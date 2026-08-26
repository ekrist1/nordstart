const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")

function loadStore() {
  const source = fs
    .readFileSync(path.join(__dirname, "..", "StoreModel.js"), "utf8")
    .replace(/^\.pragma library\s*/, "")
  const ctx = {}
  vm.createContext(ctx)
  vm.runInContext(source, ctx)
  return ctx
}

const Store = loadStore()

// Values built inside the vm realm carry that realm's prototypes, which strict
// deep-equality rejects even when the contents match. Round-trip them into this
// realm before comparing.
function plain(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value))
}

function deepEq(actual, expected, message) {
  assert.deepEqual(plain(actual), expected, message)
}

// A trimmed stand-in for omarchy-menu.jsonc, keeping the shapes that matter:
// line comments, a trailing comma, category submenus, install/remove pairs,
// an install with no remove counterpart, a non-package guard, and the
// top-level meta-installers that must never reach the store.
const MENU = `{
  // Root
  "install": {"icon":"","label":"Install"},
  "remove": {"icon":"","label":"Remove"},

  // Meta installers - not apps
  "install.package": {"icon":"","label":"Package","action":"xdg-terminal-exec omarchy-pkg-install"},
  "install.webapp": {"icon":"","label":"Web App","action":"omarchy-webapp-install"},

  // Categories
  "install.browser": {"icon":"","label":"Browser"},
  "install.editor": {"icon":"","label":"Editor"},
  "install.style": {"icon":"","label":"Style"},

  "install.browser.firefox": {"icon":"","label":"Firefox","when":"! omarchy-pkg-present firefox","action":"term 'omarchy-install-browser firefox'"},
  "remove.browser.firefox": {"icon":"","label":"Firefox","when":"omarchy-pkg-present firefox","action":"term 'omarchy-remove-browser firefox'"},
  "install.browser.zen": {"icon":"","label":"Zen","when":"! omarchy-pkg-present zen-browser-bin","action":"term 'omarchy-install-browser zen'"},
  "install.editor.vim": {"icon":"","label":"Vim","when":"! omarchy-pkg-present vim","action":"omarchy-install-app Vim vim"},
  "install.editor.ollama": {"icon":"","label":"Ollama","when":"! omarchy-cmd-present ollama","action":"omarchy-install-app Ollama \\"$ollama_pkg\\""},
  "install.style.font": {"icon":"","label":"Font","action":"omarchy-install-font x y z"},
}`

test("stripJsonc removes comments and trailing commas", () => {
  const stripped = Store.stripJsonc('{\n  // a comment\n  "a": {"b": 1},\n}')
  assert.equal(stripped.indexOf("//"), -1)
  deepEq(JSON.parse(stripped), { a: { b: 1 } })
})

test("parseMenuJsonc survives malformed input instead of throwing", () => {
  deepEq(Store.parseMenuJsonc("{ not json"), [])
  deepEq(Store.parseMenuJsonc(""), [])
  deepEq(Store.parseMenuJsonc(null), [])
  deepEq(Store.parseMenuJsonc("[1,2,3]"), [])
})

test("storeCatalog pairs install with remove and keeps unpaired installs", () => {
  const records = Store.storeCatalog(Store.parseMenuJsonc(MENU), [])
  const byKey = {}
  records.forEach((r) => (byKey[r.key] = r))

  assert.ok(byKey["browser.firefox"].removeAction, "firefox has a remove counterpart")
  assert.equal(byKey["browser.firefox"].removeWhen, "omarchy-pkg-present firefox")

  // Vim ships an installer but no remover; it must still be listed.
  assert.ok(byKey["editor.vim"], "vim is in the catalog")
  assert.equal(byKey["editor.vim"].removeAction, "")
  assert.equal(byKey["browser.zen"].removeAction, "")
})

test("storeCatalog drops meta-installers, submenus and style rows", () => {
  const records = Store.storeCatalog(Store.parseMenuJsonc(MENU), [])
  const keys = records.map((r) => r.key)

  assert.ok(!keys.includes("package"), "the fzf package picker is not an app")
  assert.ok(!keys.includes("webapp"))
  assert.ok(!keys.includes("browser"), "a category submenu is not an app")
  assert.ok(!keys.includes("style.font"), "fonts are not apps")
  assert.equal(records.length, 4)
})

test("storeCatalog carries category labels and orders by declaration", () => {
  const records = Store.storeCatalog(Store.parseMenuJsonc(MENU), [])
  assert.equal(records[0].categoryLabel, "Browser")
  assert.equal(records[0].label, "Firefox")
  assert.equal(records[1].label, "Zen")
  assert.equal(records[2].categoryLabel, "Editor")
})

test("user extensions override shipped rows by id", () => {
  const user = Store.parseMenuJsonc(
    '{"install.browser.firefox": {"icon":"X","label":"Firefox ESR","when":"! omarchy-pkg-present firefox-esr","action":"custom"}}'
  )
  const records = Store.storeCatalog(Store.parseMenuJsonc(MENU), user)
  const firefox = records.find((r) => r.key === "browser.firefox")

  assert.equal(firefox.label, "Firefox ESR")
  assert.equal(firefox.installAction, "custom")
  deepEq(firefox.packages, ["firefox-esr"])
})

test("packagesFromWhen reads package names and ignores everything else", () => {
  deepEq(Store.packagesFromWhen("! omarchy-pkg-present firefox"), ["firefox"])
  deepEq(Store.packagesFromWhen("! omarchy-pkg-present bitwarden bitwarden-cli"), ["bitwarden", "bitwarden-cli"])
  deepEq(Store.packagesFromWhen("! omarchy-cmd-present ollama"), [])
  deepEq(Store.packagesFromWhen('[[ ! -d $HOME/.rustup ]]'), [])
  // A shell variable is not a package name and must not be treated as one.
  deepEq(Store.packagesFromWhen('! omarchy-pkg-present "$ollama_pkg"'), [])
})

test("guard script emits one line per guard and round-trips through the parser", () => {
  const records = Store.storeCatalog(Store.parseMenuJsonc(MENU), [])
  const script = Store.storeGuardScript(records)

  assert.ok(script.includes("pacman -Qq"), "uses a single installed-package snapshot")
  assert.ok(script.includes("browser.firefox:i:1"))
  assert.ok(script.includes("browser.firefox:r:1"))
  assert.equal(Store.storeGuardScript([]), "")

  const guards = Store.parseStoreGuards(
    "browser.firefox:i:0\nbrowser.firefox:r:1\nbrowser.zen:i:1\ngarbage\n\n"
  )
  deepEq(guards["browser.firefox"], { installable: false, removable: true })
  deepEq(guards["browser.zen"], { installable: true })
  assert.equal(guards.garbage, undefined)
})

test("storeState reads an install guard as inverted and a remove guard as direct", () => {
  const record = { key: "a", installWhen: "x", removeWhen: "y" }

  assert.equal(Store.storeState(record, { a: { installable: true } }), "available")
  assert.equal(Store.storeState(record, { a: { installable: false } }), "installed")
  assert.equal(Store.storeState({ key: "b", removeWhen: "y" }, { b: { removable: true } }), "installed")
  assert.equal(Store.storeState({ key: "b", removeWhen: "y" }, { b: { removable: false } }), "available")
  assert.equal(Store.storeState(record, {}), "unknown")
  assert.equal(Store.storeState(null, {}), "unknown")
})

test("parsePacmanSearch handles repo and AUR line shapes", () => {
  const rows = Store.parsePacmanSearch(
    [
      "extra/ripgrep 15.2.0-1 [installed]",
      "    A search tool that combines the usability of ag with the raw speed of grep",
      "extra/ripgrep-all 0.10.10-2",
      "    rga: ripgrep, but also search in PDFs",
      "aur/zettli 1.0.1-1 (+0 0.00) [328d16h] ",
      "    A fuzzy CLI note manager with fzf + bat + ripgrep",
      "not a package line"
    ].join("\n")
  )

  assert.equal(rows.length, 3)
  deepEq(
    { repo: rows[0].repo, name: rows[0].name, version: rows[0].version, installed: rows[0].installed },
    { repo: "extra", name: "ripgrep", version: "15.2.0-1", installed: true }
  )
  assert.equal(rows[0].description, "A search tool that combines the usability of ag with the raw speed of grep")
  assert.equal(rows[1].installed, false)
  assert.equal(rows[2].repo, "aur")
  assert.equal(rows[2].name, "zettli")
  assert.equal(Store.parsePacmanSearch("").length, 0)

  // A bare prefix like "on" matches 16k lines of pacman output, so the parse
  // is bounded rather than trusting the caller to have capped the input.
  const many = Array.from({ length: 50 }, (_, i) => `extra/pkg${i} 1.0-1\n    desc ${i}`).join("\n")
  assert.equal(Store.parsePacmanSearch(many).length, 50)
  assert.equal(Store.parsePacmanSearch(many, 10).length, 10)
  assert.equal(Store.parsePacmanSearch(many, 10)[9].name, "pkg9")
})

test("storeRows sections the catalog and only searches packages on a query", () => {
  const records = Store.storeCatalog(Store.parseMenuJsonc(MENU), [])
  const pkgs = Store.parsePacmanSearch("extra/vim 9.1-1\n    Vi Improved\nextra/neovim 0.11-1\n    Fork of Vim")

  const idle = Store.storeRows(records, {}, pkgs, { updateCount: 0 })
  assert.equal(idle.packageCount, 0, "no package section without a query")
  assert.equal(idle.rows[0].kind, "header")
  assert.equal(idle.rows[0].label, "Browser")
  assert.equal(idle.appCount, 4)

  const searched = Store.storeRows(records, {}, pkgs, { query: "vim" })
  assert.equal(searched.appCount, 1, "curated Vim matches")
  // extra/vim is already curated, so only neovim survives into the package section.
  assert.equal(searched.packageCount, 1)
  const pkgRow = searched.rows.find((r) => r.kind === "package")
  assert.equal(pkgRow.name, "neovim")
  assert.equal(pkgRow.state, "available")
})

test("storeRows shows an update row only when idle and updates are pending", () => {
  const records = Store.storeCatalog(Store.parseMenuJsonc(MENU), [])

  const one = Store.storeRows(records, {}, [], { updateCount: 1 })
  assert.equal(one.rows[0].kind, "update")
  assert.equal(one.rows[0].detail, "1 update")

  assert.equal(Store.storeRows(records, {}, [], { updateCount: 7 }).rows[0].detail, "7 updates")
  assert.notEqual(Store.storeRows(records, {}, [], { updateCount: 0 }).rows[0].kind, "update")
  assert.notEqual(Store.storeRows(records, {}, [], { updateCount: 3, query: "vim" }).rows[0].kind, "update")
})

test("the cursor steps over headers and clamps at both ends", () => {
  const rows = [
    { selectable: false },
    { selectable: true },
    { selectable: true },
    { selectable: false },
    { selectable: true }
  ]

  assert.equal(Store.storeFirstSelectable(rows), 1)
  assert.equal(Store.storeSelectableCount(rows), 3)
  assert.equal(Store.storeClampCursor(rows, 0), 1, "a header snaps to the next row")
  assert.equal(Store.storeClampCursor(rows, 3), 4)
  assert.equal(Store.storeClampCursor(rows, 99), 4)

  assert.equal(Store.storeMoveCursor(rows, 2, 1), 4, "skips the header at 3")
  assert.equal(Store.storeMoveCursor(rows, 4, 1), 4, "clamps at the end")
  assert.equal(Store.storeMoveCursor(rows, 1, -1), 1, "clamps at the start")
  assert.equal(Store.storeMoveCursor(rows, 4, -1), 2)
  assert.equal(Store.storeMoveCursor([], 0, 1), 0)
})

test("isSafePackageName rejects anything that could escape a shell string", () => {
  assert.ok(Store.isSafePackageName("ripgrep"))
  assert.ok(Store.isSafePackageName("visual-studio-code-bin"))
  assert.ok(Store.isSafePackageName("gtk+"))
  assert.ok(Store.isSafePackageName("lib32-glibc"))

  assert.ok(!Store.isSafePackageName("foo; rm -rf /"))
  assert.ok(!Store.isSafePackageName("$(id)"))
  assert.ok(!Store.isSafePackageName("a b"))
  assert.ok(!Store.isSafePackageName("'quoted'"))
  assert.ok(!Store.isSafePackageName("-leading-dash"))
  assert.ok(!Store.isSafePackageName(""))
})

test("storeCommand passes catalog actions through and builds argv for packages", () => {
  const records = Store.storeCatalog(Store.parseMenuJsonc(MENU), [])
  const rows = Store.storeRows(records, {}, [], {}).rows
  const firefox = rows.find((r) => r.key === "browser.firefox")
  const vim = rows.find((r) => r.key === "editor.vim")

  // Curated actions are trusted strings straight out of the menu file.
  deepEq(Store.storeCommand(firefox, "install"), {
    mode: "shell",
    command: "term 'omarchy-install-browser firefox'"
  })
  deepEq(Store.storeCommand(firefox, "uninstall"), {
    mode: "shell",
    command: "term 'omarchy-remove-browser firefox'"
  })
  assert.equal(Store.storeCommand(vim, "uninstall"), null, "no remover means no uninstall command")

  // Package rows are built by us, so they go out as argv, not a shell string.
  const repo = { kind: "package", name: "neovim", repo: "extra", state: "available" }
  deepEq(Store.storeCommand(repo, "install"), {
    mode: "argv",
    argv: ["omarchy-launch-floating-terminal-with-presentation", "echo Installing neovim...; omarchy-pkg-add neovim"]
  })

  const aur = { kind: "package", name: "zettli", repo: "aur", state: "available" }
  assert.ok(Store.storeCommand(aur, "install").argv[1].includes("omarchy-pkg-aur-add zettli"))

  deepEq(Store.storeCommand({ kind: "package", name: "neovim", repo: "extra" }, "uninstall"), {
    mode: "argv",
    argv: ["omarchy-launch-floating-terminal-with-presentation", "omarchy-pkg-drop neovim"]
  })

  assert.equal(Store.storeCommand({ kind: "package", name: "foo; reboot", repo: "extra" }, "install"), null)
  assert.equal(Store.storeCommand(null, "install"), null)
})

test("storeCommand builds the system update row and uninstall is gated on state", () => {
  deepEq(Store.storeCommand({ kind: "update" }), {
    mode: "shell",
    command: "omarchy-launch-floating-terminal-with-presentation omarchy-update"
  })

  const installed = { kind: "app", state: "installed", record: { removeAction: "term remove" } }
  const available = { kind: "app", state: "available", record: { removeAction: "term remove" } }
  const unremovable = { kind: "app", state: "installed", record: { removeAction: "" } }

  assert.ok(Store.storeCanUninstall(installed))
  assert.ok(!Store.storeCanUninstall(available), "cannot uninstall what is not installed")
  assert.ok(!Store.storeCanUninstall(unremovable))
  assert.ok(!Store.storeCanUninstall({ kind: "header" }))
  assert.ok(Store.storeCanUninstall({ kind: "package", name: "neovim", state: "installed" }))

  assert.equal(Store.storePrompt({ label: "Firefox" }), "uninstall Firefox?")
  assert.equal(Store.storeConfirmText({}), "Uninstall")
})

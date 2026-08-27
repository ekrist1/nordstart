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

// A trimmed omarchy-plugin-catalog payload: one first-party plugin (which must
// never be listed, since it updates with Omarchy itself) and two third-party.
const PLUGIN_CATALOG = JSON.stringify([
  { id: "omarchy.clock", name: "Clock", description: "", firstParty: true, sourceDir: "/usr/share/omarchy/shell/plugins/clock" },
  { id: "mirador", name: "Mirador", description: "Workspace overview", firstParty: false, sourceDir: "/home/e/.config/omarchy/plugins/mirador" },
  { id: "io.github.ekrist1.nordstart", name: "Nordstart", description: "Launcher", firstParty: false, sourceDir: "/home/e/.config/omarchy/plugins/io.github.ekrist1.nordstart" }
])

test("parsePluginCatalog keeps third-party plugins and sorts them by name", () => {
  const records = Store.parsePluginCatalog(PLUGIN_CATALOG)
  assert.equal(records.length, 2, "the first-party plugin is dropped")
  assert.equal(records[0].name, "Mirador")
  assert.equal(records[1].name, "Nordstart")
  assert.equal(records[0].dir, "/home/e/.config/omarchy/plugins/mirador")

  assert.equal(Store.parsePluginCatalog("not json").length, 0)
  assert.equal(Store.parsePluginCatalog("{}").length, 0)
  assert.equal(Store.parsePluginCatalog("").length, 0)

  // An entry with no install directory cannot be checked, so it is not listed.
  assert.equal(Store.parsePluginCatalog('[{"id":"x","firstParty":false}]').length, 0)
})

test("isSafePluginId matches omarchy-plugin-update's own rule", () => {
  assert.ok(Store.isSafePluginId("mirador"))
  assert.ok(Store.isSafePluginId("io.github.ekrist1.nordstart"))
  assert.ok(Store.isSafePluginId("a-b_c.1"))

  assert.ok(!Store.isSafePluginId("../../etc/passwd"))
  assert.ok(!Store.isSafePluginId("a..b"))
  assert.ok(!Store.isSafePluginId("foo; reboot"))
  assert.ok(!Store.isSafePluginId("two words"))
  assert.ok(!Store.isSafePluginId("-leading"))
  assert.ok(!Store.isSafePluginId(""))
})

test("pluginCheckScript batches every plugin into one run and cannot be prompted", () => {
  const records = Store.parsePluginCatalog(PLUGIN_CATALOG)
  const script = Store.pluginCheckScript(records, "/home/e/.cache/nordstart/plugin-updates.tsv")

  // Both batch-mode guards, lifted from omarchy-plugin-update: without them a
  // repo needing credentials blocks the check on a hidden password prompt.
  assert.ok(script.includes("GIT_TERMINAL_PROMPT=0"))
  assert.ok(script.includes("BatchMode=yes"))

  assert.ok(script.includes("__nordstart_check 'mirador'"))
  assert.ok(script.includes("__nordstart_check 'io.github.ekrist1.nordstart'"))
  assert.ok(!script.includes("omarchy.clock"), "first-party plugins are not checked")
  assert.ok(script.includes("wait"), "fetches run concurrently")
  assert.ok(script.includes("tee '/home/e/.cache/nordstart/plugin-updates.tsv'"))
  assert.ok(script.includes("mkdir -p '/home/e/.cache/nordstart'"))

  assert.equal(Store.pluginCheckScript([], "/tmp/x"), "", "nothing to check, nothing to run")

  // A directory with a space still has to survive into the script intact.
  const spaced = Store.pluginCheckScript([{ id: "ok", dir: "/home/e/my plugins/ok" }], "/tmp/x")
  assert.ok(spaced.includes("'/home/e/my plugins/ok'"))
})

test("parsePluginStatus reads the TSV and ignores anything malformed", () => {
  const status = Store.parsePluginStatus(
    [
      "mirador\tbehind\t3\thttps://github.com/sanjyay/Mirador.git",
      "io.github.ekrist1.nordstart\tlocal\t0\t",
      "weather\tok\t0\thttps://example.com/w.git",
      "broken\terror\t0\t",
      "nonsense",
      "bad\tnotastate\t0\t",
      ""
    ].join("\n")
  )

  deepEq(status.mirador, { state: "behind", behind: 3, remote: "https://github.com/sanjyay/Mirador.git" })
  assert.equal(status["io.github.ekrist1.nordstart"].state, "local")
  assert.equal(status.weather.state, "ok")
  assert.equal(status.broken.state, "error")
  assert.equal(status.nonsense, undefined)
  assert.equal(status.bad, undefined, "an unknown state is not trusted")

  assert.equal(Store.pluginsBehind(status), 1)
  assert.equal(Store.pluginsBehind({}), 0)
  assert.equal(Store.pluginsBehind(null), 0)
})

test("pluginRows explains every state, including one never checked", () => {
  const records = Store.parsePluginCatalog(PLUGIN_CATALOG)
  const status = Store.parsePluginStatus("mirador\tbehind\t1\thttps://x\nio.github.ekrist1.nordstart\tlocal\t0\t")
  const rows = Store.pluginRows(records, status)

  assert.equal(rows[0].detail, "update · 1 commit", "singular")
  assert.equal(rows[1].detail, "local checkout")
  assert.equal(Store.pluginRows(records, {})[0].detail, "not checked yet")

  const many = Store.parsePluginStatus("mirador\tbehind\t4\thttps://x")
  assert.equal(Store.pluginRows(records, many)[0].detail, "update · 4 commits")

  // Every row is selectable so the cursor can rest on it and read why; it is
  // pluginCommand that refuses to act.
  assert.ok(rows.every((r) => r.selectable))
})

test("pluginCommand only acts on a repo that has actually moved", () => {
  const behind = { kind: "plugin", pluginId: "mirador", state: "behind" }
  const cmd = Store.storeCommand(behind)

  assert.equal(cmd.mode, "argv", "assembled by us, so it goes out as argv")
  assert.equal(cmd.argv[0], "omarchy-launch-floating-terminal-with-presentation")
  // The restart is the point: omarchy-plugin-update ends in rescanPlugins,
  // which leaves the QML engine on its cached compilation.
  assert.equal(cmd.argv[1], "omarchy-plugin-update mirador && omarchy-restart-shell")

  assert.equal(Store.storeCommand({ kind: "plugin", pluginId: "mirador", state: "ok" }), null)
  assert.equal(Store.storeCommand({ kind: "plugin", pluginId: "mirador", state: "local" }), null)
  assert.equal(Store.storeCommand({ kind: "plugin", pluginId: "mirador", state: "error" }), null)
  assert.equal(Store.storeCommand({ kind: "plugin", pluginId: "../evil", state: "behind" }), null)

  assert.ok(!Store.storeCanUninstall(behind), "x never removes a plugin")
})

test("storeRows puts plugins in their own section and filters them by query", () => {
  const records = Store.storeCatalog(Store.parseMenuJsonc(MENU), [])
  const plugins = Store.pluginRows(
    Store.parsePluginCatalog(PLUGIN_CATALOG),
    Store.parsePluginStatus("mirador\tbehind\t2\thttps://x")
  )

  const idle = Store.storeRows(records, {}, [], { plugins: plugins })
  assert.equal(idle.pluginCount, 2)
  assert.equal(idle.rows[0].kind, "header")
  assert.equal(idle.rows[0].label, "Plugins", "plugins lead, above the app categories")
  assert.equal(idle.rows[1].kind, "plugin")

  const searched = Store.storeRows(records, {}, [], { plugins: plugins, query: "mirador" })
  assert.equal(searched.pluginCount, 1)
  assert.equal(searched.appCount, 0)

  const missed = Store.storeRows(records, {}, [], { plugins: plugins, query: "firefox" })
  assert.equal(missed.pluginCount, 0, "no plugin header when nothing matches")
  assert.ok(!missed.rows.some((r) => r.key === "hdr:plugins"))

  // With no plugins the store list is exactly what it was before.
  assert.equal(Store.storeRows(records, {}, [], {}).pluginCount, 0)
})

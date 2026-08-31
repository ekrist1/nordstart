const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")

function loadModel() {
  const source = fs
    .readFileSync(path.join(__dirname, "..", "NordstartModel.js"), "utf8")
    .replace(/^\.pragma library\s*/, "")
  const ctx = {}
  vm.createContext(ctx)
  vm.runInContext(source, ctx)
  return ctx
}

const Model = loadModel()

function toplevel(cls, title, extra) {
  extra = extra || {}
  return {
    title: title || "",
    lastIpcObject: { class: cls, title: title || "" },
    wayland: { appId: cls },
    activated: extra.activated === true,
    address: extra.address || "",
    workspace: extra.workspace || null
  }
}

function workspace(id, windows) {
  return { id: id, toplevels: { values: windows || [] } }
}

test("Nautilus is labeled Files", () => {
  assert.equal(Model.prettyClass("org.gnome.Nautilus"), "Files")
  assert.equal(Model.prettyClass("Nautilus"), "Files")
  assert.equal(Model.shortAppName("Nautilus File Manager", "org.gnome.Nautilus"), "Files")
})

test("common linux apps have friendly names", () => {
  assert.equal(Model.prettyClass("Alacritty"), "Terminal")
  assert.equal(Model.prettyClass("firefox"), "Firefox")
  assert.equal(Model.prettyClass("org.telegram.desktop"), "Telegram")
  assert.equal(Model.prettyClass("com.spotify.Client"), "Spotify")
  assert.equal(Model.prettyClass("google-chrome-stable"), "Chrome")
  assert.equal(Model.prettyClass("org.gnome.Settings"), "Settings")
  assert.equal(Model.prettyClass("thunar"), "Files")
})

test("user appNames override built-in labels", () => {
  const names = Model.parseNameMap("org.gnome.Nautilus=Explorer,firefox=Web")
  assert.equal(Model.prettyClass("org.gnome.Nautilus", names), "Explorer")
  assert.equal(Model.prettyClass("firefox", names), "Web")
  assert.equal(Model.prettyClass("Alacritty", names), "Terminal")
})

test("parseNameMap accepts JSON objects and strings", () => {
  assert.equal(Model.parseNameMap({ "org.gnome.Nautilus": "Files" })["org.gnome.nautilus"], "Files")
  assert.equal(Model.parseNameMap('{"firefox":"Web"}').firefox, "Web")
  assert.equal(Model.parseNameMap("").firefox, undefined)
})

test("user appAliases join built-in desktop id aliases", () => {
  const aliases = Model.parseAliasMap("chat=discord|vesktop,files=org.gnome.Nautilus")
  const files = Model.aliasCandidates("files", aliases)
  assert.ok(files.includes("org.gnome.Nautilus"))
  assert.ok(files.includes("nautilus"))
  const chat = Model.aliasCandidates("chat", aliases)
  assert.ok(chat.includes("discord"))
  assert.ok(chat.includes("vesktop"))
})

test("workspace presentation uses Files and terminal subtitles", () => {
  const empty = Model.workspacePresentation(workspace(8, []), null)
  assert.equal(empty.name, "empty")
  assert.equal(empty.occupied, false)

  const files = Model.workspacePresentation(
    workspace(9, [toplevel("org.gnome.Nautilus", "navbarapp")]),
    null
  )
  assert.equal(files.name, "Files")
  assert.equal(files.subtitle, "")

  const term = Model.workspacePresentation(
    workspace(1, [toplevel("Alacritty", "espen@omarchy:~/devoma/navbarapp")]),
    null
  )
  assert.equal(term.name, "Terminal")
  assert.equal(term.subtitle, "devoma/navbarapp")
})

test("user names apply to workspace presentation", () => {
  const shown = Model.workspacePresentation(
    workspace(2, [toplevel("firefox", "Mozilla Firefox")]),
    null,
    "firefox=Web"
  )
  assert.equal(shown.name, "Web")
})

test("pinned apps resolve files aliases and running state", () => {
  const running = {
    values: [
      workspace(2, [toplevel("firefox", "Home", { address: "0x1", workspace: { id: 2 } })])
    ]
  }
  const entries = {
    byId: function(id) {
      if (id === "firefox" || id === "firefox.desktop") return { id: "firefox", name: "Firefox", icon: "firefox" }
      return null
    },
    heuristicLookup: function() { return null }
  }
  const pinned = Model.pinnedApps("firefox,missing-app", entries, running)
  assert.equal(pinned.length, 1)
  assert.equal(pinned[0].name, "Firefox")
  assert.equal(pinned[0].running, true)
  assert.equal(pinned[0].workspaceId, 2)
})

test("cursor movement wraps between workspaces and pinned apps", () => {
  const right = Model.moveCursor("workspaces", 3, 0, 1, 0, 9, 4)
  assert.equal(right.section, "pinned")
  const left = Model.moveCursor("pinned", 3, 1, -1, 0, 9, 4)
  assert.equal(left.section, "workspaces")
  const down = Model.moveCursor("workspaces", 1, 0, 0, 1, 9, 0)
  assert.equal(down.workspaceId, 4)
})

test("first empty workspace and clamp", () => {
  assert.equal(Model.clampWorkspaceCount(99), 9)
  assert.equal(Model.clampWorkspaceCount(0), 9)
  const spaces = { values: [workspace(1, [toplevel("firefox", "x")]), workspace(2, [])] }
  assert.equal(Model.firstEmptyWorkspace(9, spaces), 2)
})

test("catalogRecords uses friendly names and skips duplicates", () => {
  const rows = [
    { entry: { id: "org.gnome.Nautilus.desktop", name: "Nautilus", icon: "org.gnome.Nautilus" } },
    { entry: { id: "org.gnome.Nautilus", name: "Files" } },
    { id: "firefox", name: "Firefox Web Browser", icon: "firefox" }
  ]
  const apps = Model.catalogRecords(rows)
  assert.equal(apps.length, 2)
  assert.equal(apps[0].name, "Files")
  assert.equal(apps[0].id, "org.gnome.Nautilus")
  assert.equal(apps[0].pinned, false)
  assert.equal(apps[1].name, "Firefox")
})

test("parsePinnedSetting treats missing and blank as defaults", () => {
  const defaults = Model.parsePinnedSetting(null)
  assert.ok(defaults.includes("firefox"))
  assert.equal(Model.parsePinnedSetting("").length, defaults.length)
  assert.equal(Model.parsePinnedSetting("none").length, 0)
  assert.equal(Model.parsePinnedSetting([]).length, 0)
  const parsed = Model.parsePinnedSetting("a, b")
  assert.equal(parsed.length, 2)
  assert.equal(parsed[0], "a")
  assert.equal(parsed[1], "b")
})

test("togglePinnedSetting pins and unpins, including aliases", () => {
  const added = Model.togglePinnedSetting("firefox,code", "org.gnome.Nautilus")
  assert.equal(added.pinned, true)
  assert.equal(added.setting, "firefox,code,org.gnome.Nautilus")

  const removed = Model.togglePinnedSetting("firefox,code", "firefox")
  assert.equal(removed.pinned, false)
  assert.equal(removed.setting, "code")

  const aliasOff = Model.togglePinnedSetting("firefox,code", "org.mozilla.firefox")
  assert.equal(aliasOff.pinned, false)
  assert.equal(aliasOff.setting, "code")

  const files = Model.togglePinnedSetting("files", "org.gnome.Nautilus")
  assert.equal(files.pinned, false)
  assert.equal(files.setting, "none")

  const fromEmpty = Model.togglePinnedSetting("none", "kitty")
  assert.equal(fromEmpty.pinned, true)
  assert.equal(fromEmpty.setting, "kitty")
})

test("unpinning code-insiders does not drop a code pin", () => {
  assert.equal(Model.pinnedIdMatches("code-insiders", "code"), false)
  assert.equal(Model.isPinnedApp("code-insiders", "code"), false)
  const added = Model.togglePinnedSetting("code,firefox", "code-insiders")
  assert.equal(added.pinned, true)
  assert.equal(added.setting, "code,firefox,code-insiders")
  const removed = Model.togglePinnedSetting("code,code-insiders", "code-insiders")
  assert.equal(removed.pinned, false)
  assert.equal(removed.setting, "code")
})

test("catalogRecords marks pinned apps from the setting", () => {
  const rows = [
    { id: "firefox", name: "Firefox Web Browser" },
    { id: "kitty", name: "Kitty" }
  ]
  const apps = Model.catalogRecords(rows, null, "firefox,code")
  assert.equal(apps[0].pinned, true)
  assert.equal(apps[1].pinned, false)
  assert.equal(Model.isPinnedApp("org.gnome.Nautilus", "files"), true)
})

test("catalogRecords keeps distinct ids that only differ by punctuation", () => {
  const rows = [
    { id: "foo.bar", name: "Foo Bar" },
    { id: "foo-bar", name: "Foo-Bar" }
  ]
  const apps = Model.catalogRecords(rows)
  assert.equal(apps.length, 2)
  assert.equal(apps[0].id, "foo.bar")
  assert.equal(apps[1].id, "foo-bar")
})

test("app list cursor clamps and session commands map", () => {
  assert.equal(Model.moveAppCursor(0, -1, 10), 0)
  assert.equal(Model.moveAppCursor(3, 2, 10), 5)
  assert.equal(Model.moveAppCursor(9, 1, 10), 9)
  assert.equal(Model.moveAppCursor(0, 1, 0), 0)
  assert.equal(Model.sessionCommand("shutdown"), "omarchy-system-shutdown")
  assert.equal(Model.sessionPrompt("shutdown"), "power off?")
  assert.equal(Model.sessionConfirmText("shutdown"), "Power off")
  assert.equal(Model.sessionNeedsConfirm("reboot"), true)
  assert.equal(Model.sessionNeedsConfirm("logout"), false)
})

test("companion catalog labels, keys, and install commands", () => {
  const missing = {}
  const themeReady = { themeCli: true, themeDir: true }
  const themePartial = { themeDir: true }
  const settingsReady = { settingsInstalled: true, settingsOnBar: true }
  const settingsInstalled = { settingsInstalled: true }

  assert.equal(Model.companionSettingsId(), "io.github.ekrist1.nordsettings")
  assert.equal(Model.companionThemeMenu(), "style.nordtema")
  assert.equal(Model.companionKey("theme"), "t")
  assert.equal(Model.companionKey("settings"), "c")
  assert.equal(Model.companionForKey("t"), "theme")
  assert.equal(Model.companionForKey("C"), "settings")
  assert.equal(Model.companionForKey("x"), "")

  assert.equal(Model.companionLabel("theme", missing), "Install theme")
  assert.equal(Model.companionLabel("theme", themeReady), "Theme")
  assert.equal(Model.companionLabel("theme", themePartial), "Theme")
  assert.equal(Model.companionLabel("settings", missing), "Install Hyprland")
  assert.equal(Model.companionLabel("settings", settingsInstalled), "Hyprland")

  assert.equal(Model.companionReady("theme", missing), false)
  assert.equal(Model.companionReady("theme", themePartial), false)
  assert.equal(Model.companionReady("theme", themeReady), true)
  assert.equal(Model.companionReady("settings", settingsInstalled), false)
  assert.equal(Model.companionReady("settings", settingsReady), true)

  assert.equal(Model.companionKnown("theme", themePartial), true)
  assert.equal(Model.companionKnown("settings", missing), false)

  assert.equal(Model.companionPrompt("theme").indexOf("Nordtema") >= 0, true)
  assert.equal(Model.companionConfirmText("theme"), "Install")
  assert.equal(Model.companionInstallCommand("nope"), null)

  const themeInstall = Model.companionInstallCommand("theme", missing)
  assert.equal(themeInstall.mode, "argv")
  assert.equal(themeInstall.argv[0], "omarchy-launch-floating-terminal-with-presentation")
  assert.equal(
    themeInstall.argv[1],
    "omarchy theme install https://github.com/ekrist1/nordtema && bash \"$HOME/.config/omarchy/themes/nordtema/install.sh\""
  )
  assert.equal(Model.companionInstallCommand("theme", themeReady), null)

  const finishTheme = Model.companionInstallCommand("theme", themePartial)
  assert.equal(finishTheme.argv[1], "bash \"$HOME/.config/omarchy/themes/nordtema/install.sh\"")

  const settingsInstall = Model.companionInstallCommand("settings", missing)
  assert.equal(settingsInstall.mode, "argv")
  assert.equal(
    settingsInstall.argv[1],
    "omarchy plugin add https://github.com/ekrist1/nordsettings.git --enable --yes"
  )
  assert.equal(Model.companionInstallCommand("settings", settingsInstalled), null)
})

test("findRunningToplevels returns every window of an app, workspace-ordered", () => {
  const a = toplevel("ghostty", "one", { address: "0xA" })
  const b = toplevel("ghostty", "two", { address: "0xB" })
  const c = toplevel("ghostty", "three", { address: "0xC" })
  const other = toplevel("firefox", "web", { address: "0xF" })
  const spaces = { values: [workspace(5, [c, other]), workspace(2, [a, b])] }
  a.workspace = { id: 2 }
  b.workspace = { id: 2 }
  c.workspace = { id: 5 }

  const found = Model.findRunningToplevels("ghostty", null, spaces, {})
  assert.equal(found.length, 3)
  // Joined into a string on purpose: an array built inside the vm realm
  // carries that realm's prototype, which strict deep-equality rejects.
  assert.equal(found.map((t) => t.address).join(","), "0xA,0xB,0xC")

  assert.equal(Model.findRunningToplevels("inkscape", null, spaces, {}).length, 0)
})

test("nextToplevel cycles from the focused window and wraps", () => {
  const mk = (addr, activated) => ({ address: addr, activated: !!activated })
  const tops = [mk("0xA"), mk("0xB"), mk("0xC")]

  // Nothing focused and nothing remembered: start at the first.
  assert.equal(Model.nextToplevel(tops, "").address, "0xA")
  // Remembered but unfocused: advance from there.
  assert.equal(Model.nextToplevel(tops, "0xA").address, "0xB")
  assert.equal(Model.nextToplevel(tops, "0xC").address, "0xA", "wraps")
  // A focused window wins over the remembered one.
  const focused = [mk("0xA"), mk("0xB", true), mk("0xC")]
  assert.equal(Model.nextToplevel(focused, "0xA").address, "0xC")

  // A single window always resolves to itself, focused or not.
  assert.equal(Model.nextToplevel([mk("0xA")], "0xA").address, "0xA")
  assert.equal(Model.nextToplevel([mk("0xA", true)], "").address, "0xA")
  assert.equal(Model.nextToplevel([], "0xA"), null)
  assert.equal(Model.nextToplevel(null, ""), null)
})

test("launchWorkspaceId stays put unless the empty-workspace mode is set", () => {
  const spaces = { values: [workspace(1, [toplevel("foo", "x")]), workspace(2, [])] }

  assert.equal(Model.parseLaunchWorkspace(""), "current")
  assert.equal(Model.parseLaunchWorkspace(null), "current")
  assert.equal(Model.parseLaunchWorkspace("Current workspace"), "current")
  assert.equal(Model.parseLaunchWorkspace("empty"), "empty")
  assert.equal(Model.parseLaunchWorkspace("First empty workspace"), "empty")

  // 0 means "launch right here".
  assert.equal(Model.launchWorkspaceId("current", 9, spaces), 0)
  assert.equal(Model.launchWorkspaceId("", 9, spaces), 0)
  assert.equal(Model.launchWorkspaceId("First empty workspace", 9, spaces), 2)
})

test("catalogRecords annotates running state from a prebuilt window index", () => {
  const term = toplevel("Alacritty", "shell", { address: "0xA", activated: true })
  const term2 = toplevel("Alacritty", "logs", { address: "0xB" })
  const chrome = toplevel("chromium", "web", { address: "0xC" })
  term.workspace = { id: 2 }
  term2.workspace = { id: 2 }
  chrome.workspace = { id: 5 }
  const spaces = { values: [workspace(2, [term, term2]), workspace(5, [chrome])] }

  const index = Model.toplevelIndex(spaces)
  assert.equal(index.length, 3)

  const rows = [
    { entry: { id: "Alacritty", name: "Alacritty" } },
    { entry: { id: "chromium", name: "Chromium" } },
    { entry: { id: "inkscape", name: "Inkscape" } }
  ]
  const records = Model.catalogRecords(rows, "", undefined, {}, index)

  assert.equal(records[0].running, true)
  assert.equal(records[0].workspaceId, 2)
  assert.equal(records[0].windows, 2, "both terminals counted")
  assert.equal(records[1].running, true)
  assert.equal(records[1].workspaceId, 5)
  assert.equal(records[2].running, false)
  assert.equal(records[2].workspaceId, 0)

  // Without an index the extra fields stay inert, so installedAppCount and any
  // other caller that omits it pays nothing.
  const plain = Model.catalogRecords(rows, "")
  assert.equal(plain[0].running, false)
  assert.equal(plain[0].windows, 0)
})

test("runningStateFor prefers the focused window for the workspace it reports", () => {
  const index = [
    { cls: "Alacritty", workspaceId: 2, address: "0xA", activated: false },
    { cls: "Alacritty", workspaceId: 7, address: "0xB", activated: true }
  ]
  const state = Model.runningStateFor("Alacritty", null, index, {})
  assert.equal(state.running, true)
  assert.equal(state.windows, 2)
  assert.equal(state.workspaceId, 7, "reports where Enter would actually land")

  assert.equal(Model.runningStateFor("Alacritty", null, [], {}).running, false)
  assert.equal(Model.runningStateFor("gimp", null, index, {}).running, false)
})

test("catalogHint describes the action and names the live new-instance key", () => {
  const running = { running: true, workspaceId: 3 }
  const idle = { running: false, workspaceId: 0 }

  assert.equal(Model.catalogHint(running, false), "↵ go to 3 · n new")
  assert.equal(Model.catalogHint(idle, false), "↵ open · n new")
  // The search field types a plain n, so it advertises Ctrl+N instead.
  assert.equal(Model.catalogHint(running, true), "↵ go to 3 · ^n new")
  assert.equal(Model.catalogHint(null, false), "")
})

const DAY = 86400
const NOW = 1756300000

test("parseUsage reads the compact form, JSON, and shrugs off junk", () => {
  const usage = Model.parseUsage("firefox:12:1756200000,code:3:1756100000")
  assert.equal(usage.firefox.count, 12)
  assert.equal(usage.firefox.last, 1756200000)
  assert.equal(usage.code.count, 3)

  // A .desktop suffix and casing must land on the same key the launcher uses.
  assert.equal(Model.parseUsage("Firefox.desktop:4:100").firefox.count, 4)

  const fromJson = Model.parseUsage('{"firefox":{"count":2,"last":50}}')
  assert.equal(fromJson.firefox.count, 2)

  assert.equal(Object.keys(Model.parseUsage("")).length, 0)
  assert.equal(Object.keys(Model.parseUsage(null)).length, 0)
  assert.equal(Object.keys(Model.parseUsage("garbage")).length, 0)
  assert.equal(Object.keys(Model.parseUsage("firefox:0:100")).length, 0, "a zero count is not usage")
})

test("frecencyScore decays a stale count below a fresh one", () => {
  assert.equal(Model.frecencyScore({ count: 5, last: NOW }, NOW), 5, "today, no decay")
  // Two-week half-life.
  assert.equal(Model.frecencyScore({ count: 8, last: NOW - 14 * DAY }, NOW), 4)
  assert.equal(Model.frecencyScore({ count: 8, last: NOW - 28 * DAY }, NOW), 2)

  const stale = Model.frecencyScore({ count: 40, last: NOW - 180 * DAY }, NOW)
  const fresh = Model.frecencyScore({ count: 3, last: NOW }, NOW)
  assert.ok(fresh > stale, "three launches today beat forty from six months ago")

  assert.equal(Model.frecencyScore(null, NOW), 0)
  assert.equal(Model.frecencyScore({ count: 0, last: NOW }, NOW), 0)
})

test("recordLaunch increments without mutating what it was given", () => {
  const before = Model.parseUsage("firefox:2:100")
  const after = Model.recordLaunch(before, "firefox", NOW)

  assert.equal(after.firefox.count, 3)
  assert.equal(after.firefox.last, NOW)
  assert.equal(before.firefox.count, 2, "the original object is untouched")
  assert.notEqual(before, after, "a new object, so QML re-evaluates the binding")

  assert.equal(Model.recordLaunch({}, "org.gnome.Nautilus.desktop", NOW)["org.gnome.nautilus"].count, 1)
  assert.equal(Object.keys(Model.recordLaunch({}, "", NOW)).length, 0)
})

test("formatUsage round-trips and caps how much lands in shell.json", () => {
  const usage = Model.parseUsage("firefox:12:" + NOW + ",code:3:" + NOW)
  const text = Model.formatUsage(usage, NOW)
  assert.equal(text, "firefox:12:" + NOW + ",code:3:" + NOW, "most-used first")
  assert.equal(Model.parseUsage(text).firefox.count, 12, "round-trips")

  const many = {}
  for (let i = 0; i < 200; i++) many["app" + i] = { count: i + 1, last: NOW }
  const capped = Model.formatUsage(many, NOW).split(",")
  assert.equal(capped.length, 60, "capped so shell.json cannot grow without bound")
  assert.ok(capped[0].startsWith("app199:"), "the busiest survive the cap")
})

test("rankAppRows puts most-used first, but never outranks a better text match", () => {
  const rows = [
    { entry: { id: "alacritty" }, score: 0 },
    { entry: { id: "brave" }, score: 0 },
    { entry: { id: "code" }, score: 0 }
  ]
  const usage = Model.parseUsage("code:20:" + NOW + ",brave:5:" + NOW)

  const idle = Model.rankAppRows(rows, usage, NOW, "")
  assert.equal(idle.map((r) => r.entry.id).join(","), "code,brave,alacritty")

  // With no usage at all the incoming (alphabetical) order is preserved.
  assert.equal(Model.rankAppRows(rows, {}, NOW, "").map((r) => r.entry.id).join(","), "alacritty,brave,code")

  // A prefix hit (10000) must stay ahead of a keyword hit (6000) no matter how
  // heavily the weaker match is used.
  const scored = [
    { entry: { id: "abc-viewer" }, score: 6000 },
    { entry: { id: "abacus" }, score: 10000 }
  ]
  const heavy = Model.parseUsage("abc-viewer:500:" + NOW)
  assert.equal(Model.rankAppRows(scored, heavy, NOW, "ab")[0].entry.id, "abacus")

  // Within one band, usage decides.
  const tied = [{ entry: { id: "x1" }, score: 8000 }, { entry: { id: "x2" }, score: 8000 }]
  assert.equal(Model.rankAppRows(tied, Model.parseUsage("x2:9:" + NOW), NOW, "x")[0].entry.id, "x2")

  assert.equal(Model.rankAppRows(null, {}, NOW, "").length, 0)
})

// ------------------------------------------------------------------ windows

// A toplevel as Quickshell hands it over: the interesting fields live on
// lastIpcObject, which is the raw `hyprctl clients` record.
function win(cls, title, opts) {
  opts = opts || {}
  return {
    title: title || "",
    address: opts.address || ("0x" + cls),
    activated: opts.activated === true,
    workspace: opts.workspace || null,
    lastIpcObject: {
      class: cls,
      title: title || "",
      address: opts.address || ("0x" + cls),
      focusHistoryID: opts.focus,
      floating: opts.floating === true,
      pinned: opts.pinned === true,
      workspace: opts.ws || { id: opts.wsId || 1, name: String(opts.wsId || 1) }
    }
  }
}

const winEntries = {
  byId: function(id) {
    if (id === "firefox" || id === "firefox.desktop") return { id: "firefox", name: "Firefox", icon: "firefox" }
    if (id === "code" || id === "code.desktop") return { id: "code", name: "Visual Studio Code", icon: "code" }
    return null
  },
  heuristicLookup: function() { return null }
}

test("focus rank reads focusHistoryID, and treats 0 as most recent", () => {
  assert.equal(Model.toplevelFocusRank(win("firefox", "a", { focus: 0 })), 0)
  assert.equal(Model.toplevelFocusRank(win("firefox", "a", { focus: 4 })), 4)
  // No history at all must sort last, not first.
  assert.ok(Model.toplevelFocusRank(win("firefox", "a", {})) > 1000)
  assert.ok(Model.toplevelFocusRank(null) > 1000)
})

test("windowRows orders by MRU and labels the workspace", () => {
  const tops = [
    win("code", "one.qml", { focus: 3, wsId: 1, address: "0xa" }),
    win("firefox", "Home", { focus: 0, wsId: 2, address: "0xb" }),
    win("code", "two.qml", { focus: 2, wsId: 1, address: "0xc" })
  ]
  const rows = Model.rankWindowRows(Model.windowRows(tops, winEntries, null, null, null), "")
  assert.equal(rows.map(function(r) { return r.address }).join(","), "0xb,0xc,0xa")
  assert.equal(rows[0].appName, "Firefox")
  assert.equal(rows[0].workspaceLabel, "2")
})

test("windowRows labels a workspace by its user-given name", () => {
  const tops = [win("firefox", "Home", { focus: 0, wsId: 2 })]
  const rows = Model.windowRows(tops, winEntries, null, "1=code,2=web", null)
  assert.equal(rows[0].workspaceLabel, "web")
})

test("windowRows trusts the ipc workspace over the quickshell one", () => {
  const top = win("firefox", "Home", { focus: 0, wsId: 7 })
  top.workspace = { id: 1, name: "1" }
  const rows = Model.windowRows([top], winEntries, null, null, null)
  assert.equal(rows[0].workspaceId, 7)
})

test("windowMruRanks freezes the order it was captured with", () => {
  const tops = [
    win("code", "one", { focus: 1, address: "0xa" }),
    win("firefox", "Home", { focus: 0, address: "0xb" })
  ]
  const ranks = Model.windowMruRanks(tops)
  // Hyprland refocuses while the view is open; the frozen ranks must win, or
  // the list reshuffles under the cursor.
  tops[0].lastIpcObject.focusHistoryID = 0
  tops[1].lastIpcObject.focusHistoryID = 1
  const rows = Model.rankWindowRows(Model.windowRows(tops, winEntries, null, null, ranks), "")
  assert.equal(rows.map(function(r) { return r.address }).join(","), "0xb,0xa")
})

test("matchesWindowQuery ANDs its terms across title, app and class", () => {
  const row = Model.windowRows([win("code", "SettingsBackend.qml", { focus: 0, wsId: 3 })], winEntries, null, null, null)[0]
  assert.equal(Model.matchesWindowQuery(row, "settings"), true)
  assert.equal(Model.matchesWindowQuery(row, "code settings"), true)
  assert.equal(Model.matchesWindowQuery(row, "SETTINGS"), true)
  assert.equal(Model.matchesWindowQuery(row, "settings firefox"), false)
  assert.equal(Model.matchesWindowQuery(row, ""), true)
})

test("a better text match outranks a more recent window", () => {
  const tops = [
    win("firefox", "Home", { focus: 0, address: "0xb" }),
    win("code", "settings.qml", { focus: 9, address: "0xa" })
  ]
  const rows = Model.rankWindowRows(Model.windowRows(tops, winEntries, null, null, null), "settings")
  // 0xa is far staler but matches; recency must not drag 0xb back in.
  assert.equal(rows.length, 1)
  assert.equal(rows[0].address, "0xa")
})

test("windowHint names the live move key, without repeating the badge", () => {
  const row = Model.windowRows([win("firefox", "Home", { focus: 0, wsId: 4 })], winEntries, null, null, null)[0]
  assert.ok(Model.windowHint(row, false).indexOf(" m move") >= 0)
  assert.ok(Model.windowHint(row, true).indexOf("^m move") >= 0)
  // The workspace badge renders right beside the hint, so repeating it here
  // just says the same thing twice.
  assert.equal(Model.windowHint(row, false).indexOf("workspace"), -1)
})

test("searchPlaceholder covers every view", () => {
  assert.equal(Model.searchPlaceholder("store"), "search apps and packages...")
  assert.equal(Model.searchPlaceholder("windows"), "search windows...")
  assert.equal(Model.searchPlaceholder("apps"), "search apps...")
  assert.equal(Model.searchPlaceholder("workspaces"), "search apps...")
})

// ------------------------------------------------------------- move window

test("moveWindowDispatch builds both hyprland syntaxes", () => {
  assert.equal(Model.moveWindowDispatch("3", false, true), 'hl.dsp.window.move({ workspace = "3", follow = false })')
  assert.equal(Model.moveWindowDispatch("3", true, true), 'hl.dsp.window.move({ workspace = "3" })')
  assert.equal(Model.moveWindowDispatch("3", false, false), "movetoworkspacesilent 3")
  assert.equal(Model.moveWindowDispatch("3", true, false), "movetoworkspace 3")
  assert.ok(Model.moveWindowDispatch("special:scratchpad", false, false).indexOf("special:scratchpad") > 0)
})

test("moveWindowDispatch refuses anything that is not a workspace", () => {
  // A dispatch is fire-and-forget, so a bad target fails silently in the
  // compositor. Refusing here is the only place it can be caught.
  assert.equal(Model.moveWindowDispatch("3; rm -rf /", false, false), "")
  assert.equal(Model.moveWindowDispatch("0", false, false), "")
  assert.equal(Model.moveWindowDispatch("10", false, false), "")
  assert.equal(Model.moveWindowDispatch("", false, false), "")
  assert.equal(Model.moveWindowDispatch("special:has spaces", false, false), "")
})

test("toggleSpecialDispatch builds both syntaxes and refuses junk", () => {
  assert.equal(Model.toggleSpecialDispatch("scratchpad", true), 'hl.dsp.workspace.toggle_special("scratchpad")')
  assert.equal(Model.toggleSpecialDispatch("scratchpad", false), "togglespecialworkspace scratchpad")
  assert.equal(Model.toggleSpecialDispatch("bad name", false), "")
  assert.equal(Model.toggleSpecialDispatch("", false), "")
})

// -------------------------------------------------------------- scratchpad

test("specialWorkspaceRows picks up only the scratchpad's windows", () => {
  const tops = [
    win("firefox", "Home", { focus: 0, ws: { id: 2, name: "2" } }),
    win("code", "one.qml", { focus: 1, address: "0xs", ws: { id: -99, name: "special:scratchpad" } }),
    win("firefox", "Other", { focus: 2, address: "0xm", ws: { id: -98, name: "special:magic" } })
  ]
  const info = Model.specialWorkspaceRows(tops, winEntries, null, "scratchpad")
  assert.equal(info.count, 1)
  assert.equal(info.apps.join(","), "Code")
  assert.equal(info.addresses.join(","), "0xs")
})

test("scratchpadLabel summarises what is stashed", () => {
  assert.equal(Model.scratchpadLabel({ count: 0, apps: [] }), "empty")
  assert.equal(Model.scratchpadLabel(null), "empty")
  assert.equal(Model.scratchpadLabel({ count: 1, apps: ["Terminal"] }), "Terminal")
  assert.equal(Model.scratchpadLabel({ count: 3, apps: ["Terminal", "Firefox", "Code"] }), "Terminal +2")
})

test("the scratchpad chip is reachable below the grid, and only when it exists", () => {
  // Bottom-left cell of a 9-workspace grid, pressing down.
  const down = Model.moveCursor("workspaces", 7, 0, 0, 1, 9, 3, true)
  assert.equal(down.section, "scratchpad")
  const back = Model.moveCursor("scratchpad", 7, 0, 0, -1, 9, 3, true)
  assert.equal(back.section, "workspaces")
  const toPinned = Model.moveCursor("scratchpad", 7, 0, 1, 0, 9, 3, true)
  assert.equal(toPinned.section, "pinned")
  // Without a scratchpad the old behaviour has to be exactly preserved.
  const clamped = Model.moveCursor("workspaces", 7, 0, 0, 1, 9, 3, false)
  assert.equal(clamped.section, "workspaces")
  assert.equal(clamped.workspaceId, 7)
})

// --------------------------------------------------------- workspace names

test("workspaceName reads the shared id=name grammar", () => {
  assert.equal(Model.workspaceName("1=code,2=web", 1), "code")
  assert.equal(Model.workspaceName("1=code, 2 = web", 2), "web")
  assert.equal(Model.workspaceName("1=code", 3), "")
  assert.equal(Model.workspaceName("", 1), "")
  assert.equal(Model.workspaceName('{"3":"mail"}', 3), "mail")
})

test("a named workspace keeps its name when empty and beside the app when busy", () => {
  const empty = Model.workspacePresentation(workspace(2, []), winEntries, null, "web")
  assert.equal(empty.name, "web")
  assert.equal(empty.occupied, false)
  // Unnamed must still read "empty" — that is the pre-existing behaviour.
  assert.equal(Model.workspacePresentation(workspace(2, []), winEntries, null, "").name, "empty")

  const busy = Model.workspacePresentation(workspace(1, [win("firefox", "Home", { focus: 0 })]), winEntries, null, "web")
  assert.equal(busy.name, "Firefox")
  assert.equal(busy.workspaceName, "web")
})

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

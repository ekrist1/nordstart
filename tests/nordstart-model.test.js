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
  assert.equal(apps[1].name, "Firefox")
})

test("app list cursor clamps and session commands map", () => {
  assert.equal(Model.moveAppCursor(0, -1, 10), 0)
  assert.equal(Model.moveAppCursor(3, 2, 10), 5)
  assert.equal(Model.moveAppCursor(9, 1, 10), 9)
  assert.equal(Model.moveAppCursor(0, 1, 0), 0)
  assert.equal(Model.sessionCommand("shutdown"), "omarchy-system-shutdown")
  assert.equal(Model.sessionPrompt("shutdown"), "power off?")
  assert.equal(Model.sessionNeedsConfirm("reboot"), true)
  assert.equal(Model.sessionNeedsConfirm("logout"), false)
})

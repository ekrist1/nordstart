.pragma library

var DEFAULT_PINNED = [
  "firefox",
  "code",
  "thunderbird",
  "tableplus",
  "onlyoffice-desktopeditors"
]

var ID_ALIASES = {
  firefox: ["firefox", "org.mozilla.firefox", "firefox-esr"],
  chromium: ["chromium", "chromium-browser", "org.chromium.Chromium"],
  chrome: ["google-chrome", "google-chrome-stable", "com.google.Chrome"],
  brave: ["brave", "brave-browser", "com.brave.Browser"],
  code: ["code", "code-oss", "visual-studio-code", "com.visualstudio.code", "codium", "com.vscodium.codium"],
  thunderbird: ["thunderbird", "org.mozilla.Thunderbird", "net.thunderbird.Thunderbird"],
  files: ["nautilus", "org.gnome.Nautilus", "nemo", "org.nemo.Nemo", "thunar", "thunar-3", "pcmanfm", "org.kde.dolphin"],
  nautilus: ["nautilus", "org.gnome.Nautilus"],
  tableplus: ["tableplus", "com.tinyapp.TablePlus"],
  onlyoffice: ["onlyoffice-desktopeditors", "org.onlyoffice.desktopeditors", "DesktopEditors", "onlyoffice"],
  "onlyoffice-desktopeditors": ["onlyoffice-desktopeditors", "org.onlyoffice.desktopeditors", "DesktopEditors", "onlyoffice"],
  discord: ["discord", "vesktop", "dev.vencord.Vesktop", "com.discordapp.Discord"],
  telegram: ["telegram", "telegram-desktop", "org.telegram.desktop"],
  signal: ["signal", "signal-desktop", "org.signal.Signal"],
  slack: ["slack", "com.slack.Slack"],
  spotify: ["spotify", "com.spotify.Client"],
  vlc: ["vlc", "org.videolan.VLC"],
  mpv: ["mpv", "io.mpv.Mpv"],
  steam: ["steam", "com.valvesoftware.Steam"],
  obsidian: ["obsidian", "md.obsidian.Obsidian"],
  calculator: ["gnome-calculator", "org.gnome.Calculator"],
  settings: ["gnome-control-center", "org.gnome.Settings"]
}

var CLASS_LABELS = {
  alacritty: "Terminal",
  kitty: "Terminal",
  foot: "Terminal",
  ghostty: "Terminal",
  wezterm: "Terminal",
  konsole: "Terminal",
  xterm: "Terminal",
  ptyxis: "Terminal",
  tilix: "Terminal",
  terminator: "Terminal",
  "xfce4-terminal": "Terminal",
  "org.gnome.terminal": "Terminal",
  "org.gnome.console": "Terminal",
  "org.gnome.ptyxis": "Terminal",
  "com.mitchellh.ghostty": "Terminal",
  nautilus: "Files",
  "org.gnome.nautilus": "Files",
  nemo: "Files",
  "org.nemo.nemo": "Files",
  thunar: "Files",
  "thunar-3": "Files",
  pcmanfm: "Files",
  "org.kde.dolphin": "Files",
  dolphin: "Files",
  code: "Code",
  "code-oss": "Code",
  "visual-studio-code": "Code",
  codium: "Code",
  cursor: "Cursor",
  "cursor-url-handler": "Cursor",
  firefox: "Firefox",
  "org.mozilla.firefox": "Firefox",
  chromium: "Chromium",
  "org.chromium.chromium": "Chromium",
  "google-chrome": "Chrome",
  "google-chrome-stable": "Chrome",
  "com.google.chrome": "Chrome",
  brave: "Brave",
  "brave-browser": "Brave",
  "com.brave.browser": "Brave",
  thunderbird: "Thunderbird",
  "org.mozilla.thunderbird": "Thunderbird",
  "net.thunderbird.thunderbird": "Thunderbird",
  tableplus: "Tableplus",
  "com.tinyapp.tableplus": "Tableplus",
  discord: "Discord",
  vesktop: "Discord",
  "com.discordapp.discord": "Discord",
  telegram: "Telegram",
  "telegram-desktop": "Telegram",
  "org.telegram.desktop": "Telegram",
  signal: "Signal",
  "signal-desktop": "Signal",
  "org.signal.signal": "Signal",
  slack: "Slack",
  "com.slack.slack": "Slack",
  spotify: "Spotify",
  "com.spotify.client": "Spotify",
  vlc: "VLC",
  "org.videolan.vlc": "VLC",
  mpv: "mpv",
  steam: "Steam",
  "com.valvesoftware.steam": "Steam",
  obsidian: "Obsidian",
  "md.obsidian.obsidian": "Obsidian",
  gimp: "GIMP",
  "org.gimp.gimp": "GIMP",
  inkscape: "Inkscape",
  "org.inkscape.inkscape": "Inkscape",
  blender: "Blender",
  "org.blender.blender": "Blender",
  "libreoffice-writer": "Writer",
  "libreoffice-calc": "Calc",
  "libreoffice-impress": "Impress",
  soffice: "LibreOffice",
  "org.gnome.calculator": "Calculator",
  "gnome-calculator": "Calculator",
  "org.gnome.settings": "Settings",
  "gnome-control-center": "Settings",
  "org.gnome.software": "Software",
  "org.gnome.texteditor": "Text Editor",
  "gnome-text-editor": "Text Editor",
  evince: "Document Viewer",
  "org.gnome.evince": "Document Viewer",
  "org.gnome.papers": "Document Viewer",
  eog: "Image Viewer",
  "org.gnome.eog": "Image Viewer",
  loupe: "Image Viewer",
  "org.gnome.loupe": "Image Viewer",
  "org.gnome.systemmonitor": "System Monitor",
  "gnome-system-monitor": "System Monitor"
}

var EMULATOR_NAMES = {
  alacritty: "Alacritty",
  kitty: "Kitty",
  foot: "Foot",
  ghostty: "Ghostty",
  wezterm: "WezTerm",
  konsole: "Konsole",
  xterm: "XTerm",
  "org.gnome.terminal": "GNOME Terminal",
  "org.gnome.console": "Console",
  "com.mitchellh.ghostty": "Ghostty"
}

function clampWorkspaceCount(value) {
  var n = Math.trunc(Number(value))
  if (!(n > 0)) n = 9
  return Math.max(1, Math.min(9, n))
}

var EMPTY_PINNED_SENTINEL = "none"

function stripDesktop(id) {
  var value = String(id || "").trim()
  if (value.slice(-8).toLowerCase() === ".desktop") value = value.slice(0, -8)
  return value
}

function normalizeKey(value) {
  return stripDesktop(value).toLowerCase().replace(/[^a-z0-9]+/g, "")
}

function idKey(value) {
  return stripDesktop(value).toLowerCase()
}

function idsEqual(left, right) {
  var a = idKey(left)
  var b = idKey(right)
  return !!a && a === b
}

function parsePinnedSetting(raw) {
  if (raw == null) return DEFAULT_PINNED.slice()

  if (Array.isArray(raw)) {
    var fromArray = []
    for (var a = 0; a < raw.length; a++) {
      var item = stripDesktop(raw[a])
      if (item) fromArray.push(item)
    }
    return fromArray
  }

  var text = String(raw).trim()
  if (!text) return DEFAULT_PINNED.slice()
  if (text.toLowerCase() === EMPTY_PINNED_SENTINEL || text === "-") return []

  var parts = text.split(/[,;\n]+/)
  var ids = []
  for (var i = 0; i < parts.length; i++) {
    var id = stripDesktop(parts[i])
    if (id) ids.push(id)
  }
  return ids.length ? ids : DEFAULT_PINNED.slice()
}

function formatPinnedSetting(ids) {
  var out = []
  var seen = ({})
  var list = ids || []
  for (var i = 0; i < list.length; i++) {
    var id = stripDesktop(list[i])
    var key = idKey(id)
    if (!key || seen[key]) continue
    seen[key] = true
    out.push(id)
  }
  return out.length ? out.join(",") : EMPTY_PINNED_SENTINEL
}

function pinnedIdMatches(appId, pinnedId, userAliases) {
  if (!appId || !pinnedId) return false
  if (idsEqual(appId, pinnedId)) return true
  var aliases = aliasCandidates(pinnedId, userAliases)
  for (var i = 0; i < aliases.length; i++) {
    if (idsEqual(appId, aliases[i])) return true
  }
  aliases = aliasCandidates(appId, userAliases)
  for (var j = 0; j < aliases.length; j++) {
    if (idsEqual(pinnedId, aliases[j])) return true
  }
  return false
}

function idIsPinned(appId, pinnedIds, userAliases) {
  var id = stripDesktop(appId)
  if (!id || !pinnedIds) return false
  for (var i = 0; i < pinnedIds.length; i++) {
    if (pinnedIdMatches(id, pinnedIds[i], userAliases)) return true
  }
  return false
}

function isPinnedApp(appId, rawSetting, userAliases) {
  return idIsPinned(appId, parsePinnedSetting(rawSetting), userAliases)
}

function togglePinnedSetting(rawSetting, appId, userAliases) {
  var id = stripDesktop(appId)
  var ids = parsePinnedSetting(rawSetting)
  var next = []
  var found = false
  for (var i = 0; i < ids.length; i++) {
    if (pinnedIdMatches(id, ids[i], userAliases)) {
      found = true
      continue
    }
    next.push(ids[i])
  }
  if (!found && id) next.push(id)
  return {
    pinned: !found,
    ids: next,
    setting: formatPinnedSetting(next)
  }
}

function parseNameMap(raw) {
  var out = ({})
  function add(key, label) {
    var id = stripDesktop(key).toLowerCase()
    var name = String(label || "").trim()
    if (id && name) out[id] = name
  }
  if (raw == null || raw === "") return out
  if (typeof raw === "object" && !Array.isArray(raw)) {
    for (var key in raw) add(key, raw[key])
    return out
  }
  var text = String(raw).trim()
  if (!text) return out
  if (text.charAt(0) === "{") {
    try { return parseNameMap(JSON.parse(text)) } catch (e) { return out }
  }
  var parts = text.split(/[,;\n]+/)
  for (var i = 0; i < parts.length; i++) {
    var pair = parts[i]
    var eq = pair.indexOf("=")
    if (eq < 1) continue
    add(pair.slice(0, eq), pair.slice(eq + 1))
  }
  return out
}

function parseAliasMap(raw) {
  var out = ({})
  function add(key, values) {
    var id = stripDesktop(key).toLowerCase()
    if (!id) return
    if (!out[id]) out[id] = []
    var list = Array.isArray(values) ? values : String(values || "").split(/[|,]/)
    for (var i = 0; i < list.length; i++) {
      var item = stripDesktop(list[i])
      if (item && out[id].indexOf(item) === -1) out[id].push(item)
    }
  }
  if (raw == null || raw === "") return out
  if (typeof raw === "object" && !Array.isArray(raw)) {
    for (var key in raw) add(key, raw[key])
    return out
  }
  var text = String(raw).trim()
  if (!text) return out
  if (text.charAt(0) === "{") {
    try { return parseAliasMap(JSON.parse(text)) } catch (e) { return out }
  }
  var parts = text.split(/[,;\n]+/)
  for (var p = 0; p < parts.length; p++) {
    var eq = parts[p].indexOf("=")
    if (eq < 1) continue
    add(parts[p].slice(0, eq), parts[p].slice(eq + 1))
  }
  return out
}

function aliasCandidates(id, userAliases) {
  var clean = stripDesktop(id)
  var out = []
  function add(value) {
    var item = stripDesktop(value)
    if (!item) return
    for (var i = 0; i < out.length; i++) if (out[i] === item) return
    out.push(item)
  }
  function addAll(list) {
    if (!list) return
    if (typeof list === "string") list = String(list).split(/[|,]/)
    for (var i = 0; i < list.length; i++) add(list[i])
  }

  add(clean)
  var lower = clean.toLowerCase()
  addAll(ID_ALIASES[lower])
  var norm = normalizeKey(clean)
  for (var builtin in ID_ALIASES) {
    if (normalizeKey(builtin) === norm) addAll(ID_ALIASES[builtin])
  }

  if (userAliases) {
    addAll(userAliases[lower])
    for (var key in userAliases) {
      var group = userAliases[key]
      var matches = normalizeKey(key) === norm
      if (!matches && Array.isArray(group)) {
        for (var g = 0; g < group.length; g++) {
          if (normalizeKey(group[g]) === norm) { matches = true; break }
        }
      }
      if (matches) {
        add(key)
        addAll(group)
      }
    }
  }
  return out
}

function lookupEntry(id, desktopEntries, userAliases) {
  var candidates = aliasCandidates(id, userAliases)
  if (!desktopEntries) return null

  for (var i = 0; i < candidates.length; i++) {
    var candidate = candidates[i]
    try {
      var exact = desktopEntries.byId(candidate)
      if (exact) return exact
      var withDesktop = desktopEntries.byId(candidate + ".desktop")
      if (withDesktop) return withDesktop
    } catch (e) {
    }
  }

  for (var j = 0; j < candidates.length; j++) {
    try {
      var guessed = desktopEntries.heuristicLookup(candidates[j])
      if (guessed) return guessed
    } catch (e2) {
    }
  }

  return null
}

function workspaceIds(count) {
  var n = clampWorkspaceCount(count)
  var ids = []
  for (var i = 1; i <= n; i++) ids.push(i)
  return ids
}

function workspaceById(workspaces, id) {
  var values = workspaces && workspaces.values ? workspaces.values : []
  for (var i = 0; i < values.length; i++) {
    if (values[i] && values[i].id === id) return values[i]
  }
  return null
}

// Keep the bar compact by default: show the focused workspace and every
// occupied workspace.  "all" mirrors the launcher's configured workspace
// count for people who use the bar as a complete workspace map.
function workspaceBarIds(count, workspaces, focusedId, mode) {
  var ids = workspaceIds(count)
  var visibility = String(mode || "").toLowerCase()
  if (visibility.indexOf("all") === 0) return ids

  var visible = []
  var focused = Math.trunc(Number(focusedId))
  for (var i = 0; i < ids.length; i++) {
    var id = ids[i]
    var stockMinimum = visibility.indexOf("first five") === 0 && id <= 5
    if (stockMinimum || id === focused || workspaceOccupied(workspaceById(workspaces, id)))
      visible.push(id)
  }
  if (!visible.length) visible.push(ids[0])
  return visible
}

function toplevelClass(toplevel) {
  if (!toplevel) return ""
  var ipc = toplevel.lastIpcObject
  if (ipc) {
    if (ipc.class) return String(ipc.class)
    if (ipc.initialClass) return String(ipc.initialClass)
  }
  var wayland = toplevel.wayland
  if (wayland && wayland.appId) return String(wayland.appId)
  return ""
}

function toplevelTitle(toplevel) {
  if (!toplevel) return ""
  var title = String(toplevel.title || "").replace(/\s+/g, " ").trim()
  if (title) return title
  var ipc = toplevel.lastIpcObject
  if (ipc && ipc.title) return String(ipc.title).replace(/\s+/g, " ").trim()
  return ""
}

function primaryToplevel(workspace) {
  if (!workspace || !workspace.toplevels) return null
  var values = workspace.toplevels.values || []
  var first = null
  for (var i = 0; i < values.length; i++) {
    if (!values[i]) continue
    if (!first) first = values[i]
    if (values[i].activated) return values[i]
  }
  return first
}

function classKey(cls) {
  return stripDesktop(cls).toLowerCase()
}

function classTail(cls) {
  var key = classKey(cls)
  var slash = key.lastIndexOf(".")
  return slash >= 0 ? key.slice(slash + 1) : key
}

function labelFromTable(cls, table) {
  if (!table || !cls) return ""
  var key = classKey(cls)
  if (table[key]) return table[key]
  var tail = classTail(cls)
  if (table[tail]) return table[tail]
  var norm = normalizeKey(cls)
  for (var k in table) {
    if (normalizeKey(k) === norm) return table[k]
  }
  return ""
}

function prettyClass(cls, userNames) {
  var custom = labelFromTable(cls, userNames)
  if (custom) return custom
  var builtin = labelFromTable(cls, CLASS_LABELS)
  if (builtin) return builtin
  var tail = classTail(cls)
  if (!tail) return ""
  return tail.charAt(0).toUpperCase() + tail.slice(1)
}

function isTerminalClass(cls) {
  if (prettyClass(cls) === "Terminal") return true
  var key = classKey(cls)
  var tail = classTail(cls)
  if (EMULATOR_NAMES[key] || EMULATOR_NAMES[tail]) return true
  return /alacritty|kitty|ghostty|foot|wezterm|konsole|xterm|ptyxis/.test(key)
}

function emulatorName(cls, entryName) {
  var key = classKey(cls)
  if (EMULATOR_NAMES[key]) return EMULATOR_NAMES[key]
  var tail = classTail(cls)
  if (EMULATOR_NAMES[tail]) return EMULATOR_NAMES[tail]
  var label = String(entryName || "").trim()
  if (label && !/^terminal$/i.test(label)) return label
  return ""
}

function cleanWindowTitle(title, appName, cls) {
  var text = String(title || "").replace(/\s+/g, " ").trim()
  if (!text) return ""

  var drop = [appName, emulatorName(cls, ""), "Alacritty", "Kitty", "kitty", "Ghostty", "ghostty", "Foot", "foot", "WezTerm", "wezterm", "Konsole", "XTerm", "Terminal"]
  for (var i = 0; i < drop.length; i++) {
    var prefix = drop[i]
    if (!prefix) continue
    var separators = [prefix + " - ", prefix + " — ", prefix + " – ", prefix + ": "]
    for (var j = 0; j < separators.length; j++) {
      if (text.indexOf(separators[j]) === 0)
        text = text.slice(separators[j].length).trim()
    }
    if (text.toLowerCase() === prefix.toLowerCase()) return ""
  }
  return text
}

function terminalSubtitle(title, appName, cls, entryName) {
  var text = cleanWindowTitle(title, appName, cls)
  if (text) {
    var hosted = text.match(/^[^@\s]+@[^:\s]+:\s*(.*)$/)
    if (hosted && hosted[1]) {
      var path = hosted[1]
      var parts = path.replace(/\/+$/, "").split("/").filter(function(part) { return part.length > 0 })
      text = parts.length > 2 ? parts.slice(-2).join("/") : path
    }
  }
  if (!text) text = emulatorName(cls, entryName)
  if (text && text.toLowerCase() === String(appName || "").toLowerCase()) return ""
  return text
}

function shortAppName(name, cls, userNames) {
  var mapped = prettyClass(cls, userNames)
  if (mapped && mapped !== prettyClass("")) return mapped
  var named = labelFromTable(name, userNames)
  if (named) return named
  var label = String(name || "").trim()
  if (!label) return mapped
  if (/visual studio code/i.test(label)) return "Code"
  if (/onlyoffice/i.test(label)) return "Onlyoffice"
  if (/nautilus/i.test(label)) return "Files"
  return label
}

function workspaceAppName(workspace, desktopEntries, userNames, wsName) {
  return workspacePresentation(workspace, desktopEntries, userNames, wsName).name
}

function workspaceSubtitle(workspace, desktopEntries, userNames, wsName) {
  return workspacePresentation(workspace, desktopEntries, userNames, wsName).subtitle
}

// `workspaceNames` uses the same `1=code,2=web` grammar as `appNames`, so it
// reuses parseNameMap outright — stripDesktop("1") is "1" and lowercasing a
// digit is a no-op, which is why no separate parser is needed.
function workspaceName(workspaceNames, id) {
  var map = parseNameMap(workspaceNames)
  var value = map[String(id)]
  return value ? String(value) : ""
}

// `wsName` is optional and last so the existing three-argument callers (and
// their tests) keep working unchanged.
function workspacePresentation(workspace, desktopEntries, userNames, wsName) {
  userNames = parseNameMap(userNames)
  var label = String(wsName || "")
  var toplevel = primaryToplevel(workspace)
  // A named but empty workspace shows its name instead of "empty", so the grid
  // stays a map of intent even when nothing is running on it.
  if (!toplevel) return { name: label || "empty", subtitle: "", occupied: false, workspaceName: label }

  var cls = toplevelClass(toplevel)
  var entry = lookupEntry(cls, desktopEntries)
  var name = shortAppName(entry ? entry.name : "", cls, userNames)
  if (!name) {
    var fallback = toplevelTitle(toplevel)
    name = fallback ? fallback.slice(0, 28) : "empty"
  }

  var subtitle = ""
  if (isTerminalClass(cls)) {
    subtitle = terminalSubtitle(toplevelTitle(toplevel), name, cls, entry ? entry.name : "")
  }

  // The name goes in its own field, never folded into `subtitle` — that slot
  // already carries a terminal's cwd, and naming a workspace must not hide it.
  return {
    name: name,
    subtitle: subtitle ? subtitle.slice(0, 42) : "",
    occupied: true,
    workspaceName: label
  }
}

function workspaceOccupied(workspace) {
  return !!(workspace && workspace.toplevels && workspace.toplevels.values && workspace.toplevels.values.length > 0)
}

function firstEmptyWorkspace(count, workspaces) {
  var ids = workspaceIds(count)
  for (var i = 0; i < ids.length; i++) {
    var workspace = workspaceById(workspaces, ids[i])
    if (!workspaceOccupied(workspace)) return ids[i]
  }
  return -1
}

function collectToplevels(workspaces) {
  var out = []
  var values = workspaces && workspaces.values ? workspaces.values : []
  for (var i = 0; i < values.length; i++) {
    var workspace = values[i]
    if (!workspace || !workspace.toplevels) continue
    var tops = workspace.toplevels.values || []
    for (var j = 0; j < tops.length; j++) {
      if (tops[j]) out.push(tops[j])
    }
  }
  return out
}

function classesMatch(left, right) {
  var a = normalizeKey(left)
  var b = normalizeKey(right)
  if (!a || !b) return false
  if (a === b) return true
  if (a.indexOf(b) >= 0 || b.indexOf(a) >= 0) return a.length >= 3 && b.length >= 3
  return false
}

function entryMatchesClass(entry, cls) {
  if (!entry || !cls) return false
  if (classesMatch(entry.id, cls)) return true
  if (classesMatch(entry.icon, cls)) return true
  if (entry.startupClass && classesMatch(entry.startupClass, cls)) return true
  if (entry.name && classesMatch(entry.name.replace(/\s+/g, ""), cls)) return true
  return false
}

function matchToplevel(toplevel, appId, entry, userAliases) {
  if (!toplevel) return false
  var cls = toplevelClass(toplevel)
  if (!cls) return false
  if (classesMatch(appId, cls)) return true
  var aliases = aliasCandidates(appId, userAliases)
  for (var i = 0; i < aliases.length; i++) {
    if (classesMatch(aliases[i], cls)) return true
  }
  return entryMatchesClass(entry, cls)
}

// ---------------------------------------------------------------- frecency
//
// The launcher is alphabetical, so the app you open twenty times a day costs
// the same keystrokes as the one you have never opened. Usage is kept in
// shell.json's `appUsage` as `id:count:lastSeconds` triples.

var USAGE_HALF_LIFE_DAYS = 14
var USAGE_LIMIT = 60
// The host's fuzzy bands sit ~400-500 apart (prefix 10000, substring 8000,
// keyword 6000 ...). Capping the boost below that keeps a textual match
// authoritative and lets frecency reorder only within a band.
var USAGE_MAX_BOOST = 400

function parseUsage(raw) {
  if (raw === null || raw === undefined) return {}

  if (typeof raw === "object" && !Array.isArray(raw)) {
    var fromObject = {}
    for (var key in raw) {
      var value = raw[key]
      if (!value) continue
      fromObject[idKey(key)] = {
        count: Math.max(0, Number(value.count) || 0),
        last: Math.max(0, Number(value.last) || 0)
      }
    }
    return fromObject
  }

  var text = String(raw).trim()
  if (!text) return {}
  if (text.charAt(0) === "{") {
    try {
      return parseUsage(JSON.parse(text))
    } catch (e) {
      return {}
    }
  }

  var out = {}
  var parts = text.split(/[,;\n]/)
  for (var i = 0; i < parts.length; i++) {
    var fields = parts[i].split(":")
    if (fields.length < 2) continue
    var id = idKey(stripDesktop(fields[0]))
    if (!id) continue
    var count = Number(fields[1])
    if (!(count > 0)) continue
    out[id] = { count: count, last: Math.max(0, Number(fields[2]) || 0) }
  }
  return out
}

// Capped so shell.json cannot grow without bound; the entries dropped are the
// ones frecency would rank last anyway.
function formatUsage(usage, nowSeconds) {
  var ids = []
  for (var id in (usage || {})) ids.push(id)

  ids.sort(function(a, b) {
    return frecencyScore(usage[b], nowSeconds) - frecencyScore(usage[a], nowSeconds)
  })

  var parts = []
  for (var i = 0; i < ids.length && i < USAGE_LIMIT; i++) {
    var entry = usage[ids[i]]
    if (!entry || !(entry.count > 0)) continue
    parts.push(ids[i] + ":" + entry.count + ":" + Math.round(entry.last || 0))
  }
  return parts.join(",")
}

// Returns a new object; the caller persists it. Never mutates in place, since
// QML only re-evaluates bindings when the whole object changes.
function recordLaunch(usage, appId, nowSeconds) {
  var id = idKey(stripDesktop(appId))
  var out = {}
  for (var key in (usage || {})) out[key] = usage[key]
  if (!id) return out

  var prev = out[id]
  out[id] = {
    count: (prev && prev.count > 0 ? prev.count : 0) + 1,
    last: Math.max(0, Number(nowSeconds) || 0)
  }
  return out
}

// Count decayed by age: ten launches last year should not outrank three from
// this morning. Half-life of two weeks.
function frecencyScore(entry, nowSeconds) {
  if (!entry || !(entry.count > 0)) return 0
  var ageDays = (Number(nowSeconds) - Number(entry.last || 0)) / 86400
  if (!(ageDays > 0)) return entry.count
  return entry.count * Math.pow(0.5, ageDays / USAGE_HALF_LIFE_DAYS)
}

function usageScoreFor(usage, appId, nowSeconds) {
  return frecencyScore((usage || {})[idKey(stripDesktop(appId))], nowSeconds)
}

// With no query, most-used first. With a query, the host's fuzzy score leads
// and frecency only breaks ties. Sorting is made stable by falling back to the
// incoming order, which is already alphabetical or score-ordered.
function rankAppRows(rows, usage, nowSeconds, query) {
  var list = []
  for (var i = 0; i < (rows ? rows.length : 0); i++) {
    var row = rows[i]
    if (!row) continue
    var entry = row.entry ? row.entry : row
    list.push({
      row: row,
      order: i,
      score: Number(row.score) || 0,
      usage: usageScoreFor(usage, entry ? entry.id : "", nowSeconds)
    })
  }

  var searching = !!String(query || "").trim()
  list.sort(function(a, b) {
    if (searching) {
      var av = a.score + Math.min(USAGE_MAX_BOOST, Math.round(a.usage * 40))
      var bv = b.score + Math.min(USAGE_MAX_BOOST, Math.round(b.usage * 40))
      if (av !== bv) return bv - av
    } else if (a.usage !== b.usage) {
      return b.usage - a.usage
    }
    return a.order - b.order
  })

  var out = []
  for (var j = 0; j < list.length; j++) out.push(list[j].row)
  return out
}

// Every window belonging to an app, ordered by workspace so a cycle visits
// them in the same sequence every time. collectToplevels already walks
// workspaces in order and sort is stable, so windows sharing a workspace keep
// their relative order.
function findRunningToplevels(appId, entry, workspaces, userAliases) {
  var tops = collectToplevels(workspaces)
  var out = []
  for (var i = 0; i < tops.length; i++) {
    if (matchToplevel(tops[i], appId, entry, userAliases)) out.push(tops[i])
  }
  out.sort(function(a, b) {
    var aw = a.workspace && a.workspace.id ? Number(a.workspace.id) : 0
    var bw = b.workspace && b.workspace.id ? Number(b.workspace.id) : 0
    return aw - bw
  })
  return out
}

// Advance from whichever window is focused right now; failing that, from the
// one we last sent the user to. With nothing to go on, start at the first.
// A single window always resolves to itself, so cycling is a no-op there.
function nextToplevel(tops, lastAddress) {
  if (!tops || !tops.length) return null

  var from = -1
  for (var i = 0; i < tops.length; i++) {
    if (tops[i] && tops[i].activated) { from = i; break }
  }
  if (from < 0 && lastAddress) {
    for (var j = 0; j < tops.length; j++) {
      if (tops[j] && String(tops[j].address || "") === String(lastAddress)) { from = j; break }
    }
  }
  if (from < 0) return tops[0]
  return tops[(from + 1) % tops.length]
}

// `launchWorkspace` accepts the manifest enum's labels as well as the short
// tokens, since the settings panel writes whatever string it displays.
function parseLaunchWorkspace(raw) {
  var value = String(raw == null ? "" : raw).trim().toLowerCase()
  if (value.indexOf("empty") >= 0) return "empty"
  return "current"
}

// The workspace a launch should switch to first. 0 means "stay put", which is
// what lets a second terminal land beside the first instead of jumping away.
function launchWorkspaceId(mode, count, workspaces) {
  if (parseLaunchWorkspace(mode) !== "empty") return 0
  return firstEmptyWorkspace(count, workspaces)
}

function findRunningToplevel(appId, entry, workspaces, userAliases) {
  var tops = collectToplevels(workspaces)
  var match = null
  for (var i = 0; i < tops.length; i++) {
    if (!matchToplevel(tops[i], appId, entry, userAliases)) continue
    if (tops[i].activated) return tops[i]
    if (!match) match = tops[i]
  }
  return match
}

function pinnedAppRecord(id, desktopEntries, workspaces, userNames, userAliases) {
  var entry = lookupEntry(id, desktopEntries, userAliases)
  var resolvedId = stripDesktop((entry && entry.id) || id)
  var running = findRunningToplevel(resolvedId, entry, workspaces, userAliases)
  var workspaceId = running && running.workspace ? Number(running.workspace.id) : 0
  var name = shortAppName(entry && entry.name ? entry.name : "", (entry && entry.id) || id, userNames)
  if (!name) name = resolvedId
  return {
    id: resolvedId,
    name: name,
    icon: entry && entry.icon ? String(entry.icon) : resolvedId,
    running: !!running,
    workspaceId: workspaceId > 0 ? workspaceId : 0,
    address: running && running.address ? String(running.address) : "",
    missing: !entry
  }
}

function pinnedApps(rawSetting, desktopEntries, workspaces, userNames, userAliases) {
  var ids = parsePinnedSetting(rawSetting)
  var names = parseNameMap(userNames)
  var aliases = parseAliasMap(userAliases)
  var seen = ({})
  var out = []
  for (var i = 0; i < ids.length; i++) {
    var record = pinnedAppRecord(ids[i], desktopEntries, workspaces, names, aliases)
    var key = idKey(record.id)
    if (!key || seen[key]) continue
    seen[key] = true
    if (record.missing && !record.running) continue
    out.push(record)
  }
  return out
}

function cursorIndex(section, workspaceId, pinnedIndex, workspaceCount, pinnedCount) {
  if (section === "scratchpad") {
    return { section: "scratchpad", workspaceId: workspaceId, pinnedIndex: pinnedIndex }
  }
  if (section === "pinned") {
    if (pinnedCount <= 0) return { section: "workspaces", workspaceId: workspaceId, pinnedIndex: 0 }
    var idx = Math.max(0, Math.min(pinnedCount - 1, pinnedIndex))
    return { section: "pinned", workspaceId: workspaceId, pinnedIndex: idx }
  }
  var id = Math.max(1, Math.min(workspaceCount, workspaceId))
  return { section: "workspaces", workspaceId: id, pinnedIndex: pinnedIndex }
}

// Each open window's class, derived once, so annotating a ~100-row catalog
// does not re-derive it per row. Built once per catalog rebuild.
function toplevelIndex(workspaces) {
  var tops = collectToplevels(workspaces)
  var out = []
  for (var i = 0; i < tops.length; i++) {
    var cls = toplevelClass(tops[i])
    if (!cls) continue
    out.push({
      cls: cls,
      workspaceId: tops[i].workspace && tops[i].workspace.id ? Number(tops[i].workspace.id) : 0,
      address: tops[i].address ? String(tops[i].address) : "",
      activated: tops[i].activated === true
    })
  }
  return out
}

// Running state for one catalog row against that prebuilt index. Alias
// candidates are expanded once per row rather than once per window, which is
// what keeps this off the per-keystroke hot path.
function runningStateFor(appId, entry, index, userAliases) {
  var idle = { running: false, workspaceId: 0, windows: 0 }
  if (!index || !index.length) return idle

  var candidates = aliasCandidates(appId, userAliases)
  var best = null
  var count = 0

  for (var i = 0; i < index.length; i++) {
    var hit = false
    for (var c = 0; c < candidates.length; c++) {
      if (classesMatch(candidates[c], index[i].cls)) { hit = true; break }
    }
    if (!hit && entry && entryMatchesClass(entry, index[i].cls)) hit = true
    if (!hit) continue

    count++
    // Prefer the focused window, so the workspace shown is the one Enter
    // would actually take you to first.
    if (!best || (index[i].activated && !best.activated)) best = index[i]
  }

  if (!best) return idle
  return { running: true, workspaceId: best.workspaceId, windows: count }
}

// What activating the selected row will do. `searchFocused` matters because
// the search field types a plain `n`, so it uses Ctrl+N instead.
function catalogHint(record, searchFocused) {
  if (!record) return ""
  var go = record.running && record.workspaceId > 0
    ? "\u21b5 go to " + record.workspaceId
    : "\u21b5 open"
  return go + " \u00b7 " + (searchFocused ? "^n" : "n") + " new"
}

function catalogRecords(rows, userNames, rawPinned, userAliases, index) {
  var names = parseNameMap(userNames)
  var pinnedIds = rawPinned !== undefined ? parsePinnedSetting(rawPinned) : null
  var out = []
  var seen = ({})
  if (!rows) return out
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i]
    var entry = row && row.entry ? row.entry : row
    if (!entry) continue
    var id = stripDesktop(entry.id)
    if (!id) continue
    var key = idKey(id)
    if (!key || seen[key]) continue
    seen[key] = true
    var name = shortAppName(entry.name || "", id, names)
    if (!name) name = String(entry.name || id)
    var state = index ? runningStateFor(id, entry, index, userAliases) : null
    out.push({
      id: id,
      name: name,
      icon: entry.icon ? String(entry.icon) : id,
      pinned: pinnedIds ? idIsPinned(id, pinnedIds, userAliases) : false,
      running: state ? state.running : false,
      workspaceId: state ? state.workspaceId : 0,
      windows: state ? state.windows : 0
    })
  }
  return out
}

function moveAppCursor(index, delta, count) {
  if (!(count > 0)) return 0
  var next = Math.trunc(Number(index)) + Math.trunc(Number(delta))
  if (next < 0) return 0
  if (next > count - 1) return count - 1
  return next
}

// ------------------------------------------------------------------ windows
//
// The window switcher works one level below the app list: every open window,
// not every installed app. Hyprland's `focusHistoryID` (0 = the focused window,
// 1 = the one before it) is the only true MRU source, and it lives on
// `lastIpcObject` — the raw `hyprctl clients` record Quickshell hangs off each
// toplevel.

var SPECIAL_PREFIX = "special:"
var SCRATCHPAD_NAME = "scratchpad"
// Sorts a window with no focus history after every window that has one.
var NO_FOCUS_RANK = 1e9

function toplevelList(toplevels) {
  if (!toplevels) return []
  if (Array.isArray(toplevels)) return toplevels
  if (toplevels.values) return toplevels.values
  return []
}

// Careful: focusHistoryID of 0 is the *most* recent window, so a falsy check
// would throw away exactly the entry that matters most.
function toplevelFocusRank(toplevel) {
  if (!toplevel) return NO_FOCUS_RANK
  var ipc = toplevel.lastIpcObject
  if (!ipc) return NO_FOCUS_RANK
  var raw = ipc.focusHistoryID
  if (raw === null || raw === undefined || raw === "") return NO_FOCUS_RANK
  var value = Number(raw)
  return isNaN(value) || value < 0 ? NO_FOCUS_RANK : value
}

function toplevelAddress(toplevel) {
  if (!toplevel) return ""
  if (toplevel.address) return String(toplevel.address)
  var ipc = toplevel.lastIpcObject
  return ipc && ipc.address ? String(ipc.address) : ""
}

// The ipc object is authoritative: `toplevel.workspace` is the Quickshell
// workspace model, which does not necessarily carry special workspaces, while
// `hyprctl clients` always names the workspace a window actually sits on.
function toplevelWorkspace(toplevel) {
  var idle = { id: 0, name: "" }
  if (!toplevel) return idle
  var ipc = toplevel.lastIpcObject
  if (ipc && ipc.workspace && (ipc.workspace.id !== undefined || ipc.workspace.name !== undefined)) {
    return {
      id: Number(ipc.workspace.id) || 0,
      name: String(ipc.workspace.name || "")
    }
  }
  var ws = toplevel.workspace
  if (ws) return { id: Number(ws.id) || 0, name: String(ws.name || "") }
  return idle
}

function isSpecialWorkspace(name) {
  return String(name || "").indexOf(SPECIAL_PREFIX) === 0
}

// Frozen once when the view opens. `refreshToplevels()` is async, so a live
// binding on focusHistoryID would reshuffle the list under the cursor a beat
// after you got there.
function windowMruRanks(toplevels) {
  var list = toplevelList(toplevels)
  var ranks = ({})
  for (var i = 0; i < list.length; i++) {
    var address = toplevelAddress(list[i])
    if (address) ranks[address] = toplevelFocusRank(list[i])
  }
  return ranks
}

// One display row per open window. `ranks` comes from windowMruRanks; pass
// null to read the live focus order instead.
function windowRows(toplevels, desktopEntries, userNames, workspaceNames, ranks) {
  var list = toplevelList(toplevels)
  var names = parseNameMap(userNames)
  var out = []

  for (var i = 0; i < list.length; i++) {
    var top = list[i]
    if (!top) continue
    var address = toplevelAddress(top)
    if (!address) continue

    var cls = toplevelClass(top)
    var entry = lookupEntry(cls, desktopEntries)
    var appName = shortAppName(entry ? entry.name : "", cls, names)
    var rawTitle = toplevelTitle(top)
    var title = cleanWindowTitle(rawTitle, appName, cls)
    // A terminal's title is its cwd, which is the only thing distinguishing
    // two of them — the same reasoning as the workspace cells.
    if (isTerminalClass(cls))
      title = terminalSubtitle(rawTitle, appName, cls, entry ? entry.name : "")
    if (!title) title = rawTitle
    if (!appName) appName = cls || "window"

    var ws = toplevelWorkspace(top)
    var special = isSpecialWorkspace(ws.name)
    var named = special ? "" : workspaceName(workspaceNames, ws.id)
    var ipc = top.lastIpcObject || {}
    var rank = (ranks && ranks[address] !== undefined) ? Number(ranks[address]) : toplevelFocusRank(top)

    out.push({
      address: address,
      cls: cls,
      appName: appName,
      title: title ? String(title).slice(0, 60) : "",
      icon: entry && entry.icon ? entry.icon : "",
      workspaceId: ws.id,
      workspaceRawName: ws.name,
      workspaceLabel: special ? SCRATCHPAD_NAME : (named || String(ws.id)),
      special: special,
      activated: !!top.activated,
      floating: !!ipc.floating,
      pinned: !!ipc.pinned,
      rank: rank
    })
  }
  return out
}

// AND over whitespace-separated terms, the same shape as the store's matcher.
function matchesWindowQuery(row, query) {
  if (!row) return false
  var text = String(query || "").trim().toLowerCase()
  if (!text) return true
  var haystack = [row.title, row.appName, row.cls, row.workspaceLabel].join(" ").toLowerCase()
  var terms = text.split(/\s+/)
  for (var i = 0; i < terms.length; i++) {
    if (haystack.indexOf(terms[i]) < 0) return false
  }
  return true
}

// 0 = the term starts the name or title, 1 = it starts a word inside one,
// 2 = it appears anywhere. Lower is better.
function windowMatchTier(row, query) {
  var text = String(query || "").trim().toLowerCase()
  if (!text) return 0
  var fields = [String(row.appName || "").toLowerCase(), String(row.title || "").toLowerCase()]
  for (var i = 0; i < fields.length; i++) {
    if (fields[i].indexOf(text) === 0) return 0
  }
  for (var j = 0; j < fields.length; j++) {
    if (new RegExp("\\b" + text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(fields[j])) return 1
  }
  return 2
}

// Without a query this is pure MRU. With one, match quality leads and MRU only
// breaks ties, so typing always beats recency — the same invariant the app list
// keeps between fuzzy score and frecency.
function rankWindowRows(rows, query) {
  var list = []
  for (var i = 0; i < (rows || []).length; i++) {
    if (matchesWindowQuery(rows[i], query)) list.push({ row: rows[i], order: i })
  }
  var text = String(query || "").trim()
  list.sort(function(a, b) {
    if (text) {
      var ta = windowMatchTier(a.row, text)
      var tb = windowMatchTier(b.row, text)
      if (ta !== tb) return ta - tb
    }
    var ra = Number(a.row.rank)
    var rb = Number(b.row.rank)
    if (ra !== rb) return ra - rb
    return a.order - b.order
  })
  var out = []
  for (var k = 0; k < list.length; k++) out.push(list[k].row)
  return out
}

// `searchFocused` matters for the same reason it does in catalogHint: a plain
// `m` in the search field types a letter, so it becomes Ctrl+M there.
// Deliberately does not name the workspace: the badge sits immediately to the
// right of this text and already says it.
function windowHint(row, searchFocused) {
  if (!row) return ""
  return "↵ focus · " + (searchFocused ? "^m" : "m") + " move"
}

function searchPlaceholder(view) {
  if (view === "store") return "search apps and packages..."
  if (view === "windows") return "search windows..."
  return "search apps..."
}

// -------------------------------------------------------------- move window
//
// Dispatch strings are built here rather than inline in the QML because
// `Hyprland.dispatch` is fire-and-forget: a syntactically valid but wrong
// dispatcher silently does nothing and never throws, so a unit test on the
// string is the only automated coverage this integration can have.
// Both forms are lifted verbatim from Omarchy's own bindings
// (/usr/share/omarchy/default/hypr/bindings/tiling.lua:22-28).

function isMoveTarget(target) {
  return /^([1-9]|special:[a-z0-9_-]+)$/.test(String(target || ""))
}

function scratchpadTarget() {
  return SPECIAL_PREFIX + SCRATCHPAD_NAME
}

// Moves the *focused* window. Whether the lua form accepts a `window =`
// selector is unverified, so callers focus the window first and move it second.
function moveWindowDispatch(target, follow, lua) {
  var value = String(target || "")
  if (!isMoveTarget(value)) return ""
  if (lua) {
    return follow
      ? 'hl.dsp.window.move({ workspace = "' + value + '" })'
      : 'hl.dsp.window.move({ workspace = "' + value + '", follow = false })'
  }
  return (follow ? "movetoworkspace " : "movetoworkspacesilent ") + value
}

function isSpecialName(name) {
  return /^[a-z0-9_-]+$/.test(String(name || ""))
}

function toggleSpecialDispatch(name, lua) {
  var value = String(name || "")
  if (!isSpecialName(value)) return ""
  return lua
    ? 'hl.dsp.workspace.toggle_special("' + value + '")'
    : "togglespecialworkspace " + value
}

function movePrompt(row, workspaceNames) {
  var what = row && row.appName ? row.appName : "this window"
  return "move " + what + " → 1-9 · 0 scratchpad · esc cancel"
}

// -------------------------------------------------------------- scratchpad
//
// Derived from toplevels rather than Hyprland.workspaces: `hyprctl clients`
// always names a window's workspace, whereas the Quickshell workspace model
// carrying special workspaces is not something this plugin should depend on.
function specialWorkspaceRows(toplevels, desktopEntries, userNames, name) {
  var target = SPECIAL_PREFIX + String(name || SCRATCHPAD_NAME)
  var rows = windowRows(toplevels, desktopEntries, userNames, null, null)
  var apps = []
  var addresses = []
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].workspaceRawName !== target) continue
    apps.push(rows[i].appName)
    addresses.push(rows[i].address)
  }
  return {
    name: String(name || SCRATCHPAD_NAME),
    count: apps.length,
    apps: apps,
    addresses: addresses,
    summary: apps.join(", ")
  }
}

function scratchpadLabel(info) {
  if (!info || !(info.count > 0)) return "empty"
  if (info.count === 1) return String(info.apps[0] || "1 window")
  return String(info.apps[0] || "window") + " +" + (info.count - 1)
}

var SESSION_ACTIONS = {
  logout: { command: "omarchy-system-logout", prompt: "log out?", confirm: false, confirmText: "Log out" },
  reboot: { command: "omarchy-system-reboot", prompt: "reboot?", confirm: true, confirmText: "Reboot" },
  shutdown: { command: "omarchy-system-shutdown", prompt: "power off?", confirm: true, confirmText: "Power off" }
}

function sessionAction(id) {
  return SESSION_ACTIONS[id] || null
}

function sessionCommand(id) {
  var action = sessionAction(id)
  return action ? action.command : ""
}

function sessionPrompt(id) {
  var action = sessionAction(id)
  return action ? action.prompt : ""
}

function sessionConfirmText(id) {
  var action = sessionAction(id)
  return action ? action.confirmText : "Confirm"
}

function sessionNeedsConfirm(id) {
  var action = sessionAction(id)
  return !!(action && action.confirm)
}

// ---------------------------------------------------------------- companions
//
// Nordtema (theme) and Nordsettings (Hyprland look-and-feel) are separate
// repos. The footer offers them next to the session buttons: open if they
// are already there, otherwise install from git in a floating terminal —
// the same pattern as the store, so this plugin never clones or enables
// anything itself.

var COMPANION_TERMINAL = "omarchy-launch-floating-terminal-with-presentation"
var COMPANION_THEME_REPO = "https://github.com/ekrist1/nordtema"
var COMPANION_SETTINGS_REPO = "https://github.com/ekrist1/nordsettings.git"
var COMPANION_SETTINGS_ID = "io.github.ekrist1.nordsettings"
var COMPANION_THEME_MENU = "style.nordtema"

var COMPANIONS = {
  theme: {
    id: "theme",
    key: "t",
    label: "Theme",
    missingLabel: "Install theme",
    prompt: "install Nordtema? this applies the Slate palette.",
    confirmText: "Install"
  },
  settings: {
    id: "settings",
    key: "c",
    pluginId: COMPANION_SETTINGS_ID,
    label: "Hyprland",
    missingLabel: "Install Hyprland",
    prompt: "install Nordsettings? this adds Hyprland look-and-feel settings to the bar.",
    confirmText: "Install"
  }
}

function companion(id) {
  return COMPANIONS[id] || null
}

function companionSettingsId() {
  return COMPANION_SETTINGS_ID
}

function companionThemeMenu() {
  return COMPANION_THEME_MENU
}

// facts.themeCli: nordtema CLI is executable (install.sh has been run)
// facts.themeDir: the theme tree is on disk (clone without install.sh)
// facts.settingsInstalled: plugin is in the shell registry
// facts.settingsOnBar: its bar widget is live
function companionFacts(facts) {
  var value = facts || {}
  return {
    themeCli: !!value.themeCli,
    themeDir: !!value.themeDir,
    settingsInstalled: !!value.settingsInstalled,
    settingsOnBar: !!value.settingsOnBar
  }
}

function companionKnown(id, facts) {
  var f = companionFacts(facts)
  if (id === "theme") return f.themeCli || f.themeDir
  if (id === "settings") return f.settingsInstalled || f.settingsOnBar
  return false
}

function companionReady(id, facts) {
  var f = companionFacts(facts)
  if (id === "theme") return f.themeCli
  if (id === "settings") return f.settingsOnBar
  return false
}

function companionLabel(id, facts) {
  var item = companion(id)
  if (!item) return ""
  return companionKnown(id, facts) ? item.label : item.missingLabel
}

function companionPrompt(id) {
  var item = companion(id)
  return item ? item.prompt : ""
}

function companionConfirmText(id) {
  var item = companion(id)
  return item ? item.confirmText : "Install"
}

function companionKey(id) {
  var item = companion(id)
  return item ? item.key : ""
}

function companionForKey(key) {
  var value = String(key || "").toLowerCase()
  if (!value) return ""
  for (var id in COMPANIONS) {
    if (COMPANIONS[id].key === value) return id
  }
  return ""
}

// A trusted argv for the floating terminal. URLs are constants, never
// interpolated from user input. `$HOME` is expanded by bash in that terminal.
function companionInstallCommand(id, facts) {
  var f = companionFacts(facts)

  if (id === "theme") {
    if (f.themeDir && !f.themeCli) {
      return {
        mode: "argv",
        argv: [COMPANION_TERMINAL, "bash \"$HOME/.config/omarchy/themes/nordtema/install.sh\""]
      }
    }
    if (f.themeCli) return null
    return {
      mode: "argv",
      argv: [
        COMPANION_TERMINAL,
        "omarchy theme install " + COMPANION_THEME_REPO
          + " && bash \"$HOME/.config/omarchy/themes/nordtema/install.sh\""
      ]
    }
  }

  if (id === "settings") {
    if (f.settingsInstalled || f.settingsOnBar) return null
    return {
      mode: "argv",
      argv: [
        COMPANION_TERMINAL,
        "omarchy plugin add " + COMPANION_SETTINGS_REPO + " --enable --yes"
      ]
    }
  }

  return null
}

// `hasScratchpad` is optional and last: without it this behaves exactly as it
// did before the chip existed, which is what keeps the existing callers and
// their tests honest.
function moveCursor(section, workspaceId, pinnedIndex, dx, dy, workspaceCount, pinnedCount, hasScratchpad) {
  var columns = 3
  if (section === "scratchpad") {
    // Up returns to the bottom-left grid cell; right hops to the pinned list.
    if (dy < 0) return cursorIndex("workspaces", workspaceId, pinnedIndex, workspaceCount, pinnedCount)
    if (dx > 0) return cursorIndex("pinned", workspaceId, pinnedIndex, workspaceCount, pinnedCount)
    return cursorIndex("scratchpad", workspaceId, pinnedIndex, workspaceCount, pinnedCount)
  }
  if (section === "pinned") {
    if (dx > 0) return cursorIndex("pinned", workspaceId, pinnedIndex, workspaceCount, pinnedCount)
    if (dx < 0) return cursorIndex("workspaces", workspaceCount, pinnedIndex, workspaceCount, pinnedCount)
    return cursorIndex("pinned", workspaceId, pinnedIndex + dy, workspaceCount, pinnedCount)
  }

  var index = workspaceId - 1
  var col = index % columns
  var row = Math.floor(index / columns)
  var rows = Math.ceil(workspaceCount / columns)

  col += dx
  row += dy

  if (col >= columns) return cursorIndex("pinned", workspaceId, Math.min(row, Math.max(0, pinnedCount - 1)), workspaceCount, pinnedCount)
  if (col < 0) col = 0
  if (row < 0) row = 0
  // Down off the bottom row lands on the scratchpad chip when there is one.
  if (row >= rows) {
    if (hasScratchpad) return cursorIndex("scratchpad", workspaceId, pinnedIndex, workspaceCount, pinnedCount)
    row = rows - 1
  }

  var next = row * columns + col + 1
  if (next > workspaceCount) next = workspaceCount
  return cursorIndex("workspaces", next, pinnedIndex, workspaceCount, pinnedCount)
}

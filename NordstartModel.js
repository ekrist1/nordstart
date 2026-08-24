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

function stripDesktop(id) {
  var value = String(id || "").trim()
  if (value.slice(-8).toLowerCase() === ".desktop") value = value.slice(0, -8)
  return value
}

function normalizeKey(value) {
  return stripDesktop(value).toLowerCase().replace(/[^a-z0-9]+/g, "")
}

function parsePinnedSetting(raw) {
  if (Array.isArray(raw)) {
    var fromArray = []
    for (var a = 0; a < raw.length; a++) {
      var item = stripDesktop(raw[a])
      if (item) fromArray.push(item)
    }
    return fromArray.length ? fromArray : DEFAULT_PINNED.slice()
  }

  var text = String(raw == null ? "" : raw).trim()
  if (!text) return DEFAULT_PINNED.slice()

  var parts = text.split(/[,;\n]+/)
  var ids = []
  for (var i = 0; i < parts.length; i++) {
    var id = stripDesktop(parts[i])
    if (id) ids.push(id)
  }
  return ids.length ? ids : DEFAULT_PINNED.slice()
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

function workspaceAppName(workspace, desktopEntries, userNames) {
  return workspacePresentation(workspace, desktopEntries, userNames).name
}

function workspaceSubtitle(workspace, desktopEntries, userNames) {
  return workspacePresentation(workspace, desktopEntries, userNames).subtitle
}

function workspacePresentation(workspace, desktopEntries, userNames) {
  userNames = parseNameMap(userNames)
  var toplevel = primaryToplevel(workspace)
  if (!toplevel) return { name: "empty", subtitle: "", occupied: false }

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

  return {
    name: name,
    subtitle: subtitle ? subtitle.slice(0, 42) : "",
    occupied: true
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
    var key = normalizeKey(record.id)
    if (!key || seen[key]) continue
    seen[key] = true
    if (record.missing && !record.running) continue
    out.push(record)
  }
  return out
}

function cursorIndex(section, workspaceId, pinnedIndex, workspaceCount, pinnedCount) {
  if (section === "pinned") {
    if (pinnedCount <= 0) return { section: "workspaces", workspaceId: workspaceId, pinnedIndex: 0 }
    var idx = Math.max(0, Math.min(pinnedCount - 1, pinnedIndex))
    return { section: "pinned", workspaceId: workspaceId, pinnedIndex: idx }
  }
  var id = Math.max(1, Math.min(workspaceCount, workspaceId))
  return { section: "workspaces", workspaceId: id, pinnedIndex: pinnedIndex }
}

function moveCursor(section, workspaceId, pinnedIndex, dx, dy, workspaceCount, pinnedCount) {
  var columns = 3
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
  if (row >= rows) row = rows - 1

  var next = row * columns + col + 1
  if (next > workspaceCount) next = workspaceCount
  return cursorIndex("workspaces", next, pinnedIndex, workspaceCount, pinnedCount)
}

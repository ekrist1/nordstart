.pragma library

// App-store logic for Nordstart.
//
// The catalog is not ours: Omarchy already curates one in omarchy-menu.jsonc,
// where every `install.*` row carries an icon, a label, a `when` guard that is
// true exactly when the app is *missing*, and an action that runs the install
// inside a floating terminal (which is what owns the sudo prompt — this plugin
// never escalates anything itself). A matching `remove.*` row, where one
// exists, gives us uninstall for free.
//
// Everything here is pure so it can be unit-tested in plain Node the same way
// NordstartModel.js is. No Quickshell, no imports.

// ------------------------------------------------------------------- JSONC

// The menu files are JSONC: line comments and trailing commas, neither of
// which JSON.parse accepts.
function stripJsonc(raw) {
  return String(raw || "")
    .replace(/^\s*\/\/[^\n]*(\n|$)/gm, "")
    .replace(/,(\s*[}\]])/g, "$1")
}

function normalizeMenuItem(id, raw) {
  var value = raw || {}
  return {
    id: id,
    label: value.label || id,
    icon: value.icon || "",
    iconFont: value.iconFont || "",
    action: value.action || "",
    when: value.when || "",
    isAction: !!value.action
  }
}

// A malformed or half-written file yields no rows rather than an exception —
// the store goes empty, the panel keeps working.
function parseMenuJsonc(raw) {
  var stripped = stripJsonc(raw)
  if (!stripped.trim()) return []

  var parsed
  try {
    parsed = JSON.parse(stripped)
  } catch (e) {
    return []
  }
  if (typeof parsed !== "object" || parsed === null) return []

  var source = (parsed.items && typeof parsed.items === "object" && !Array.isArray(parsed.items))
    ? parsed.items
    : parsed

  var out = []
  for (var id in source) {
    var entry = source[id]
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue
    out.push(normalizeMenuItem(id, entry))
  }
  return out
}

// The user extension file overrides the shipped one row-for-row by id.
function mergeMenuItems(defaultItems, userItems) {
  var byId = {}
  var order = []

  function absorb(list) {
    for (var i = 0; i < (list || []).length; i++) {
      var item = list[i]
      if (!item || !item.id) continue
      if (!(item.id in byId)) order.push(item.id)
      byId[item.id] = item
    }
  }

  absorb(defaultItems)
  absorb(userItems)

  var out = []
  for (var j = 0; j < order.length; j++) out.push(byId[order[j]])
  return out
}

// ----------------------------------------------------------------- catalog

var INSTALL_PREFIX = "install."
var REMOVE_PREFIX = "remove."

// Categories that are not applications.
var EXCLUDED_CATEGORIES = { style: true }

function capitalize(value) {
  var s = String(value || "")
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

// Package names mentioned in a guard, used both for display and to keep a
// curated app from showing up a second time in the raw-package results.
// Guards that test something else (`omarchy-cmd-present ollama`, a directory
// check, a shell variable) simply contribute nothing.
function packagesFromWhen(when) {
  var text = String(when || "")
  var out = []
  var re = /omarchy-pkg-present\s+([^;&|)\n]*)/g
  var match

  while ((match = re.exec(text)) !== null) {
    var parts = match[1].split(/\s+/)
    for (var i = 0; i < parts.length; i++) {
      var token = parts[i].replace(/^['"]|['"]$/g, "")
      if (isSafePackageName(token)) out.push(token)
    }
  }
  return out
}

// Pairs install.<leaf> with remove.<leaf>. The ids are symmetric wherever a
// remove row exists, so the leaf is the join key and also the stable row id.
function storeCatalog(defaultItems, userItems) {
  var items = mergeMenuItems(defaultItems, userItems)

  var byId = {}
  for (var i = 0; i < items.length; i++) byId[items[i].id] = items[i]

  // Category headers come from the `install.<category>` submenu rows, in the
  // order the menu file declares them.
  var categories = {}
  var order = 0
  for (var c = 0; c < items.length; c++) {
    var head = items[c]
    if (head.id.indexOf(INSTALL_PREFIX) !== 0 || head.isAction) continue
    var headLeaf = head.id.slice(INSTALL_PREFIX.length)
    if (headLeaf.indexOf(".") >= 0) continue
    categories[headLeaf] = { label: head.label, icon: head.icon, iconFont: head.iconFont, order: order++ }
  }

  var records = []
  for (var k = 0; k < items.length; k++) {
    var item = items[k]
    if (item.id.indexOf(INSTALL_PREFIX) !== 0 || !item.isAction) continue

    var leaf = item.id.slice(INSTALL_PREFIX.length)
    var parts = leaf.split(".")
    // Top-level install actions are the fzf pickers and meta-installers
    // (package, aur, webapp, tui, windows, preinstalls), not apps.
    if (parts.length < 2) continue

    var category = parts[0]
    if (EXCLUDED_CATEGORIES[category]) continue

    var meta = categories[category] || { label: capitalize(category), icon: "", iconFont: "", order: 999 }
    var removal = byId[REMOVE_PREFIX + leaf]

    records.push({
      key: leaf,
      id: item.id,
      label: item.label,
      icon: item.icon,
      iconFont: item.iconFont,
      category: category,
      categoryLabel: meta.label,
      categoryOrder: meta.order,
      installAction: item.action,
      installWhen: item.when,
      removeAction: removal ? removal.action : "",
      removeWhen: removal ? removal.when : "",
      packages: packagesFromWhen(item.when)
    })
  }

  records.sort(function(a, b) {
    if (a.categoryOrder !== b.categoryOrder) return a.categoryOrder - b.categoryOrder
    return a.label.toLowerCase() < b.label.toLowerCase() ? -1 : (a.label.toLowerCase() > b.label.toLowerCase() ? 1 : 0)
  })

  return records
}

// ------------------------------------------------------------------ guards

// Ported from Omarchy's own menu plugin. The point is that one `pacman -Qq`
// snapshot (plus the provides table) answers every row, so checking sixty apps
// costs one subprocess instead of sixty.
function guardHelpers() {
  return 'declare -A __omarchy_pkgs=()\n'
    + 'mapfile -t __omarchy_pkg_names < <({ pacman -Qq; LC_ALL=C pacman -Qi'
    + " | awk '/^[A-Za-z]/ { provides = ($0 ~ /^Provides/); sub(/^[^:]*: /, \"\") }"
    + ' provides && $0 != "None" { n = split($0, p, " ");'
    + ' for (i = 1; i <= n; i++) { sub(/[<>=].*/, "", p[i]); print p[i] } }\'; } 2>/dev/null)\n'
    + 'for __omarchy_pkg in "${__omarchy_pkg_names[@]}"; do __omarchy_pkgs[$__omarchy_pkg]=1; done\n'
    + '__omarchy_pkg_has() { [[ -n ${__omarchy_pkgs[$1]-} ]] && return 0; '
    + '[[ $1 == *[\\<\\>=]* ]] && { pacman -Q "$1" &>/dev/null; return; }; return 1; }\n'
    + 'omarchy-pkg-present() { local p; for p in "$@"; do __omarchy_pkg_has "$p" || return 1; done; return 0; }\n'
    + 'omarchy-pkg-missing() { local p; for p in "$@"; do __omarchy_pkg_has "$p" || return 0; done; return 1; }\n'
    + 'omarchy-cmd-present() { local c; for c in "$@"; do command -v "$c" &>/dev/null || return 1; done; return 0; }\n'
    + 'omarchy-cmd-missing() { local c; for c in "$@"; do command -v "$c" &>/dev/null || return 0; done; return 1; }\n'
}

function guardLine(key, tag, expression) {
  return "if { " + expression + "; } >/dev/null 2>&1; then echo "
    + key + ":" + tag + ":1; else echo " + key + ":" + tag + ":0; fi\n"
}

// One script for the whole catalog, reporting `<key>:<i|r>:<0|1>` per line.
function storeGuardScript(records) {
  var guards = ""

  for (var i = 0; i < (records || []).length; i++) {
    var rec = records[i]
    if (!rec || !rec.key) continue
    if (rec.installWhen) guards += guardLine(rec.key, "i", rec.installWhen)
    if (rec.removeWhen) guards += guardLine(rec.key, "r", rec.removeWhen)
  }

  return guards ? guardHelpers() + guards : ""
}

function parseStoreGuards(raw) {
  var out = {}
  var lines = String(raw || "").split("\n")

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim()
    if (!line) continue

    var colon = line.lastIndexOf(":")
    if (colon < 0) continue
    var value = line.substring(colon + 1) === "1"

    var rest = line.substring(0, colon)
    var tagAt = rest.lastIndexOf(":")
    if (tagAt < 0) continue

    var key = rest.substring(0, tagAt)
    var tag = rest.substring(tagAt + 1)
    if (!key) continue

    if (!out[key]) out[key] = {}
    if (tag === "i") out[key].installable = value
    else if (tag === "r") out[key].removable = value
  }
  return out
}

// An install guard is true when the app is missing; a remove guard is true
// when it is present. A row with neither answered yet reads as "unknown",
// which the UI presents as installable rather than pretending to know.
function storeState(record, guards) {
  if (!record) return "unknown"
  var g = (guards || {})[record.key]
  if (!g) return "unknown"

  if (g.installable !== undefined) return g.installable ? "available" : "installed"
  if (g.removable !== undefined) return g.removable ? "installed" : "available"
  return "unknown"
}

// ----------------------------------------------------------- package search

// `pacman -Ss` and `yay -Ss` both emit a header line followed by an indented
// description:
//   extra/ripgrep 15.2.0-1 [installed]
//       A search tool that combines ...
//   aur/zettli 1.0.1-1 (+0 0.00) [328d16h]
//       A fuzzy CLI note manager ...
function parsePacmanSearch(raw, limit) {
  var lines = String(raw || "").split("\n")
  var max = limit > 0 ? limit : 0
  var out = []
  var current = null

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i]
    if (!line.trim()) continue

    if (/^\s/.test(line)) {
      if (current && !current.description) current.description = line.trim()
      continue
    }

    var match = line.match(/^([A-Za-z0-9_.+-]+)\/(\S+)\s+(\S+)(.*)$/)
    if (!match) {
      current = null
      continue
    }

    if (max && out.length >= max) break

    current = {
      repo: match[1],
      name: match[2],
      version: match[3],
      description: "",
      installed: /\[installed/.test(match[4])
    }
    out.push(current)
  }
  return out
}

// -------------------------------------------------------------------- rows

var DEFAULT_PACKAGE_LIMIT = 40

function matchesStoreQuery(record, query) {
  if (!query) return true
  var haystack = (record.label + " " + record.key + " " + record.packages.join(" ")).toLowerCase()
  var terms = query.split(/\s+/)

  for (var i = 0; i < terms.length; i++) {
    if (terms[i] && haystack.indexOf(terms[i]) < 0) return false
  }
  return true
}

// Flat list for the ListView: headers are rows too, but not selectable, so
// the cursor has to step over them (see storeMoveCursor).
function storeRows(records, guards, pkgRows, opts) {
  opts = opts || {}
  var query = String(opts.query || "").trim().toLowerCase()
  var limit = opts.packageLimit > 0 ? opts.packageLimit : DEFAULT_PACKAGE_LIMIT
  var rows = []

  if (!query && opts.updateCount > 0) {
    rows.push({
      kind: "update",
      key: "update",
      label: "Update system",
      detail: opts.updateCount + (opts.updateCount === 1 ? " update" : " updates"),
      count: opts.updateCount,
      selectable: true
    })
  }

  // Dedupe against the whole catalog, not just what matched, so a curated app
  // that the query missed still suppresses its raw package twin.
  var curatedPackages = {}
  for (var c = 0; c < (records || []).length; c++) {
    var pkgs = records[c].packages
    for (var p = 0; p < pkgs.length; p++) curatedPackages[pkgs[p]] = true
  }

  var pluginCount = 0
  var plugins = opts.plugins || []
  var pluginMatches = []
  for (var pl = 0; pl < plugins.length; pl++) {
    var plugin = plugins[pl]
    if (query) {
      var hay = (plugin.label + " " + plugin.pluginId).toLowerCase()
      if (hay.indexOf(query) < 0) continue
    }
    pluginMatches.push(plugin)
  }
  if (pluginMatches.length) {
    rows.push({ kind: "header", key: "hdr:plugins", label: "Plugins", selectable: false })
    for (var pm = 0; pm < pluginMatches.length; pm++) rows.push(pluginMatches[pm])
    pluginCount = pluginMatches.length
  }

  var matchedCount = 0
  var lastCategory = ""
  for (var i = 0; i < (records || []).length; i++) {
    var rec = records[i]
    if (!matchesStoreQuery(rec, query)) continue

    if (rec.category !== lastCategory) {
      rows.push({ kind: "header", key: "hdr:" + rec.category, label: rec.categoryLabel, selectable: false })
      lastCategory = rec.category
    }

    rows.push({
      kind: "app",
      key: rec.key,
      label: rec.label,
      icon: rec.icon,
      iconFont: rec.iconFont,
      detail: rec.categoryLabel,
      state: storeState(rec, guards),
      record: rec,
      selectable: true
    })
    matchedCount++
  }

  var packageCount = 0
  if (query) {
    var pending = []
    for (var k = 0; k < (pkgRows || []).length && pending.length < limit; k++) {
      var pkg = pkgRows[k]
      if (!pkg || !pkg.name || curatedPackages[pkg.name]) continue
      pending.push(pkg)
    }

    if (pending.length) {
      rows.push({ kind: "header", key: "hdr:packages", label: "Packages", selectable: false })
      for (var q = 0; q < pending.length; q++) {
        var row = pending[q]
        rows.push({
          kind: "package",
          key: "pkg:" + row.repo + "/" + row.name,
          label: row.name,
          repo: row.repo,
          name: row.name,
          version: row.version,
          detail: row.repo,
          description: row.description,
          state: row.installed ? "installed" : "available",
          selectable: true
        })
      }
      packageCount = pending.length
    }
  }

  return { rows: rows, appCount: matchedCount, packageCount: packageCount, pluginCount: pluginCount }
}

function storeSelectableCount(rows) {
  var n = 0
  for (var i = 0; i < (rows || []).length; i++) if (rows[i].selectable) n++
  return n
}

function storeFirstSelectable(rows) {
  for (var i = 0; i < (rows || []).length; i++) if (rows[i].selectable) return i
  return 0
}

// Snap a stale cursor onto a selectable row — the list is rebuilt on every
// keystroke, so the index it held may now point at a header or past the end.
function storeClampCursor(rows, index) {
  if (!rows || !rows.length) return 0
  var i = index
  if (i < 0) i = 0
  if (i >= rows.length) i = rows.length - 1
  if (rows[i].selectable) return i

  for (var down = i; down < rows.length; down++) if (rows[down].selectable) return down
  for (var up = i; up >= 0; up--) if (rows[up].selectable) return up
  return 0
}

// Steps over headers, clamps at both ends, never wraps — same feel as the
// all-apps list.
function storeMoveCursor(rows, index, delta) {
  if (!rows || !rows.length) return 0

  var current = storeClampCursor(rows, index)
  if (!delta) return current

  var step = delta > 0 ? 1 : -1
  var remaining = Math.abs(delta)

  while (remaining > 0) {
    var next = current + step
    while (next >= 0 && next < rows.length && !rows[next].selectable) next += step
    if (next < 0 || next >= rows.length) break
    current = next
    remaining--
  }
  return current
}

// ----------------------------------------------------------------- plugins
//
// Omarchy plugins live as git checkouts under ~/.config/omarchy/plugins/<id>.
// Detecting an update is a fetch plus a rev-list; applying one is entirely
// omarchy-plugin-update's job (it shows the diff, fast-forwards, validates and
// rolls back on failure), so nothing here touches a repository.

// Single-quote for bash. Plugin ids are validated before they get here; this
// covers the install directory, which is a filesystem path and may hold spaces.
function shellQuote(value) {
  return "'" + String(value == null ? "" : value).split("'").join("'\\''") + "'"
}

// omarchy-plugin-update's own id rule. Ids reach a shell string, so anything
// outside this is dropped rather than quoted around.
function isSafePluginId(id) {
  var value = String(id || "")
  if (value.indexOf("..") >= 0) return false
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)
}

// First-party plugins ship with Omarchy and are updated by updating Omarchy,
// so only third-party checkouts belong in this list.
function parsePluginCatalog(raw) {
  var parsed
  try {
    parsed = JSON.parse(String(raw || ""))
  } catch (e) {
    return []
  }
  if (!Array.isArray(parsed)) return []

  var out = []
  for (var i = 0; i < parsed.length; i++) {
    var entry = parsed[i]
    if (!entry || entry.firstParty === true) continue
    if (!isSafePluginId(entry.id)) continue
    if (!entry.sourceDir) continue

    out.push({
      id: String(entry.id),
      name: String(entry.name || entry.id),
      description: String(entry.description || ""),
      dir: String(entry.sourceDir)
    })
  }

  out.sort(function(a, b) {
    var an = a.name.toLowerCase(), bn = b.name.toLowerCase()
    return an < bn ? -1 : (an > bn ? 1 : 0)
  })
  return out
}

// One bash run for every plugin, the same way storeGuardScript batches the
// app guards. Each check is ~0.5s of network latency rather than CPU, so they
// run concurrently; each line is short enough to land atomically on the pipe.
// The batch-mode flags are lifted from omarchy-plugin-update: without them a
// repo needing credentials blocks the whole check on a hidden password prompt.
function pluginCheckScript(records, cachePath) {
  var checks = ""
  for (var i = 0; i < (records || []).length; i++) {
    var rec = records[i]
    if (!rec || !isSafePluginId(rec.id) || !rec.dir) continue
    checks += "__nordstart_check " + shellQuote(rec.id) + " " + shellQuote(rec.dir) + " &\n"
  }
  if (!checks) return ""

  return "export GIT_TERMINAL_PROMPT=0\n"
    + "export GIT_SSH_COMMAND=\"${GIT_SSH_COMMAND:-ssh -oBatchMode=yes}\"\n"
    + "__nordstart_check() {\n"
    + "  local id=\"$1\" dir=\"$2\" remote behind\n"
    + "  if [[ ! -d $dir/.git ]]; then printf '%s\\tlocal\\t0\\t\\n' \"$id\"; return; fi\n"
    + "  remote=$(git -C \"$dir\" remote get-url origin 2>/dev/null)\n"
    + "  if ! git -C \"$dir\" fetch --quiet origin HEAD 2>/dev/null; then\n"
    + "    printf '%s\\terror\\t0\\t%s\\n' \"$id\" \"$remote\"; return\n"
    + "  fi\n"
    + "  behind=$(git -C \"$dir\" rev-list --count HEAD..FETCH_HEAD 2>/dev/null)\n"
    + "  [[ -n $behind ]] || behind=0\n"
    + "  if (( behind > 0 )); then printf '%s\\tbehind\\t%s\\t%s\\n' \"$id\" \"$behind\" \"$remote\"\n"
    + "  else printf '%s\\tok\\t0\\t%s\\n' \"$id\" \"$remote\"; fi\n"
    + "}\n"
    + "mkdir -p " + shellQuote(cachePath.replace(/\/[^/]*$/, "")) + " 2>/dev/null\n"
    + "{\n" + checks + "wait\n} | tee " + shellQuote(cachePath) + "\n"
}

function parsePluginStatus(raw) {
  var out = {}
  var lines = String(raw || "").split("\n")

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i]
    if (!line || !line.trim()) continue

    var parts = line.split("\t")
    if (parts.length < 2) continue

    var id = parts[0].trim()
    var state = parts[1].trim()
    if (!id || ["ok", "behind", "local", "error"].indexOf(state) < 0) continue

    var behind = parseInt(parts[2], 10)
    out[id] = {
      state: state,
      behind: behind > 0 ? behind : 0,
      remote: parts.length > 3 ? String(parts[3]).trim() : ""
    }
  }
  return out
}

function pluginsBehind(status) {
  var n = 0
  for (var id in (status || {})) {
    if (status[id] && status[id].state === "behind") n++
  }
  return n
}

function pluginDetail(state, behind) {
  if (state === "behind") return "update \u00b7 " + behind + (behind === 1 ? " commit" : " commits")
  if (state === "ok") return "up to date"
  if (state === "local") return "local checkout"
  if (state === "error") return "check failed"
  return "not checked yet"
}

// Selectable even when there is nothing to do, so the cursor can rest on a row
// and read why. pluginCommand is what refuses to act.
function pluginRows(records, status) {
  var rows = []
  for (var i = 0; i < (records || []).length; i++) {
    var rec = records[i]
    var info = (status || {})[rec.id]
    var state = info ? info.state : "unknown"
    var behind = info ? info.behind : 0

    rows.push({
      kind: "plugin",
      key: "plugin:" + rec.id,
      pluginId: rec.id,
      label: rec.name,
      description: rec.description,
      detail: pluginDetail(state, behind),
      state: state,
      behind: behind,
      selectable: true
    })
  }
  return rows
}

// ---------------------------------------------------------------- commands

// pacman's own permitted set. Everything that reaches a shell string is
// checked against this first, so a package name can never carry a quote,
// a space, or a substitution out of the search results.
function isSafePackageName(name) {
  return /^[A-Za-z0-9@._+][A-Za-z0-9@._+-]*$/.test(String(name || ""))
}

var TERMINAL_WRAPPER = "omarchy-launch-floating-terminal-with-presentation"

// Returns either a trusted shell string straight from the catalog, or an argv
// vector we assembled — the caller picks execDetached or execArgv to match.
function storeCommand(row, kind) {
  if (!row) return null

  if (row.kind === "update")
    return { mode: "shell", command: TERMINAL_WRAPPER + " omarchy-update" }

  if (row.kind === "app") {
    var rec = row.record
    if (!rec) return null
    if (kind === "uninstall")
      return rec.removeAction ? { mode: "shell", command: rec.removeAction } : null
    return rec.installAction ? { mode: "shell", command: rec.installAction } : null
  }

  if (row.kind === "plugin") {
    // Only a repo that has actually moved is actionable; a local checkout or a
    // failed check has nothing to apply.
    if (row.state !== "behind" || !isSafePluginId(row.pluginId)) return null
    // omarchy-plugin-update ends in `rescanPlugins`, which reloads the plugin
    // entry but leaves the QML engine on its cached compilation — the updated
    // code would not actually run. Restarting is what applies it.
    return {
      mode: "argv",
      argv: [TERMINAL_WRAPPER, "omarchy-plugin-update " + row.pluginId + " && omarchy-restart-shell"]
    }
  }

  if (row.kind === "package") {
    if (!isSafePackageName(row.name)) return null

    if (kind === "uninstall")
      return { mode: "argv", argv: [TERMINAL_WRAPPER, "omarchy-pkg-drop " + row.name] }

    var adder = row.repo === "aur" ? "omarchy-pkg-aur-add" : "omarchy-pkg-add"
    return { mode: "argv", argv: [TERMINAL_WRAPPER, "echo Installing " + row.name + "...; " + adder + " " + row.name] }
  }

  return null
}

function storeCanUninstall(row) {
  if (!row) return false
  if (row.kind === "plugin") return false
  if (row.kind === "app") return !!(row.record && row.record.removeAction) && row.state === "installed"
  if (row.kind === "package") return row.state === "installed" && isSafePackageName(row.name)
  return false
}

function storePrompt(row) {
  if (!row) return ""
  return "uninstall " + (row.label || row.name || "this") + "?"
}

function storeConfirmText(row) {
  return "Uninstall"
}

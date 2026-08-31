// Static checks for the classes of bug that unit tests structurally cannot
// reach in this project. The model tests cover pure logic; the QML needs a
// compositor, so nothing exercises it automatically. Every rule here exists
// because the corresponding mistake was actually shipped, or is an invariant
// CLAUDE.md already documents in prose.

const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const os = require("node:os")
const cp = require("node:child_process")

const ROOT = path.join(__dirname, "..")
const QML_FILES = ["Panel.qml", "BarWidget.qml"]
const JS_FILES = ["NordstartModel.js", "StoreModel.js"]

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8")
}

// ---------------------------------------------------------------------------
// 1. Invalid escape sequences in string literals
//
// `"\U000F03D7"` is not a JS escape. It evaluates to the literal 9-character
// string "U000F03D7", which is exactly what put a garbled glyph in the store
// list: the fallback icon overflowed its column and collided with the app
// name. JS silently drops the backslash on an unrecognised escape, so nothing
// warns you — not the QML engine, not qmllint.

const VALID_ESCAPES = new Set([
  "'", '"', "`", "\\", "/", "b", "f", "n", "r", "t", "v", "0", "\n", "\r"
])

// A `/` opens a regex rather than a division when the previous meaningful
// character is one of these. Needed so a regex like /^['"]$/ is not mistaken
// for the start of a string literal.
const REGEX_PRECEDERS = new Set(["(", ",", "=", ":", "[", "!", "&", "|", "?", "{", "}", ";", "+", "-", "*", "%", "<", ">", "~", "^"])

function findBadEscapes(source) {
  const bad = []
  let i = 0
  let line = 1
  let lastMeaningful = ""

  while (i < source.length) {
    const c = source[i]
    if (c === "\n") { line++; i++; continue }

    // comments
    if (c === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") i++
      continue
    }
    if (c === "/" && source[i + 1] === "*") {
      i += 2
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) {
        if (source[i] === "\n") line++
        i++
      }
      i += 2
      continue
    }

    // regex literal — skipped wholesale, its escapes follow different rules
    if (c === "/" && (lastMeaningful === "" || REGEX_PRECEDERS.has(lastMeaningful))) {
      i++
      let inClass = false
      while (i < source.length) {
        if (source[i] === "\\") { i += 2; continue }
        if (source[i] === "[") inClass = true
        else if (source[i] === "]") inClass = false
        else if (source[i] === "/" && !inClass) { i++; break }
        else if (source[i] === "\n") { line++; break }
        i++
      }
      lastMeaningful = "/"
      continue
    }

    // string literal
    if (c === '"' || c === "'" || c === "`") {
      const quote = c
      const startLine = line
      i++
      while (i < source.length && source[i] !== quote) {
        if (source[i] === "\n") {
          line++
          if (quote !== "`") break // an unterminated literal is not ours to judge
          i++
          continue
        }
        if (source[i] === "\\") {
          const next = source[i + 1]
          const isHex = next === "x" && /^[0-9a-fA-F]{2}/.test(source.slice(i + 2, i + 4))
          const isUnicode =
            next === "u" &&
            (/^[0-9a-fA-F]{4}/.test(source.slice(i + 2, i + 6)) || /^\{[0-9a-fA-F]{1,6}\}/.test(source.slice(i + 2, i + 10)))
          if (!VALID_ESCAPES.has(next) && !isHex && !isUnicode) {
            bad.push({ line: startLine, escape: "\\" + next })
          }
          i += 2
          continue
        }
        i++
      }
      i++
      lastMeaningful = quote
      continue
    }

    if (!/\s/.test(c)) lastMeaningful = c
    i++
  }
  return bad
}

test("lint: no invalid escape sequences in string literals", () => {
  // The scanner has to actually catch the bug that motivated it.
  assert.equal(findBadEscapes('var a = "\\U000F03D7"').length, 1, "\\U is not a JS escape")
  assert.equal(findBadEscapes('var a = "\\N{FOO}"').length, 1)
  // ...without flagging what is legitimate.
  assert.equal(findBadEscapes('var a = "\\u25cf \\n \\t \\\\ \\" \\x41 \\u{F03D7}"').length, 0)
  assert.equal(findBadEscapes('var re = /^[\\s\\S]+$/').length, 0, "regex escapes are not string escapes")
  assert.equal(findBadEscapes('var re = /^[\'"]|[\'"]$/g').length, 0, "quotes inside a regex are not a string")
  assert.equal(findBadEscapes('// a comment with \\Q in it').length, 0)

  for (const file of [...QML_FILES, ...JS_FILES]) {
    const bad = findBadEscapes(read(file))
    assert.equal(
      bad.length,
      0,
      `${file}: invalid escape(s) — ` +
        bad.map((b) => `${b.escape} on line ${b.line}`).join(", ") +
        `. JS drops the backslash silently, so this renders as literal text.`
    )
  }
})

// ---------------------------------------------------------------------------
// 2. SplitParser on unbounded process output
//
// SplitParser fires onRead per line. Searching "on" returns 16,534 lines of
// pacman output, so a per-line handler meant that many C++ -> JS crossings on
// every keystroke — which is what made typing lag. StdioCollector hands the
// stream over once. SplitParser is still correct for output whose size is
// known small, so this asks for that reasoning to be written down rather than
// banning it.

test("lint: every SplitParser justifies why its output is bounded", () => {
  for (const file of QML_FILES) {
    const lines = read(file).split("\n")
    lines.forEach((line, idx) => {
      if (!/\bSplitParser\b/.test(line)) return
      if (/StdioCollector/.test(line)) return // prose about the alternative
      const context = lines.slice(Math.max(0, idx - 6), idx).join("\n")
      assert.ok(
        /bounded:/.test(context),
        `${file}:${idx + 1}: SplitParser without a "bounded:" comment in the 6 lines above. ` +
          `Say why the output cannot grow, or use StdioCollector.`
      )
    })
  }
})

// ---------------------------------------------------------------------------
// 3. Settings stay in sync across three places
//
// CLAUDE.md documents this in prose: barWidget.defaults and
// barWidget.schema[].defaultValue duplicate each other, and both must cover
// every key the QML actually reads through setting(). Four settings have been
// added by hand so far, each time relying on remembering it.

test("lint: every setting() key exists in manifest defaults and schema", () => {
  const manifest = JSON.parse(read("manifest.json"))
  const defaults = manifest.barWidget.defaults
  const schema = manifest.barWidget.schema

  const used = new Set()
  for (const file of QML_FILES) {
    const source = read(file)
    for (const m of source.matchAll(/\bsetting\(\s*"([^"]+)"/g)) used.add(m[1])
  }
  assert.ok(used.size > 0, "the matcher should find setting() calls at all")

  const schemaKeys = new Set(schema.map((e) => e.key))
  for (const key of used) {
    assert.ok(key in defaults, `manifest barWidget.defaults is missing "${key}", read via setting() in QML`)
    assert.ok(schemaKeys.has(key), `manifest barWidget.schema is missing "${key}", read via setting() in QML`)
  }

  // And the two copies of the default must agree, or the settings panel and
  // the running widget disagree about what the default is.
  for (const entry of schema) {
    if (!(entry.key in defaults)) continue
    assert.deepEqual(
      entry.defaultValue,
      defaults[entry.key],
      `manifest: defaults["${entry.key}"] and schema defaultValue disagree`
    )
  }
})

// ---------------------------------------------------------------------------
// 4. The installed copy is actually what is running
//
// `omarchy-shell shell rescanPlugins` reloads the plugin entry but leaves the
// QML engine on its cached compilation, so an edit can appear to do nothing.
// That cost a full round of "the bug is still there" once. Skipped when the
// plugin is not installed or no shell is running, so a fresh checkout is green.

function installedDir() {
  return path.join(os.homedir(), ".config/omarchy/plugins/io.github.ekrist1.nordstart")
}

function shellStartedAt() {
  try {
    const pid = cp.execSync("pgrep -f 'quickshell -n -p /usr/share/omarchy/shell'", { encoding: "utf8" }).split("\n")[0].trim()
    if (!pid) return null
    const started = cp.execSync(`ps -o lstart= -p ${pid}`, { encoding: "utf8" }).trim()
    return started ? new Date(started) : null
  } catch (e) {
    return null
  }
}

test("lint: the running shell is newer than the installed plugin", (t) => {
  const dir = installedDir()
  if (!fs.existsSync(dir)) return t.skip("plugin not installed locally")

  const started = shellStartedAt()
  if (!started) return t.skip("omarchy-shell is not running")

  const newest = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".qml") || f.endsWith(".js") || f === "manifest.json")
    .map((f) => fs.statSync(path.join(dir, f)).mtime)
    .reduce((a, b) => (a > b ? a : b), new Date(0))

  assert.ok(
    started > newest,
    `the running shell started ${started.toISOString()} but the installed plugin was written ` +
      `${newest.toISOString()} — it is still running the older compilation. Run omarchy-restart-shell ` +
      `(rescanPlugins is not enough).`
  )
})

// ---------------------------------------------------------------------------
// 5. No key is bound twice, and none collides with the host's reserved keys
//
// PanelKeyCatcher (/usr/share/omarchy/shell/Ui/PanelKeyCatcher.qml) hands the
// panel `event.text`, and it consumes h/j/k/l/x/Space/Return/Esc/Tab *before*
// emitting textKey. So the panel's keyspace is one flat namespace of single
// letters with no modifiers available: Shift+1 arrives as `!` (or whatever the
// layout puts there), which is why move-mode is armed with `m` rather than
// bound to Shift+digit. Nothing at runtime reports a collision — the first
// matching branch simply wins and the second key silently does nothing.

// Consumed by PanelKeyCatcher before onTextKey ever sees them.
const RESERVED_KEYS = new Set(["h", "j", "k", "l", "x"])

function extractBoundKeys(source) {
  const body = source.slice(source.indexOf("onTextKey:"))
  const out = []
  const re = /\b(?:key|t)\s*===\s*"([^"]+)"/g
  let match
  while ((match = re.exec(body)) !== null) {
    const key = match[1]
    // Digit branches are ranges (`t >= "1" && t <= "9"`), handled separately.
    if (key.length === 1 && /[a-z]/.test(key)) out.push(key)
  }
  return out
}

function keyCollisions(keys) {
  const seen = new Set()
  const bad = []
  for (const key of keys) {
    if (RESERVED_KEYS.has(key)) bad.push(`${key} is consumed by PanelKeyCatcher and never reaches onTextKey`)
    else if (seen.has(key)) bad.push(`${key} is bound more than once`)
    seen.add(key)
  }
  return bad
}

test("lint: every panel key is bound once and is actually reachable", () => {
  const keys = extractBoundKeys(read("Panel.qml"))
  // The companion keys live in NordstartModel.js's COMPANIONS table, so they
  // are invisible to the scan above and have to be folded in by hand.
  const model = read("NordstartModel.js")
  const companionKeys = [...model.matchAll(/key:\s*"([a-z])"/g)].map((m) => m[1])

  assert.ok(keys.length > 0, "found no key bindings to check — the scan broke")
  assert.deepEqual(keyCollisions([...keys, ...companionKeys]), [])
})

test("lint: the key-collision scan can actually fail", () => {
  // A lint that cannot fail is worthless (CLAUDE.md).
  assert.equal(extractBoundKeys('onTextKey: if (key === "w") {} if (key === "m") {}').length, 2)
  assert.equal(keyCollisions(["w", "m"]).length, 0)
  assert.equal(keyCollisions(["w", "w"]).length, 1, "a duplicate must be reported")
  assert.equal(keyCollisions(["j"]).length, 1, "a PanelKeyCatcher-reserved key must be reported")
  assert.equal(keyCollisions(["a", "s", "a", "l"]).length, 2)
})

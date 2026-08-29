# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Nordstart — an [Omarchy](https://omarchy.org) shell plugin (a `bar-widget` kind) that adds a
3×3-grid icon to the top bar. Clicking/hovering it opens a launcher panel with two halves:
a 3×3 workspace grid (1–9) and a list of pinned apps with running-state dots. It also has an
all-apps search/catalog view, an app-store view (install/update/uninstall), and a session-action
footer (logout/reboot/poweroff).

The plugin is loaded and run by `omarchy-shell` (Quickshell-based), not by anything in this repo.
There is no build step — QML/JS files are read directly by the shell at runtime.

## Commands

- Run the tests: `node --test tests/*.test.js` (model logic plus `tests/source-lint.test.js`)
- Validate the plugin manifest/structure: `omarchy plugin validate .`
- Install/sync into a local Omarchy config for manual testing (see README's "Install" section for
  the full rsync-based flow and `omarchy plugin enable`).
- **After changing any `.qml` file, run `omarchy-restart-shell`.** `omarchy-shell shell rescanPlugins`
  reloads the plugin entry and logs "Local plugin changed, reloading", but the QML engine keeps its
  compiled `Panel.qml` from the URL cache, so the running shell goes on using the old code and the
  edit appears to do nothing. Confirm a reload really took by comparing the shell's start time
  (`ps -o lstart= -p $(pgrep -f 'quickshell -n -p')`) against the file's mtime.
- There is no lint/build/typecheck command in this repo; QML has no compiler here.

There is no test runner config beyond Node's built-in `node:test` — run the files above directly.
To scope to one test, use Node's `--test-name-pattern`, e.g.:
`node --test --test-name-pattern="pinned apps" tests/nordstart-model.test.js`

Note for both test files: values built inside the `vm` context carry that realm's prototypes, so
`assert.deepEqual` rejects them even when the contents match. `tests/store-model.test.js` has a
`deepEq` helper that round-trips through JSON — use it there instead of `assert.deepEqual`.
`tests/nordstart-model.test.js` has no such helper, so assert on primitives (join an array into a
string) rather than deep-comparing what a model function returned.

`tests/source-lint.test.js` is a static pass over the sources, not a unit test. It exists because
the QML has no automated coverage and cannot get any cheaply (it needs Quickshell, Hyprland and
layer-shell). Each rule encodes a mistake that was actually shipped, or an invariant this file
states in prose:

1. **Invalid string escapes** — `"\U000F03D7"` is not a JS escape; it evaluates to the literal text
   `U000F03D7`. That shipped as a garbled glyph in the store. Nothing else warns: not the QML
   engine, not qmllint.
2. **`SplitParser` needs a `bounded:` comment** within 6 lines. Per-line handling of unbounded
   output is what made store search lag (16,534 lines per keystroke). SplitParser is still right for
   small output — the rule asks you to say why, not to stop using it.
3. **`setting()` keys must exist in `barWidget.defaults` *and* `barWidget.schema`,** with matching
   default values. This is the duplication warned about below, now enforced.
4. **The running shell must be newer than the installed plugin** — catches testing against a stale
   compilation after a `rescanPlugins`. Skips when the plugin isn't installed or no shell is running,
   so a fresh checkout stays green.

When adding a rule, add a fault-injection check alongside it: a lint that cannot fail is worthless.

## Architecture

Four files carry almost all the logic; everything else (`qs.Commons`, `qs.Ui`, `Quickshell.*`,
`Quickshell.Hyprland`, `Quickshell.Wayland`) is imported from the host `omarchy-shell` environment
and lives outside this repo — treat those as an external API surface, not something to modify.

- **`NordstartModel.js`** (`.pragma library`) — all pure logic: desktop-id alias resolution,
  friendly app-name lookup, workspace/toplevel presentation, pinned-app parsing/toggling
  (`shell.json`'s `pinnedApps` string), catalog building, cursor-movement math for keyboard
  navigation, and companion (Nordtema / Nordsettings) labels plus install-command construction. It has no QML/Quickshell dependencies, which is exactly why it's unit-testable in
  plain Node (see `tests/nordstart-model.test.js`, which loads it via `vm.runInContext` after
  stripping the `.pragma library` line since Node doesn't understand that QML directive).
  When changing behavior around naming, aliasing, pinning, or navigation, this is almost always
  the file to touch, and it should stay dependency-free so it keeps loading in plain Node.
- **`StoreModel.js`** (`.pragma library`) — the app store's pure logic, kept separate from
  `NordstartModel.js` because it is a distinct domain (packages, not workspaces): JSONC parsing,
  catalog building from Omarchy's `omarchy-menu.jsonc`, the batched `when:` guard script,
  `pacman -Ss` / `yay -Ss` output parsing, cursor movement over a list containing non-selectable
  headers, and command construction. Same rules as `NordstartModel.js`: dependency-free, testable
  in plain Node (`tests/store-model.test.js`).

  The store deliberately owns no package logic of its own. Omarchy already curates the catalog in
  `$OMARCHY_PATH/default/omarchy/omarchy-menu.jsonc` (with `~/.config/omarchy/extensions/omarchy-menu.jsonc`
  as the user override), where an `install.*` row's `when` is true exactly when the app is missing
  and a paired `remove.*` row gives it an uninstall action. Every action ends in
  `omarchy-launch-floating-terminal-with-presentation`, which owns the sudo prompt — **this plugin
  must never escalate privileges or run pacman/yay mutations itself.** The parsing, guard-batching
  and file-watching patterns are ported from the host's own `/usr/share/omarchy/shell/plugins/menu/`,
  which is the reference implementation to consult when changing any of this.

  It also owns the installed-plugin list (same domain: things installed from a repo, not
  workspaces). `omarchy-plugin-catalog` supplies the list, `pluginCheckScript` batches one
  `git fetch` per plugin into a single subprocess the way `storeGuardScript` does, and applying an
  update is entirely `omarchy-plugin-update`'s job — it shows the diff, fast-forwards, validates and
  rolls back on failure. **Never git-mutate a plugin checkout from here.** The command appends
  `&& omarchy-restart-shell` on purpose: `omarchy-plugin-update` ends in `rescanPlugins`, which does
  not recompile QML (see the Commands note above), so without it an applied update would not run.
- **`Panel.qml`** — the launcher popup UI and nearly all interactive state (focus section,
  cursor position, search query, session-confirm state, workspace preview). It imports
  `NordstartModel.js as Model` and calls into it for anything computable outside QML. Handles
  keyboard input (digits, hjkl/arrows, `q`/`/` for search, `a` for all-apps, `s` for the store,
  `p` for pin/unpin, `n` for a new instance, `x` to uninstall, Tab/Shift+Tab to hop between bar
  panels, Esc to back out/close), workspace switching via Hyprland IPC, and live workspace preview
  capture.

  Launching is split into three functions on purpose, because one `launchPinned` conflated them:
  `launchPinned` (go to a running app, cycling through its windows via `Model.nextToplevel`, else
  start it), `launchNewInstance` (always spawn another copy on the current workspace), and
  `spawnApp` (the shared spawn, honouring the `launchWorkspace` setting). `Model.launchWorkspaceId`
  returning 0 means "stay put" — that is what lets a second terminal land beside the first.
  `lastFocusedAddress` is a plain object rebuilt copy-on-write, since QML only re-evaluates
  bindings when the whole object changes.

  The new-instance key differs by focus, and that is forced by the host: `PanelKeyCatcher` collapses
  Return into a modifier-less `activateRequested()`, so Shift+Enter is invisible to the list and it
  uses `n` instead; the search field sees raw events and uses `Ctrl+N` (matching the pre-existing
  `Ctrl+P` for pinning). `Model.catalogHint(record, searchFocused)` is what keeps the on-row hint
  honest about which one is live — pass `searchInput.activeFocus`.

  All-apps ordering runs through `Model.rankAppRows(rows, usage, now, query)` before
  `catalogRecords`, so the host's fuzzy score is still the input. The invariant it must keep: with a
  query present, a better textual match always wins — usage is capped at `USAGE_MAX_BOOST` (400),
  which is under the ~500 gap between the host's score bands, so frecency can only reorder *within*
  a band. Widening that cap would let a much-used app outrank a far better match. `appUsage` is
  persisted through the existing `persistSettings` round-trip and capped at 60 entries.

  Running state in the all-apps list goes through `Model.toplevelIndex(workspaces)` once per
  rebuild, passed as `catalogRecords`' optional 5th argument. Do not call `findRunningToplevel` per
  row: the index exists so annotating ~100 entries costs ~2ms rather than re-deriving each window's
  class 100 times. The index is only built while `opened && browsingApps`, so window focus changes
  do not re-walk the catalog when it is off screen.

  `view` is three-valued (`workspaces` / `apps` / `store`). `browsingApps` means the apps view
  specifically; `overlayView` means either full-width view and is what workspace-only UI should
  branch on. Adding a fourth view means revisiting both. The store's `Process` usage follows two
  traps documented in the host's `Menu.qml`: a `Process` silently ignores a `command` change while
  it is running (hence the `guardsPending` / `searchPending` flags), and a killed process still
  reports `exitCode === 0`, so `exitStatus` is what says the run actually finished.

  Companion footer buttons (left of logout/reboot/poweroff) open Nordtema and Nordsettings.
  Detection is `FileView` for Nordtema's CLI / `install.sh`, and `pluginRegistry` for
  Nordsettings. Opening a present companion goes through the host (`shell.summon` for the
  Nordtema menu route `style.nordtema`, `bar.summonBarWidget` for Nordsettings) so this
  plugin never embeds those UIs. A missing companion confirms, then
  `omarchy-launch-floating-terminal-with-presentation` runs `omarchy theme install` or
  `omarchy plugin add` — same rule as the store, never clone or enable from here.
  Install URLs live as constants in `NordstartModel.js` (`companionInstallCommand`).
- **`BarWidget.qml`** — the small bar-icon entry point. Lazily loads `Panel.qml` via a `Loader`,
  wires up the `IpcHandler` (`omarchy-shell shell toggle io.github.ekrist1.nordstart`, plus
  open/close/show/hide), hover-to-open behavior, and the bar's click-target/tooltip registration
  contract.
- **`manifest.json`** — plugin metadata and the settings schema (`hoverOpen`,
  `showWorkspacePreview`, `workspaceCount`, `pinnedApps`, `appNames`, `appAliases`,
  `appStoreEnabled`, `appStoreSearchAur`, `launchWorkspace`, `pluginUpdateCheck`). Note `barWidget.defaults` and `barWidget.schema[].defaultValue`
  duplicate each other — a new setting has to be added to both. Keep this in
  sync with any new/renamed settings read via `setting(...)` in the QML files, since it's what
  drives the bar's settings panel UI and default values.

### Settings and persistence

All user configuration is read through `setting(key, default)` (provided by the `BarWidget` base
class from the host shell) and persisted to `~/.config/omarchy/shell.json` under this plugin's id
(`io.github.ekrist1.nordstart`). `pinnedApps`/`appNames`/`appAliases` are comma-separated strings
(or, for the latter two, an equivalent JSON object) — see `NordstartModel.js`'s `parse*` functions
for the exact grammar, and the README's "Settings" section for user-facing docs of the same.

### Testing philosophy

Only the plain-function logic in `NordstartModel.js` is unit tested. Full UI (open/click/hover,
workspace preview, Hyprland IPC) is intentionally *not* covered by automated tests — it depends on
`omarchy-shell`, Hyprland, and layer-shell, which a headless test can't see. That coverage is
expected to come from manually running the plugin on the bar (see README's "Install" section).
When adding logic, prefer extracting it into `NordstartModel.js` as a pure function so it can be
tested the same way the existing logic is.

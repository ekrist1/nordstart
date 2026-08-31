# Nordstart

An [Omarchy](https://omarchy.org) shell plugin that opens a workspace launcher
from a 3×3 grid icon on the top bar.

The modal has two halves:

- **Workspaces** — a 3×3 grid of workspaces 1–9. Occupied workspaces show the
  name of the app running there; empty ones read `empty`.
- **Pinned apps** — a list of favorite apps with a dot that lights up when the
  app is already open. Click a running app to jump to its workspace, or a
  closed one to launch it on the first empty workspace.

Behind those sit three full-width views: the **all-apps** list (`a`), the
**window switcher** (`w`), and the **app store** (`s`), where you can install,
update and uninstall software.

Click a workspace, press `1`–`9`, or move with the arrow keys / `hjkl` and
press Enter. Tab and Shift+Tab move to the next or previous bar panel.

## Disclaimer
This plugin is made with Grok AI. The code is not guaranteed to be correct and may require manual review and testing. Use at your own risk.

## Install

```bash
omarchy plugin add https://github.com/ekrist1/nordstart.git --enable --yes
omarchy bar move io.github.ekrist1.nordstart --after omarchy.workspaces
```

From this folder, without git:

```bash
omarchy plugin validate .
mkdir -p ~/.config/omarchy/plugins
rsync -a --delete --exclude .git ./ ~/.config/omarchy/plugins/io.github.ekrist1.nordstart/
omarchy-restart-shell
omarchy plugin enable io.github.ekrist1.nordstart --yes
omarchy bar move io.github.ekrist1.nordstart --after omarchy.workspaces
```

Re-syncing after an edit needs `omarchy-restart-shell`, not
`omarchy-shell shell rescanPlugins`: the latter reloads the plugin entry but the QML engine keeps
its already-compiled `Panel.qml`, so the running shell quietly carries on with the old code.

## Keyboard shortcut

Add this to `~/.config/hypr/bindings.lua`:

```lua
o.bind(
  "SUPER + N",
  "Nordstart",
  "omarchy-shell shell toggle io.github.ekrist1.nordstart"
)
```

Hyprland reloads the file on save. `SUPER+N` is free in stock Omarchy;
`SUPER+SHIFT+N` stays bound to the editor.

You can also toggle it from a terminal:

```bash
omarchy-shell shell toggle io.github.ekrist1.nordstart
```

## Use

- Hover or click the grid icon on the bar (to the right of the workspace
  numbers) to open the launcher.
- Click a workspace, or press its number, to switch to it. With workspace
  preview on, the right side shows a live view of that workspace's window.
- Click a pinned app to go to it if it is running, or to start it if it is
  not. When an app has several windows open, activating it again walks
  through them in turn rather than always landing on the same one.
- Press `n` (or Shift-click) to start **another** copy of the selected app,
  on the workspace you are already on — that is how you get two terminals
  side by side, or a second window of an app that is already running. While
  the search box has focus a plain `n` types a letter, so use `Ctrl+N` there
  (the same way `Ctrl+P` pins while typing). Shift+Enter also works there.
- The all-apps list puts the apps you actually launch at the top, weighted by
  how recently you used them (a two-week half-life, so three launches today
  beat forty from six months ago). When you type, the text match still decides
  — usage only breaks ties between equally good matches. Set
  `appOrder` to `Alphabetical` to turn this off.
- Running apps in the all-apps list carry a dot and the workspace they are on,
  and the selected row spells out what its keys will do — `↵ go to 2 · n new`
  for something already running, `↵ open · n new` for something that is not.
- Press `q` or `/` to jump to search, or `a` to open the all-apps list.
  Click **search apps...** or **all apps** for the same. Type to filter,
  Enter to launch, Esc to return to workspaces (Esc again closes the
  launcher). Press `p` (or click **pin** / **unpin**) to pin the selected
  app to the launcher, or to take it off. That writes `pinnedApps` in
  `shell.json`.
- Press `s` (or click **store**) for the app store. It lists Omarchy's curated
  app catalog grouped by category — browsers, editors, terminals, AI, gaming,
  services, dev environments — with each row marked `install` or `installed`.
  Type to filter; a query that curated apps do not cover also searches the
  Arch repos. `Enter` installs the selected app, `x` uninstalls it (with a
  confirmation). When updates are pending, an **Update system** row appears at
  the top and the footer shows `store •`.

- The store also lists your installed Omarchy plugins under **Plugins**, with
  the state of each one: `update · 2 commits`, `up to date`, `local checkout`
  (a plugin that is not a git checkout, so there is nothing to pull), or
  `check failed`. Enter on a plugin that is behind opens a floating terminal
  running `omarchy plugin update`, which shows you the real diff and asks
  before applying it, then restarts the shell so the new code actually runs.
  Press `r` to check again right away; otherwise it checks every 6 hours and
  the footer shows `store •` when anything is behind.

  Installs and removals open in a floating terminal, which is where the sudo
  password prompt and the progress output appear. Nordstart itself never asks
  for a password and never runs a package command directly. The panel closes
  when the terminal takes over; reopen it to see the updated state.
- The footer icons log out immediately, and ask for confirmation before
  reboot or power off (`Enter` confirms, `Esc` cancels). To the left of
  those sit **Theme** (`t`) and **Hyprland** (`c`). Theme opens Nordtema's
  variant / bar-style / day-night menu. Hyprland opens Nordsettings' look-and-feel
  panel (and puts it on the bar if it is installed but not enabled yet).
  If either companion is missing, the same button offers to install it
  from git in a floating terminal — Nordstart never clones or enables
  anything itself.
- Press `w` (or click **windows**) for the window switcher: every open window
  across every workspace, most recently used first, with its title, its app and
  the workspace it is on. This is the one thing the workspace grid and the app
  list cannot do — with two editor windows open, the grid only tells you *that*
  something is on workspace 1, and the app list only takes you to whichever
  window it picked first. Type to filter on title, app or class; a text match
  always wins over recency. Enter focuses that exact window.
- Press `m` to move a window to another workspace, then a digit for where it
  goes (`0` for the scratchpad). In the window switcher it moves the selected
  window; anywhere else it moves the one you are focused on. Shift-click a
  workspace cell does the same with the mouse. `Esc` cancels.

  It is `m` and then a digit rather than Shift+digit because the host hands
  panels the *typed character*, so Shift+1 arrives as `!` — or `"`, or
  something else again, depending on your keyboard layout.
- The **scratchpad** chip under the grid shows what is in Hyprland's special
  workspace, which is otherwise invisible: `SUPER+S` toggles a window you
  cannot see or count. Press `0` or click the chip to toggle it, `m` then `0`
  to stash the focused window there.
- Name your workspaces with `workspaceNames` (`1=code,2=web,3=mail`). A named
  empty workspace reads as its name rather than `empty`, so the grid stays a
  map of where things belong even when nothing is running yet; a busy one shows
  the name beside the app.
- The store's **Web apps** section turns any URL into a launcher via
  `omarchy-webapp-install`, and removes them again — both in a floating
  terminal, like every other store action.
- Escape or a click outside the modal closes it. Tab and Shift+Tab move to
  the next or previous bar panel (clock, weather, and so on), including
  panels in other bar sections.

## Settings

Tune the widget from the bar settings panel, or inline in
`~/.config/omarchy/shell.json`:

```json
{
  "id": "io.github.ekrist1.nordstart",
  "hoverOpen": true,
  "showWorkspacePreview": true,
  "workspaceCount": 9,
  "workspaceNames": "",
  "moveFollowsWindow": false,
  "showScratchpad": true,
  "launchWorkspace": "Current workspace",
  "pinnedApps": "firefox,code,thunderbird,tableplus,onlyoffice-desktopeditors",
  "appNames": "",
  "appAliases": "",
  "appOrder": "Recent first",
  "appStoreEnabled": true,
  "appStoreSearchAur": false,
  "pluginUpdateCheck": "On"
}
```

`launchWorkspace` decides where an app opens when you start it: `Current
workspace` (the default) leaves you where you are, `First empty workspace`
jumps to the first unoccupied one. The `n` / Shift-click "another copy" action
ignores this and always opens on the current workspace, since asking for a
second window is asking for it beside the first.

`workspaceNames` labels the grid: `1=code,2=web,3=mail`, or an equivalent JSON
object. Unnamed workspaces are unaffected.

`moveFollowsWindow` decides what happens after `m` sends a window somewhere.
Off (the default) leaves you where you are, the same way launching an app does
— moving a window off your workspace is usually tidying, not relocating. On
takes you with it.

`showScratchpad` hides the scratchpad chip if you do not use Hyprland's special
workspace.

`appOrder` chooses between `Recent first` (the default) and `Alphabetical` for
the all-apps list. Usage is recorded in `appUsage` as `id:count:timestamp`
triples, capped at 60 apps; clear that value to reset the ordering, or set
`appOrder` to `Alphabetical` to stop recording it entirely.

`pluginUpdateCheck` controls the plugin section and its update check. `Off`
removes the section and stops all of its network traffic. The check runs one
`git fetch` per installed plugin, caching the result under
`~/.cache/nordstart/` so opening the panel never waits on the network.

`appStoreEnabled` turns the store view (and its `s` key) on or off.
`appStoreSearchAur` adds AUR results to store searches through `yay`; it is off
by default because AUR searches need the network and AUR packages are unvetted.

`pinnedApps` is a comma-separated list of desktop entry ids. Installed apps
are resolved with a few aliases (`code` also matches VS Code / Codium, `files`
matches Nautilus). Apps that are not installed are skipped. Pin or unpin from
the all-apps list to update this list in `shell.json`. A blank value falls
back to the default pins; `none` means no pins.

Nautilus windows show as **Files**. Other common desktop classes (Chrome,
Telegram, Spotify, Settings, and so on) have built-in friendly names too.

### Adding your own apps to the store

The store reads Omarchy's menu catalog, so anything you add to
`~/.config/omarchy/extensions/omarchy-menu.jsonc` shows up in it. Rows are
matched by id: an `install.<category>.<name>` entry becomes a store row, and a
matching `remove.<category>.<name>` entry gives that row an uninstall action.

```jsonc
{
  "install.editor.micro": {
    "icon": "",
    "label": "Micro",
    "when": "! omarchy-pkg-present micro",
    "action": "omarchy-install-app Micro micro"
  },
  "remove.editor.micro": {
    "icon": "",
    "label": "Micro",
    "when": "omarchy-pkg-present micro",
    "action": "omarchy-launch-floating-terminal-with-presentation 'omarchy-pkg-drop micro'"
  }
}
```

The `when` condition is what tells the store whether the app is installed. Both
files are watched, so a saved edit shows up without restarting the shell.

### Custom names and aliases

Override a display name, or add ids of your own, from the bar settings panel
or in `shell.json`:

```json
{
  "id": "io.github.ekrist1.nordstart",
  "appNames": "org.gnome.Nautilus=Files,firefox=Web,my.custom.app=Notes",
  "appAliases": "notes=my.custom.app|com.example.Notes"
}
```

`appNames` also accepts a JSON object:

```json
"appNames": { "org.telegram.desktop": "Telegram", "Alacritty": "Term" }
```

User names always win over the built-in map. `appAliases` is for pinning and
for matching a running window to a pinned row (`id=alias|alias`).

## Tests

The naming, alias, workspace, and pinned-app logic lives in
`NordstartModel.js`, and the store's catalog, guard, search-parsing and command
logic lives in `StoreModel.js` — both as plain functions, so they can be checked
without the desktop session:

```bash
node --test tests/*.test.js
```

That also runs `tests/source-lint.test.js`, a static pass over the QML and JS
that checks the things unit tests here cannot: invalid string escape sequences,
per-line handling of unbounded process output, and settings declared in the QML
but missing from `manifest.json`.

That is the right kind of test for this plugin: it locks down labels, user
overrides, terminal subtitles, and workspace cursor movement. Full UI
open/click/hover coverage still belongs to using the plugin on the bar —
QML here depends on `omarchy-shell`, Hyprland, and layer-shell, which a
headless unit test cannot see.

## Remove

```bash
omarchy plugin remove io.github.ekrist1.nordstart
```

That takes the widget off the bar and removes the plugin folder.

## License

MIT

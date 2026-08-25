# Nordstart

An [Omarchy](https://omarchy.org) shell plugin that opens a workspace launcher
from a 3×3 grid icon on the top bar.

The modal has two halves:

- **Workspaces** — a 3×3 grid of workspaces 1–9. Occupied workspaces show the
  name of the app running there; empty ones read `empty`.
- **Pinned apps** — a list of favorite apps with a dot that lights up when the
  app is already open. Click a running app to jump to its workspace, or a
  closed one to launch it on the first empty workspace.

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
omarchy-shell shell rescanPlugins
omarchy plugin enable io.github.ekrist1.nordstart --yes
omarchy bar move io.github.ekrist1.nordstart --after omarchy.workspaces
```

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
- Click a pinned app to focus it if it is running, or to open it on an empty
  workspace if it is not.
- Press `q` or `/` to jump to search, or `a` to open the all-apps list.
  Click **search apps...** or **all apps** for the same. Type to filter,
  Enter to launch, Esc to return to workspaces (Esc again closes the
  launcher). Press `p` (or click **pin** / **unpin**) to pin the selected
  app to the launcher, or to take it off. That writes `pinnedApps` in
  `shell.json`.
- The footer icons log out immediately, and ask for confirmation before
  reboot or power off (`Enter` confirms, `Esc` cancels).
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
  "pinnedApps": "firefox,code,thunderbird,tableplus,onlyoffice-desktopeditors",
  "appNames": "",
  "appAliases": ""
}
```

`pinnedApps` is a comma-separated list of desktop entry ids. Installed apps
are resolved with a few aliases (`code` also matches VS Code / Codium, `files`
matches Nautilus). Apps that are not installed are skipped. Pin or unpin from
the all-apps list to update this list in `shell.json`. A blank value falls
back to the default pins; `none` means no pins.

Nautilus windows show as **Files**. Other common desktop classes (Chrome,
Telegram, Spotify, Settings, and so on) have built-in friendly names too.

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
`NordstartModel.js` as plain functions, so it can be checked without the
desktop session:

```bash
node --test tests/nordstart-model.test.js
```

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

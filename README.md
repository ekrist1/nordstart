# Nordstart

An [Omarchy](https://omarchy.org) shell plugin that opens a workspace launcher
from a rectangle on the top bar.

The modal has two halves:

- **Workspaces** — a 3×3 grid of workspaces 1–9. Occupied workspaces show the
  name of the app running there; empty ones read `empty`.
- **Pinned apps** — a list of favorite apps with a dot that lights up when the
  app is already open. Click a running app to jump to its workspace, or a
  closed one to launch it on the first empty workspace.

Click a workspace, press `1`–`9`, or move with the arrow keys / `hjkl` and
press Enter.

## Install

From this folder:

```bash
omarchy plugin validate .
mkdir -p ~/.config/omarchy/plugins
rsync -a --delete --exclude .git ./ ~/.config/omarchy/plugins/nordstart/
omarchy-shell shell rescanPlugins
omarchy plugin enable nordstart --yes
omarchy bar move nordstart --after omarchy.workspaces
```

Or publish it as a git repo and add it the usual way:

```bash
omarchy plugin add https://github.com/you/nordstart.git --enable --yes
omarchy bar move nordstart --after omarchy.workspaces
```

## Keyboard shortcut

Add this to `~/.config/hypr/bindings.lua`:

```lua
o.bind(
  "SUPER + N",
  "Nordstart",
  "omarchy-shell shell toggle nordstart"
)
```

Hyprland reloads the file on save. `SUPER+N` is free in stock Omarchy;
`SUPER+SHIFT+N` stays bound to the editor.

You can also toggle it from a terminal:

```bash
omarchy-shell shell toggle nordstart
```

## Use

- Hover or click the rectangle on the bar (to the right of the workspace
  numbers) to open the launcher.
- Click a workspace, or press its number, to switch to it.
- Click a pinned app to focus it if it is running, or to open it on an empty
  workspace if it is not.
- Escape or a click outside the modal closes it.

## Settings

Tune the widget from the bar settings panel, or inline in
`~/.config/omarchy/shell.json`:

```json
{
  "id": "nordstart",
  "hoverOpen": true,
  "workspaceCount": 9,
  "pinnedApps": "firefox,code,thunderbird,tableplus,onlyoffice-desktopeditors"
}
```

`pinnedApps` is a comma-separated list of desktop entry ids. Installed apps
are resolved with a few aliases (`code` also matches VS Code / Codium). Apps
that are not installed are skipped.

## Remove

```bash
omarchy plugin remove nordstart
```

That takes the widget off the bar and removes the plugin folder.

## License

MIT

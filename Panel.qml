import QtQuick
import QtQuick.Layouts
import Quickshell
import Quickshell.Io
import Quickshell.Hyprland
import Quickshell.Wayland
import qs.Commons
import qs.Ui
import "NordstartModel.js" as Model
import "StoreModel.js" as Store

// Centered launcher: workspaces on the left, pinned apps on the right.
// BarWidget.qml owns the bar mark and hands this panel the button to
// anchor against — the same shape as the clock calendar.
Panel {
  id: root
  moduleName: "io.github.ekrist1.nordstart"
  ipcTarget: "io.github.ekrist1.nordstart"
  manageIpc: false

  property var anchorItem: null
  property var hostWidget: null
  readonly property var barIdentity: hostWidget || root

  readonly property color contentForeground: bar ? bar.foreground : Color.foreground
  readonly property string contentFontFamily: bar ? bar.fontFamily : Style.font.family
  readonly property color dimForeground: Qt.darker(contentForeground, 1.85)
  readonly property color keyHintForeground: Qt.darker(contentForeground, 2.6)
  readonly property color badgeForeground: Color.popups.background

  readonly property int workspaceCount: Model.clampWorkspaceCount(setting("workspaceCount", 9))
  readonly property var workspaceIds: Model.workspaceIds(workspaceCount)
  readonly property var appNames: Model.parseNameMap(setting("appNames", null))
  readonly property var appAliases: Model.parseAliasMap(setting("appAliases", null))
  readonly property var appUsage: Model.parseUsage(setting("appUsage", null))
  readonly property bool rankByUsage: String(setting("appOrder", "Recent first")).toLowerCase().indexOf("alpha") < 0
  readonly property var pinned: {
    var _ = Hyprland.workspaces.values
    var __ = Hyprland.focusedWorkspace
    var ___ = Hyprland.activeToplevel
    return Model.pinnedApps(setting("pinnedApps", null), DesktopEntries, Hyprland.workspaces, root.appNames, root.appAliases)
  }

  property string focusSection: "workspaces"
  property int focusWorkspaceId: 1
  property int focusPinnedIndex: 0
  property bool cursorActive: false
  property string view: "workspaces"
  property string searchQuery: ""
  property int appCursor: 0
  property string sessionConfirm: ""
  property string companionConfirm: ""
  property bool swallowSearchChar: false
  // appId -> address of the window we last sent the user to, so repeated
  // activation walks through an app's windows instead of re-focusing one.
  property var lastFocusedAddress: ({})

  // App store. The catalog is Omarchy's own install/remove menu, read from
  // disk; `storeGuards` is what the batched `when:` evaluation last told us
  // about which of those apps are present.
  property int storeCursor: 0
  property var storeGuards: ({})
  property var storePackages: []
  property int updateCount: 0
  property var storeDefaultItems: []
  property var storeUserItems: []
  property var storeConfirmRow: null
  property var pluginRecords: []
  property var pluginStatus: ({})
  property bool pluginsChecking: false
  property bool pluginCheckPending: false
  property bool guardsPending: false
  property bool searchPending: false
  property int searchRevision: 0
  property bool storeSearching: false
  property int spinnerFrame: 0
  readonly property var spinnerFrames: ["\u280B", "\u2819", "\u2839", "\u2838", "\u283C", "\u2834", "\u2826", "\u2827", "\u2807", "\u280F"]

  readonly property int workspaceColumns: 3
  readonly property int workspaceRowHeight: Style.space(36)
  readonly property int badgeSize: Style.space(22)
  readonly property int pinnedRowHeight: Style.space(34)
  readonly property bool showWorkspacePreview: setting("showWorkspacePreview", true) === true
  readonly property int sidebarWidth: showWorkspacePreview ? Style.space(260) : Style.space(156)
  readonly property int previewHeight: Style.space(148)
  readonly property int paneMinHeight: Style.space(248)
  readonly property var appLibrary: bar && bar.shell ? bar.shell.appLibrary : null
  readonly property int installedAppCount: {
    var lib = root.appLibrary
    var _ = DesktopEntries.applications.values
    if (!lib || typeof lib.sortedEntries !== "function") return 0
    return Model.catalogRecords(lib.sortedEntries(""), root.appNames).length
  }
  readonly property var catalog: {
    var lib = root.appLibrary
    var _ = DesktopEntries.applications.values
    var __ = Hyprland.workspaces.values
    var ___ = Hyprland.activeToplevel
    if (!lib || typeof lib.sortedEntries !== "function") return []
    // Only annotate running state when the list is actually on screen —
    // otherwise every window focus change would re-walk the catalog.
    var index = (root.opened && root.browsingApps) ? Model.toplevelIndex(Hyprland.workspaces) : null
    var rows = lib.sortedEntries(root.searchQuery)
    if (root.rankByUsage)
      rows = Model.rankAppRows(rows, root.appUsage, root.nowSeconds(), root.searchQuery)
    return Model.catalogRecords(rows, root.appNames, setting("pinnedApps", null), root.appAliases, index)
  }
  readonly property var workspaceNames: setting("workspaceNames", "")
  readonly property bool moveFollowsWindow: setting("moveFollowsWindow", false) === true
  readonly property bool scratchpadEnabled: setting("showScratchpad", true) === true

  property int windowCursor: 0
  // Frozen when the windows view opens: refreshToplevels() is async, so a live
  // binding on focusHistoryID would reshuffle the list under the cursor a beat
  // after you got there.
  property var windowRanks: ({})
  // "" = not armed. Otherwise the address to move, or "focused".
  property string movePending: ""

  readonly property var windowList: {
    var _ = Hyprland.toplevels.values
    var __ = Hyprland.activeToplevel
    // Same off-screen gate as the app catalog: no point re-walking every
    // window because focus changed while the list is not visible.
    if (!root.opened || !root.browsingWindows) return []
    return Model.rankWindowRows(
      Model.windowRows(Hyprland.toplevels, DesktopEntries, root.appNames, root.workspaceNames, root.windowRanks),
      root.searchQuery)
  }
  readonly property var windowCurrentRow: root.windowList[root.windowCursor] || null

  readonly property var scratchpadInfo: {
    var _ = Hyprland.toplevels.values
    var __ = Hyprland.activeToplevel
    if (!root.opened || !root.scratchpadEnabled) return { name: "scratchpad", count: 0, apps: [], addresses: [], summary: "" }
    return Model.specialWorkspaceRows(Hyprland.toplevels, DesktopEntries, root.appNames, "scratchpad")
  }
  readonly property bool scratchpadVisible: root.scratchpadEnabled && !root.overlayView

  readonly property bool browsingApps: root.view === "apps"
  readonly property bool browsingStore: root.view === "store"
  readonly property bool browsingWindows: root.view === "windows"
  // Every full-width view hides the workspace grid and the workspace-only
  // footer. Defined as the complement of the grid rather than a union of named
  // views, so a fifth view does not have to remember to add itself here.
  readonly property bool overlayView: root.view !== "workspaces"
  readonly property bool confirmingSession: root.sessionConfirm !== ""
  readonly property bool confirmingStore: root.storeConfirmRow !== null
  readonly property bool confirmingCompanion: root.companionConfirm !== ""
  readonly property bool confirmingAny: root.confirmingSession || root.confirmingStore || root.confirmingCompanion

  readonly property bool nordtemaCliPresent: nordtemaCliFile.present
  readonly property bool nordtemaDirPresent: nordtemaDirFile.present
  readonly property var pluginRegistry: {
    var shell = root.bar && root.bar.shell ? root.bar.shell : null
    return shell && shell.pluginRegistry ? shell.pluginRegistry : null
  }
  readonly property int pluginRegistryRevision: root.pluginRegistry ? root.pluginRegistry.registryRevision : 0
  readonly property bool nordsettingsInstalled: {
    var _ = root.pluginRegistryRevision
    var plugins = root.pluginRegistry ? root.pluginRegistry.installedPlugins : null
    return !!(plugins && plugins[Model.companionSettingsId()])
  }
  readonly property bool nordsettingsOnBar: {
    var _ = root.pluginRegistryRevision
    var __ = root.bar ? root.bar.moduleSlots : null
    if (root.pluginRegistry && typeof root.pluginRegistry.inBar === "function")
      return root.pluginRegistry.inBar(Model.companionSettingsId()) === true
    return root.findCompanionWidget(Model.companionSettingsId()) !== null
  }
  readonly property var companionFacts: ({
    themeCli: root.nordtemaCliPresent,
    themeDir: root.nordtemaDirPresent,
    settingsInstalled: root.nordsettingsInstalled,
    settingsOnBar: root.nordsettingsOnBar
  })

  readonly property string launchWorkspaceMode: Model.parseLaunchWorkspace(setting("launchWorkspace", null))
  readonly property bool storeEnabled: setting("appStoreEnabled", true) === true
  readonly property bool storeSearchAur: setting("appStoreSearchAur", false) === true
  readonly property bool pluginUpdateCheck: String(setting("pluginUpdateCheck", "On")).toLowerCase() !== "off"
  readonly property string pluginCachePath: (Quickshell.env("XDG_CACHE_HOME") || (Quickshell.env("HOME") + "/.cache")) + "/nordstart/plugin-updates.tsv"
  readonly property var pluginListRows: Store.pluginRows(root.pluginRecords, root.pluginStatus)
  readonly property int pluginsBehind: Store.pluginsBehind(root.pluginStatus)
  readonly property var storeRecords: Store.storeCatalog(root.storeDefaultItems, root.storeUserItems)
  readonly property var storeModel: Store.storeRows(root.storeRecords, root.storeGuards, root.storePackages, {
    query: root.browsingStore ? root.searchQuery : "",
    updateCount: root.updateCount,
    plugins: root.pluginListRows
  })
  readonly property var storeRows: root.storeModel.rows
  readonly property var storeCurrentRow: root.storeRows[root.storeCursor] || null
  onStoreRowsChanged: root.storeCursor = Store.storeClampCursor(root.storeRows, root.storeCursor)
  onSearchQueryChanged: if (root.browsingStore) searchDebounce.restart()
  readonly property var previewCaptureSource: {
    var ws = root.lookupWorkspace(root.focusWorkspaceId)
    var _ = ws && ws.toplevels ? ws.toplevels.values : null
    var __ = Hyprland.activeToplevel
    if (!root.opened || !root.showWorkspacePreview || root.overlayView) return null
    if (!Model.workspaceOccupied(ws)) return null
    var top = Model.primaryToplevel(ws)
    if (!top || !top.wayland) return null
    return top.wayland
  }
  readonly property bool previewLive: root.opened && root.showWorkspacePreview && !root.overlayView && root.previewCaptureSource !== null

  function open() {
    Hyprland.refreshWorkspaces()
    Hyprland.refreshToplevels()
    root.focusSection = "workspaces"
    root.focusWorkspaceId = Hyprland.focusedWorkspace ? Hyprland.focusedWorkspace.id : 1
    if (root.focusWorkspaceId < 1 || root.focusWorkspaceId > root.workspaceCount)
      root.focusWorkspaceId = 1
    root.focusPinnedIndex = 0
    root.cursorActive = true
    root.view = "workspaces"
    root.searchQuery = ""
    root.appCursor = 0
    root.windowCursor = 0
    root.movePending = ""
    root.storeCursor = 0
    root.storePackages = []
    root.sessionConfirm = ""
    root.companionConfirm = ""
    root.storeConfirmRow = null
    if (root.appLibrary && typeof root.appLibrary.refreshIcons === "function")
      root.appLibrary.refreshIcons()
    if (root.storeEnabled) root.refreshStore()
    root.controller.show()
    Qt.callLater(function() {
      if (root.opened) setCenterHoverRevealSuppressed(true)
    })
  }

  function close() {
    setCenterHoverRevealSuppressed(false)
    root.controller.hide()
  }

  function toggle() {
    if (root.opened) root.close()
    else root.open()
  }

  function switchPanel(direction) {
    // Omarchy's built-in Tab walk stays inside one bar section. Nordstart
    // lives on the left next to the workspace numbers, so that walk has
    // nowhere to go. Step through every panel on this bar surface instead,
    // left → center → right, the same order the icons read.
    if (!root.bar || typeof root.bar.panelNavigationSlots !== "function") {
      if (root.bar && typeof root.bar.switchPanelFrom === "function")
        return root.bar.switchPanelFrom(root.barIdentity, direction)
      return false
    }

    var host = root.barIdentity
    var window = null
    var liveSlots = root.bar.moduleSlots || []
    for (var i = 0; i < liveSlots.length; i++) {
      if (liveSlots[i] && liveSlots[i].activeItem === host) {
        if (typeof root.bar.slotWindow === "function")
          window = root.bar.slotWindow(liveSlots[i])
        break
      }
    }

    var regions = ["left", "center", "right"]
    var walk = []
    var currentIndex = -1
    for (var r = 0; r < regions.length; r++) {
      var regionSlots = root.bar.panelNavigationSlots(regions[r], window)
      for (var s = 0; s < regionSlots.length; s++) {
        if (regionSlots[s] && regionSlots[s].activeItem === host)
          currentIndex = walk.length
        walk.push(regionSlots[s])
      }
    }

    if (currentIndex < 0 || walk.length < 2) {
      if (typeof root.bar.switchPanelFrom === "function")
        return root.bar.switchPanelFrom(host, direction)
      return false
    }

    var step = direction < 0 ? -1 : 1
    var nextSlot = walk[(currentIndex + step + walk.length) % walk.length]
    if (!nextSlot || !nextSlot.activeItem || nextSlot.activeItem === host)
      return false
    if (typeof nextSlot.activeItem.open !== "function")
      return false
    nextSlot.activeItem.open()
    return true
  }

  function setCenterHoverRevealSuppressed(value) {
    if (root.bar && "centerHoverRevealSuppressed" in root.bar)
      root.bar.centerHoverRevealSuppressed = value
  }

  function lookupWorkspace(id) {
    return Model.workspaceById(Hyprland.workspaces, id)
  }

  function workspaceInfo(id) {
    var _ = Hyprland.workspaces.values
    var __ = Hyprland.activeToplevel
    var ___ = Hyprland.focusedWorkspace
    return Model.workspacePresentation(lookupWorkspace(id), DesktopEntries, root.appNames,
                                       Model.workspaceName(root.workspaceNames, id))
  }

  function workspaceIsOccupied(id) {
    var _ = Hyprland.workspaces.values
    var __ = Hyprland.focusedWorkspace
    return Model.workspaceOccupied(lookupWorkspace(id))
  }

  function workspaceIsFocused(id) {
    return Hyprland.focusedWorkspace !== null && Hyprland.focusedWorkspace.id === id
  }

  function isWorkspaceCursor(id) {
    return root.cursorActive && root.focusSection === "workspaces" && root.focusWorkspaceId === id
  }

  function isPinnedCursor(index) {
    return root.cursorActive && root.focusSection === "pinned" && root.focusPinnedIndex === index
  }

  function dispatchWorkspace(id) {
    var n = Math.trunc(Number(id))
    if (!(n > 0)) return false
    try {
      Hyprland.dispatch("hl.dsp.focus({ workspace = \"" + n + "\" })")
      return true
    } catch (e) {
    }
    try {
      Hyprland.dispatch("workspace " + n)
      return true
    } catch (e2) {
    }
    if (root.bar)
      root.bar.run("hyprctl dispatch " + Util.shellQuote("hl.dsp.focus({ workspace = \"" + n + "\" })"))
    return true
  }

  // `Hyprland.dispatch` is fire-and-forget over a socket: a dispatcher that is
  // syntactically fine but semantically wrong does nothing and never throws.
  // So the syntax is chosen from `usingLua` rather than guessed at with a
  // try/catch ladder — the catch here is only for the method being absent.
  function dispatchRaw(request) {
    if (!request) return
    try {
      Hyprland.dispatch(request)
    } catch (e) {
      if (root.bar) root.bar.run("hyprctl dispatch " + Util.shellQuote(request))
    }
  }

  // `!== false` rather than `=== true`: the two syntaxes are mutually
  // exclusive — a lua-configured Hyprland rejects `movetoworkspacesilent 4`
  // outright — and dispatch cannot report that failure back. So an absent
  // `usingLua` has to fall to lua, which is what Omarchy ships.
  readonly property bool hyprlandUsesLua: Hyprland.usingLua !== false

  function dispatchMoveWindow(target, follow) {
    dispatchRaw(Model.moveWindowDispatch(target, follow, root.hyprlandUsesLua))
  }

  function dispatchToggleScratchpad() {
    dispatchRaw(Model.toggleSpecialDispatch("scratchpad", root.hyprlandUsesLua))
  }

  function focusWindowAddress(address) {
    var value = String(address || "")
    if (!value) return
    try {
      Hyprland.dispatch("hl.dsp.focus({ window = \"address:" + value + "\" })")
      return
    } catch (e) {
    }
    try {
      Hyprland.dispatch("focuswindow address:" + value)
    } catch (e2) {
    }
  }

  function activateWorkspace(id) {
    dispatchWorkspace(id)
    root.close()
  }

  // Enter / click: go to the app if it is running, otherwise start it.
  // Repeated activation cycles through an app's windows rather than parking
  // on whichever one findRunningToplevel happened to pick first.
  function nowSeconds() {
    return Math.round(Date.now() / 1000)
  }

  // Reaching for an app counts whether it was already running or not — the
  // point is which apps you actually use, not which ones you cold-start.
  function noteLaunch(appId) {
    if (!root.rankByUsage || !appId) return
    var next = Model.recordLaunch(root.appUsage, appId, root.nowSeconds())
    root.persistSettings({ appUsage: Model.formatUsage(next, root.nowSeconds()) })
  }

  function launchPinned(app) {
    if (!app || !app.id) return
    root.noteLaunch(app.id)

    var windows = Model.findRunningToplevels(app.id, null, Hyprland.workspaces, root.appAliases)
    if (windows.length > 0) {
      root.focusToplevel(app.id, Model.nextToplevel(windows, root.lastFocusedAddress[app.id]))
      return
    }
    root.spawnApp(app, root.launchWorkspaceMode)
  }

  // `n` / Shift-click: always start another copy, here on this workspace.
  // Deliberately ignores the launchWorkspace setting — asking for a second
  // window is asking for it beside the first.
  function launchNewInstance(app) {
    if (!app || !app.id) return
    root.noteLaunch(app.id)
    root.spawnApp(app, "current")
  }

  function focusToplevel(appId, top) {
    if (!top) return
    var address = top.address ? String(top.address) : ""
    var workspaceId = top.workspace && top.workspace.id ? Number(top.workspace.id) : 0

    // Copy-on-write: QML only re-evaluates bindings on a whole-object change.
    var seen = ({})
    for (var key in root.lastFocusedAddress) seen[key] = root.lastFocusedAddress[key]
    seen[appId] = address
    root.lastFocusedAddress = seen

    if (workspaceId > 0) dispatchWorkspace(workspaceId)
    if (address) focusWindowAddress(address)
    root.close()
  }

  function spawnApp(app, mode) {
    var target = Model.launchWorkspaceId(mode, root.workspaceCount, Hyprland.workspaces)
    // 0 means "stay here" — that is what puts a second terminal beside the
    // first instead of throwing the user onto an empty workspace.
    if (target > 0) dispatchWorkspace(target)
    else if (Model.parseLaunchWorkspace(mode) === "empty") Hyprland.dispatch("workspace emptyn")

    var library = root.bar && root.bar.shell ? root.bar.shell.appLibrary : null
    if (library && typeof library.launch === "function") library.launch(app.id, app.name)
    else Util.execDetached("uwsm-app -- gtk-launch " + Util.shellQuote(app.id + ".desktop"))
    root.close()
  }

  // The row under the cursor, whichever list is showing.
  function currentApp() {
    // The windows view has no app cursor, and falling through to the pinned
    // one would spawn a copy of whatever is selected behind the overlay.
    if (root.browsingWindows) return null
    if (root.browsingApps) {
      var entry = root.catalog[root.appCursor]
      return entry ? { id: entry.id, name: entry.name } : null
    }
    if (root.focusSection === "pinned" && root.focusPinnedIndex >= 0 && root.focusPinnedIndex < root.pinned.length)
      return root.pinned[root.focusPinnedIndex]
    return null
  }

  function tabDirectionFromEvent(event) {
    return (event.modifiers & Qt.ShiftModifier) || event.key === Qt.Key_Backtab ? -1 : 1
  }

  // Whichever confirm dialog is open wins the key. Every key entry point
  // calls this first, so a dialog can never be typed past.
  function sessionDialogKey(key, modifiers) {
    var event = { key: key, modifiers: modifiers || 0 }
    if (root.confirmingSession) return sessionConfirmDialog.handleKey(event)
    if (root.confirmingStore) return storeConfirmDialog.handleKey(event)
    if (root.confirmingCompanion) return companionConfirmDialog.handleKey(event)
    return false
  }

  function findCompanionWidget(pluginId) {
    if (!root.bar || typeof root.bar.findPanelWidget !== "function") return null
    return root.bar.findPanelWidget(pluginId)
  }

  function companionShell() {
    return root.bar && root.bar.shell ? root.bar.shell : null
  }

  function openCompanion(id) {
    if (root.confirmingAny) return
    if (id === "theme") {
      if (Model.companionReady("theme", root.companionFacts)) {
        root.openThemeMenu()
        return
      }
      if (Model.companionKnown("theme", root.companionFacts)) {
        root.runCompanionInstall("theme")
        return
      }
      root.requestCompanionInstall("theme")
      return
    }
    if (id === "settings") {
      if (Model.companionReady("settings", root.companionFacts)) {
        root.openSettingsPanel()
        return
      }
      if (Model.companionKnown("settings", root.companionFacts)) {
        root.enableSettingsWidget()
        return
      }
      root.requestCompanionInstall("settings")
    }
  }

  function openThemeMenu() {
    var payload = "{\"menu\":\"" + Model.companionThemeMenu() + "\"}"
    var shell = root.companionShell()
    root.close()
    Qt.callLater(function() {
      if (shell && typeof shell.summon === "function")
        shell.summon("omarchy.menu", payload)
      else if (root.bar)
        root.bar.run("omarchy-shell shell summon omarchy.menu " + Util.shellQuote(payload))
      else
        Util.execDetached("omarchy-shell shell summon omarchy.menu " + Util.shellQuote(payload))
    })
  }

  function openSettingsPanel() {
    if (root.bar && typeof root.bar.summonBarWidget === "function"
        && root.bar.summonBarWidget(Model.companionSettingsId()))
      return
    var shell = root.companionShell()
    if (shell && typeof shell.summon === "function") {
      root.close()
      Qt.callLater(function() { shell.summon(Model.companionSettingsId(), "") })
      return
    }
    root.close()
    if (root.bar)
      root.bar.run("omarchy-shell shell summon " + Model.companionSettingsId())
    else
      Util.execDetached("omarchy-shell shell summon " + Model.companionSettingsId())
  }

  function enableSettingsWidget() {
    var registry = root.pluginRegistry
    if (registry && typeof registry.putBarWidget === "function") {
      registry.putBarWidget(Model.companionSettingsId(), { section: "right" })
      Qt.callLater(function() { root.openSettingsPanel() })
      return
    }
    root.close()
    var command = "omarchy plugin enable " + Model.companionSettingsId() + " --section right"
    if (root.bar) root.bar.run(command)
    else Util.execDetached(command)
  }

  function requestCompanionInstall(id) {
    if (!Model.companionInstallCommand(id, root.companionFacts)) return
    root.companionConfirm = id
    companionConfirmDialog.selectedIndex = 1
    keyCatcher.forceActiveFocus()
  }

  function confirmCompanionInstall() {
    var id = root.companionConfirm
    root.companionConfirm = ""
    if (id) root.runCompanionInstall(id)
  }

  function runCompanionInstall(id) {
    var command = Model.companionInstallCommand(id, root.companionFacts)
    if (!command) return
    root.close()
    if (command.mode === "argv") Util.execArgv(command.argv)
    else if (root.bar) root.bar.run(command.command)
    else Util.execDetached(command.command)
  }

  function activateCursor() {
    if (root.sessionDialogKey(Qt.Key_Return)) return
    if (root.browsingStore) {
      root.activateStoreRow()
      return
    }
    if (root.browsingApps) {
      root.launchCatalogApp(root.appCursor)
      return
    }
    if (root.browsingWindows) {
      root.activateWindowRow()
      return
    }
    if (root.focusSection === "scratchpad") {
      root.toggleScratchpad()
      return
    }
    if (root.focusSection === "pinned") {
      if (root.focusPinnedIndex >= 0 && root.focusPinnedIndex < root.pinned.length)
        root.launchPinned(root.pinned[root.focusPinnedIndex])
      return
    }
    root.activateWorkspace(root.focusWorkspaceId)
  }

  function moveCursor(dx, dy) {
    if (root.confirmingAny) {
      if (dx < 0 || dy < 0) root.sessionDialogKey(Qt.Key_Left)
      else if (dx > 0 || dy > 0) root.sessionDialogKey(Qt.Key_Right)
      return
    }
    if (root.browsingStore) {
      root.storeCursor = Store.storeMoveCursor(root.storeRows, root.storeCursor, dy !== 0 ? dy : dx)
      return
    }
    if (root.browsingApps) {
      root.appCursor = Model.moveAppCursor(root.appCursor, dy !== 0 ? dy : dx, root.catalog.length)
      return
    }
    if (root.browsingWindows) {
      root.windowCursor = Model.moveAppCursor(root.windowCursor, dy !== 0 ? dy : dx, root.windowList.length)
      return
    }
    root.cursorActive = true
    var next = Model.moveCursor(
      root.focusSection,
      root.focusWorkspaceId,
      root.focusPinnedIndex,
      dx,
      dy,
      root.workspaceCount,
      root.pinned.length,
      root.scratchpadVisible
    )
    root.focusSection = next.section
    root.focusWorkspaceId = next.workspaceId
    root.focusPinnedIndex = next.pinnedIndex
  }

  function handleDigit(text) {
    if (root.confirmingAny) return
    // While move-mode is armed the digits mean "put it there", in every view —
    // so this has to come before the overlay guard, or they are dead keys in
    // the windows list. `0` is only reachable here, which is what makes it
    // free to mean the scratchpad.
    if (root.movePending !== "") {
      if (text === "0") { root.moveWindowTo(Model.scratchpadTarget()); return }
      var target = parseInt(text, 10)
      if (target >= 1 && target <= root.workspaceCount) root.moveWindowTo(String(target))
      return
    }
    if (root.overlayView) return
    var n = parseInt(text, 10)
    if (!(n >= 1 && n <= root.workspaceCount)) return
    root.cursorActive = true
    root.focusSection = "workspaces"
    root.focusWorkspaceId = n
    root.activateWorkspace(n)
  }

  function enterApps(focusSearch) {
    root.enterView("apps", focusSearch)
  }

  function enterWindows(focusSearch) {
    Hyprland.refreshToplevels()
    root.windowRanks = Model.windowMruRanks(Hyprland.toplevels)
    root.windowCursor = 0
    root.enterView("windows", focusSearch)
  }

  function activateWindowRow() {
    var row = root.windowCurrentRow
    if (!row) return
    if (row.special) {
      // A stashed window is only reachable once its special workspace is out.
      root.dispatchToggleScratchpad()
    } else if (row.workspaceId > 0) {
      root.dispatchWorkspace(row.workspaceId)
    }
    root.focusWindowAddress(row.address)
    root.close()
  }

  // Arming, rather than a modified key: PanelKeyCatcher hands panels
  // `event.text`, so Shift+1 arrives as `!` (or whatever the layout puts
  // there) and never as a digit. See CLAUDE.md.
  function armMove(address) {
    if (root.confirmingAny) return
    root.movePending = String(address || "") || "focused"
    keyCatcher.forceActiveFocus()
  }

  function moveTargetRow() {
    if (root.movePending === "" || root.movePending === "focused") return null
    for (var i = 0; i < root.windowList.length; i++) {
      if (root.windowList[i].address === root.movePending) return root.windowList[i]
    }
    return null
  }

  function moveWindowTo(target) {
    var address = root.movePending === "focused" ? "" : root.movePending
    root.movePending = ""
    if (!Model.isMoveTarget(target)) return
    // Focus first, then move: the lua dispatcher moves the *focused* window,
    // and whether it accepts a `window =` selector is unverified.
    if (address) root.focusWindowAddress(address)
    root.dispatchMoveWindow(target, root.moveFollowsWindow)
    if (root.moveFollowsWindow && target.indexOf("special:") !== 0)
      root.dispatchWorkspace(parseInt(target, 10))
    root.close()
  }

  function requestMove() {
    if (root.browsingWindows) {
      var row = root.windowCurrentRow
      if (row) root.armMove(row.address)
      return
    }
    if (root.overlayView) return
    root.armMove("focused")
  }

  function toggleScratchpad() {
    root.dispatchToggleScratchpad()
    root.close()
  }

  function enterStore(focusSearch) {
    if (!root.storeEnabled) return
    root.enterView("store", focusSearch)
    root.refreshStore()
  }

  function enterView(name, focusSearch) {
    if (focusSearch !== false) focusSearch = true
    root.sessionConfirm = ""
    root.companionConfirm = ""
    root.storeConfirmRow = null
    root.view = name
    root.movePending = ""
    if (root.appCursor >= root.catalog.length) root.appCursor = 0
    if (root.windowCursor >= root.windowList.length) root.windowCursor = 0
    root.storeCursor = Store.storeClampCursor(root.storeRows, root.storeCursor)
    if (!focusSearch) {
      root.swallowSearchChar = false
      keyCatcher.forceActiveFocus()
      return
    }
    root.swallowSearchChar = true
    Qt.callLater(function() {
      if (root.opened) searchInput.forceActiveFocus()
      Qt.callLater(function() { root.swallowSearchChar = false })
    })
  }

  function leaveOverlay() {
    root.view = "workspaces"
    root.searchQuery = ""
    root.appCursor = 0
    root.windowCursor = 0
    root.movePending = ""
    root.storeCursor = 0
    root.storePackages = []
    root.sessionConfirm = ""
    root.companionConfirm = ""
    root.storeConfirmRow = null
    if (searchInput.text !== "") searchInput.text = ""
    keyCatcher.forceActiveFocus()
  }

  function handleEscape() {
    if (root.sessionDialogKey(Qt.Key_Escape)) return
    if (root.movePending !== "") {
      root.movePending = ""
      return
    }
    if (root.overlayView) {
      root.leaveOverlay()
      return
    }
    root.close()
  }

  function persistSettings(values) {
    var entry = { id: root.moduleName }
    for (var existing in root.settings) if (existing !== "id") entry[existing] = root.settings[existing]
    for (var key in values) entry[key] = values[key]
    root.settings = entry
    if (root.hostWidget && "settings" in root.hostWidget) root.hostWidget.settings = entry
    if (root.bar && root.bar.shell && typeof root.bar.shell.updateEntryInline === "function")
      root.bar.shell.updateEntryInline(root.moduleName, entry)
  }

  function togglePinnedApp(app) {
    if (!app || !app.id) return
    var next = Model.togglePinnedSetting(setting("pinnedApps", null), app.id, root.appAliases)
    root.persistSettings({ pinnedApps: next.setting })
  }

  function togglePinnedAtCursor() {
    if (!root.browsingApps) return
    root.togglePinnedApp(root.catalog[root.appCursor])
  }

  function launchCatalogApp(index) {
    var app = root.catalog[index]
    if (!app) return
    root.launchPinned({ id: app.id, name: app.name })
  }

  // ------------------------------------------------------------- app store
  //
  // Installs and removals are handed to a floating terminal
  // (omarchy-launch-floating-terminal-with-presentation), which owns the sudo
  // prompt and the progress output. Nothing here escalates, and nothing here
  // learns the outcome — the guard pass on the next open is what notices.

  function activateStoreRow() {
    var row = root.storeCurrentRow
    if (!row || !row.selectable) return
    if (row.kind === "update") {
      root.runStoreCommand(Store.storeCommand(row))
      return
    }
    // Enter never removes anything; uninstall is deliberately its own key.
    if (row.state === "installed") return
    root.runStoreCommand(Store.storeCommand(row, "install"))
  }

  function requestStoreUninstall() {
    if (!root.browsingStore) return
    var row = root.storeCurrentRow
    if (!Store.storeCanUninstall(row)) return
    root.storeConfirmRow = row
    storeConfirmDialog.selectedIndex = 1
    keyCatcher.forceActiveFocus()
  }

  function confirmStoreUninstall() {
    var row = root.storeConfirmRow
    root.storeConfirmRow = null
    if (row) root.runStoreCommand(Store.storeCommand(row, "uninstall"))
  }

  function runStoreCommand(command) {
    if (!command) return
    root.close()
    // Catalog actions are trusted strings from the menu file; anything we
    // assembled from a search result goes out as argv so no shell re-parses it.
    if (command.mode === "argv") Util.execArgv(command.argv)
    else if (root.bar) root.bar.run(command.command)
    else Util.execDetached(command.command)
  }

  function refreshStore() {
    root.evaluateStoreGuards()
    if (!updateProc.running) updateProc.running = true
    if (!pluginListProc.running) pluginListProc.running = true
  }

  // The list is local and instant; the check is a git fetch per plugin, so it
  // is only ever driven by the timer or an explicit `r`.
  function checkPluginUpdates() {
    if (!root.pluginUpdateCheck) return
    if (pluginCheckProc.running) {
      root.pluginCheckPending = true
      return
    }
    root.pluginCheckPending = false

    var script = Store.pluginCheckScript(root.pluginRecords, root.pluginCachePath)
    if (!script) return

    root.pluginsChecking = true
    pluginCheckProc.command = ["bash", "-lc", script]
    pluginCheckProc.running = true
  }

  function evaluateStoreGuards() {
    // Process ignores a command change while it is running, so a second
    // request has to wait for the one in flight rather than be dropped.
    if (guardProc.running) {
      root.guardsPending = true
      return
    }
    root.guardsPending = false

    var script = Store.storeGuardScript(root.storeRecords)
    if (!script) {
      root.storeGuards = ({})
      return
    }
    guardProc.collected = ""
    guardProc.command = ["bash", "-lc", script]
    guardProc.running = true
  }

  function runStoreSearch() {
    var query = root.searchQuery.trim()
    if (!root.browsingStore || query.length < 2) {
      root.storePackages = []
      root.storeSearching = false
      return
    }
    if (searchProc.running) {
      root.searchPending = true
      return
    }
    root.searchPending = false
    root.storeSearching = true
    searchProc.revision = ++root.searchRevision
    // The script is a constant and the query only ever lands in $1, so bash
    // never re-tokenizes it. `head` bounds the result: searching "on" would
    // otherwise return 16k lines we would parse and throw away.
    searchProc.command = root.storeSearchAur
      ? ["bash", "-lc", "yay -Ss --aur -- \"$1\" | head -n 400", "bash", query]
      : ["bash", "-lc", "pacman -Ss -- \"$1\" | head -n 400", "bash", query]
    searchProc.running = true
  }

  function requestSession(id) {
    if (!Model.sessionCommand(id)) return
    if (Model.sessionNeedsConfirm(id)) {
      root.sessionConfirm = id
      sessionConfirmDialog.selectedIndex = 1
      keyCatcher.forceActiveFocus()
      return
    }
    root.runSession(id)
  }

  function confirmSession() {
    var id = root.sessionConfirm
    root.sessionConfirm = ""
    if (id) root.runSession(id)
  }

  function runSession(id) {
    var command = Model.sessionCommand(id)
    if (!command) return
    root.close()
    if (root.bar) root.bar.run(command)
    else Util.execDetached(command)
  }

  // The whole catalog's `when:` guards in one bash run: the prelude takes a
  // single `pacman -Qq` snapshot, so sixty apps cost one subprocess.
  Process {
    id: guardProc
    property string collected: ""
    // bounded: two lines per catalog entry at most (a `when:` and a `checked:`),
    // so ~120 for the sixty apps Omarchy curates. Fixed by the menu file, not
    // by anything the user types.
    stdout: SplitParser {
      onRead: function(data) { guardProc.collected += data + "\n" }
    }
    onExited: function(exitCode, exitStatus) {
      // A killed process still reports exitCode 0, so the status is what says
      // whether the batch actually finished. A partial read would silently
      // flip rows to "unknown", so keep the last complete answer instead.
      if (exitCode === 0 && exitStatus === 0)
        root.storeGuards = Store.parseStoreGuards(guardProc.collected)
      if (root.guardsPending) Qt.callLater(function() { root.evaluateStoreGuards() })
    }
  }

  Process {
    id: searchProc
    property int revision: 0
    // StdioCollector hands the whole stream over in one callback. A SplitParser
    // here fired onRead per line, and a bare prefix like "on" matches 16,534
    // lines of pacman output: that many C++ -> JS signal crossings, and 8,267
    // result objects built, for every keystroke on the way to a real query.
    // `head` in the command bounds the input; this bounds the handling of it.
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        // Ignore a run the query has already moved past.
        if (searchProc.revision !== root.searchRevision) return
        root.storePackages = Store.parsePacmanSearch(text, 200)
        root.storeSearching = false
      }
    }
    onExited: {
      if (searchProc.revision === root.searchRevision) root.storeSearching = false
      if (root.searchPending) Qt.callLater(function() { root.runStoreSearch() })
    }
  }

  Timer {
    running: root.storeSearching
    interval: 90
    repeat: true
    onTriggered: root.spinnerFrame = (root.spinnerFrame + 1) % root.spinnerFrames.length
  }

  Process {
    id: updateProc
    property string collected: ""
    command: ["bash", "-lc", "checkupdates 2>/dev/null | wc -l"]
    // bounded: `wc -l` emits exactly one line.
    stdout: SplitParser {
      onRead: function(data) { updateProc.collected += data }
    }
    onStarted: updateProc.collected = ""
    onExited: function(exitCode, exitStatus) {
      var n = parseInt(updateProc.collected.trim(), 10)
      root.updateCount = (exitStatus === 0 && n > 0) ? n : 0
    }
  }

  // Typing shouldn't spawn a pacman per keystroke.
  // Local and instant: this is what renders the list.
  Process {
    id: pluginListProc
    command: ["omarchy-plugin-catalog"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        root.pluginRecords = Store.parsePluginCatalog(text)
        // First run of the session with nothing cached: check once so the
        // list is not stuck on "not checked yet".
        if (root.pluginUpdateCheck && root.pluginRecords.length > 0 && !pluginCacheFile.loadedOnce)
          root.checkPluginUpdates()
      }
    }
  }

  // Networked: one batched run, git fetch per plugin, tee'd to the cache.
  Process {
    id: pluginCheckProc
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.pluginStatus = Store.parsePluginStatus(text)
    }
    onExited: {
      root.pluginsChecking = false
      if (root.pluginCheckPending) Qt.callLater(function() { root.checkPluginUpdates() })
    }
  }

  // Survives a shell restart, which happens often enough that a fresh process
  // would otherwise show no status until the next check lands.
  FileView {
    id: pluginCacheFile
    property bool loadedOnce: false
    path: root.pluginCachePath
    watchChanges: true
    printErrors: false
    onLoaded: {
      pluginCacheFile.loadedOnce = true
      root.pluginStatus = Store.parsePluginStatus(text())
    }
    onLoadFailed: pluginCacheFile.loadedOnce = false
    onFileChanged: reload()
  }

  Timer {
    interval: 6 * 60 * 60 * 1000
    running: root.pluginUpdateCheck
    repeat: true
    onTriggered: root.checkPluginUpdates()
  }

  Timer {
    id: searchDebounce
    interval: 180
    onTriggered: root.runStoreSearch()
  }

  // Watched, so edits to either file land without restarting the shell.
  FileView {
    id: defaultMenuFile
    path: Quickshell.env("OMARCHY_PATH") + "/default/omarchy/omarchy-menu.jsonc"
    watchChanges: true
    printErrors: false
    onLoaded: {
      root.storeDefaultItems = Store.parseMenuJsonc(text())
      if (root.opened) root.evaluateStoreGuards()
    }
    onLoadFailed: root.storeDefaultItems = []
    onFileChanged: reload()
  }

  // Optional: how a user adds their own apps to the store.
  FileView {
    id: userMenuFile
    path: Quickshell.env("HOME") + "/.config/omarchy/extensions/omarchy-menu.jsonc"
    watchChanges: true
    printErrors: false
    onLoaded: {
      root.storeUserItems = Store.parseMenuJsonc(text())
      if (root.opened) root.evaluateStoreGuards()
    }
    onLoadFailed: root.storeUserItems = []
    onFileChanged: reload()
  }

  // Nordtema's CLI is a bash script, so FileView can watch it as text. Present
  // means install.sh has been run; the sibling FileView covers a clone that
  // has not been finished yet.
  FileView {
    id: nordtemaCliFile
    property bool present: false
    path: Quickshell.env("HOME") + "/.config/omarchy/themes/nordtema/bin/nordtema"
    watchChanges: true
    printErrors: false
    onLoaded: present = true
    onLoadFailed: present = false
    onFileChanged: reload()
  }

  FileView {
    id: nordtemaDirFile
    property bool present: false
    path: Quickshell.env("HOME") + "/.config/omarchy/themes/nordtema/install.sh"
    watchChanges: true
    printErrors: false
    onLoaded: present = true
    onLoadFailed: present = false
    onFileChanged: reload()
  }

  KeyboardPanel {
    id: panel
    anchorItem: root.anchorItem
    owner: root.barIdentity
    bar: root.bar
    open: root.opened
    centerOnBar: true
    focusTarget: keyCatcher
    contentWidth: panel.fittedContentWidth(Style.space(root.showWorkspacePreview ? 820 : 720))
    contentHeight: panel.fittedContentHeight(bodyColumn.implicitHeight)

    PanelKeyCatcher {
      id: keyCatcher
      anchors.fill: parent
      blocked: searchInput.activeFocus
      onMoveRequested: function(dx, dy) { root.moveCursor(dx, dy) }
      onActivateRequested: root.activateCursor()
      onCloseRequested: root.handleEscape()
      onTabRequested: function(direction) {
        if (root.sessionDialogKey(Qt.Key_Tab, direction < 0 ? Qt.ShiftModifier : 0)) return
        root.switchPanel(direction)
      }
      // PanelKeyCatcher already maps x/X to deleteRequested; it was simply
      // never connected before.
      onDeleteRequested: root.requestStoreUninstall()
      onTextKey: function(t) {
        if (root.confirmingAny) return
        var key = String(t || "").toLowerCase()
        // Armed move-mode owns the keyboard: digits land the window, anything
        // else backs out rather than doing two things at once.
        if (root.movePending !== "") {
          if (t >= "0" && t <= "9") { root.handleDigit(t); return }
          root.movePending = ""
          return
        }
        if (key === "q" || key === "/") {
          // Search within whichever full-width view is already open.
          root.enterView(root.overlayView ? root.view : "apps", true)
          return
        }
        if (key === "a") {
          root.enterApps(false)
          return
        }
        if (key === "w") {
          root.enterWindows(false)
          return
        }
        if (key === "m") {
          root.requestMove()
          return
        }
        if (key === "0" && !root.overlayView && root.scratchpadEnabled) {
          root.toggleScratchpad()
          return
        }
        if (key === "s" && !root.browsingApps && !root.browsingWindows) {
          root.enterStore(false)
          return
        }
        if (key === "p" && root.browsingApps) {
          root.togglePinnedAtCursor()
          return
        }
        if (key === "r" && root.browsingStore) {
          root.checkPluginUpdates()
          return
        }
        // Not in the windows view: a window gives a class, not a desktop id,
        // so there is nothing safe to spawn a second copy of.
        if (key === "n" && !root.browsingStore && !root.browsingWindows) {
          root.launchNewInstance(root.currentApp())
          return
        }
        var companionId = Model.companionForKey(key)
        if (companionId) {
          root.openCompanion(companionId)
          return
        }
        if (t >= "1" && t <= "9") root.handleDigit(t)
      }

      Column {
        id: bodyColumn
        width: parent.width
        spacing: Style.space(16)
        clip: true

        Item {
          id: mainPane
          width: parent.width
          height: Math.max(root.paneMinHeight, workspaceBody.implicitHeight)

          Column {
            id: workspaceBody
            width: parent.width
            visible: !root.overlayView
            spacing: Style.space(18)

        RowLayout {
          id: bodyRow
          width: parent.width
          spacing: Style.space(16)

          Column {
            id: workspaceColumn
            Layout.fillWidth: true
            Layout.alignment: Qt.AlignTop
            spacing: Style.space(14)

            Text {
              text: "Workspaces"
              color: root.contentForeground
              font.family: root.contentFontFamily
              font.pixelSize: Style.font.title
            }

            Grid {
              id: workspaceGrid
              width: parent.width
              columns: root.workspaceColumns
              columnSpacing: Style.space(12)
              rowSpacing: Style.space(8)

              Repeater {
                model: root.workspaceIds

                Item {
                  id: workspaceRow
                  required property int modelData

                  readonly property int workspaceId: modelData
                  readonly property var info: root.workspaceInfo(workspaceId)
                  readonly property bool occupied: root.workspaceIsOccupied(workspaceId)
                  readonly property bool focused: root.workspaceIsFocused(workspaceId)
                  readonly property bool selected: root.isWorkspaceCursor(workspaceId)
                  readonly property string label: (info && info.name) ? String(info.name) : "empty"
                  readonly property string subtitle: (info && info.subtitle) ? String(info.subtitle) : ""
                  readonly property bool hasSubtitle: subtitle.length > 0
                  // Only on an occupied cell: an empty one already reads as
                  // its name, so repeating it would just say it twice.
                  readonly property string wsName: (info && info.workspaceName && info.occupied) ? String(info.workspaceName) : ""
                  readonly property int cellWidth: Math.max(
                    Style.space(110),
                    Math.floor((workspaceGrid.width - workspaceGrid.columnSpacing * (root.workspaceColumns - 1)) / root.workspaceColumns)
                  )

                  width: cellWidth
                  height: Style.space(workspaceRow.hasSubtitle ? 50 : 36)

                  Rectangle {
                    anchors.fill: parent
                    radius: Style.cornerRadius
                    color: workspaceRow.selected || workspaceMouse.containsMouse
                      ? Style.hoverFillFor(root.contentForeground, Color.accent)
                      : "transparent"
                  }

                  Row {
                    anchors.verticalCenter: parent.verticalCenter
                    anchors.left: parent.left
                    anchors.right: parent.right
                    anchors.leftMargin: Style.space(4)
                    anchors.rightMargin: Style.space(4)
                    spacing: Style.space(8)

                    Rectangle {
                      width: root.badgeSize
                      height: root.badgeSize
                      radius: Math.max(2, Style.space(3))
                      anchors.verticalCenter: parent.verticalCenter
                      color: workspaceRow.occupied || workspaceRow.focused
                        ? root.contentForeground
                        : Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.55)

                      Text {
                        anchors.centerIn: parent
                        text: String(workspaceRow.workspaceId)
                        color: root.badgeForeground
                        font.family: root.contentFontFamily
                        font.pixelSize: Style.font.bodySmall
                        font.bold: true
                      }
                    }

                    Column {
                      id: labelColumn
                      width: parent.width - root.badgeSize - parent.spacing
                      spacing: Style.space(1)

                      Row {
                        width: parent.width
                        spacing: Style.space(6)

                        Text {
                          id: workspaceLabelText
                          width: Math.min(implicitWidth, parent.width - (wsNameText.visible ? wsNameText.implicitWidth + parent.spacing : 0))
                          text: workspaceRow.label
                          color: workspaceRow.occupied || workspaceRow.focused
                            ? root.contentForeground
                            : root.dimForeground
                          font.family: root.contentFontFamily
                          font.pixelSize: Style.font.subtitle
                          elide: Text.ElideRight
                        }

                        Text {
                          id: wsNameText
                          visible: workspaceRow.wsName !== ""
                          text: workspaceRow.wsName
                          color: root.dimForeground
                          font.family: root.contentFontFamily
                          font.pixelSize: Style.font.caption
                          anchors.verticalCenter: parent.verticalCenter
                        }
                      }

                      Text {
                        visible: workspaceRow.subtitle !== ""
                        width: parent.width
                        text: workspaceRow.subtitle
                        color: root.dimForeground
                        font.family: root.contentFontFamily
                        font.pixelSize: Style.font.bodySmall
                        elide: Text.ElideRight
                      }
                    }
                  }

                  MouseArea {
                    id: workspaceMouse
                    anchors.fill: parent
                    hoverEnabled: true
                    cursorShape: Qt.PointingHandCursor
                    onEntered: {
                      root.cursorActive = true
                      root.focusSection = "workspaces"
                      root.focusWorkspaceId = workspaceRow.workspaceId
                    }
                    onClicked: function(mouse) {
                      // Shift+click sends the focused window here instead of
                      // going there — the grid's one direct manipulation.
                      if (mouse.modifiers & Qt.ShiftModifier) {
                        root.armMove("focused")
                        root.moveWindowTo(String(workspaceRow.workspaceId))
                        return
                      }
                      root.activateWorkspace(workspaceRow.workspaceId)
                    }
                  }
                }
              }
            }

            // Hyprland's special workspace is otherwise invisible: SUPER+S
            // toggles something you cannot see or count.
            Item {
              id: scratchpadChip
              visible: root.scratchpadVisible
              width: parent.width
              height: Style.space(30)

              readonly property bool selected: root.cursorActive && root.focusSection === "scratchpad"
              readonly property bool filled: root.scratchpadInfo.count > 0

              Rectangle {
                anchors.fill: parent
                radius: Style.cornerRadius
                color: scratchpadChip.selected || scratchpadMouse.containsMouse
                  ? Style.hoverFillFor(root.contentForeground, Color.accent)
                  : "transparent"
              }

              Row {
                anchors.verticalCenter: parent.verticalCenter
                anchors.left: parent.left
                anchors.right: parent.right
                anchors.leftMargin: Style.space(4)
                anchors.rightMargin: Style.space(4)
                spacing: Style.space(8)

                Rectangle {
                  width: root.badgeSize
                  height: root.badgeSize
                  radius: Math.max(2, Style.space(3))
                  anchors.verticalCenter: parent.verticalCenter
                  color: scratchpadChip.filled
                    ? root.contentForeground
                    : Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.55)

                  Text {
                    anchors.centerIn: parent
                    text: "0"
                    color: root.badgeForeground
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.bodySmall
                    font.bold: true
                  }
                }

                Text {
                  text: "scratchpad"
                  color: scratchpadChip.filled ? root.contentForeground : root.dimForeground
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.body
                  anchors.verticalCenter: parent.verticalCenter
                }

                Text {
                  text: Model.scratchpadLabel(root.scratchpadInfo)
                  color: root.dimForeground
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.bodySmall
                  anchors.verticalCenter: parent.verticalCenter
                }
              }

              MouseArea {
                id: scratchpadMouse
                anchors.fill: parent
                hoverEnabled: true
                cursorShape: Qt.PointingHandCursor
                onEntered: {
                  root.cursorActive = true
                  root.focusSection = "scratchpad"
                }
                onClicked: function(mouse) {
                  if (mouse.modifiers & Qt.ShiftModifier) {
                    root.armMove("focused")
                    root.moveWindowTo(Model.scratchpadTarget())
                    return
                  }
                  root.toggleScratchpad()
                }
              }
            }
          }

          Rectangle {
            id: divider
            Layout.preferredWidth: Style.spacing.hairline
            Layout.fillHeight: true
            Layout.minimumHeight: Math.max(workspaceColumn.height, pinnedColumn.height)
            color: root.contentForeground
            opacity: 0.12
          }

          Column {
            id: pinnedColumn
            Layout.preferredWidth: root.sidebarWidth
            Layout.maximumWidth: root.sidebarWidth
            Layout.rightMargin: Style.space(10)
            Layout.alignment: Qt.AlignTop
            spacing: Style.space(14)
            clip: true

            Item {
              id: previewPane
              visible: root.showWorkspacePreview
              width: parent.width
              height: root.previewHeight
              clip: true

              Rectangle {
                anchors.fill: parent
                radius: Style.cornerRadius
                color: Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.06)
              }

              ScreencopyView {
                id: previewCapture
                anchors.centerIn: parent
                captureSource: root.previewCaptureSource
                live: root.previewLive
                paintCursor: false
                constraintSize.width: parent.width - Style.space(6)
                constraintSize.height: parent.height - Style.space(6)
                visible: hasContent
              }

              Text {
                visible: !root.workspaceIsOccupied(root.focusWorkspaceId)
                anchors.centerIn: parent
                text: "empty"
                color: root.dimForeground
                font.family: root.contentFontFamily
                font.pixelSize: Style.font.subtitle
              }

              Text {
                visible: root.workspaceIsOccupied(root.focusWorkspaceId) && !previewCapture.hasContent
                width: parent.width - Style.space(16)
                anchors.centerIn: parent
                horizontalAlignment: Text.AlignHCenter
                text: {
                  var info = root.workspaceInfo(root.focusWorkspaceId)
                  return (info && info.name) ? info.name : ""
                }
                color: root.dimForeground
                font.family: root.contentFontFamily
                font.pixelSize: Style.font.subtitle
                elide: Text.ElideRight
              }

              MouseArea {
                anchors.fill: parent
                cursorShape: Qt.PointingHandCursor
                onClicked: root.activateWorkspace(root.focusWorkspaceId)
              }
            }

            Text {
              text: "Pinned apps"
              color: root.contentForeground
              font.family: root.contentFontFamily
              font.pixelSize: Style.font.title
            }

            Column {
              width: parent.width
              spacing: Style.space(4)

              Repeater {
                model: root.pinned

                Item {
                  id: pinnedRow
                  required property var modelData
                  required property int index

                  readonly property bool selected: root.isPinnedCursor(index)

                  width: pinnedColumn.width
                  height: root.pinnedRowHeight
                  clip: true

                  Rectangle {
                    anchors.fill: parent
                    anchors.leftMargin: Style.space(2)
                    anchors.rightMargin: Style.space(8)
                    radius: Style.cornerRadius
                    color: pinnedRow.selected || pinnedMouse.containsMouse
                      ? Style.hoverFillFor(root.contentForeground, Color.accent)
                      : "transparent"
                  }

                  Row {
                    anchors.verticalCenter: parent.verticalCenter
                    anchors.left: parent.left
                    anchors.right: parent.right
                    anchors.leftMargin: Style.space(6)
                    anchors.rightMargin: Style.space(8)
                    spacing: Style.space(10)

                    Rectangle {
                      width: Style.space(8)
                      height: Style.space(8)
                      radius: width / 2
                      anchors.verticalCenter: parent.verticalCenter
                      color: pinnedRow.modelData.running
                        ? root.contentForeground
                        : Qt.rgba(root.contentForeground.r, root.contentForeground.g, root.contentForeground.b, 0.28)
                    }

                    Text {
                      anchors.verticalCenter: parent.verticalCenter
                      width: parent.width - Style.space(18)
                      text: pinnedRow.modelData.name
                      color: pinnedRow.modelData.running ? root.contentForeground : root.dimForeground
                      font.family: root.contentFontFamily
                      font.pixelSize: Style.font.subtitle
                      elide: Text.ElideRight
                    }
                  }

                  MouseArea {
                    id: pinnedMouse
                    anchors.fill: parent
                    hoverEnabled: true
                    cursorShape: Qt.PointingHandCursor
                    onEntered: {
                      root.cursorActive = true
                      root.focusSection = "pinned"
                      root.focusPinnedIndex = pinnedRow.index
                    }
                    onClicked: function(mouse) {
                      if (mouse.modifiers & Qt.ShiftModifier) root.launchNewInstance(pinnedRow.modelData)
                      else root.launchPinned(pinnedRow.modelData)
                    }
                  }
                }
              }

              Text {
                visible: root.pinned.length === 0
                width: parent.width
                text: "No pinned apps"
                color: root.dimForeground
                font.family: root.contentFontFamily
                font.pixelSize: Style.font.bodySmall
              }
            }
          }
        }
            }

            Column {
              id: appsBody
              visible: root.browsingApps
              width: parent.width
              height: parent.height
              spacing: Style.space(10)

              Row {
                width: parent.width
                Text {
                  width: parent.width - escHint.implicitWidth
                  text: "All apps"
                  color: root.contentForeground
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.title
                }
                Text {
                  id: escHint
                  text: "esc → workspaces"
                  color: root.dimForeground
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.bodySmall
                  anchors.verticalCenter: parent.verticalCenter
                }
              }

              ListView {
                id: appsList
                width: parent.width
                height: parent.height - y
                clip: true
                boundsBehavior: Flickable.StopAtBounds
                spacing: Style.space(2)
                model: root.catalog
                currentIndex: root.appCursor
                highlightFollowsCurrentItem: false

                onCurrentIndexChanged: {
                  if (currentIndex >= 0)
                    positionViewAtIndex(currentIndex, ListView.Contain)
                }

                delegate: Item {
                  id: appRow
                  required property var modelData
                  required property int index
                  readonly property bool selected: root.appCursor === index

                  width: appsList.width
                  height: Style.space(32)

                  Rectangle {
                    anchors.fill: parent
                    radius: Style.cornerRadius
                    color: appRow.selected || appMouse.containsMouse
                      ? Style.hoverFillFor(root.contentForeground, Color.accent)
                      : "transparent"
                  }

                  Image {
                    id: appIcon
                    anchors.verticalCenter: parent.verticalCenter
                    anchors.left: parent.left
                    anchors.leftMargin: Style.space(8)
                    width: Style.font.iconLarge
                    height: Style.font.iconLarge
                    fillMode: Image.PreserveAspectFit
                    // Decode at physical pixels — a logical-size decode leaves
                    // PNG icons upscaled and blurry on HiDPI displays.
                    sourceSize.width: width * Screen.devicePixelRatio
                    sourceSize.height: height * Screen.devicePixelRatio
                    source: root.appLibrary ? root.appLibrary.iconSource(appRow.modelData.icon) : ""
                    asynchronous: true
                  }

                  Text {
                    anchors.verticalCenter: parent.verticalCenter
                    anchors.left: appIcon.right
                    anchors.right: appTrailing.left
                    anchors.leftMargin: Style.space(8)
                    anchors.rightMargin: Style.space(8)
                    text: appRow.modelData.name
                    color: root.contentForeground
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.subtitle
                    elide: Text.ElideRight
                  }

                  // Right-hand cluster. A Row skips its invisible children, so
                  // the name reclaims the space when nothing here is showing.
                  // Above appMouse so the pin hit area wins its own clicks.
                  Row {
                    id: appTrailing
                    z: 1
                    anchors.verticalCenter: parent.verticalCenter
                    anchors.right: parent.right
                    anchors.rightMargin: Style.space(8)
                    spacing: Style.space(10)

                    Text {
                      visible: appRow.modelData.running
                      text: appRow.modelData.workspaceId > 0
                        ? "\u25cf " + appRow.modelData.workspaceId
                        : "\u25cf"
                      color: Color.accent
                      font.family: root.contentFontFamily
                      font.pixelSize: Style.font.bodySmall
                      anchors.verticalCenter: parent.verticalCenter
                    }

                    Text {
                      visible: appRow.selected
                      text: Model.catalogHint(appRow.modelData, searchInput.activeFocus)
                      color: root.dimForeground
                      font.family: root.contentFontFamily
                      font.pixelSize: Style.font.bodySmall
                      anchors.verticalCenter: parent.verticalCenter
                    }

                    Text {
                      id: pinLabel
                      visible: appRow.modelData.pinned || appRow.selected || appMouse.containsMouse
                      text: appRow.modelData.pinned ? "unpin" : "pin"
                      color: pinMouse.containsMouse ? root.contentForeground : root.dimForeground
                      font.family: root.contentFontFamily
                      font.pixelSize: Style.font.bodySmall
                      anchors.verticalCenter: parent.verticalCenter

                      MouseArea {
                        id: pinMouse
                        anchors.fill: parent
                        anchors.margins: -Style.space(6)
                        hoverEnabled: true
                        cursorShape: Qt.PointingHandCursor
                        onEntered: root.appCursor = appRow.index
                        onClicked: root.togglePinnedApp(appRow.modelData)
                      }
                    }
                  }

                  MouseArea {
                    id: appMouse
                    anchors.fill: parent
                    hoverEnabled: true
                    cursorShape: Qt.PointingHandCursor
                    onEntered: root.appCursor = appRow.index
                    onClicked: function(mouse) {
                      root.appCursor = appRow.index
                      if (mouse.modifiers & Qt.ShiftModifier) root.launchNewInstance(appRow.modelData)
                      else root.launchCatalogApp(appRow.index)
                    }
                  }
                }

                Text {
                  visible: appsList.count === 0
                  anchors.left: parent.left
                  anchors.top: parent.top
                  anchors.margins: Style.space(8)
                  text: root.searchQuery ? "No matching apps" : "No apps"
                  color: root.dimForeground
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.bodySmall
                }
              }
            }

            Column {
              id: windowsBody
              visible: root.browsingWindows
              width: parent.width
              height: parent.height
              spacing: Style.space(10)

              Row {
                width: parent.width
                Text {
                  width: parent.width - windowsEscHint.implicitWidth
                  text: "All windows"
                  color: root.contentForeground
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.title
                }
                Text {
                  id: windowsEscHint
                  text: "esc → workspaces"
                  color: root.dimForeground
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.bodySmall
                  anchors.verticalCenter: parent.verticalCenter
                }
              }

              ListView {
                id: windowsList
                width: parent.width
                height: parent.height - y
                clip: true
                boundsBehavior: Flickable.StopAtBounds
                spacing: Style.space(2)
                model: root.windowList
                currentIndex: root.windowCursor
                highlightFollowsCurrentItem: false
                onCurrentIndexChanged: {
                  if (currentIndex >= 0)
                    positionViewAtIndex(currentIndex, ListView.Contain)
                }

                delegate: Item {
                  id: windowRow
                  required property var modelData
                  required property int index
                  readonly property bool selected: root.windowCursor === index

                  width: windowsList.width
                  height: Style.space(32)

                  Rectangle {
                    anchors.fill: parent
                    radius: Style.cornerRadius
                    color: windowRow.selected || windowMouse.containsMouse
                      ? Style.hoverFillFor(root.contentForeground, Color.accent)
                      : "transparent"
                  }

                  Image {
                    id: windowIcon
                    anchors.verticalCenter: parent.verticalCenter
                    anchors.left: parent.left
                    anchors.leftMargin: Style.space(8)
                    width: Style.font.iconLarge
                    height: Style.font.iconLarge
                    fillMode: Image.PreserveAspectFit
                    sourceSize.width: width * Screen.devicePixelRatio
                    sourceSize.height: height * Screen.devicePixelRatio
                    source: root.appLibrary && windowRow.modelData.icon
                      ? root.appLibrary.iconSource(windowRow.modelData.icon)
                      : ""
                    asynchronous: true
                  }

                  // A window class does not always resolve to a desktop entry
                  // (Electron and webapp classes especially), so the glyph
                  // stands in rather than leaving a hole in the row.
                  Text {
                    anchors.centerIn: windowIcon
                    visible: windowIcon.status !== Image.Ready
                    text: ""
                    color: root.dimForeground
                    font.family: Style.bar.iconFont
                    font.pixelSize: Style.font.icon
                  }

                  Column {
                    anchors.verticalCenter: parent.verticalCenter
                    anchors.left: windowIcon.right
                    anchors.right: windowTrailing.left
                    anchors.leftMargin: Style.space(8)
                    anchors.rightMargin: Style.space(8)
                    spacing: 0

                    Text {
                      width: parent.width
                      text: windowRow.modelData.title || windowRow.modelData.appName
                      color: root.contentForeground
                      font.family: root.contentFontFamily
                      font.pixelSize: Style.font.body
                      elide: Text.ElideRight
                    }
                    Text {
                      width: parent.width
                      visible: !!windowRow.modelData.title
                      text: windowRow.modelData.appName
                      color: root.dimForeground
                      font.family: root.contentFontFamily
                      font.pixelSize: Style.font.caption
                      elide: Text.ElideRight
                    }
                  }

                  Row {
                    id: windowTrailing
                    z: 1
                    anchors.verticalCenter: parent.verticalCenter
                    anchors.right: parent.right
                    anchors.rightMargin: Style.space(8)
                    spacing: Style.space(10)

                    Text {
                      visible: windowRow.selected
                      text: Model.windowHint(windowRow.modelData, searchInput.activeFocus)
                      color: root.dimForeground
                      font.family: root.contentFontFamily
                      font.pixelSize: Style.font.bodySmall
                      anchors.verticalCenter: parent.verticalCenter
                    }

                    Text {
                      visible: windowRow.modelData.pinned
                      text: "󰀃"
                      color: root.dimForeground
                      font.family: Style.bar.iconFont
                      font.pixelSize: Style.font.bodySmall
                      anchors.verticalCenter: parent.verticalCenter
                    }

                    Text {
                      text: windowRow.modelData.workspaceLabel
                      color: windowRow.modelData.activated ? Color.accent : root.dimForeground
                      font.family: root.contentFontFamily
                      font.pixelSize: Style.font.bodySmall
                      anchors.verticalCenter: parent.verticalCenter
                    }
                  }

                  MouseArea {
                    id: windowMouse
                    anchors.fill: parent
                    hoverEnabled: true
                    cursorShape: Qt.PointingHandCursor
                    onEntered: root.windowCursor = windowRow.index
                    onClicked: function(mouse) {
                      root.windowCursor = windowRow.index
                      // Shift+click arms the move instead of jumping to it —
                      // the mouse can see modifiers even though the key
                      // catcher cannot.
                      if (mouse.modifiers & Qt.ShiftModifier) root.armMove(windowRow.modelData.address)
                      else root.activateWindowRow()
                    }
                  }
                }

                Text {
                  visible: windowsList.count === 0
                  anchors.left: parent.left
                  anchors.top: parent.top
                  anchors.margins: Style.space(8)
                  text: root.searchQuery ? "No matching windows" : "No open windows"
                  color: root.dimForeground
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.bodySmall
                }
              }
            }

            Column {
              id: storeBody
              visible: root.browsingStore
              width: parent.width
              height: parent.height
              spacing: Style.space(10)

              Row {
                width: parent.width
                spacing: Style.space(8)

                Text {
                  width: parent.width - storeEscHint.implicitWidth - storeSearchingRow.width - parent.spacing * 2
                  text: "App store"
                  color: root.contentForeground
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.title
                  elide: Text.ElideRight
                }

                Row {
                  id: storeSearchingRow
                  visible: root.storeSearching || root.pluginsChecking
                  width: visible ? implicitWidth : 0
                  spacing: Style.space(6)
                  anchors.verticalCenter: parent.verticalCenter

                  Text {
                    text: root.spinnerFrames[root.spinnerFrame]
                    color: Color.accent
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.bodySmall
                  }

                  Text {
                    text: root.pluginsChecking ? "checking plugins..." : "searching..."
                    color: root.dimForeground
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.bodySmall
                  }
                }

                Text {
                  id: storeEscHint
                  text: "esc \u2192 workspaces"
                  color: root.dimForeground
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.bodySmall
                  anchors.verticalCenter: parent.verticalCenter
                }
              }

              Item {
                width: parent.width
                height: parent.height - y

                ListView {
                  id: storeList
                  anchors.fill: parent
                  clip: true
                  boundsBehavior: Flickable.StopAtBounds
                  spacing: Style.space(2)
                  model: root.storeRows
                  currentIndex: root.storeCursor
                  highlightFollowsCurrentItem: false

                  onCurrentIndexChanged: {
                    if (currentIndex >= 0)
                      positionViewAtIndex(currentIndex, ListView.Contain)
                  }

                  delegate: Item {
                    id: storeRow
                    required property var modelData
                    required property int index
                    readonly property bool isHeader: storeRow.modelData.kind === "header"
                    readonly property bool selected: !storeRow.isHeader && root.storeCursor === storeRow.index

                    width: storeList.width
                    height: storeRow.isHeader
                      ? Style.space(26)
                      : Math.max(Style.space(32), storeRowText.implicitHeight + Style.space(12))

                    Text {
                      visible: storeRow.isHeader
                      anchors.left: parent.left
                      anchors.leftMargin: Style.space(8)
                      anchors.bottom: parent.bottom
                      anchors.bottomMargin: Style.space(4)
                      text: String(storeRow.modelData.label || "").toUpperCase()
                      color: root.dimForeground
                      font.family: root.contentFontFamily
                      font.pixelSize: Style.font.bodySmall
                      font.letterSpacing: 1
                    }

                    Rectangle {
                      visible: !storeRow.isHeader
                      anchors.fill: parent
                      radius: Style.cornerRadius
                      color: storeRow.selected || storeMouse.containsMouse
                        ? Style.hoverFillFor(root.contentForeground, Color.accent)
                        : "transparent"
                    }

                    Text {
                      id: storeGlyph
                      visible: !storeRow.isHeader
                      anchors.verticalCenter: parent.verticalCenter
                      anchors.left: parent.left
                      anchors.leftMargin: Style.space(8)
                      width: Style.space(22)
                      horizontalAlignment: Text.AlignHCenter
                      elide: Text.ElideRight
                      text: storeRow.modelData.icon || "󰏗"
                      color: root.contentForeground
                      font.family: storeRow.modelData.iconFont ? storeRow.modelData.iconFont : root.contentFontFamily
                      font.pixelSize: Style.font.subtitle
                    }

                    Column {
                      id: storeRowText
                      visible: !storeRow.isHeader
                      anchors.verticalCenter: parent.verticalCenter
                      anchors.left: storeGlyph.right
                      anchors.right: storeStateLabel.left
                      anchors.leftMargin: Style.space(8)
                      anchors.rightMargin: Style.space(8)
                      spacing: Style.space(2)

                      Text {
                        width: parent.width
                        text: storeRow.modelData.label || ""
                        color: root.contentForeground
                        font.family: root.contentFontFamily
                        font.pixelSize: Style.font.subtitle
                        elide: Text.ElideRight
                      }

                      Text {
                        width: parent.width
                        visible: !!storeRow.modelData.description
                        text: storeRow.modelData.description || ""
                        color: root.dimForeground
                        font.family: root.contentFontFamily
                        font.pixelSize: Style.font.bodySmall
                        elide: Text.ElideRight
                      }
                    }

                    Text {
                      id: storeStateLabel
                      visible: !storeRow.isHeader
                      anchors.verticalCenter: parent.verticalCenter
                      anchors.right: parent.right
                      anchors.rightMargin: Style.space(8)
                      text: {
                        var row = storeRow.modelData
                        if (row.kind === "update") return row.detail || "update"
                        // Plugins carry their own status text: "update - 2
                        // commits", "up to date", "local checkout", ...
                        if (row.kind === "plugin") return row.detail
                        // Action rows say what they do; "install" is wrong for
                        // both halves of the web-app pair.
                        if (row.actionLabel) return row.actionLabel
                        if (row.state === "installed") return storeRow.selected && Store.storeCanUninstall(row) ? "x uninstall" : "installed"
                        return "install"
                      }
                      color: {
                        var row = storeRow.modelData
                        // Accent means "there is something to do here".
                        if (row.kind === "plugin") return row.state === "behind" ? Color.accent : root.dimForeground
                        return row.state === "installed" ? root.dimForeground : Color.accent
                      }
                      font.family: root.contentFontFamily
                      font.pixelSize: Style.font.bodySmall
                    }

                    MouseArea {
                      id: storeMouse
                      anchors.fill: parent
                      enabled: !storeRow.isHeader
                      hoverEnabled: true
                      cursorShape: Qt.PointingHandCursor
                      onEntered: root.storeCursor = storeRow.index
                      onClicked: {
                        root.storeCursor = storeRow.index
                        root.activateStoreRow()
                      }
                    }
                  }
                }

                Text {
                  visible: storeList.count === 0
                  anchors.left: parent.left
                  anchors.top: parent.top
                  anchors.margins: Style.space(8)
                  text: root.searchQuery ? "No matching apps or packages" : "Catalog unavailable"
                  color: root.dimForeground
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.bodySmall
                }
              }
            }
          }

          Rectangle {
            width: parent.width
            height: Style.spacing.hairline
            color: root.contentForeground
            opacity: 0.12
          }

          Item {
            id: footer
            width: parent.width
            height: Style.space(30)

            // Armed move-mode takes over the footer, because it also takes
            // over the keyboard — the digits no longer switch workspaces.
            Row {
              id: moveBanner
              visible: root.movePending !== ""
              z: 5
              anchors.left: parent.left
              anchors.right: parent.right
              anchors.verticalCenter: parent.verticalCenter
              spacing: Style.space(8)

              Rectangle {
                width: parent.width
                height: Style.space(24)
                radius: Style.cornerRadius
                color: Style.hoverFillFor(root.contentForeground, Color.accent)

                Text {
                  anchors.verticalCenter: parent.verticalCenter
                  anchors.left: parent.left
                  anchors.leftMargin: Style.space(8)
                  text: Model.movePrompt(root.moveTargetRow(), root.workspaceNames)
                  color: root.contentForeground
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.bodySmall
                }
              }
            }

            Row {
              id: leftFooter
              visible: root.movePending === ""
              anchors.left: parent.left
              anchors.verticalCenter: parent.verticalCenter
              spacing: Style.space(10)
              height: parent.height

              Item {
                id: searchHit
                width: Style.space(200)
                height: parent.height

                Row {
                  anchors.verticalCenter: parent.verticalCenter
                  spacing: Style.space(8)
                  width: parent.width

                  Text {
                    text: ""
                    color: root.dimForeground
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.subtitle
                    anchors.verticalCenter: parent.verticalCenter
                  }

                  TextInput {
                    id: searchInput
                    width: Math.max(Style.space(80), searchHit.width - Style.space(28))
                    color: root.contentForeground
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.subtitle
                    selectedTextColor: root.badgeForeground
                    selectionColor: root.contentForeground
                    clip: true
                    onTextChanged: {
                      if (root.swallowSearchChar) {
                        if (text !== "") searchInput.text = ""
                        root.searchQuery = ""
                        return
                      }
                      var value = text
                      if (!root.overlayView && value.length > 0 && value.charAt(0) === "/") {
                        value = value.slice(1)
                        if (searchInput.text !== value) {
                          Qt.callLater(function() {
                            var next = searchInput.text
                            if (next.length > 0 && next.charAt(0) === "/")
                              searchInput.text = next.slice(1)
                          })
                        }
                        root.searchQuery = value
                        root.appCursor = 0
                        root.enterApps(true)
                        return
                      }
                      root.searchQuery = value
                      root.appCursor = 0
                      root.storeCursor = 0
                      if (value.length > 0 && !root.overlayView) root.enterApps(true)
                    }
                    onActiveFocusChanged: if (activeFocus && !root.overlayView) root.enterApps(true)

                    Keys.onPressed: function(event) {
                      if (event.key === Qt.Key_Escape) {
                        if (searchInput.text !== "") {
                          searchInput.text = ""
                          root.searchQuery = ""
                          event.accepted = true
                          return
                        }
                        root.leaveOverlay()
                        event.accepted = true
                      } else if (event.key === Qt.Key_Down) {
                        root.moveCursor(0, 1)
                        event.accepted = true
                      } else if (event.key === Qt.Key_Up) {
                        root.moveCursor(0, -1)
                        event.accepted = true
                      } else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) {
                        if (root.browsingStore) root.activateStoreRow()
                        else if (root.browsingWindows) root.activateWindowRow()
                        else if (event.modifiers & Qt.ShiftModifier) root.launchNewInstance(root.currentApp())
                        else root.launchCatalogApp(root.appCursor)
                        event.accepted = true
                      } else if (event.key === Qt.Key_M && (event.modifiers & Qt.ControlModifier)) {
                        // A plain `m` types a letter here, the same reason
                        // pinning is Ctrl+P and a new instance is Ctrl+N.
                        root.requestMove()
                        event.accepted = true
                      } else if (event.key === Qt.Key_N && (event.modifiers & Qt.ControlModifier)) {
                        root.launchNewInstance(root.currentApp())
                        event.accepted = true
                      } else if (event.key === Qt.Key_P && (event.modifiers & Qt.ControlModifier)) {
                        root.togglePinnedAtCursor()
                        event.accepted = true
                      } else if (event.key === Qt.Key_Tab || event.key === Qt.Key_Backtab) {
                        root.switchPanel(root.tabDirectionFromEvent(event))
                        event.accepted = true
                      }
                    }
                  }
                }

                Row {
                  visible: searchInput.text.length === 0 && !searchInput.activeFocus
                  anchors.verticalCenter: parent.verticalCenter
                  anchors.left: parent.left
                  anchors.leftMargin: Style.space(26)
                  spacing: Style.space(8)
                  z: 2

                  Text {
                    text: "q"
                    color: root.keyHintForeground
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.subtitle
                    anchors.verticalCenter: parent.verticalCenter
                  }

                  Text {
                    text: Model.searchPlaceholder(root.view)
                    color: root.dimForeground
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.subtitle
                  }
                }

                MouseArea {
                  anchors.fill: parent
                  enabled: !searchInput.activeFocus
                  hoverEnabled: true
                  cursorShape: Qt.IBeamCursor
                  onClicked: root.enterApps(true)
                }
              }

            }

            Row {
              id: rightFooter
              visible: root.movePending === ""
              anchors.right: parent.right
              anchors.verticalCenter: parent.verticalCenter
              spacing: Style.space(10)
              height: parent.height

              Text {
                visible: !root.overlayView
                anchors.verticalCenter: parent.verticalCenter
                text: root.installedAppCount + " apps"
                color: root.dimForeground
                font.family: root.contentFontFamily
                font.pixelSize: Style.font.bodySmall
              }

              Item {
                visible: !root.overlayView
                width: visible ? allAppsRow.implicitWidth : 0
                height: parent.height

                Row {
                  id: allAppsRow
                  spacing: Style.space(6)
                  anchors.verticalCenter: parent.verticalCenter

                  Text {
                    text: "a"
                    color: root.keyHintForeground
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.subtitle
                  }

                  Text {
                    text: "all apps"
                    color: allAppsMouse.containsMouse ? root.contentForeground : root.dimForeground
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.bodySmall
                  }
                }

                MouseArea {
                  id: allAppsMouse
                  anchors.fill: parent
                  hoverEnabled: true
                  cursorShape: Qt.PointingHandCursor
                  onClicked: root.enterApps(false)
                }
              }

              Item {
                visible: !root.overlayView
                width: visible ? windowsFooterRow.implicitWidth : 0
                height: parent.height

                Row {
                  id: windowsFooterRow
                  spacing: Style.space(6)
                  anchors.verticalCenter: parent.verticalCenter

                  Text {
                    text: "w"
                    color: root.keyHintForeground
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.subtitle
                  }

                  Text {
                    text: "windows"
                    color: windowsFooterMouse.containsMouse ? root.contentForeground : root.dimForeground
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.bodySmall
                  }
                }

                MouseArea {
                  id: windowsFooterMouse
                  anchors.fill: parent
                  hoverEnabled: true
                  cursorShape: Qt.PointingHandCursor
                  onClicked: root.enterWindows(false)
                }
              }

              Item {
                visible: !root.overlayView && root.storeEnabled
                width: visible ? storeFooterRow.implicitWidth : 0
                height: parent.height

                Row {
                  id: storeFooterRow
                  spacing: Style.space(6)
                  anchors.verticalCenter: parent.verticalCenter

                  Text {
                    text: "s"
                    color: root.keyHintForeground
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.subtitle
                  }

                  Text {
                    text: (root.updateCount > 0 || root.pluginsBehind > 0) ? "store \u2022" : "store"
                    color: storeFooterMouse.containsMouse ? root.contentForeground : root.dimForeground
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.bodySmall
                  }
                }

                MouseArea {
                  id: storeFooterMouse
                  anchors.fill: parent
                  hoverEnabled: true
                  cursorShape: Qt.PointingHandCursor
                  onClicked: root.enterStore(false)
                }
              }

              Rectangle {
                visible: !root.overlayView
                width: Style.spacing.hairline
                height: Style.space(16)
                anchors.verticalCenter: parent.verticalCenter
                color: root.contentForeground
                opacity: 0.18
              }

              SessionButton {
                glyph: "󰸌"
                hint: Model.companionKey("theme")
                label: Model.companionLabel("theme", root.companionFacts)
                muted: !Model.companionKnown("theme", root.companionFacts)
                onActivated: root.openCompanion("theme")
              }
              SessionButton {
                glyph: "󰕴"
                hint: Model.companionKey("settings")
                label: Model.companionLabel("settings", root.companionFacts)
                muted: !Model.companionKnown("settings", root.companionFacts)
                onActivated: root.openCompanion("settings")
              }

              Rectangle {
                width: Style.spacing.hairline
                height: Style.space(16)
                anchors.verticalCenter: parent.verticalCenter
                color: root.contentForeground
                opacity: 0.18
              }

              SessionButton {
                glyph: "󰍃"
                label: "Log out"
                onActivated: root.requestSession("logout")
              }
              SessionButton {
                glyph: "󰜉"
                label: "Reboot"
                onActivated: root.requestSession("reboot")
              }
              SessionButton {
                glyph: "󰐥"
                label: "Power off"
                danger: true
                onActivated: root.requestSession("shutdown")
              }
            }
          }
      }

      ConfirmDialog {
        id: sessionConfirmDialog
        anchors.fill: parent
        z: 20
        opened: root.confirmingSession
        message: Model.sessionPrompt(root.sessionConfirm)
        confirmText: Model.sessionConfirmText(root.sessionConfirm)
        background: Color.popups.background
        foreground: root.contentForeground
        selectedText: Color.accent
        fontFamily: root.contentFontFamily
        onCanceled: root.sessionConfirm = ""
        onConfirmed: root.confirmSession()
      }

      ConfirmDialog {
        id: storeConfirmDialog
        anchors.fill: parent
        z: 20
        opened: root.confirmingStore
        message: Store.storePrompt(root.storeConfirmRow)
        confirmText: Store.storeConfirmText(root.storeConfirmRow)
        background: Color.popups.background
        foreground: root.contentForeground
        selectedText: Color.accent
        fontFamily: root.contentFontFamily
        onCanceled: root.storeConfirmRow = null
        onConfirmed: root.confirmStoreUninstall()
      }

      ConfirmDialog {
        id: companionConfirmDialog
        anchors.fill: parent
        z: 20
        opened: root.confirmingCompanion
        message: Model.companionPrompt(root.companionConfirm)
        confirmText: Model.companionConfirmText(root.companionConfirm)
        background: Color.popups.background
        foreground: root.contentForeground
        selectedText: Color.accent
        fontFamily: root.contentFontFamily
        onCanceled: root.companionConfirm = ""
        onConfirmed: root.confirmCompanionInstall()
      }
    }
  }

  component SessionButton: Item {
    id: btn
    property string glyph: ""
    property string hint: ""
    property string label: ""
    property bool danger: false
    property bool muted: false
    signal activated()

    readonly property bool hot: area.containsMouse
    readonly property color ink: btn.hot && btn.danger
      ? Color.urgent
      : (btn.muted && !btn.hot ? root.dimForeground : root.contentForeground)
    implicitHeight: Style.space(26)
    implicitWidth: inner.implicitWidth + Style.space(10)

    Rectangle {
      anchors.fill: parent
      radius: Style.cornerRadius
      color: btn.hot
        ? (btn.danger ? Qt.rgba(Color.urgent.r, Color.urgent.g, Color.urgent.b, 0.28) : Style.hoverFillFor(root.contentForeground, Color.accent))
        : "transparent"
    }

    Row {
      id: inner
      anchors.centerIn: parent
      spacing: Style.space(6)

      Text {
        visible: btn.hint !== ""
        text: btn.hint
        color: root.keyHintForeground
        font.family: root.contentFontFamily
        font.pixelSize: Style.font.subtitle
        anchors.verticalCenter: parent.verticalCenter
      }

      Text {
        text: btn.glyph
        color: btn.ink
        font.family: root.contentFontFamily
        font.pixelSize: Style.font.subtitle
      }

      Text {
        visible: btn.hot
        text: btn.label
        color: btn.ink
        font.family: root.contentFontFamily
        font.pixelSize: Style.font.bodySmall
        anchors.verticalCenter: parent.verticalCenter
      }
    }

    MouseArea {
      id: area
      anchors.fill: parent
      hoverEnabled: true
      cursorShape: Qt.PointingHandCursor
      onClicked: btn.activated()
    }
  }
}

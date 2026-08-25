import QtQuick
import QtQuick.Layouts
import Quickshell
import Quickshell.Hyprland
import Quickshell.Wayland
import qs.Commons
import qs.Ui
import "NordstartModel.js" as Model

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
  property bool swallowSearchChar: false

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
    return lib && typeof lib.sortedEntries === "function" ? lib.sortedEntries("").length : 0
  }
  readonly property var catalog: {
    var lib = root.appLibrary
    var _ = DesktopEntries.applications.values
    if (!lib || typeof lib.sortedEntries !== "function") return []
    return Model.catalogRecords(lib.sortedEntries(root.searchQuery), root.appNames, setting("pinnedApps", null), root.appAliases)
  }
  readonly property bool browsingApps: root.view === "apps"
  readonly property bool confirmingSession: root.sessionConfirm !== ""
  readonly property var previewCaptureSource: {
    var _ = Hyprland.workspaces.values
    var __ = Hyprland.activeToplevel
    var ___ = root.focusWorkspaceId
    if (!root.opened || !root.showWorkspacePreview || root.browsingApps) return null
    if (!root.workspaceIsOccupied(root.focusWorkspaceId)) return null
    var top = Model.primaryToplevel(root.lookupWorkspace(root.focusWorkspaceId))
    if (!top || !top.wayland) return null
    return top.wayland
  }
  readonly property bool previewLive: root.opened && root.showWorkspacePreview && !root.browsingApps && root.previewCaptureSource !== null

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
    root.sessionConfirm = ""
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
    return Model.workspacePresentation(lookupWorkspace(id), DesktopEntries, root.appNames)
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

  function launchPinned(app) {
    if (!app) return
    if (app.running) {
      if (app.workspaceId > 0) dispatchWorkspace(app.workspaceId)
      if (app.address) focusWindowAddress(app.address)
      root.close()
      return
    }

    var emptyId = Model.firstEmptyWorkspace(root.workspaceCount, Hyprland.workspaces)
    if (emptyId > 0) dispatchWorkspace(emptyId)
    else Hyprland.dispatch("workspace emptyn")

    var library = root.bar && root.bar.shell ? root.bar.shell.appLibrary : null
    if (library && typeof library.launch === "function") library.launch(app.id, app.name)
    else Util.execDetached("uwsm-app -- gtk-launch " + Util.shellQuote(app.id + ".desktop"))
    root.close()
  }

  function activateCursor() {
    if (root.confirmingSession) {
      root.confirmSession()
      return
    }
    if (root.browsingApps) {
      root.launchCatalogApp(root.appCursor)
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
    if (root.confirmingSession) return
    if (root.browsingApps) {
      root.appCursor = Model.moveAppCursor(root.appCursor, dy !== 0 ? dy : dx, root.catalog.length)
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
      root.pinned.length
    )
    root.focusSection = next.section
    root.focusWorkspaceId = next.workspaceId
    root.focusPinnedIndex = next.pinnedIndex
  }

  function handleDigit(text) {
    if (root.browsingApps || root.confirmingSession) return
    var n = parseInt(text, 10)
    if (!(n >= 1 && n <= root.workspaceCount)) return
    root.cursorActive = true
    root.focusSection = "workspaces"
    root.focusWorkspaceId = n
    root.activateWorkspace(n)
  }

  function enterApps(focusSearch) {
    if (focusSearch !== false) focusSearch = true
    root.sessionConfirm = ""
    root.view = "apps"
    if (root.appCursor >= root.catalog.length) root.appCursor = 0
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

  function leaveApps() {
    root.view = "workspaces"
    root.searchQuery = ""
    root.appCursor = 0
    root.sessionConfirm = ""
    if (searchInput.text !== "") searchInput.text = ""
    keyCatcher.forceActiveFocus()
  }

  function handleEscape() {
    if (root.confirmingSession) {
      root.sessionConfirm = ""
      return
    }
    if (root.browsingApps) {
      root.leaveApps()
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
    var running = Model.findRunningToplevel(app.id, null, Hyprland.workspaces, root.appAliases)
    root.launchPinned({
      id: app.id,
      name: app.name,
      running: !!running,
      workspaceId: running && running.workspace ? Number(running.workspace.id) : 0,
      address: running && running.address ? String(running.address) : ""
    })
  }

  function requestSession(id) {
    if (!Model.sessionCommand(id)) return
    if (Model.sessionNeedsConfirm(id)) {
      root.sessionConfirm = id
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
      onTabRequested: function(direction) { root.switchPanel(direction) }
      onTextKey: function(t) {
        if (root.confirmingSession) return
        var key = String(t || "").toLowerCase()
        if (key === "q" || key === "/") {
          root.enterApps(true)
          return
        }
        if (key === "a") {
          root.enterApps(false)
          return
        }
        if (key === "p" && root.browsingApps) {
          root.togglePinnedAtCursor()
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
            visible: !root.browsingApps
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

                      Text {
                        width: parent.width
                        text: workspaceRow.label
                        color: workspaceRow.occupied || workspaceRow.focused
                          ? root.contentForeground
                          : root.dimForeground
                        font.family: root.contentFontFamily
                        font.pixelSize: Style.font.subtitle
                        elide: Text.ElideRight
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
                    onClicked: root.activateWorkspace(workspaceRow.workspaceId)
                  }
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
                    onClicked: root.launchPinned(pinnedRow.modelData)
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

                  Text {
                    anchors.verticalCenter: parent.verticalCenter
                    anchors.left: parent.left
                    anchors.right: pinLabel.left
                    anchors.leftMargin: Style.space(8)
                    anchors.rightMargin: Style.space(8)
                    text: appRow.modelData.name
                    color: root.contentForeground
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.subtitle
                    elide: Text.ElideRight
                  }

                  Text {
                    id: pinLabel
                    anchors.verticalCenter: parent.verticalCenter
                    anchors.right: parent.right
                    anchors.rightMargin: Style.space(8)
                    visible: appRow.modelData.pinned || appRow.selected || appMouse.containsMouse || pinMouse.containsMouse
                    text: appRow.modelData.pinned ? "unpin" : "pin"
                    color: pinMouse.containsMouse ? root.contentForeground : root.dimForeground
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.bodySmall
                  }

                  MouseArea {
                    id: appMouse
                    anchors.fill: parent
                    hoverEnabled: true
                    cursorShape: Qt.PointingHandCursor
                    onEntered: root.appCursor = appRow.index
                    onClicked: root.launchCatalogApp(appRow.index)
                  }

                  MouseArea {
                    id: pinMouse
                    anchors.top: parent.top
                    anchors.bottom: parent.bottom
                    anchors.right: parent.right
                    width: pinLabel.implicitWidth + Style.space(16)
                    hoverEnabled: true
                    cursorShape: Qt.PointingHandCursor
                    onEntered: root.appCursor = appRow.index
                    onClicked: root.togglePinnedApp(appRow.modelData)
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

            RowLayout {
              visible: !root.confirmingSession
              anchors.fill: parent
              spacing: Style.space(10)

              Row {
                id: leftFooter
                Layout.fillWidth: false
                Layout.alignment: Qt.AlignLeft | Qt.AlignVCenter
                Layout.preferredWidth: Style.space(200) + (root.browsingApps ? Style.space(56) : 0)
                Layout.maximumWidth: Style.space(200) + (root.browsingApps ? Style.space(56) : 0)
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
                      if (text === "/") {
                        Qt.callLater(function() {
                          if (searchInput.text === "/") searchInput.text = ""
                        })
                        root.searchQuery = ""
                        if (!root.browsingApps) root.enterApps(true)
                        return
                      }
                      root.searchQuery = text
                      root.appCursor = 0
                      if (text.length > 0 && !root.browsingApps) root.enterApps(true)
                    }
                    onActiveFocusChanged: if (activeFocus && !root.browsingApps) root.enterApps(true)

                    Keys.onPressed: function(event) {
                      if (event.key === Qt.Key_Escape) {
                        if (searchInput.text !== "") {
                          searchInput.text = ""
                          root.searchQuery = ""
                          event.accepted = true
                          return
                        }
                        root.leaveApps()
                        event.accepted = true
                      } else if (event.key === Qt.Key_Down) {
                        root.moveCursor(0, 1)
                        event.accepted = true
                      } else if (event.key === Qt.Key_Up) {
                        root.moveCursor(0, -1)
                        event.accepted = true
                      } else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) {
                        root.launchCatalogApp(root.appCursor)
                        event.accepted = true
                      } else if (event.key === Qt.Key_P && (event.modifiers & Qt.ControlModifier)) {
                        root.togglePinnedAtCursor()
                        event.accepted = true
                      } else if (event.key === Qt.Key_Tab || event.key === Qt.Key_Backtab) {
                        root.switchPanel((event.modifiers & Qt.ShiftModifier) || event.key === Qt.Key_Backtab ? -1 : 1)
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
                    text: "search apps..."
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

              Item {
                id: footerPin
                visible: root.browsingApps
                width: footerPinRow.implicitWidth
                height: parent.height

                Row {
                  id: footerPinRow
                  spacing: Style.space(6)
                  anchors.verticalCenter: parent.verticalCenter

                  Text {
                    visible: !searchInput.activeFocus
                    text: "p"
                    color: root.keyHintForeground
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.subtitle
                  }

                  Text {
                    text: {
                      var app = root.catalog[root.appCursor]
                      return app && app.pinned ? "unpin" : "pin"
                    }
                    color: footerPinMouse.containsMouse ? root.contentForeground : root.dimForeground
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.bodySmall
                  }
                }

                MouseArea {
                  id: footerPinMouse
                  anchors.fill: parent
                  hoverEnabled: true
                  cursorShape: Qt.PointingHandCursor
                  onClicked: root.togglePinnedAtCursor()
                }
              }
              }

              Item {
                Layout.fillWidth: true
                Layout.fillHeight: true
                Layout.minimumWidth: Style.space(16)
              }

              Text {
                visible: !root.browsingApps
                text: root.installedAppCount + " apps"
                color: root.dimForeground
                font.family: root.contentFontFamily
                font.pixelSize: Style.font.bodySmall
                Layout.alignment: Qt.AlignVCenter
                Layout.preferredWidth: visible ? implicitWidth : 0
                Layout.maximumWidth: visible ? 65535 : 0
              }

              Row {
                visible: !root.browsingApps
                spacing: Style.space(6)
                Layout.alignment: Qt.AlignVCenter
                Layout.preferredWidth: visible ? implicitWidth : 0
                Layout.maximumWidth: visible ? 65535 : 0

                Text {
                  text: "a"
                  color: root.keyHintForeground
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.subtitle
                  anchors.verticalCenter: parent.verticalCenter
                }

                Text {
                  text: "all apps"
                  color: allAppsMouse.containsMouse ? root.contentForeground : root.dimForeground
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.bodySmall
                  anchors.verticalCenter: parent.verticalCenter
                }

                MouseArea {
                  id: allAppsMouse
                  anchors.fill: parent
                  hoverEnabled: true
                  cursorShape: Qt.PointingHandCursor
                  onClicked: root.enterApps(false)
                }
              }

              Rectangle {
                Layout.preferredWidth: Style.spacing.hairline
                Layout.preferredHeight: Style.space(16)
                Layout.alignment: Qt.AlignVCenter
                color: root.contentForeground
                opacity: 0.18
              }

              Row {
                Layout.alignment: Qt.AlignVCenter
                spacing: Style.space(4)

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

            Item {
              visible: root.confirmingSession
              anchors.fill: parent

              Row {
                anchors.verticalCenter: parent.verticalCenter
                spacing: Style.space(10)

                Text {
                  text: Model.sessionPrompt(root.sessionConfirm)
                  color: root.sessionConfirm === "shutdown" ? Color.urgent : root.contentForeground
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.subtitle
                }

                Text {
                  text: "↵ confirm · esc cancel"
                  color: root.dimForeground
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.bodySmall
                  anchors.verticalCenter: parent.verticalCenter
                }
              }

              MouseArea {
                anchors.fill: parent
                cursorShape: Qt.PointingHandCursor
                onClicked: root.confirmSession()
              }
            }
          }
      }
    }
  }

  component SessionButton: Item {
    id: btn
    property string glyph: ""
    property string label: ""
    property bool danger: false
    signal activated()

    readonly property bool hot: area.containsMouse
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
        text: btn.glyph
        color: btn.hot && btn.danger ? Color.urgent : root.contentForeground
        font.family: root.contentFontFamily
        font.pixelSize: Style.font.subtitle
      }

      Text {
        visible: btn.hot
        text: btn.label
        color: btn.hot && btn.danger ? Color.urgent : root.contentForeground
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

import QtQuick
import QtQuick.Layouts
import Quickshell
import Quickshell.Hyprland
import qs.Commons
import qs.Ui
import "NordstartModel.js" as Model

// Centered launcher: workspaces on the left, pinned apps on the right.
// BarWidget.qml owns the bar mark and hands this panel the button to
// anchor against — the same shape as the clock calendar.
Panel {
  id: root
  moduleName: "nordstart"
  ipcTarget: "nordstart"
  manageIpc: false

  property var anchorItem: null
  property var hostWidget: null
  readonly property var barIdentity: hostWidget || root

  readonly property color contentForeground: bar ? bar.foreground : Color.foreground
  readonly property string contentFontFamily: bar ? bar.fontFamily : Style.font.family
  readonly property color dimForeground: Qt.darker(contentForeground, 1.85)
  readonly property color badgeForeground: Color.popups.background

  readonly property int workspaceCount: Model.clampWorkspaceCount(setting("workspaceCount", 9))
  readonly property var workspaceIds: Model.workspaceIds(workspaceCount)
  readonly property var pinned: {
    var _ = Hyprland.workspaces.values
    var __ = Hyprland.focusedWorkspace
    var ___ = Hyprland.activeToplevel
    return Model.pinnedApps(setting("pinnedApps", null), DesktopEntries, Hyprland.workspaces)
  }

  property string focusSection: "workspaces"
  property int focusWorkspaceId: 1
  property int focusPinnedIndex: 0
  property bool cursorActive: false

  readonly property int workspaceColumns: 3
  readonly property int workspaceRowHeight: Style.space(36)
  readonly property int badgeSize: Style.space(22)
  readonly property int pinnedRowHeight: Style.space(34)
  readonly property int sidebarWidth: Style.space(184)

  function open() {
    Hyprland.refreshWorkspaces()
    Hyprland.refreshToplevels()
    root.focusSection = "workspaces"
    root.focusWorkspaceId = Hyprland.focusedWorkspace ? Hyprland.focusedWorkspace.id : 1
    if (root.focusWorkspaceId < 1 || root.focusWorkspaceId > root.workspaceCount)
      root.focusWorkspaceId = 1
    root.focusPinnedIndex = 0
    root.cursorActive = true
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
    if (root.bar && typeof root.bar.switchPanelFrom === "function")
      return root.bar.switchPanelFrom(root.barIdentity, direction)
    return false
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
    return Model.workspacePresentation(lookupWorkspace(id), DesktopEntries)
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
    if (root.focusSection === "pinned") {
      if (root.focusPinnedIndex >= 0 && root.focusPinnedIndex < root.pinned.length)
        root.launchPinned(root.pinned[root.focusPinnedIndex])
      return
    }
    root.activateWorkspace(root.focusWorkspaceId)
  }

  function moveCursor(dx, dy) {
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

  function cycleSection(direction) {
    root.cursorActive = true
    if (root.pinned.length === 0) {
      root.focusSection = "workspaces"
      return
    }
    if (direction < 0) {
      root.focusSection = root.focusSection === "pinned" ? "workspaces" : "pinned"
    } else {
      root.focusSection = root.focusSection === "workspaces" ? "pinned" : "workspaces"
    }
  }

  function handleDigit(text) {
    var n = parseInt(text, 10)
    if (!(n >= 1 && n <= root.workspaceCount)) return
    root.cursorActive = true
    root.focusSection = "workspaces"
    root.focusWorkspaceId = n
    root.activateWorkspace(n)
  }

  KeyboardPanel {
    id: panel
    anchorItem: root.anchorItem
    owner: root.barIdentity
    bar: root.bar
    open: root.opened
    centerOnBar: true
    focusTarget: keyCatcher
    contentWidth: panel.fittedContentWidth(Style.space(720))
    contentHeight: panel.fittedContentHeight(bodyColumn.implicitHeight)

    PanelKeyCatcher {
      id: keyCatcher
      anchors.fill: parent
      onMoveRequested: function(dx, dy) { root.moveCursor(dx, dy) }
      onActivateRequested: root.activateCursor()
      onCloseRequested: root.close()
      onTabRequested: function(direction) { root.cycleSection(direction) }
      onTextKey: function(t) {
        if (t >= "1" && t <= "9") root.handleDigit(t)
      }

      Column {
        id: bodyColumn
        width: parent.width
        spacing: Style.space(18)
        clip: true

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
            Layout.preferredWidth: Style.space(156)
            Layout.maximumWidth: Style.space(156)
            Layout.rightMargin: Style.space(10)
            Layout.alignment: Qt.AlignTop
            spacing: Style.space(14)
            clip: true

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
    }
  }
}

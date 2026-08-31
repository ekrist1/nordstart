import QtQuick
import QtQuick.Effects
import QtQuick.Layouts
import Quickshell
import Quickshell.Hyprland
import Quickshell.Io
import Quickshell.Wayland
import qs.Commons
import qs.Ui
import "NordstartModel.js" as Model

// Workspace pills plus the Nordstart launcher. Nordstart clones the stock
// workspace widget, so the pills replace (rather than duplicate) Omarchy's
// workspace numbers while the grid button preserves the full launcher.
BarWidget {
  id: root
  moduleName: "io.github.ekrist1.nordstart"

  readonly property bool hoverOpen: setting("hoverOpen", true) === true
  readonly property int workspaceCount: Model.clampWorkspaceCount(setting("workspaceCount", 9))
  readonly property string workspaceBarStyle: String(setting("workspaceBarStyle", "Workspace pills"))
  readonly property string workspaceBarVisibility: String(setting("workspaceBarVisibility", "First five and occupied"))
  readonly property string workspaceHoverPreview: String(setting("workspaceHoverPreview", "Window list"))
  readonly property string workspaceIconStyle: String(setting("workspaceIconStyle", "Monochrome"))
  readonly property bool showLauncherButton: setting("showLauncherButton", true) === true
  readonly property var appNames: Model.parseNameMap(setting("appNames", null))
  readonly property var workspaceNames: setting("workspaceNames", "")
  readonly property var appLibrary: bar && bar.shell ? bar.shell.appLibrary : null
  readonly property bool pillsVisible: workspaceBarStyle.toLowerCase().indexOf("pill") >= 0
  readonly property bool launcherVisible: showLauncherButton || !pillsVisible
  readonly property bool hyprlandUsesLua: Hyprland.usingLua !== false
  readonly property int focusedWorkspaceId: Hyprland.focusedWorkspace ? Hyprland.focusedWorkspace.id : 1
  readonly property var visibleWorkspaceIds: {
    var _ = Hyprland.workspaces.values
    var __ = Hyprland.focusedWorkspace
    return Model.workspaceBarIds(root.workspaceCount, Hyprland.workspaces,
                                 root.focusedWorkspaceId, root.workspaceBarVisibility)
  }
  readonly property bool opened: panelLoader.item ? panelLoader.item.opened === true : false
  readonly property bool popoutSwitchClosing: panelLoader.item ? panelLoader.item.popoutSwitchClosing === true : false
  readonly property real openPanelIndicatorWidth: launcherButton.width
  readonly property real openPanelIndicatorHeight: Math.max(Style.space(10), Math.round(Style.bar.iconSlot * 0.55))

  property int previewWorkspaceId: 0
  property var previewAnchor: null
  // Which pill the pointer is actually on, or 0. The preview must never be
  // closed while this is set -- see the comment on previewCloseTimer.
  property int hoveredWorkspaceId: 0
  property int pendingPreviewWorkspaceId: 0
  property var pendingPreviewAnchor: null

  readonly property var previewWorkspace: Model.workspaceById(Hyprland.workspaces, previewWorkspaceId)
  readonly property var previewWindows: previewWorkspace && previewWorkspace.toplevels
    ? previewWorkspace.toplevels.values : []
  readonly property var previewPrimary: Model.primaryToplevel(previewWorkspace)
  readonly property var previewCaptureSource: previewPrimary && previewPrimary.wayland
    ? previewPrimary.wayland : null
  readonly property bool livePreview: workspaceHoverPreview.toLowerCase().indexOf("live") >= 0
  readonly property bool previewShouldStayOpen: root.hoveredWorkspaceId > 0 || workspacePreview.containsMouse
  // One row unit: a window row plus the gap above it.
  readonly property int previewRowUnit: Style.space(42) + Style.spacing.sm
  // High-water mark for this hover session. A live popup cannot commit a new
  // position and a new size in the same frame, so resizing one mid-sweep shows
  // a frame where the two disagree -- the card lands over the pills, or leaves
  // a gap. Growing is the safe direction (the bottom edge is pinned just above
  // the bar, so the card extends upward, away from the pointer); shrinking is
  // the one that flickers. So the card grows to fit a busier workspace but
  // never shrinks while it is open, and the mark is cleared on the next open
  // -- i.e. once the pointer has left the strip.
  property int previewRowsFloor: 0
  readonly property int previewRows: Math.max(root.previewRowsFloor,
                                              Math.max(1, root.previewWindows.length))
  readonly property bool monochromeWorkspaceIcons: workspaceIconStyle.toLowerCase().indexOf("mono") >= 0

  implicitWidth: barLayout.implicitWidth
  implicitHeight: barLayout.implicitHeight

  function workspaceById(id) {
    return Model.workspaceById(Hyprland.workspaces, id)
  }

  function workspaceInfo(id) {
    return Model.workspacePresentation(workspaceById(id), DesktopEntries, root.appNames,
                                       Model.workspaceName(root.workspaceNames, id))
  }

  function workspaceIcon(id) {
    var top = Model.primaryToplevel(workspaceById(id))
    if (!top) return ""
    var cls = Model.toplevelClass(top)
    var entry = Model.lookupEntry(cls, DesktopEntries)
    return entry && entry.icon ? String(entry.icon) : cls
  }

  function windowIcon(top) {
    if (!top) return ""
    var cls = Model.toplevelClass(top)
    var entry = Model.lookupEntry(cls, DesktopEntries)
    return entry && entry.icon ? String(entry.icon) : cls
  }

  function iconSource(icon) {
    return root.appLibrary && icon ? root.appLibrary.iconSource(icon) : ""
  }

  function focusWorkspace(id) {
    closeWorkspacePreview()
    var n = Math.trunc(Number(id))
    if (!(n > 0)) return
    Hyprland.dispatch(root.hyprlandUsesLua
      ? ("hl.dsp.focus({ workspace = \"" + n + "\" })")
      : ("workspace " + n))
  }

  function focusWindow(top) {
    closeWorkspacePreview()
    if (!top) return
    if (top.wayland && typeof top.wayland.activate === "function") {
      top.wayland.activate()
      return
    }
    var address = Model.toplevelAddress(top)
    if (!address) return
    Hyprland.dispatch(root.hyprlandUsesLua
      ? ("hl.dsp.focus({ window = \"address:" + address + "\" })")
      : ("focuswindow address:" + address))
  }

  function scheduleWorkspacePreview(id, anchor) {
    if (workspaceHoverPreview.toLowerCase() === "off") return
    // The launcher panel owns the screen while it is open; a hover preview
    // would take the bar's popout slot from it and close it.
    if (root.opened) return
    previewCloseTimer.stop()
    pendingPreviewWorkspaceId = id
    pendingPreviewAnchor = anchor
    previewOpenTimer.restart()
  }

  function showWorkspacePreview(id, anchor) {
    previewOpenTimer.stop()
    previewCloseTimer.stop()
    // Re-anchoring repositions and resizes a live window, which is visible as
    // a flicker. Nothing to do when the pointer is back on the pill already
    // being shown.
    if (workspacePreview.open && previewWorkspaceId === id && previewAnchor === anchor) return
    // Opening fresh, so the pointer has been away from the strip: forget the
    // previous session's height and size to this workspace.
    if (!workspacePreview.open) root.previewRowsFloor = 0
    previewWorkspaceId = id
    previewAnchor = anchor
    root.previewRowsFloor = root.previewRows
    workspacePreview.open = true
  }

  function schedulePreviewClose() {
    // Deliberately does NOT stop previewOpenTimer. Qt does not guarantee that
    // pill A's exit is delivered before pill B's enter, so cancelling the
    // pending open here would sometimes throw away the open that B just
    // scheduled and close the preview while the pointer sits on B. The open
    // timer re-checks that its pill is still hovered, so leaving a stale
    // pending open armed is harmless.
    previewCloseTimer.restart()
  }

  function closeWorkspacePreview() {
    previewOpenTimer.stop()
    previewCloseTimer.stop()
    root.hoveredWorkspaceId = 0
    workspacePreview.open = false
  }

  function open() {
    closeWorkspacePreview()
    if (panelLoader.item) panelLoader.item.open()
  }

  function close() {
    if (panelLoader.item) panelLoader.item.close()
  }

  function togglePanel() {
    closeWorkspacePreview()
    if (panelLoader.item) panelLoader.item.toggle()
  }

  function closeForPopoutSwitch() {
    closeWorkspacePreview()
    if (panelLoader.item) panelLoader.item.closeForPopoutSwitch()
  }

  function injectPanel() {
    var target = panelLoader.item
    if (!target) return
    if ("bar" in target) target.bar = root.bar
    if ("settings" in target) target.settings = root.settings
    if ("anchorItem" in target) target.anchorItem = launcherButton
    if ("hostWidget" in target) target.hostWidget = root
  }

  onBarChanged: injectPanel()
  onSettingsChanged: injectPanel()
  onPillsVisibleChanged: if (!pillsVisible) closeWorkspacePreview()
  onWorkspaceHoverPreviewChanged: if (workspaceHoverPreview.toLowerCase() === "off") closeWorkspacePreview()

  Loader {
    id: panelLoader
    active: true
    source: Qt.resolvedUrl("Panel.qml")
    visible: false
    onLoaded: {
      root.injectPanel()
      Qt.callLater(root.injectPanel)
    }
  }

  IpcHandler {
    target: "io.github.ekrist1.nordstart"

    function open(): void { root.open() }
    function close(): void { root.close() }
    function show(): void { root.open() }
    function hide(): void { root.close() }
    function toggle(): void { root.togglePanel() }
  }

  component PillIcon: Item {
    required property string icon
    required property color tint

    Image {
      id: pillIconImage
      anchors.fill: parent
      fillMode: Image.PreserveAspectFit
      sourceSize.width: Math.round(Math.min(width, height) * Screen.devicePixelRatio)
      sourceSize.height: Math.round(Math.min(width, height) * Screen.devicePixelRatio)
      source: root.iconSource(icon)
      asynchronous: true
      visible: !root.monochromeWorkspaceIcons
      layer.enabled: root.monochromeWorkspaceIcons
    }

    MultiEffect {
      anchors.fill: pillIconImage
      source: pillIconImage
      visible: root.monochromeWorkspaceIcons
      colorization: 1.0
      colorizationColor: tint
    }
  }

  GridLayout {
    id: barLayout
    anchors.fill: parent
    columns: root.vertical ? 1 : Math.max(1, root.visibleWorkspaceIds.length + (root.launcherVisible ? 1 : 0))
    columnSpacing: Style.space(2)
    rowSpacing: Style.space(2)

    Repeater {
      model: root.pillsVisible ? root.visibleWorkspaceIds : []

      Item {
        id: workspacePill
        required property int modelData
        readonly property int workspaceId: modelData
        readonly property var info: root.workspaceInfo(workspaceId)
        readonly property bool focused: root.focusedWorkspaceId === workspaceId
        readonly property string appIcon: root.workspaceIcon(workspaceId)
        readonly property bool hovered: pillMouse.containsMouse
        readonly property color ink: root.bar ? root.bar.barForeground : Color.foreground

        Layout.preferredWidth: root.vertical ? root.barSize : (appIcon ? Style.space(38) : Style.space(24))
        Layout.preferredHeight: root.vertical ? (appIcon ? Style.space(38) : Style.space(26)) : root.barSize

        Rectangle {
          anchors.left: parent.left
          anchors.right: parent.right
          anchors.leftMargin: Style.space(1)
          anchors.rightMargin: Style.space(1)
          anchors.verticalCenter: parent.verticalCenter
          height: Math.min(parent.height - Style.space(8), Style.space(30))
          radius: height / 2
          color: workspacePill.focused
            ? Qt.rgba(workspacePill.ink.r, workspacePill.ink.g, workspacePill.ink.b, 0.20)
            : "transparent"
          border.width: workspacePill.focused ? 0 : 1
          border.color: Qt.rgba(workspacePill.ink.r, workspacePill.ink.g, workspacePill.ink.b,
                                workspacePill.info.occupied ? 0.75 : 0.28)

          Behavior on color {
            ColorAnimation { duration: 120; easing.type: Easing.OutCubic }
          }

          RowLayout {
            visible: !root.vertical
            anchors.centerIn: parent
            spacing: Style.space(3)

            Text {
              text: String(workspacePill.workspaceId)
              color: workspacePill.ink
              font.family: Style.font.family
              font.pixelSize: Style.font.body
              horizontalAlignment: Text.AlignHCenter
            }

            PillIcon {
              visible: workspacePill.appIcon.length > 0
              Layout.preferredWidth: Style.space(15)
              Layout.preferredHeight: Style.space(15)
              icon: workspacePill.appIcon
              tint: workspacePill.ink
            }
          }

          ColumnLayout {
            visible: root.vertical
            anchors.centerIn: parent
            spacing: 0

            Text {
              Layout.alignment: Qt.AlignHCenter
              text: String(workspacePill.workspaceId)
              color: workspacePill.ink
              font.family: Style.font.family
              font.pixelSize: Style.font.caption
            }

            PillIcon {
              visible: workspacePill.appIcon.length > 0
              Layout.alignment: Qt.AlignHCenter
              Layout.preferredWidth: Style.space(14)
              Layout.preferredHeight: Style.space(14)
              icon: workspacePill.appIcon
              tint: workspacePill.ink
            }
          }
        }

        MouseArea {
          id: pillMouse
          anchors.fill: parent
          hoverEnabled: true
          cursorShape: Qt.PointingHandCursor
          onEntered: {
            root.hoveredWorkspaceId = workspacePill.workspaceId
            root.scheduleWorkspacePreview(workspacePill.workspaceId, workspacePill)
          }
          onExited: {
            // Only give up the shared slot if it is still ours: a spurious
            // enter on another pill may already have claimed it.
            if (root.hoveredWorkspaceId === workspacePill.workspaceId) root.hoveredWorkspaceId = 0
            root.schedulePreviewClose()
          }
          onClicked: root.focusWorkspace(workspacePill.workspaceId)
        }
      }
    }

    Item {
      id: launcherButton
      visible: root.launcherVisible
      Layout.preferredWidth: visible ? Style.bar.iconSlot : 0
      Layout.preferredHeight: visible ? root.barSize : 0

      property var registeredBar: null
      readonly property bool hovered: launcherMouse.containsMouse
      readonly property color foreground: root.bar ? root.bar.barForeground : Color.foreground

      // Required by the bar: moduleTargetClickable() rejects any registered
      // click target without a triggerPress function, so leaving this out
      // makes registerClickTarget below a no-op and the bar can never route a
      // click here (Bar.qml moduleClickTargetAt).
      function triggerPress(mouseButton) {
        if (root.bar) root.bar.hideTooltip(launcherButton)
        if (mouseButton === Qt.RightButton || mouseButton === Qt.MiddleButton) return
        root.togglePanel()
      }

      function syncClickRegistration() {
        if (registeredBar && registeredBar.unregisterClickTarget)
          registeredBar.unregisterClickTarget(launcherButton)
        registeredBar = root.bar
        if (registeredBar && registeredBar.registerClickTarget)
          registeredBar.registerClickTarget(launcherButton)
      }

      onVisibleChanged: if (!visible && root.bar) root.bar.hideTooltip(launcherButton)
      Component.onCompleted: syncClickRegistration()
      Component.onDestruction: {
        if (registeredBar && registeredBar.unregisterClickTarget)
          registeredBar.unregisterClickTarget(launcherButton)
      }

      Connections {
        target: root
        function onBarChanged() { launcherButton.syncClickRegistration() }
      }

      Rectangle {
        anchors.fill: parent
        radius: Style.cornerRadius
        color: launcherButton.hovered || root.opened
          ? Style.hoverFillFor(launcherButton.foreground, Color.accent)
          : "transparent"
      }

      Grid {
        id: launcherGlyph
        anchors.centerIn: parent
        columns: 3
        rowSpacing: Math.max(1, Math.round(width * 0.14))
        columnSpacing: rowSpacing
        readonly property int cell: Math.max(2, Math.floor((Style.bar.iconCanvas - rowSpacing * 2) / 3))

        Repeater {
          model: 9
          Rectangle {
            width: launcherGlyph.cell
            height: launcherGlyph.cell
            radius: Math.max(1, Math.round(launcherGlyph.cell * 0.25))
            color: launcherButton.hovered || root.opened
              ? Style.hoverStateColor(launcherButton.foreground, Color.accent)
              : launcherButton.foreground
          }
        }
      }

      MouseArea {
        id: launcherMouse
        anchors.fill: parent
        acceptedButtons: Qt.LeftButton | Qt.RightButton | Qt.MiddleButton
        hoverEnabled: true
        cursorShape: Qt.PointingHandCursor
        onEntered: {
          root.closeWorkspacePreview()
          if (root.bar) root.bar.showTooltip(launcherButton, "Nordstart")
          if (root.hoverOpen) launcherOpenTimer.restart()
        }
        onExited: {
          if (root.bar) root.bar.hideTooltip(launcherButton)
          launcherOpenTimer.stop()
        }
        onClicked: function(mouse) {
          launcherOpenTimer.stop()
          launcherButton.triggerPress(mouse.button)
        }
      }
    }
  }

  Timer {
    id: launcherOpenTimer
    interval: 160
    onTriggered: if (root.hoverOpen && launcherMouse.containsMouse && !root.opened) root.open()
  }

  Timer {
    id: previewOpenTimer
    interval: 160
    // Re-check that the pointer is still on the pill that asked. A pending
    // open can outlive the hover that scheduled it -- the pointer moves on, or
    // the popup (a separate window, stacked over the bar) takes the pointer
    // for a frame -- and without this the preview switches to a workspace the
    // pointer has already left.
    onTriggered: {
      var anchor = root.pendingPreviewAnchor
      if (!anchor || anchor.hovered !== true) return
      root.showWorkspacePreview(root.pendingPreviewWorkspaceId, anchor)
    }
  }

  Timer {
    id: previewCloseTimer
    interval: 180
    // Decide from live hover state, not from the exit that armed the timer:
    // by the time this fires the pointer may be on another pill, or back on
    // the same one. Trusting the stale event is what closed the preview while
    // the pointer was still on a pill.
    onTriggered: if (!root.previewShouldStayOpen) workspacePreview.open = false
  }

  PopupCard {
    id: workspacePreview
    // Anchored to the widget, not to the hovered pill. Re-anchoring to each
    // pill repositions a live popup surface on every crossing, which is what
    // tears when the card is also resizing (a workspace with more windows).
    // The card is about as wide as the pill strip and gets clamped to the
    // screen edge anyway, so per-pill anchoring bought almost no precision.
    anchorItem: root
    bar: root.bar
    // No `owner`, on purpose: that leaves the popout key as this card rather
    // than the BarWidget, which the launcher panel already claims
    // (Panel.qml: owner: root.barIdentity). Sharing the key meant closing the
    // preview released the panel's claim, and made the bar light the module's
    // open-panel indicator -- which is centred on the whole widget, so it
    // appeared under an unrelated pill.
    triggerMode: "hover"
    contentWidth: fittedContentWidth(Style.space(300), Style.space(420))
    contentHeight: fittedContentHeight(previewContent.implicitHeight, Style.space(440))

    onContainsMouseChanged: {
      if (containsMouse) previewCloseTimer.stop()
      else root.schedulePreviewClose()
    }


    ColumnLayout {
      id: previewContent
      anchors.fill: parent
      spacing: Style.spacing.sm

      RowLayout {
        Layout.fillWidth: true

        Text {
          Layout.fillWidth: true
          text: {
            var name = Model.workspaceName(root.workspaceNames, root.previewWorkspaceId)
            return name ? (root.previewWorkspaceId + "  " + name) : ("Workspace " + root.previewWorkspaceId)
          }
          color: Color.foreground
          font.family: Style.font.family
          font.pixelSize: Style.font.heading
          font.weight: Font.DemiBold
        }

        Text {
          text: root.previewWindows.length + (root.previewWindows.length === 1 ? " window" : " windows")
          color: Color.foreground
          opacity: 0.55
          font.family: Style.font.family
          font.pixelSize: Style.font.caption
        }
      }

      Item {
        // Reserved for the whole of live mode, not just when a capture exists:
        // collapsing it on an empty workspace would resize the card.
        visible: root.livePreview
        Layout.fillWidth: true
        Layout.preferredHeight: visible ? Style.space(150) : 0
        clip: true

        Rectangle {
          anchors.fill: parent
          radius: Style.cornerRadius
          color: Qt.rgba(Color.foreground.r, Color.foreground.g, Color.foreground.b, 0.06)
        }

        ScreencopyView {
          anchors.centerIn: parent
          captureSource: root.previewCaptureSource
          live: workspacePreview.open && root.livePreview
          paintCursor: false
          constraintSize.width: parent.width - Style.space(6)
          constraintSize.height: parent.height - Style.space(6)
        }
      }

      Text {
        Layout.fillWidth: true
        // Sized as one window row so the padding below can treat the empty
        // state as a single row and keep the card height constant.
        Layout.preferredHeight: Style.space(42)
        verticalAlignment: Text.AlignVCenter
        visible: root.previewWindows.length === 0
        text: "No windows open"
        color: Color.foreground
        opacity: 0.6
        font.family: Style.font.family
        font.pixelSize: Style.font.body
      }

      Repeater {
        model: root.previewWindows

        Rectangle {
          id: windowRow
          required property var modelData
          Layout.fillWidth: true
          Layout.preferredHeight: Style.space(42)
          radius: Style.cornerRadius
          color: windowHover.containsMouse ? Style.hoverFill : "transparent"

          RowLayout {
            anchors.fill: parent
            anchors.leftMargin: Style.spacing.sm
            anchors.rightMargin: Style.spacing.sm
            spacing: Style.spacing.sm

            Image {
              Layout.preferredWidth: Style.space(22)
              Layout.preferredHeight: Style.space(22)
              fillMode: Image.PreserveAspectFit
              source: root.iconSource(root.windowIcon(windowRow.modelData))
              asynchronous: true
            }

            ColumnLayout {
              Layout.fillWidth: true
              spacing: 0

              Text {
                Layout.fillWidth: true
                text: Model.toplevelTitle(windowRow.modelData) || "Untitled window"
                color: Color.foreground
                font.family: Style.font.family
                font.pixelSize: Style.font.body
                elide: Text.ElideRight
                maximumLineCount: 1
              }

              Text {
                Layout.fillWidth: true
                text: Model.prettyClass(Model.toplevelClass(windowRow.modelData), root.appNames)
                color: Color.foreground
                opacity: 0.55
                font.family: Style.font.family
                font.pixelSize: Style.font.caption
                elide: Text.ElideRight
              }
            }

            Text {
              text: windowRow.modelData.activated ? "●" : ""
              color: Color.accent
              font.pixelSize: Style.font.body
            }
          }

          MouseArea {
            id: windowHover
            anchors.fill: parent
            hoverEnabled: true
            cursorShape: Qt.PointingHandCursor
            onClicked: root.focusWindow(windowRow.modelData)
          }
        }
      }

      // Holds the card at this session's high-water mark, so stepping onto a
      // quieter workspace leaves empty space rather than shrinking a live
      // popup. An empty workspace counts as one row, because the
      // "No windows open" label above is sized as one.
      Item {
        Layout.fillWidth: true
        Layout.preferredHeight: Math.max(0,
          (root.previewRows - Math.max(1, root.previewWindows.length)) * root.previewRowUnit)
      }
    }
  }
}

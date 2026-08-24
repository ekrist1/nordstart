import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui

// Rectangle on the bar that opens the Nordstart workspace launcher.
// Hover (optional), click, and `omarchy-shell shell toggle nordstart` all
// drive the same panel — the clock's open/close contract, so the bar's
// popout coordinator and the IPC shortcut share one path.
BarWidget {
  id: root
  moduleName: "nordstart"

  readonly property bool hoverOpen: setting("hoverOpen", true) === true
  readonly property bool opened: panelLoader.item ? panelLoader.item.opened === true : false
  readonly property bool popoutSwitchClosing: panelLoader.item ? panelLoader.item.popoutSwitchClosing === true : false
  readonly property real openPanelIndicatorWidth: button.width
  readonly property real openPanelIndicatorHeight: Math.max(Style.space(10), Math.round(Style.bar.iconSlot * 0.55))

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  function open() {
    if (panelLoader.item) panelLoader.item.open()
  }

  function close() {
    if (panelLoader.item) panelLoader.item.close()
  }

  function togglePanel() {
    if (panelLoader.item) panelLoader.item.toggle()
  }

  function closeForPopoutSwitch() {
    if (panelLoader.item) panelLoader.item.closeForPopoutSwitch()
  }

  function injectPanel() {
    var target = panelLoader.item
    if (!target) return
    if ("bar" in target) target.bar = root.bar
    if ("settings" in target) target.settings = root.settings
    if ("anchorItem" in target) target.anchorItem = button
    if ("hostWidget" in target) target.hostWidget = root
  }

  onBarChanged: injectPanel()
  onSettingsChanged: injectPanel()

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
    target: "nordstart"

    function open(): void { root.open() }
    function close(): void { root.close() }
    function show(): void { root.open() }
    function hide(): void { root.close() }
    function toggle(): void { root.togglePanel() }
  }

  Item {
    id: button
    implicitWidth: Style.bar.iconSlot
    implicitHeight: root.barSize
    width: implicitWidth
    height: implicitHeight

    property var registeredBar: null
    readonly property bool hovered: mouseArea.containsMouse
    readonly property color foreground: root.bar ? root.bar.barForeground : Color.foreground

    function triggerPress(mouseButton) {
      if (root.bar) root.bar.hideTooltip(button)
      if (mouseButton === Qt.RightButton || mouseButton === Qt.MiddleButton) return
      root.togglePanel()
    }

    function syncClickRegistration() {
      if (registeredBar && registeredBar.unregisterClickTarget)
        registeredBar.unregisterClickTarget(button)
      registeredBar = root.bar
      if (registeredBar && registeredBar.registerClickTarget)
        registeredBar.registerClickTarget(button)
    }

    onVisibleChanged: if (!visible && root.bar) root.bar.hideTooltip(button)
    Component.onCompleted: syncClickRegistration()
    Component.onDestruction: {
      if (registeredBar && registeredBar.unregisterClickTarget)
        registeredBar.unregisterClickTarget(button)
    }

    Connections {
      target: root
      function onBarChanged() { button.syncClickRegistration() }
    }

    Rectangle {
      anchors.fill: parent
      radius: Style.cornerRadius
      color: button.hovered || root.opened
        ? Style.hoverFillFor(button.foreground, Color.accent)
        : "transparent"

      Behavior on color {
        ColorAnimation { duration: 120; easing.type: Easing.OutCubic }
      }
    }

    Rectangle {
      anchors.centerIn: parent
      width: Style.space(12)
      height: Style.space(8)
      radius: Math.max(1, Style.space(2))
      color: button.hovered || root.opened
        ? Style.hoverStateColor(button.foreground, Color.accent)
        : button.foreground

      Behavior on color {
        ColorAnimation { duration: 120; easing.type: Easing.OutCubic }
      }
    }

    MouseArea {
      id: mouseArea
      anchors.fill: parent
      acceptedButtons: Qt.LeftButton | Qt.RightButton | Qt.MiddleButton
      hoverEnabled: true
      cursorShape: Qt.PointingHandCursor
      onEntered: {
        if (root.bar) root.bar.showTooltip(button, "Nordstart")
        if (root.hoverOpen) hoverOpenTimer.restart()
      }
      onExited: {
        if (root.bar) root.bar.hideTooltip(button)
        hoverOpenTimer.stop()
      }
      onClicked: function(mouse) {
        hoverOpenTimer.stop()
        button.triggerPress(mouse.button)
      }
    }

    Timer {
      id: hoverOpenTimer
      interval: 160
      repeat: false
      onTriggered: {
        if (!root.hoverOpen || root.opened) return
        if (!mouseArea.containsMouse) return
        root.open()
      }
    }
  }
}

/**
 * Example Pi HUD Plugin — Current time display.
 *
 * Place in .pi/pi-hud-plugins/clock.js or ~/.pi/agent/pi-hub-plugins/clock.js
 *
 * Shows: 🕐 14:32 on Line 1 (right side)
 */
module.exports = {
  name: "clock",
  target: "line1",
  order: 200,  // after elapsed time

  render(_ctx, theme) {
    const now = new Date();
    const h = now.getHours().toString().padStart(2, "0");
    const m = now.getMinutes().toString().padStart(2, "0");
    return theme.fg("dim", `🕐 ${h}:${m}`);
  },
};

/**
 * Example Pi HUD Plugin — Custom "turn count" display.
 *
 * Place in .pi/pi-hud-plugins/turn-counter.js or ~/.pi/agent/pi-hud-plugins/turn-counter.js
 *
 * Shows: 🔁 12 turns (auto-calculated from input history length)
 */
module.exports = {
  name: "turn-counter",
  target: "line2",
  order: 50,  // after context files, before tool stats

  render(ctx, theme) {
    const turns = ctx.inputHistory.length;
    if (turns === 0) return undefined;
    return theme.fg("dim", `🔁 ${turns} turn${turns > 1 ? "s" : ""}`);
  },
};

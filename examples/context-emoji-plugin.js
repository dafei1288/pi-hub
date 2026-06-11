/**
 * Example pi-agent-hud Plugin — Context bar emoji style.
 *
 * Place in .pi/pi-agent-hud-plugins/context-emoji.js
 *
 * Replaces Line 1 context percentage with an emoji indicator:
 *   🟢 < 70%   🟡 70-90%   🔴 > 90%
 */
module.exports = {
  name: "context-emoji",
  target: "line1",
  order: 10,

  render(ctx, theme) {
    const pct = ctx.ctxPercent;
    if (!pct) return undefined;
    if (pct > 90) return theme.fg("error", `🔴 ${Math.round(pct)}%`);
    if (pct > 70) return theme.fg("warning", `🟡 ${Math.round(pct)}%`);
    return theme.fg("success", `🟢 ${Math.round(pct)}%`);
  },
};

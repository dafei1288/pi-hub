# Pi Agent HUD CN Social Poster Design

## Goal

Create a domestic social-media poster for `pi-agent-hud` that can be shared as a vertical cover image and kept in an editable source format.

## Audience

- Chinese developers using `pi-coding-agent`
- Terminal-heavy users who want clearer agent execution visibility
- Users browsing productivity/tool recommendation posts on Xiaohongshu, Jike, Zhihu, or Juejin

## Message Priority

1. `pi-agent-hud` adds an agent HUD to the terminal so key session information stays visible.
2. Users can review interaction history and inspect the active execution plan and tool-call timeline.
3. Installation is simple: `pi install npm:pi-agent-hud`.

## Chosen Direction

Use a product-screenshot-led vertical social poster.

The poster should look like a real developer tool recommendation rather than a generic tech ad. The central proof is a layered terminal composition using the existing project screenshots: the HUD status bar, history overlay, and plan/tool-call overlay.

## Copy

- Brand line: `Pi Agent HUD`
- Main headline: `终端里的 Agent 抬头显示`
- Supporting line: `关键信息尽在掌握`
- Feature tags: `历史交互` `执行任务` `Tool Call 视图`
- Install callout: `一行命令安装`
- Install command: `pi install npm:pi-agent-hud`

## Visual System

- Format: vertical domestic social cover, `1242x1660`
- Background: light warm gray with restrained technical grid accents
- Primary colors: deep charcoal terminal panels, cyan HUD highlights, lime progress highlights, warm red-orange callouts
- Composition:
  - top: strong Chinese headline and concise product promise
  - middle: layered real UI screenshots
  - bottom: three feature chips and install command
- Source format: SVG for deterministic editing and clean text updates
- Export format: PNG for posting

## Deliverables

- Editable source: `docs/posters/pi-agent-hud-cn-social.svg`
- Shareable export: `docs/posters/pi-agent-hud-cn-social.png`

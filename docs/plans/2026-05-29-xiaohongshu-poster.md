# Pi HUD Xiaohongshu Poster Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a Xiaohongshu-style poster for `Pi Agent HUD for pi-coding-agent`, save an editable source file in the repo, and export a ready-to-share PNG.

**Architecture:** Build the poster as a single SVG so the layout stays deterministic and editable in-repo. Export the SVG to PNG with ImageMagick after the composition is complete, then verify the output files and dimensions.

**Tech Stack:** SVG, ImageMagick, PowerShell

---

### Task 1: Create the poster source

**Files:**
- Create: `docs/posters/pi-agent-hud-xiaohongshu-poster.svg`

**Step 1: Write the poster composition**

Create a portrait SVG with:
- warm off-white background
- bold Xiaohongshu-style headline blocks
- one dark terminal HUD card
- three feature labels
- supporting sticker text

**Step 2: Review the copy and spacing**

Check that the visible text matches the approved direction:
- `Pi Agent HUD for pi-coding-agent`
- `把终端状态栏`
- `做成效率仪表盘`
- `安装简单` `插件扩展` `自定义布局`

**Step 3: Save the source**

Keep the SVG as the editable source of truth for future revisions.

### Task 2: Export the poster image

**Files:**
- Modify: `docs/posters/pi-agent-hud-xiaohongshu-poster.svg`
- Create: `docs/posters/pi-agent-hud-xiaohongshu-poster.png`

**Step 1: Export SVG to PNG**

Run:

```powershell
magick docs/posters/pi-agent-hud-xiaohongshu-poster.svg docs/posters/pi-agent-hud-xiaohongshu-poster.png
```

Expected: a portrait PNG is created next to the SVG.

**Step 2: Verify output metadata**

Run:

```powershell
magick identify docs/posters/pi-agent-hud-xiaohongshu-poster.png
```

Expected: the PNG exists and reports portrait dimensions.

### Task 3: Record the design notes

**Files:**
- Create: `docs/plans/2026-05-29-xiaohongshu-poster-design.md`
- Create: `docs/plans/2026-05-29-xiaohongshu-poster.md`

**Step 1: Save the approved design brief**

Document the chosen direction, copy hierarchy, and visual system.

**Step 2: Save the implementation plan**

Document the exact files and export commands needed to reproduce the asset.

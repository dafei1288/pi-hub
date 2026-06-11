# Pi Agent HUD CN Social Poster Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a domestic social-media poster for `pi-agent-hud` as an editable SVG and exported PNG.

**Architecture:** Build the poster as one self-contained SVG source file that embeds existing project screenshots from `docs/` as PNG data URIs. Export the SVG to PNG with ImageMagick, then verify image metadata and inspect the rendered output.

**Tech Stack:** SVG, ImageMagick, PowerShell

---

### Task 1: Create the poster source

**Files:**
- Create: `docs/posters/pi-agent-hud-cn-social.svg`

**Step 1: Ensure the output directory exists**

Run:

```powershell
New-Item -ItemType Directory -Force docs/posters
```

Expected: `docs/posters` exists.

**Step 2: Write the SVG composition**

Create a `1242x1660` SVG with:

- warm light background and subtle grid accents
- headline `终端里的 Agent 抬头显示`
- subtitle `关键信息尽在掌握`
- layered screenshots embedded from `docs/demo.png`, `docs/demo-history.png`, and `docs/demo-plan-tab.png`
- feature chips for `历史交互`, `执行任务`, and `Tool Call 视图`
- install callout with `pi install npm:pi-agent-hud`

**Step 3: Check source content**

Run:

```powershell
Select-String -Path docs/posters/pi-agent-hud-cn-social.svg -Pattern "data:image/png;base64","pi install npm:pi-agent-hud"
```

Expected: embedded image data and the install command are present.

### Task 2: Export and verify the PNG

**Files:**
- Create: `docs/posters/pi-agent-hud-cn-social.png`

**Step 1: Export SVG to PNG**

Run:

```powershell
magick docs/posters/pi-agent-hud-cn-social.svg docs/posters/pi-agent-hud-cn-social.png
```

Expected: PNG is created next to the SVG.

**Step 2: Verify output metadata**

Run:

```powershell
magick identify docs/posters/pi-agent-hud-cn-social.png
```

Expected: `PNG 1242x1660`.

**Step 3: Inspect the rendered image**

Open `docs/posters/pi-agent-hud-cn-social.png` and check:

- headline is readable
- screenshots are visible and not stretched incoherently
- install command is readable
- feature chips do not overlap

### Task 3: Report the result

**Files:**
- Read: `docs/posters/pi-agent-hud-cn-social.svg`
- Read: `docs/posters/pi-agent-hud-cn-social.png`

**Step 1: Summarize files created**

Report the SVG and PNG paths.

**Step 2: Summarize verification**

Report the ImageMagick identify result and any visual inspection notes.

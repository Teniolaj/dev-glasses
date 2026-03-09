# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a creative web production workspace with two Claude skills for building premium, scroll-driven animated websites. Projects are vanilla HTML/CSS/JS — no bundler, no framework, CDN libraries only.

## Skills

### `video-to-website` (.claude/skills/video-to-website/SKILL 1.md)
Converts a video file into a scroll-driven animated website using GSAP + Lenis + canvas frame rendering. Invoked when the user provides a video and wants a website built from it.

### `frontend-design` (.claude/skills/frontend-deisgn/SKILL 2.md)
Guides creation of distinctive, production-grade frontend interfaces. Used standalone or as the styling layer inside `video-to-website`. Always commits to a bold, intentional aesthetic — never generic AI defaults.

## Local Dev

Serve locally (frames must load over HTTP, not `file://`):
```bash
npx serve .
# or
python -m http.server 8000
```

## FFmpeg

FFprobe/FFmpeg are installed at `C:\Users\nateh\bin\` and on PATH. Do not reinstall.

Analyze a video:
```bash
ffprobe -v error -select_streams v:0 -show_entries stream=width,height,duration,r_frame_rate,nb_frames -of csv=p=0 "<VIDEO_PATH>"
```

Extract frames as WebP:
```bash
mkdir -p frames
ffmpeg -i "<VIDEO_PATH>" -vf "fps=<FPS>,scale=<WIDTH>:-1" -c:v libwebp -quality 80 "frames/frame_%04d.webp"
```

Target 150–300 frames. Short (<10s): original fps capped at ~300. Medium (10–30s): 10–15fps. Long (30s+): 5–10fps.

## Project Scaffold

Every video-to-website project follows this structure:
```
project-root/
  index.html
  css/style.css
  js/app.js
  frames/frame_0001.webp ...
```

## CDN Stack (load order matters)

```html
<script src="https://cdn.jsdelivr.net/npm/lenis@1/dist/lenis.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/ScrollTrigger.min.js"></script>
<script src="js/app.js"></script>
```

## Architecture: How a Video-to-Website Works

1. **Hero section** (standalone 100vh, solid bg) — canvas is hidden behind it; circle-wipe clip-path reveals canvas as hero scrolls away
2. **Canvas** (fixed, full viewport) — renders extracted frames driven by scroll progress, padded-cover mode with `IMAGE_SCALE` 0.82–0.90
3. **Scroll container** (800vh+ for 6 sections) — content sections are `position: absolute` at their scroll midpoint
4. **Sections** — each reads `data-enter`/`data-leave`/`data-animation`; every consecutive section must use a DIFFERENT animation type
5. **Lenis** wired to `ScrollTrigger.update` for smooth scroll; `FRAME_SPEED` 1.8–2.2 controls how fast product animation completes
6. **Stats section** — dark overlay (0.88–0.92 opacity), counters animate from 0 via GSAP
7. **Marquee** — at least one 12vw+ text element slides horizontally on scroll
8. **CTA** — `data-persist="true"` keeps final section pinned visible

## Key Rules (Non-Negotiable)

- All text in outer 40% side zones (`align-left`/`align-right`) — never centered, except stats with full dark overlay
- No glassmorphism cards — text sits directly on background
- Hero gets 20%+ of scroll range; total scroll height 800vh+ for 6 sections
- `FRAME_SPEED` must be 1.8–2.2; never below 1.8
- Never repeat the same entrance animation for consecutive sections
- Numbers always count up from 0 — never appear statically
- Hero headings 6rem+ minimum; marquee text 10–15vw
- Only take screenshots and save to the project folder when i tell you to

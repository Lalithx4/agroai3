---
name: CropMagix
description: A field notebook for sick crops. Point at a leaf, hear what's wrong, know what to do next.
status: final
created: 2026-11-23
updated: 2026-11-23
sources:
  - _bmad-output/brainstorming/brainstorm-cropmagix-voice-features-2026-11-22/.memlog.md
  - _bmad-output/brainstorming/brainstorm-talking-plant-ar-2026-11-22/.memlog.md
  - _bmad-output/experiments/accuracy-ladder.md
colors:
  paper: '#F6F1E7'
  surface: '#FFFDF8'
  sunken: '#EDE6D6'
  ink: '#1F2A22'
  ink-secondary: '#545C51'
  ink-muted: '#80857A'
  hairline: '#DDD3BF'
  hairline-strong: '#C9BCA3'
  leaf: '#2F5D3A'
  leaf-strong: '#234A2D'
  leaf-tint: '#E3EBDD'
  turmeric: '#D9A21B'
  turmeric-tint: '#F7EBC8'
  terracotta: '#B5452A'
  terracotta-tint: '#F5DFD6'
  amber: '#B26B00'
  amber-tint: '#F8E6C4'
  sky: '#3C6E8F'
  sky-tint: '#DDE8EF'
  on-leaf: '#FFFDF8'
  paper-dark: '#161A15'
  surface-dark: '#1E231D'
  sunken-dark: '#12150F'
  ink-dark: '#ECE7DA'
  ink-secondary-dark: '#B3AE9F'
  ink-muted-dark: '#858275'
  hairline-dark: '#2F352D'
  hairline-strong-dark: '#3E463B'
  leaf-dark: '#8CC497'
  leaf-strong-dark: '#A8D5B0'
  leaf-tint-dark: '#223126'
  turmeric-dark: '#E7B53C'
  terracotta-dark: '#E58468'
  amber-dark: '#E8A33A'
  sky-dark: '#7FB0D1'
typography:
  display:
    fontFamily: 'Fraunces, Georgia, serif'
    fontSize: 'clamp(2rem, 5vw, 3.25rem)'
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: '-0.02em'
  title:
    fontFamily: 'Fraunces, Georgia, serif'
    fontSize: 'clamp(1.5rem, 3.5vw, 2rem)'
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: '-0.015em'
  heading:
    fontFamily: 'Fraunces, Georgia, serif'
    fontSize: '1.25rem'
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "'Public Sans', 'Noto Sans Devanagari', 'Noto Sans Telugu', system-ui, sans-serif"
    fontSize: '1rem'
    fontWeight: 400
    lineHeight: 1.55
  body-strong:
    fontFamily: "'Public Sans', system-ui, sans-serif"
    fontSize: '1rem'
    fontWeight: 600
    lineHeight: 1.5
  label:
    fontFamily: "'Public Sans', system-ui, sans-serif"
    fontSize: '0.875rem'
    fontWeight: 600
    lineHeight: 1.3
  meta:
    fontFamily: "'Public Sans', system-ui, sans-serif"
    fontSize: '0.8125rem'
    fontWeight: 500
    lineHeight: 1.4
  overline:
    fontFamily: "'Public Sans', system-ui, sans-serif"
    fontSize: '0.75rem'
    fontWeight: 700
    letterSpacing: '0.08em'
  numeral:
    fontFamily: 'Fraunces, Georgia, serif'
    fontWeight: 600
    note: 'Tabular lining figures for stats, temperatures, confidence'
rounded:
  sm: 6px
  md: 10px
  lg: 14px
  full: 9999px
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 24px
  '6': 32px
  '7': 48px
  '8': 64px
  gutter-phone: 16px
  gutter-tablet: 24px
  page-max: 960px
  wide-max: 1200px
components:
  button-primary:
    background: '{colors.leaf}'
    text: '{colors.on-leaf}'
    rounded: '{rounded.md}'
    height: 48px
  button-secondary:
    background: '{colors.surface}'
    text: '{colors.ink}'
    border: '{colors.hairline-strong}'
    rounded: '{rounded.md}'
    height: 48px
  card:
    background: '{colors.surface}'
    border: '{colors.hairline}'
    rounded: '{rounded.lg}'
    padding: '{spacing.4}'
  list-row:
    border-bottom: '{colors.hairline}'
    min-height: 56px
  chip:
    background: '{colors.surface}'
    border: '{colors.hairline-strong}'
    selected-background: '{colors.ink}'
    selected-text: '{colors.paper}'
    rounded: '{rounded.sm}'
  verdict-healthy:
    background: '{colors.leaf-tint}'
    rule: '{colors.leaf}'
  verdict-care:
    background: '{colors.amber-tint}'
    rule: '{colors.amber}'
  verdict-serious:
    background: '{colors.terracotta-tint}'
    rule: '{colors.terracotta}'
  verdict-unsure:
    background: '{colors.sunken}'
    rule: '{colors.ink-secondary}'
  bottom-nav:
    background: '{colors.surface}'
    border-top: '{colors.hairline}'
    active: '{colors.leaf}'
  header:
    background: '{colors.paper}'
    border-bottom: '{colors.hairline}'
---

## Brand & Style

CropMagix is a field notebook, not a sci-fi console. The product is pointed at a farmer's worst afternoon: a crop going yellow and a loan riding on it. The interface should feel like a trusted agronomist's notebook: warm paper, confident ink, a deep leaf green that means "act here", and real photographs of real leaves.

The explicit brief is *it shouldn't look AI-generated*. Everything that signals generic AI tooling is out: glassmorphism, glowing orbs, purple-to-green gradients, gradient-filled text, sparkle emoji, "AI Powered" chips, and bento grids of gradient icon tiles. The AI is real; it doesn't need to be decorated. Credibility comes from print typography, plain words, honest confidence and real photos.

The demo audience is hackathon judges. The first 20 seconds must read as a finished product with a point of view, not a template.

## Colors

The palette is drawn from a field: paper, soil, leaf, turmeric and clay. Light mode (`paper`) is the default; dark mode is "night field", a warm near-black rather than blue-black.

- **Paper (`{colors.paper}`)** is the page. **Surface (`{colors.surface}`)** is anything that sits on it: cards, sheets, inputs. **Sunken (`{colors.sunken}`)** is for wells: photo frames, empty states and the "unsure" verdict.
- **Ink (`{colors.ink}`)** for text and icons. **Ink secondary** for supporting text, **ink muted** for meta only (timestamps, units), never for anything the user must read to act.
- **Leaf (`{colors.leaf}`)** is the only action colour: primary buttons, active navigation, links, focus. It also marks "healthy". It is not used for decoration.
- **Turmeric (`{colors.turmeric}`)** is the single accent: the "Example photos" ★ marker, the today marker on the calendar, highlight underlines. It never carries text on its own background below 18px.
- **Amber, terracotta, sky** are status colours only: needs care, serious, information. Each has a `-tint` for backgrounds, with the strong value used for a 4px rule and icon, never as a large fill.
- Hairlines (`{colors.hairline}`) separate things. Heavier separation uses space, not stronger lines.

Contrast: ink on paper is 13:1, leaf on paper 7.4:1, on-leaf on leaf 7.6:1. The dark variants keep body text at 4.5:1 or better.

Avoid: gradients of any kind, neon or saturated greens (`#10b981` family), purple, blue-black backgrounds, coloured text on coloured backgrounds.

## Typography

Two families, each with a clear job.

- **Fraunces** (serif) for `display`, `title`, `heading` and `numeral`. It gives the notebook its voice: page titles, the verdict headline, temperatures, scan counts. Never for paragraphs or buttons.
- **Public Sans** for everything a person reads or taps: body, labels, buttons, chips, navigation. **Noto Sans Devanagari** and **Noto Sans Telugu** are in the stack so Hindi and Telugu render in a matched, well-hinted face rather than a random system fallback.

Rules: one `display` per screen at most (landing, home greeting). Page titles use `title`. Section headings use `heading`. `overline` is for small section labels (for example "TOOLS"), in ink-secondary, never in colour. Body text never goes below 15px on phones. Numbers that matter (confidence, temperature, counts) use `numeral` with tabular figures.

## Layout & Spacing

Scale: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64. Page gutter is 16px on phones and 24px from 640px up.

- **Phone (<640px):** single column, bottom tab bar, content padded above it.
- **Tablet (640–1023px):** single column up to `page-max` (960px), with two-column grids inside sections (tools, stats, forecast). Bottom tab bar stays.
- **Desktop (≥1024px):** header navigation replaces the tab bar. Content columns: `page-max` 960px for tool pages, `wide-max` 1200px for home and landing. Diagnosis screens (scanner result, Voice Doctor) split into photo on the left and answer on the right.

Vertical rhythm: 32px between sections, 16px within a section, 8px between a label and its value.

## Elevation & Depth

Flat by default. Hierarchy comes from paper → surface tone change, hairlines and type, not shadows.

Shadows exist only for things that physically float over content: the bottom tab bar, the scanner dock, sheets and modals, toasts. Use one shadow, `0 1px 2px rgba(31,42,34,.06), 0 8px 24px rgba(31,42,34,.08)`. No glows. No `backdrop-filter` blur except on the camera overlay, where it is needed for legibility over live video.

## Shapes

Small, practical radii, like a cut card rather than a phone bubble. `{rounded.sm}` (6px) for chips, inputs and small buttons; `{rounded.md}` (10px) for buttons and list containers; `{rounded.lg}` (14px) for cards and photo frames. `{rounded.full}` only for avatars, status dots and the scanner shutter. Photos follow their container's corners.

## Components

- **Header:** paper background, hairline bottom. Left: wordmark "CropMagix" in Fraunces with a small leaf mark in leaf green. Right: language switch (EN · हि · తె as a segmented control) and theme toggle. Desktop adds text navigation; the active item gets a 2px leaf underline, not a filled pill.
- **Bottom tab bar:** surface background, hairline top, single floating shadow. Five items; the centre "Scan" is a leaf-green square button raised 12px. Active item: leaf icon and label; inactive: ink-muted.
- **Page header:** sticky under the app header. Back button (40px square, hairline border), Fraunces `title`, optional trailing action. No gradient text.
- **Button primary:** leaf fill, on-leaf text, 48px tall, `{rounded.md}`. Pressed: leaf-strong. Disabled: sunken fill, ink-muted text.
- **Button secondary:** surface fill, hairline-strong border, ink text.
- **Card:** surface, 1px hairline, `{rounded.lg}`, 16–20px padding. No shadow.
- **List row:** 56px minimum, icon (20px, ink-secondary) + label (`body-strong`) + optional meta + chevron. Rows divided by hairlines inside a card.
- **Chip:** 36–40px tall, `{rounded.sm}`, hairline-strong border. Selected: ink fill with paper text (not green, so it doesn't compete with actions).
- **Verdict block:** the diagnosis headline. Tinted background by verdict, a 4px left rule in the strong status colour, a 32px icon, a Fraunces `title` ("Looks healthy", "Needs care", "Serious problem", "Not sure yet"), then one line of explanation. "Not sure yet" uses sunken and ink-secondary and has the same visual weight as the others.
- **Confidence meter:** a thin 6px bar on sunken with a leaf/amber/terracotta fill, plus a `numeral` percentage. Always paired with the photo mode label ("Compared with example photos" or "General guess").
- **Stat:** Fraunces numeral at 28–32px over a `meta` label. Stats sit in a row separated by hairlines, never in coloured tiles.
- **Photo frame:** sunken background, `{rounded.lg}`, real photograph, 1px hairline. The empty state shows a line icon and one sentence.
- **Toast:** ink background, paper text, `{rounded.md}`, above the tab bar.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Use real leaf photographs as imagery | Glowing orbs, particles, abstract blobs, grid overlays |
| Flat surfaces separated by hairlines and tone | Glassmorphism, `backdrop-filter`, gradient fills |
| Fraunces for titles and numbers, Public Sans for everything else | Gradient-filled or glowing text |
| Leaf green only for actions and "healthy" | Green as decoration on every icon and border |
| Line icons (lucide) at one stroke weight | Emoji as UI icons (🌱 🌍 ✨ 📷) |
| "Not sure yet" designed as a real result | Hiding uncertainty or styling it as an error |
| Status colour as a 4px rule plus a tint | Large saturated red, amber or green fills |
| Plain labels ("Check a sick plant") | "AI Powered", "Smart", "Magic" badges |

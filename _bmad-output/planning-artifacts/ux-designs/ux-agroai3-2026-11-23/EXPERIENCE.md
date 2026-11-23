---
name: CropMagix
status: final
created: 2026-11-23
updated: 2026-11-23
sources:
  - _bmad-output/brainstorming/brainstorm-cropmagix-voice-features-2026-11-22/.memlog.md
  - _bmad-output/brainstorming/brainstorm-talking-plant-ar-2026-11-22/.memlog.md
  - _bmad-output/experiments/accuracy-ladder.md
---

# CropMagix: Experience Spine

## Foundation

CropMagix is a responsive web app (Next.js, installable as a PWA). It is designed phone-first, because the demo is run on a phone, and it also has tablet and desktop layouts, because the demo may be projected from a laptop. There is no third-party UI system; components are hand-built against `DESIGN.md`, which is the visual identity reference. Light mode is the default on first open. Dark mode ("night field") is a toggle and is remembered.

Languages: English, Hindi and Telugu. The language switch is always in the header and applies to the whole app.

Scope for this round: the 11 existing screens, redesigned. No new features.

## Information Architecture

| Surface | Route | Reached from | Purpose |
|---|---|---|---|
| Landing | `/landing` | First open (via `/`) | Explain the product in one screen and a scroll, then one "Get started" |
| Home | `/home` | Tab bar, logo, after landing | Start a diagnosis; reach every tool; see scan totals |
| Scan | `/scanner` | Tab bar (centre), Home primary block | Camera or upload → full plant report; live AR overlay |
| Voice Doctor | `/voice-doctor` | Tab bar, Home | Photo + spoken question → the plant answers aloud |
| Soil | `/soil` | Home tools, desktop nav | Soil photo → nutrients, pH, suitable crops |
| Weather | `/weather` | Tab bar, Home tools | Local forecast and farming conditions |
| Chat | `/chat` | Tab bar, Home tools | Text or voice questions to "Sage" |
| Crop calendar | `/calendar` | Home tools | Month view, my crops, seasonal advice |
| Medicine guide | `/medicine` | Home tools, scan result | Treatments per disease; organic-only toggle |
| Pest alerts | `/pest` | Home tools | Pests by crop and season |
| History | `/history` | Home tools, Home stats | Past scans, on this device (or cloud when configured) |

Navigation:
- **Phone and tablet:** a bottom tab bar with Home · Voice · **Scan** · Weather · Chat. It is hidden on Landing, Scan (full-screen camera) and Chat (which has its own input bar).
- **Desktop (1024px and up):** the same destinations plus Soil appear as text links in the header; there is no tab bar.
- Every non-tab page has a back button in its page header that returns to Home.
- Modals stack one level deep, never two.

## Voice and Tone

Microcopy. The brand voice lives in `DESIGN.md` Brand & Style. Write for Ramaiah garu: he reads slowly, he is anxious, and he must never feel talked down to.

| Do | Don't |
|---|---|
| "Check a sick plant" | "Unleash AI-powered crop intelligence" |
| "Not sure yet. Take another photo in daylight, closer to the leaf." | "Error: low confidence" |
| "About 70% sure. Show this to your agriculture officer before spraying." | "Diagnosis complete! ✅" |
| "No internet. Your scans are saved on this phone." | "Network error" |
| Sentences under 18 words, everyday names first ("leaf spot", then the Latin) | Exclamation marks, emoji, "Magic", "Smart", "AI-powered" |
| Doses in household units when the data gives them | Brand names in advice |

Section headings in reports are plain nouns ("Diagnosis", "Treatment", "Prevention") with a line icon, never emoji.

## Component Patterns

Behavioural rules. Visual specs live in `DESIGN.md` Components.

| Component | Used in | Behaviour |
|---|---|---|
| Header | All except Scan and the `/` splash | Language switch applies instantly and is remembered. Theme toggle is remembered. Logo goes to Home. |
| Bottom tab bar | Phone and tablet | Active tab is marked with `aria-current`. Tapping the active tab does nothing. The Scan tab opens the camera. |
| Page header | Tool pages | Sticks under the app header while scrolling. Back returns to Home. |
| Primary action block | Home | The whole block is one tap target to Scan. |
| Tool row | Home | The whole row is the link; there are no nested buttons. |
| Verdict block | Scan result, Voice Doctor | Shown before any audio plays and before details. One of four verdicts: healthy, needs care, serious, not sure yet. |
| Confidence meter | Scan result, Voice Doctor | Always shown with the photo-mode label. In general mode, confidence is shown as "General guess" and the copy says it is less reliable. |
| Report sections | Scan, Soil | The first two sections are open (Summary, Diagnosis); the rest are collapsible on phones and fully open on desktop. |
| Chip group | Medicine, Pest, Calendar, Voice Doctor | Single-select. Scrolls sideways on phones rather than wrapping into many rows. |
| Toast | Global | Auto-dismisses after 3 seconds; tap to dismiss. Never used for errors that need action; those go inline. |

## State Patterns

| State | Surface | Treatment |
|---|---|---|
| First open | `/` | Brief splash, then Landing the first time and Home afterwards. |
| Camera denied or unavailable | Scan, Soil | Inline panel: "Camera is off. Upload a photo instead." with an Upload button. No dead end. |
| Thinking (about 4–5 s) | Scan, Voice Doctor, Soil | Staged progress text ("Looking at the leaf…", "Comparing with example photos…", "Writing the answer…") plus a slim progress bar. The photo stays visible. |
| Not sure yet | Scan, Voice Doctor | Designed as a first-class result (it happens on about 60% of answers). Gives the next step: retake the photo or ask the officer. |
| Serious | Scan, Voice Doctor | Terracotta verdict plus the line "Show this to your agriculture officer soon." |
| Example photos vs general guess | Scan, Voice Doctor | The label is always visible next to the confidence. A general guess never shows a high-confidence colour. |
| Empty history | History, Home stats | "No scans yet. Your first check takes about 5 seconds." plus a Scan button. Stats show 0 without animation. |
| Offline | Global | A slim banner under the header: "No internet. Scans need a connection; your history is on this phone." |
| Supabase not configured | History, Chat | Silently uses on-device storage. Never shows an error. |
| Loading weather | Weather | Skeleton of the hero and the four detail cells; location is named as soon as it is known. |
| Voice unavailable | Voice Doctor, Chat | "Voice is not available in this browser. You can still type / send the photo." |

## Interaction Primitives

- Tap to act. Hold-to-talk is not used; the mic is tap to start and tap to stop, with a 25-second cap.
- Sideways scroll only for chip rows and the 7-day forecast.
- Drag on the Voice Doctor photo moves the plant's face.
- Pull-to-refresh is not used; Weather has an explicit refresh button.
- **Banned:** carousels on Home, auto-rotating content, hover-only information, confetti, animated counters, parallax.

## Accessibility Floor

Behavioural. Visual contrast lives in `DESIGN.md`.

- Every control has an accessible name. Icon-only buttons have `aria-label`s, and the language buttons announce the language name in its own script.
- Tap targets are at least 44×44 px.
- Pinch-zoom is never disabled. Form text is 16px or larger on touch devices, so iOS doesn't zoom on focus.
- A visible focus ring (leaf, 3px) is shown on every interactive element for keyboard users, plus a "Skip to content" link.
- With reduced motion set, all non-essential animation is off; scanning and thinking states still change text.
- Verdicts and spoken sentences are in `aria-live="polite"` regions.
- `<html lang>` follows the selected language.
- Colour is never the only signal: every verdict has an icon and a word.

## Responsive & Platform

| Width | Navigation | Layout |
|---|---|---|
| < 640px | Bottom tab bar | One column, 16px gutter |
| 640–1023px | Bottom tab bar | One column up to 960px, two-column grids inside sections, 24px gutter |
| ≥ 1024px | Header links | Home and Landing up to 1200px; tool pages 960px; diagnosis screens split photo / answer |

Safe areas (notch, home indicator) are respected on the header, tab bar and scanner dock. Installed as a PWA, the app opens on `/`.

## Inspiration & Anti-patterns

- **Lifted from printed agricultural extension leaflets:** a plain headline, one picture, three steps, and a "see your officer" line.
- **Lifted from field notebooks and seed packets:** paper tone, ink, small radii, labels as typography rather than chips.
- **Rejected: the "AI dashboard" look** (glass cards, neon gradients, glowing orbs, sparkle emoji, bento grids). The user's brief was that it should not look AI-generated.
- **Rejected: hiding uncertainty.** The accuracy ladder shows confidence matters; "Not sure yet" is honest and gets its own designed state.

## Key Flows

### Flow 1: The booth demo (a judge, three minutes, laptop projected and phone in hand)

1. The judge opens the link on a phone. Landing shows the headline, a real tomato-leaf photo, and "Get started".
2. Home: "Check a sick plant" dominates the screen and the tools are listed underneath. The judge understands the product within 20 seconds.
3. The judge taps the centre Scan tab and points at a leaf (or uploads one).
4. The thinking state shows the photo with staged progress text for about 5 seconds.
5. **Climax:** the verdict block appears ("Needs care: Early blight", about 82% sure, compared with example photos), followed by the treatment and a "Show this to your agriculture officer" line.
6. The judge opens Voice Doctor, switches to తెలుగు, uploads the same leaf and taps "Ask the plant doctor". The plant answers aloud in Telugu while each sentence highlights in turn.

Failure: the camera is blocked by the browser → the Upload button is right there; the demo continues.

### Flow 2: Ramaiah garu checks his tomato field (evening, 3G, Telugu)

1. He opens the app; it remembers తెలుగు.
2. He taps the Voice tab, takes a photo of a yellowing leaf, and says what he sees.
3. The thinking state shows the photo and the progress text in Telugu.
4. **Climax:** the verdict is "Not sure yet", in a calm grey, with the advice to retake the photo in daylight or show it to the officer. He is not alarmed by a wrong guess.
5. He retakes the photo closer up. The verdict is now "Needs care", with three short spoken sentences.
6. He opens the Medicine guide from Home, turns on "Organic only", and reads the treatment.

### Flow 3: Checking conditions before spraying (morning, any user)

1. Weather tab: the location appears first, then the temperature and four details (feels like, humidity, wind, visibility).
2. The farming-conditions score explains in one line whether today suits field work.
3. **Climax:** the 7-day strip shows when rain is due, so he decides whether to spray today or wait.

# Liquid Glass engine

A reusable glass material for the Dashboard. One element, `GlassSurface`, renders every glass component; a provider picks the best rendering tier the browser can afford.

Live demo with every component over light, dark, photographic and moving backdrops: `/glass`. Add `?glassdebug=1` for the debug panel (`?glassdebug=0` hides it again).

## Files

| File | What it does |
| --- | --- |
| `src/lib/glass/theme.ts` | The theme (`liquidGlassTheme`), the three modes, `resolveGlass()` |
| `src/lib/glass/spring.ts` | `springCurve()`: a spring simulated once and turned into a CSS `linear()` easing |
| `src/lib/glass/displacement.ts` | `refractionMap()`: the per-size displacement map used for Tier 1 refraction |
| `src/lib/glass/capabilities.ts` | `detectTier()` and the one-off frame-time probe |
| `src/components/glass/engine.tsx` | `GlassProvider`, `useGlass`, `GlassSurface`, error and stats reporting |
| `src/components/glass/components.tsx` | `GlassButton`, `GlassCard`, `GlassContainer`, `GlassInput`, `GlassNavbar`, `GlassDock`, `GlassModal`, `GlassDropdown` |
| `src/components/glass/debug.tsx` | The debug panel |
| `src/app/glass.css` | The material, the tiers and the component styles |

## Rendering tiers

| Tier | When | What you get |
| --- | --- | --- |
| 1 | Chromium (Chrome, Edge, Arc, Opera) with normal frame times | Tier 2 plus pixel refraction: an SVG `feDisplacementMap` inside `backdrop-filter`, with optional chromatic fringing |
| 2 | Safari, Firefox, or Chromium that measured slow frames | `backdrop-filter` blur and saturation, a tint, a specular sheen that follows the pointer, a lit 1 px rim |
| 3 | `prefers-reduced-transparency`, `prefers-contrast: more` | Solid, nearly opaque surfaces with a clear border; no translucency |

The server and the first client render use Tier 2, then the real tier is applied. When Tier 1 is chosen, 60 frames are timed once; a median above 26 ms drops to Tier 2. No timing loop runs after that.

**What this is not.** Tier 1 bends the backdrop along the edges with a displacement map computed from a rounded-rectangle distance field. That looks like a thick lens rim, but it is an approximation, not physically based refraction, and Tiers 2 and 3 do not refract at all. Safari and Firefox don't support SVG filters inside `backdrop-filter`, which is why they get Tier 2.

## Using it

```tsx
import { GlassButton, GlassCard, GlassSurface } from "@/components/glass";

<GlassCard as="article" className="p-4">…</GlassCard>
<GlassButton variant="primary" icon={<Mic size={16} aria-hidden />}>Talk</GlassButton>
<GlassSurface shape="capsule" interactive contrast="high">…</GlassSurface>
```

`GlassSurface` props: `as`, `mode` (override the global intensity), `overrides` (`{ optics, lighting, motion }`), `shape` (`rounded` | `capsule` | `circle`), `radius`, `interactive` (hover lift, press squeeze, pointer highlight), `tint` (`clear` | `accent` | `danger`), `contrast` (`auto` | `high`).

### Intensity modes

`subtle`, `balanced` (default) and `expressive` change blur, refraction strength, highlights and motion together. Switch globally with `useGlass().setMode()`, or per surface with `mode`.

### Readability

- `contrast="high"` (and any glass on a page with a photo background) raises a tint floor, `--lg-tint-min`, so text stays legible over busy content. `GlassSurface` sets `--lg-tint` inline, so CSS raises the floor instead of overriding the tint.
- `data-glass-scheme="light" | "dark"` on any container makes the glass inside it match that backdrop instead of the app theme, for example a light photo shown inside the dark theme.
- Accent and danger tints use white text. In the dark theme their base is deepened by about a fifth, which takes white text from 3.4 : 1 to about 4.8 : 1 (WCAG AA).

### Motion

All motion is CSS: hover, press, the navbar indicator and the modal morph use the spring easing in `--lg-spring` / `--lg-spring-ms`, which the provider sets on `<html>`. The pointer highlight updates two CSS variables at most once per frame and only while the pointer is over the surface. `prefers-reduced-motion` turns the transforms and morphs off.

## Debug panel

Shows the tier and why it was chosen, frame rate (measured only while the panel is open), the number of mounted surfaces and any engine errors. It can switch the mode and force a tier. GPU time is shown as not measurable: browsers composite backdrop filters outside anything page timers can see.

## Testing done

Run with `npm test` (`tests/glass.test.ts` covers the spring easing and mode resolution; `tests/leads.test.ts` covers the Analysis tab's CSV import).

Checked by hand in Chromium only (the Claude desktop browser pane), 2026-11-12:

- Tier 1 refraction applied to every visible surface; forced Tiers 2 and 3 render without filters (Tier 3 solid).
- All four backdrops in `/glass`; light and dark schemes; accent and danger tints.
- Modal: opens from its button, focus moves inside, Escape closes it and focus returns. Dropdown: arrow keys move between items, Escape closes and returns focus. Dock: "more" expands.
- Phone width (375 px): no horizontal scroll; Jarvis sits above the tab bar.

Not tested: Safari, Firefox, real iOS or Android devices, screen readers, and frame rates on low-end hardware. The frame-time probe is the safeguard for slow devices, but it hasn't been tried on one.

# Dashboard and Jarvis

- **Name.** The interface is called "Dashboard" (`APP_NAME`). Inside Google the app keeps the name "FIRU Business" (`GOOGLE_NAME`): the Drive root folder, the synced calendar and the "Synced from FIRU Business." marker on synced events. That way nothing already in Google has to be renamed.
- **Tabs.** Home, Analysis, Calendar and Portfolio come first in the sidebar and the phone dock. Today, Email, Clients and Instagram are listed under "More".
- **Analysis** (`/analysis`) shows the lead pipeline, the next clients (the furthest along first, then the best fit) and every client. Import `~/Documents/Business Brain/leads.csv` with the button. Leads are matched by business name, and a status set in the app is kept unless the file shows the lead further along. The status menu only records what was done; nothing is sent from the app. Table: `leads`, migration `drizzle/0023_leads.sql`, which runs automatically on the next deploy.
- **Portfolio** shows a live preview of https://gabi-popescu.vercel.app at the top. The site is allowed in the `frame-src` Content Security Policy in `next.config.ts`.
- **Look ("Silk").** The default background is violet silk ribbons, drawn as an SVG (`lib/backgrounds.ts`). It has real shapes, so the glass in front visibly bends and frosts it. Over Silk, cards frost with a lit rim, Home's tiles are refracting `GlassSurface`s, page titles use Instrument Serif, and the accent is violet (#6a3df5 light, #9d7cff dark). It's chosen in Settings → Background, where every older background is still available.
- **Jarvis** is the bar at the bottom of every page (⌘J / Ctrl+J focuses it).
  - **Character.** A calm British butler with dry wit, spoken in the browser's British voice where one exists ("Daniel" on a Mac, "Google UK English Male" in Chrome). It answers in Romanian when you switch to RO; the only Romanian voice on a Mac is "Ioana", a female voice.
  - **Morning briefing.** Say "Good morning", press the sunrise button, or accept the once-a-day offer. Jarvis first organises today's free time (the existing rule-based planner, as proposals), then goes through the day's times, anything urgent (tasks due, unread mail if Gmail is connected, leads waiting more than 4 days for a reply) and the first focus block.
  - **Actions.** Plan the day, add a task, set a lead's status. Each appears as a chip in the chat and the page refreshes. It can't send messages or emails.
  - **Wake word.** Off by default; turned on with the ear button. While it's on, the tab listens for "Jarvis" and takes what follows as the request. It pauses while Jarvis speaks and whenever the tab is hidden. Browser speech recognition sends audio to the browser maker's speech service (Google in Chrome), so leave it off when you don't need it.
  - Replies come from Claude Sonnet through `/api/ai/jarvis`, using the owner's stored key with the usual hourly limit and usage log. Mail is read as sender and subject only. The conversation stays in the browser tab.
- **Not built yet:** a studio-quality voice (it would need a paid speech service such as ElevenLabs), creating calendar events by voice, and listening when the Dashboard tab isn't open.

## Jarvis's voice and hearing (ElevenLabs)

- **Why.** Browser voices sound robotic, and browser speech recognition mishears names and food ("shawarma" → "shower"), especially in Romanian or mixed speech. ElevenLabs ranks at the top of current blind listening tests and supports Romanian in both directions.
- **Voice out.** `/api/speech/tts` uses `eleven_v4_turbo` (expressive, real-time, Romanian and English) with the voice "George" (`JBFqnCBsd6RMkjVDRZzb`, warm British male) unless another voice ID is set. Each sentence is fetched while the previous one plays.
- **Hearing.** With a key, the mic button records your request. Recording stops by itself after about 1.3 s of silence, and the audio goes to `/api/speech/stt` (Scribe v3, language detected automatically). The wake word still uses the browser to spot "Jarvis", then records the request properly.
- **Setup.** Settings → Jarvis voice → paste the ElevenLabs API key (owner only, stored encrypted). Without a key, everything falls back to the browser. If the key fails, Jarvis says so once and uses the browser voice.
- **Microphone.** The site's `Permissions-Policy` used to block the microphone entirely (`microphone=()`), which broke voice input in production. It is now `microphone=(self)`.
- **Schedule control.** Jarvis runs on Claude Opus and can list, add, move, rename and delete Google Calendar events; plan, accept or clear today's blocks; add, complete, reschedule and edit tasks; and update leads. It deletes only when clearly asked.

## Redesign of 2026-11-12: the lens that actually bends

- **What was wrong.** The first version looked like plain frosted panels. Two causes: the backdrop was a soft blur with nothing to bend, and the lens filter was silently not applied. Chromium only honours an SVG `url()` filter in `backdrop-filter` when it comes first in the chain; after `blur()` it is dropped.
- **Fix.** One SVG filter now does everything in order: frost (`feGaussianBlur`), bend (`feDisplacementMap`), saturate (`feColorMatrix`). The rim is a fixed physical width (about 30 px) instead of a share of the surface, and pulls the backdrop up to about 55 px. Verified with a striped test backdrop: lines visibly curve at every glass edge.
- **Backdrop.** Silk is now folded satin with hard creases (`lib/backgrounds.ts`), so there are edges for the glass to bend.
- **One material everywhere.** `Card`, Home tiles, the sidebar, the phone dock, the Jarvis bar and Settings' section list are all `GlassSurface`. The older `.glass` / `.chrome` classes take the same look through tokens in `globals.css`.
- **Phones.** Only bars marked `lens="always"` (dock, Jarvis bar) bend the backdrop; cards are frosted, to keep scrolling smooth.
- **Mobile Settings.** The More menu used to open underneath the Jarvis bar, which covered its last item (Settings). It now opens above it, with Settings first.
- **Logo.** A violet glass tile with a silk fold and a "D" whose centre dot is the Jarvis orb (`components/logo.tsx`, `app/icon.svg`, `app/apple-icon.tsx`).

## On-device voice and hearing (no account, no key)

Jarvis picks the best engine available: ElevenLabs if a key is saved in Settings, otherwise open models running in the browser, otherwise the browser's own voice.

- **Voice:** Kokoro (82M parameters, Apache 2.0), British voice "George" by default; four other voices in the Jarvis voice panel. English only: Romanian replies use the browser's Romanian voice.
- **Hearing:** Whisper (MIT). The mic records the request, stops after a pause, and transcribes it on the device. The language follows the EN/RO switch on the bar.
- **Where it runs:** a Web Worker (`src/lib/speech-local/`). Recordings and text never leave the device. Model files come from Hugging Face once and are cached by the browser; the WebAssembly runtime is served by the site itself (`public/ort`, copied by `scripts/copy-ort.mjs` before `dev` and `build`).
- **Which build a device gets** (`planFor` in `client.ts`):
  - Computer with WebGPU: full-precision voice and Whisper small, about 910 MB once. Measured on an Apple-silicon Mac in Chromium: a 4.8 s sentence is ready in 0.85 s, and a request is transcribed in 0.8 s ("Add shawarma with Andrei tomorrow at one o'clock…" came back right).
  - Phone, or no WebGPU: 8-bit voice and Whisper base on the CPU, about 170 MB once, offered rather than downloaded automatically. On that build the voice took 1.6× real time on the Mac and Whisper base heard "shawarma" as "Shaoalma". If speech takes over 1.25× real time to make, Jarvis says so and uses the browser voice.
  - The half-precision voice build is not used: it is fast but garbled on WebGPU.
- **Policy changes:** `script-src` gains `'wasm-unsafe-eval'` (WebAssembly only) and `connect-src` gains huggingface.co / hf.co for the model files.
- **Not tested:** recording from a real microphone (the test browser has none; transcription was tested on audio made by the voice model), real phones, Safari and Firefox.


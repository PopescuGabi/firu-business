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
- **Jarvis** is the bar at the bottom of every page (⌘J / Ctrl+J focuses it). The microphone uses the browser's speech recognition (Chrome, Edge, Safari), in Romanian or English. Replies come from Claude Sonnet through `/api/ai/jarvis`, using the owner's stored key with the usual hourly limit and usage log, and are read aloud sentence by sentence (the speaker button mutes this). Jarvis sees a read-only snapshot of the next 7 days, open tasks, clients and open leads. It can't change data or send anything. The conversation stays in the browser tab and is not saved.
- **Not built yet:** a hands-free "Jarvis" wake word (it would need the microphone open all the time), and actions such as creating tasks or events by voice.

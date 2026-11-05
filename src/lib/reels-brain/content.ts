// Reels Brain — the distilled craft rules from the research (social-video-brain skill, Nov 2026).
// Evidence: S = standard/law, P = platform guidance, R = research, H = professional heuristic, X = hypothesis, O = own test.
// Shown on Clients → Reels Brain and sent to Claude (see prompt.ts). Client facts never live here.

export type Rule = { title: string; body: string; evidence: string; confidence: "High" | "Medium" | "Low" };
export type RuleGroup = { id: string; title: string; rules: Rule[] };

export const RULES: RuleGroup[] = [
  {
    id: "hook",
    title: "Hook (first 0–3 s)",
    rules: [
      {
        title: "Three hooks, one subject",
        body: "The subject is in frame 0, a text hook (≤ 2 lines) is visible from frame 0, and the first word lands within ~0.5 s. Visual, text and spoken hook point at one subject and one question.",
        evidence: "P: Instagram Skip Rate counts skips in the first 3 s · H: Kallaway hook frameworks · R: Emplifi (speech in first 3 s ↔ higher retention, correlational)",
        confidence: "Medium",
      },
      {
        title: "Self-contained hook",
        body: "A cold-open line must make sense alone. „Toate astea”, „asta”, pronouns and answers need their setup — if the strongest line depends on setup, move the tension into frame 0, not the line.",
        evidence: "O: FIRU re-order test broke the referent of „astea”",
        confidence: "High",
      },
      {
        title: "Curiosity must pay off",
        body: "Open a gap only for something the video delivers, early enough to be seen. Unpaid curiosity is clickbait: fewer shares, lower trust.",
        evidence: "R: Mukherjee et al., J. Academy of Marketing Science 2022 (19,386 articles) · R: Loewenstein 1994",
        confidence: "Medium",
      },
    ],
  },
  {
    id: "story",
    title: "Script & story",
    rules: [
      {
        title: "Plan from the payoff",
        body: "Write what the viewer gets and where it lands first, then the shortest true hook that promises exactly that. If the payoff sits after ~40% of the runtime, add an early partial payoff or a cold open.",
        evidence: "P: TikTok Creative Codes (hook → body → close) · H",
        confidence: "Medium",
      },
      {
        title: "„Dar / așa că”, never „și apoi”",
        body: "Beats connect by complication (dar) or consequence (așa că). A list of „și apoi” beats is facts, not story. One idea and one visual per beat.",
        evidence: "H: Parker & Stone (NYU) · R: Mayer segmenting d≈0.70",
        confidence: "Medium",
      },
      {
        title: "Real stories transport",
        body: "Realistic story, identifiable person, concrete moment, easy imagery. Founder stories start from a specific moment, never abstract mission talk. Never invent a story or testimonial.",
        evidence: "R: van Laer et al., J. Consumer Research 2014 (meta-analysis, 132 effects)",
        confidence: "Medium",
      },
      {
        title: "Match the awareness level",
        body: "Problem-aware → name the pain in their words. Solution-aware → why this approach/person. Product-aware → specifics, proof, offer. Unaware → a story that surfaces the need.",
        evidence: "H: Schwartz, Breakthrough Advertising",
        confidence: "Medium",
      },
      {
        title: "One CTA, after the payoff, with a mechanism",
        body: "The smallest next step this viewer is ready for, and how: keyword DM (only if someone answers), link in bio, „Programări: …”, save, send to someone. No „comment YES”.",
        evidence: "P: Google ABCD Direction · P: Facebook demotes engagement bait (incl. in video audio)",
        confidence: "Medium",
      },
    ],
  },
  {
    id: "speaking",
    title: "Speaking reels",
    rules: [
      {
        title: "Clean, but keep the person",
        body: "Cut false starts, repeats and frequent fillers; keep breaths before sincere lines and occasional natural hesitations. Never change meaning, negations or qualifications.",
        evidence: "R: Laske et al. 2024 (12 fillers/min hurt, 5/min didn't — secondary) · S: BBC keep first/last words",
        confidence: "Medium",
      },
      {
        title: "Cut on meaning",
        body: "Protect emotion → story → rhythm → eye-trace (in that order). Punch-ins 1.07–1.15 to mark emphasis or hide a cut, not on a timer. B-roll shows what's said (L-cut: voice continues).",
        evidence: "H: Murch, Rule of Six · R: shot count vs engagement is an inverted U (Xiao et al. 2024)",
        confidence: "Medium",
      },
      {
        title: "Credibility over polish",
        body: "Choose the polish level that makes this speaker credible for this audience. Clear audio and readable captions always; never fake casualness.",
        evidence: "R: J. Business Research 2024 (2,578 TikTok ads: authenticity U-shaped, expertise/trust positive) · X",
        confidence: "Low",
      },
    ],
  },
  {
    id: "motion",
    title: "Motion & editing",
    rules: [
      {
        title: "Every effect has a job",
        body: "Orient attention, explain a relationship, reveal a step, keep continuity or express emotion — or remove it. Hold still when the viewer must read or inspect.",
        evidence: "R: Mayer coherence d≈0.70 · S: IBM Carbon motion checklist",
        confidence: "High",
      },
      {
        title: "One onset at a time, on the word",
        body: "Attention goes to motion onsets, not ongoing motion. Diagram states change on the spoken keyword (≤ 0.3 s early). Labels are keywords, not sentences.",
        evidence: "R: Abrams & Christ 2003 · R: Mayer temporal contiguity d≈1.30, signalling d≈0.46, redundancy d≈0.87",
        confidence: "Medium",
      },
      {
        title: "Easing & vocabulary",
        body: "Entrances decelerate, exits accelerate; springs for natural motion. 2–3 transitions per client; match cuts/wipes for transformations; one riser→hit per video at most.",
        evidence: "S: Material 3 (now springs) · S: IBM Carbon · H",
        confidence: "Medium",
      },
    ],
  },
  {
    id: "captions",
    title: "Captions",
    rules: [
      {
        title: "Three different text jobs",
        body: "Accessibility captions (all speech + meaningful sounds), editorial text (hook, keywords, labels) and the post caption. Decorative keywords are not captions. Text-only reels need alt text and a readable post caption.",
        evidence: "S: WCAG 1.2.2 / 1.2.5 · S: BBC subtitle guidelines",
        confidence: "High",
      },
      {
        title: "Verify every word",
        body: "Check names, numbers, negations, diacritics (ș ț with comma) against the audio. Whisper invents text over music and its word times can be ~0.4 s early.",
        evidence: "O: 7 client reels inspected (Siloși, Growth, FIRU)",
        confidence: "High",
      },
      {
        title: "Phrase chunks at grammar",
        body: "Never split preposition+noun, number+unit, negation+verb. ≤ 17 characters/s is a review flag for adults (13 for children); fast verbatim up to ~20 cps is usually fine. Sentence case; caps only for 1–4 word display text.",
        evidence: "S: BBC (0.3 s/word, linguistic breaks) · S: Netflix Romanian guide · R: Szarkowska 2018 · R: Tinker 1955",
        confidence: "High",
      },
      {
        title: "Style chosen per video",
        body: "Calm/authoritative speaker → phrase + one accent. Rhythm-led tips → word highlight on content words only. Diagram-heavy → phrase (the diagram already supplies onsets). Music only → no subtitles, alt text.",
        evidence: "X: no study compares word-by-word vs phrase captions · O: caption-style comparison render",
        confidence: "Low",
      },
      {
        title: "Placement",
        body: "One stable anchor in the lower-middle band, never on faces, products or graphics. Instagram safe box ≈ x 65–1015, y 270–1250 on 1080×1920; keep the right ~230 px clear in the lower half. BBC 9:16: line height 4–5% of frame height.",
        evidence: "S: BBC 9:16 · P (secondary): Meta safe-zone conversions",
        confidence: "Medium",
      },
    ],
  },
  {
    id: "audio",
    title: "Audio",
    rules: [
      {
        title: "Voice first",
        body: "Music 18–24 LU under speech, deeper for older audiences (clinics). Speech + music beats music only for persuasive content. Sound effects only with a visual event of the same weight.",
        evidence: "R: music masks speech more for older listeners (Başkent 2014; NHK) · P: Meta × Toluna ad research",
        confidence: "Medium",
      },
      {
        title: "Loudness & licensing",
        body: "−14 LUFS integrated, ≤ −1 dBTP — re-measured after the final encode. Business accounts and boosted posts need cleared music (Meta Sound Collection, owned or ad-licensed).",
        evidence: "H/vendor convention (no official Instagram target) · P: Instagram music library is for personal use",
        confidence: "Medium",
      },
    ],
  },
  {
    id: "platform",
    title: "Platform & distribution (verify periodically)",
    rules: [
      {
        title: "What gets ranked",
        body: "Instagram Reels: reshares, watching to the end, likes, audio-page visits. TikTok: interactions incl. watch-in-full weigh most; search weighs query match. YouTube: viewed vs swiped, view duration, % viewed, surveys.",
        evidence: "P: Instagram Ranking Explained (2023) · P: TikTok Support (current) · P: YouTube Help",
        confidence: "High",
      },
      {
        title: "What gets shown less",
        body: "Watermarks, borders, muted, low-res, majority-text and reposted reels. Not recommended to non-followers: pharmaceutical, weight-loss and cosmetic-surgery promotion; unrelated long captions; bought engagement.",
        evidence: "P: Instagram Help Center — Recommendations (read Nov 2026)",
        confidence: "High",
      },
      {
        title: "Romania: post to Facebook too",
        body: "Ad reach late 2025: YouTube 12.9M, Facebook 10.3M, TikTok 8.7M (18+), Instagram 6.0M, LinkedIn 5.3M members. Local clients should publish the same vertical master to Facebook Reels; B2B adds a 4:5 LinkedIn cut.",
        evidence: "P: DataReportal Digital 2026 Romania (ad reach ≠ active users)",
        confidence: "Medium",
      },
      {
        title: "Medical clients (Romania)",
        body: "No guaranteed or unrealistic results, no unverifiable comparisons, doctor's image never next to discounts, patients only with consent, social pages are informational.",
        evidence: "S: CMR Decision 14/2026 amending 20/2025 (read in full)",
        confidence: "High",
      },
    ],
  },
  {
    id: "measure",
    title: "Measuring",
    rules: [
      {
        title: "One hypothesis, one variable",
        body: "Write the hypothesis before changing anything; compare only with the same client's similar posts (platform, format, length, paid vs organic). Hook tests: Instagram Trial Reels, first 3 s only.",
        evidence: "P: YouTube compare similar formats · P: Instagram Trial Reels · H",
        confidence: "High",
      },
      {
        title: "Diagnose before adding effects",
        body: "Weak result → topic/demand → distribution → opening (Skip Rate) → mid-video dips → payoff/offer → only then style. One post is an anecdote; promote a pattern after ≥ 3 comparable posts.",
        evidence: "P: YouTube (topic, competition, seasonality) · H",
        confidence: "High",
      },
    ],
  },
];

export type CheckItem = { id: string; label: string };
export type CheckGroup = { title: string; items: CheckItem[] };

/** Review checklist for an actual render. Ids are stable (saved per reel). */
export const REVIEW: CheckGroup[] = [
  {
    title: "Truth & fit",
    items: [
      { id: "benefit", label: "One clear viewer benefit; the hook's promise is paid off" },
      { id: "claims", label: "No invented numbers, results, urgency or testimonials" },
      { id: "sector", label: "Sector rules and consent checked (medical: CMR rules)" },
      { id: "cta", label: "One CTA after the payoff, with a real mechanism; no engagement bait" },
    ],
  },
  {
    title: "Opening",
    items: [
      { id: "frame0", label: "Frame 0 is the subject (no logo, black frame or fade) and the text hook is visible" },
      { id: "align", label: "Visual, text and spoken hook align; the hook makes sense on its own" },
      { id: "firstword", label: "First word within ~0.5 s" },
    ],
  },
  {
    title: "Pacing & motion",
    items: [
      { id: "beats", label: "Every beat adds an idea; no dead stretch" },
      { id: "effects", label: "Every effect has a job; holds long enough to read" },
      { id: "joins", label: "Joins are clean (no caption leaks, no audio clicks)" },
    ],
  },
  {
    title: "Captions",
    items: [
      { id: "accuracy", label: "Word-accurate vs audio (names, numbers, negations, diacritics)" },
      { id: "chunks", label: "Phrase chunks at grammar; reading speed reviewed" },
      { id: "safe", label: "Inside the safe area, off faces/products; checked with a UI overlay" },
      { id: "contrast", label: "Readable on the brightest frame" },
      { id: "a11y", label: "Complete caption track (or alt text for music-only)" },
    ],
  },
  {
    title: "Audio & export",
    items: [
      { id: "loud", label: "−14 LUFS ±1, true peak ≤ −1 dBTP after the final encode" },
      { id: "duck", label: "Music under the voice; licence OK" },
      { id: "listened", label: "Listened at phone volume, with sound and muted" },
      { id: "spec", label: "1080×1920, no watermark/border, text not dominating, cover title inside 1080×1440" },
    ],
  },
];

export const HOOK_FORMULAS: { name: string; template: string; example: string }[] = [
  { name: "Pain in their words", template: "„[What they say to themselves]”", example: "„Am angajat oameni, dar muncesc mai mult ca înainte.”" },
  { name: "Result first", template: "Show the end in frame 0 → „De la X la asta.”", example: "„De la schiță la asta. Trei săptămâni.”" },
  { name: "Before / after", template: "„Stânga: [atunci]. Dreapta: [acum].”", example: "„Stânga: prima mea planșă. Dreapta: acum.”" },
  { name: "Mistake", template: "„Greșeala pe care o fac [cine] la [ce].”", example: "„Greșeala pe care o fac aproape toți la primul album foto.”" },
  { name: "Contrarian (true)", template: "„[Credință comună] nu e problema.”", example: "„Numărul de oameni nu e problema.”" },
  { name: "Quantified curiosity (true number)", template: "Specific number + subject", example: "„196 m², patru decizii.”" },
  { name: "Benefit line", template: "The strongest promise, said plainly", example: "„Avem grijă de tine, nu doar de problema cu care ai venit.”" },
  { name: "Stakes / deadline", template: "„Mai am [timp] până la [ce].”", example: "„Mai am 36 de ore până la predare.”" },
  { name: "Question", template: "„Cum [rezultat] fără [durere]?”", example: "„Cum crești echipa fără să muncești mai mult?”" },
  { name: "Series", template: "„Ziua [N] din [drum].”", example: "„Ziua 1 spre TU Delft.”" },
];

export const CAPTION_STYLE_GUIDE: { style: string; when: string; why: string }[] = [
  { style: "Phrase + one accent", when: "Calm, authoritative or emotional speaker; diagram-heavy explainers", why: "Readable, dignified; doesn't compete with face or diagram onsets" },
  { style: "Word highlight (content words)", when: "Energetic, rhythm-led tips with short sentences", why: "Supports rhythm; restricting the accent to content words keeps emphasis on meaning" },
  { style: "Karaoke pill", when: "Very rhythmic, playful creator content", why: "Strongest emphasis; use sparingly — it lands on every word by default" },
  { style: "No subtitles", when: "Music-only typography reels", why: "Nothing spoken; carry the message in alt text and the post caption" },
];

export type NicheRow = { decision: string; cells: Record<string, string> };
export const NICHES = ["Clinic (founder-led)", "B2B strategy (typography)", "Consultant (speaking + diagram)", "Student/designer process", "Consumer app", "Craft product"];
export const NICHE_MATRIX: NicheRow[] = [
  { decision: "Objective", cells: { "Clinic (founder-led)": "Trust → informational booking", "B2B strategy (typography)": "Positioning → leads", "Consultant (speaking + diagram)": "Leads", "Student/designer process": "Authority, portfolio", "Consumer app": "Awareness → installs", "Craft product": "Sales, saves" } },
  { decision: "Hook", cells: { "Clinic (founder-led)": "Sincere contrast or patient benefit; no fear", "B2B strategy (typography)": "Owner's frustration (keep setup referents)", "Consultant (speaking + diagram)": "Pain in the viewer's words", "Student/designer process": "Result first, transformation", "Consumer app": "The problem shown as a picture", "Craft product": "Emotion + object" } },
  { decision: "Captions", cells: { "Clinic (founder-led)": "Phrase, larger (~70 px), 1 accent", "B2B strategy (typography)": "Editorial cards; alt text", "Consultant (speaking + diagram)": "Phrase + 1 accent; 2 emphasis levels max", "Student/designer process": "Phrase or none; labels on objects", "Consumer app": "Phrase (diagram supplies onsets)", "Craft product": "Phrase, warm serif accent" } },
  { decision: "Motion", cells: { "Clinic (founder-led)": "Minimal: cuts, gentle push, lower third", "B2B strategy (typography)": "Beat-locked cards, counters, diagram builds", "Consultant (speaking + diagram)": "Diagram states on keywords, punch-ins", "Student/designer process": "Match cuts drawing → render, turntables", "Consumer app": "Charts building, UI demos", "Craft product": "Page turns, macro slides" } },
  { decision: "Audio", cells: { "Clinic (founder-led)": "Music very low or none under key lines", "B2B strategy (typography)": "Music drives; cards on beat", "Consultant (speaking + diagram)": "Voice + low bed, deep ducking", "Student/designer process": "Real process sound + light bed", "Consumer app": "VO + bed; one riser → hit", "Craft product": "Paper/binding foley + soft music" } },
  { decision: "CTA", cells: { "Clinic (founder-led)": "„Programări: …” (informational)", "B2B strategy (typography)": "„Hai să vorbim →” + one channel, held to read", "Consultant (speaking + diagram)": "Keyword DM (if answered) or booking link", "Student/designer process": "Follow / save / series", "Consumer app": "Link in bio", "Craft product": "Link / DM to order" } },
  { decision: "Caution", cells: { "Clinic (founder-led)": "CMR rules; IG won't recommend drug/cosmetic promotion", "B2B strategy (typography)": "\"Majority text\" demotion risk", "Consultant (speaking + diagram)": "Long abstract stretches", "Student/designer process": "Render-only slideshows look polished-only", "Consumer app": "Extreme fitness/diet limits", "Craft product": "Music licensing (business account)" } },
];

export const SOURCES: { label: string; url: string; type: string }[] = [
  { label: "Instagram — Ranking explained (2023)", url: "https://about.instagram.com/blog/announcements/instagram-ranking-explained", type: "Platform" },
  { label: "Instagram Help — Recommendations", url: "https://help.instagram.com/313829416281232", type: "Platform" },
  { label: "TikTok Support — How TikTok recommends content", url: "https://support.tiktok.com/en/using-tiktok/exploring-videos/how-tiktok-recommends-content", type: "Platform" },
  { label: "YouTube Help — Search & discovery", url: "https://support.google.com/youtube/answer/11914225", type: "Platform" },
  { label: "BBC Subtitle Guidelines", url: "https://www.bbc.co.uk/accessibility/forproducts/guides/subtitles/", type: "Standard" },
  { label: "Netflix — Romanian Timed Text Style Guide", url: "https://partnerhelp.netflixstudios.com/hc/en-us/articles/220294068-Romanian-Timed-Text-Style-Guide", type: "Standard" },
  { label: "CMR Decision 14/2026 (medical advertising)", url: "https://www.cmr.ro/wp-content/uploads/2026/05/Decizie-CN-nr.-14-din-2026-privind-modificarea-Deciziei-20-din-2025-privind-publicitatea.pdf", type: "Law" },
  { label: "Google — ABCDs of effective video ads", url: "https://business.google.com/us/think/future-of-marketing/youtube-video-ad-creative/", type: "Ad guidance" },
  { label: "TikTok — Creative Codes", url: "https://ads.tiktok.com/business/en-US/creative-codes", type: "Ad guidance" },
  { label: "Facebook — Fighting engagement bait", url: "https://about.fb.com/news/2017/12/news-feed-fyi-fighting-engagement-bait-on-facebook/", type: "Platform" },
  { label: "IBM Carbon — Motion", url: "https://carbondesignsystem.com/elements/motion/overview/", type: "Design standard" },
  { label: "DataReportal — Digital 2026 Romania", url: "https://datareportal.com/reports/digital-2026-romania", type: "Market data" },
];

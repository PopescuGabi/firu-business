# FIRU Business

A marketing workspace for businesses and their clients: Home, Today, a Calendar week view with a planner, Clients (each with only the tools it needs: Instagram analytics, content, app updates, finance) with a shared dashboard for every client, Email and Portfolio, with Claude as editor.

Invite only: `ALLOWED_EMAIL` is the owner, who invites others in **Settings → Members**. Each person signs in with their own Google account (which connects their Calendar and Drive), picks the sections they use (School, Gym, Client work, Prompts, Portfolio, Email), and only ever sees their own data. Gmail is connected separately on the Email page; Claude uses each person's own API key (Settings → Your Anthropic key), or the free copy-paste Claude app mode.

## Running locally (this Mac)
```bash
./dev.sh
```
Opens on <http://localhost:3000>. Uses `.env.local`; with `DEV_LOGIN=true` you can sign in without Google (local only, production ignores it). Keys can be pasted in **Settings → Keys (this Mac only)**. The local database lives in `.data/`.

## Going online (Vercel + Supabase)

The site stays private online: same Google-only sign-in. Do the steps in this order.

### 1. GitHub: a private repository
1. Create a free account at <https://github.com>.
2. **New repository** → name `firu-business` → **Private** → don't add a README → **Create**.
3. In this folder (the code is already committed locally):
   ```bash
   git remote add origin https://github.com/YOUR-USERNAME/firu-business.git
   git push -u origin main
   ```
   Your keys aren't uploaded: `.env.local` and the local database are excluded by `.gitignore`.

### 2. Supabase: the online database, with your data copied in
1. Create a free account and a **new project** at <https://supabase.com> (pick the Frankfurt region; save the database password).
2. **Connect** → **Transaction pooler** → copy the connection string (port **6543**) and put your database password in it.
3. Paste it in the local site under **Settings → Keys → Supabase connection string** → **Save**. (This Mac keeps using its local database.)
4. **Stop the local site** (the local database can only be open once), then copy everything you set up locally (travel times, settings, clients, reels, carousels, prompts, feedback, plan blocks):
   ```bash
   npm run copy-to-supabase
   ```
   It prints a row count per table. It refuses if the online database already has clients; add `-- --replace` to overwrite it on purpose.

### 3. Vercel: hosting
1. Create a free account at <https://vercel.com> (sign up with GitHub).
2. **Add New → Project** → import `firu-business`. Leave the build settings as they are.
3. Before deploying, open **Environment Variables**. The quick way: in the local site, **Settings → Keys → Settings file for Vercel**, enter your Vercel address and click **Create file**. It opens a file with every value below (and a new session secret): select all, copy, and paste into Vercel's first **Key** field; Vercel fills in all rows. Delete `.env.vercel` afterwards. The values are:

   | Name | Value |
   |---|---|
   | `APP_URL` | your Vercel address, e.g. `https://firu-business-xxxx.vercel.app` (no slash at the end) |
   | `ALLOWED_EMAIL` | the Gmail address that may sign in |
   | `SESSION_SECRET` | a **new** secret: run `openssl rand -base64 32` |
   | `GOOGLE_CLIENT_ID` | same as in `.env.local` |
   | `GOOGLE_CLIENT_SECRET` | same as in `.env.local` |
   | `DATABASE_URL` | the Supabase connection string from step 2 |
   | `AI_MAX_REQUESTS_PER_HOUR` | `60` |
   | `ANTHROPIC_API_KEY` | optional: only if you bought API credit |

   **Never** add `DEV_LOGIN` online.
4. **Deploy**. If Vercel gave you a different address than you guessed, update `APP_URL` and redeploy.

### 4. Google Cloud: allow the online address and publish
Your project at <https://console.cloud.google.com>:
1. **Google Auth Platform → Clients → FIRU Business web** → under **Authorized redirect URIs** add
   `https://YOUR-DOMAIN/api/auth/callback` → **Save** (keep the localhost one).
2. **Branding**:
   - Application home page: `https://YOUR-DOMAIN/login`
   - Privacy policy: `https://YOUR-DOMAIN/privacy`
   - Terms of service: `https://YOUR-DOMAIN/terms`
   - Authorized domains: `YOUR-DOMAIN` (e.g. `firu-business-xxxx.vercel.app`)
   - **Don't upload a logo**: a logo makes Google require a full app review.
   - **Save**.
3. **Audience → Publish app** → confirm. This stops Google signing you out every 7 days. You'll still see an "unverified app" screen when signing in: **Advanced → Go to FIRU Business**.

### 5. Sign in online
Open your Vercel address, **Continue with Google**, allow Calendar and Drive. Google sign-in isn't copied from this Mac, so connecting once online is expected. Then check Settings → Connections shows your account.

## Reels Brain

Researched short-form video rules (hooks, story, speaking reels, motion, captions, audio, platforms, measuring), built into Clients:

- **Clients → Reels Brain:** the rules with evidence and confidence, the review checklist, hook formulas, caption styles, niche defaults and sources.
- **Client → Profile:** audience, awareness, offer, voice, brand, constraints and observed results. Opus reads it for every reel and carousel of that client.
- **Reel → Reels Brain panel:**
  - **Plan:** objective, promise and payoff, proof, CTA, a caption plan for this video, and one experiment.
  - **Review:** the checklist plus **Brain review**. Opus returns findings, three aligned hook options and a caption plan, or, without an API key, copies a ready prompt for the Claude app.
- The Opus editor and Marketing AI (ideas, weekly report) follow the same rules.

The rules live in `src/lib/reels-brain/content.ts`. The full research (sources, experiments, open questions) is the `social-video-brain` skill on this Mac (`~/.claude/skills/social-video-brain/`).

## Claude (Opus 5.5), optional
Without an API key, the editor panel runs in **Claude app** mode: it copies a ready prompt (your saved prompts + the reel/carousel + your request), you paste it into the Claude app (covered by your Claude subscription), then paste the reply back and apply it. Adding a key switches on **In this site** mode, where Opus edits directly.

1. Create an API key at <https://console.anthropic.com> → `ANTHROPIC_API_KEY`.
2. Set a monthly **spend limit** (Billing → Limits). The site also caps itself at `AI_MAX_REQUESTS_PER_HOUR` and shows estimated spend in Settings.

## Google permissions the site uses
Your email/profile, reading your calendars, creating/deleting the events it adds (plan blocks, task due dates), and Drive files **it creates** (`drive.file`, the "FIRU Business" folder). It can't see the rest of your Drive.

## Security
- Every page and API route needs your session (signed, httpOnly cookie, 30 days); the email is re-checked on every request. Only `/login`, `/privacy` and `/terms` are public.
- Cross-site POSTs are blocked, API calls are rate-limited per IP, and Claude calls are capped per hour (counted in the database).
- Google refresh tokens are encrypted at rest (AES-256-GCM). API keys only exist on the server.
- Strict Content-Security-Policy, HSTS, no framing, `noindex`.
- Opus requests use Anthropic's server-side refusal fallback (`fallbacks: "default"`).

## Tests
```bash
npm test        # planner, travel time, calendar sync, Instagram stats, multi-user and parser tests
npm run lint    # TypeScript
```

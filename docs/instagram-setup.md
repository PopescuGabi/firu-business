# Instagram analytics: setting up the Meta app

Personal Hub reads Instagram statistics through Meta's official **Instagram API with Instagram Login**. It works for
**Business and Creator** accounts (not personal ones) and needs no Facebook Page. You create one free Meta app for the
whole hub; every person then connects their own account from **Instagram** in the sidebar.

## 1. Create the app (about 10 minutes)

1. Go to <https://developers.facebook.com/apps> and sign in with your Facebook account. If asked, register as a developer (free).
2. **Create app** → use case **"Manage messaging & content on Instagram"** (or "Other" → type **Business**) → name it
   `Personal Hub` → create.
3. In the app's dashboard, open **Instagram** → **API setup with Instagram login**.
4. Under **Set up Instagram business login** → **Business login settings**, add the redirect URL exactly as Settings shows it:
   `https://mypersonal-hub.vercel.app/api/instagram/callback`
5. Copy the **Instagram app ID** and **Instagram app secret** from the same page (they are different from the Facebook app ID).

## 2. Add the keys to Vercel

In Vercel → the `personal-hub` project → **Settings → Environment Variables**, add:

| Name | Value |
|---|---|
| `INSTAGRAM_APP_ID` | the Instagram app ID |
| `INSTAGRAM_APP_SECRET` | the Instagram app secret |
| `CRON_SECRET` | any long random text (at least 16 characters); Vercel Cron sends it to the daily update |

Then **Redeploy**. Settings → Instagram in Personal Hub should now say "Set up".

## 3. Let the first accounts in (testers)

While the app isn't reviewed by Meta, only people with a role on it can connect:

1. App dashboard → **App roles → Roles** → **Add people** → **Instagram tester** → type the Instagram username (e.g. the pilot account).
2. The account owner accepts it in the Instagram app: **Settings → Apps and websites → Tester invites → Accept**
   (or on the web: instagram.com → Settings → Apps and websites).
3. That person opens Personal Hub → **Instagram → Connect Instagram** and allows access.

The account must be **Professional** (Instagram app → Settings → Account type and tools → Switch to professional account).

## 4. Privacy settings Meta asks for

App dashboard → **App settings → Basic**:

- **Privacy policy URL**: `https://mypersonal-hub.vercel.app/privacy`
- **User data deletion** → **Data deletion callback URL**: `https://mypersonal-hub.vercel.app/api/instagram/deletion`
- An app icon (1024 × 1024) and a category.

## 5. Later: let any client connect (App Review)

To let accounts that aren't testers connect, Meta needs **Business Verification** and **App Review** for
`instagram_business_basic` and `instagram_business_manage_insights` (Advanced Access): a short screencast of connecting
an account and showing its dashboard, test steps and the privacy policy. Switch the app to **Live** after approval.

## What the hub stores and why

- Posts (type, caption, link, thumbnail, date) and their insights; daily account totals; a daily follower count
  (Instagram keeps no follower history, so the line starts the day an account connects).
- Tokens are encrypted. **Disconnect** deletes the account and everything stored for it; Meta's deletion callback does the same.
- Numbers Instagram doesn't provide are shown as "Not available", never estimated. Insights can lag up to 48 hours.

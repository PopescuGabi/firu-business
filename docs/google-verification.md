# Google OAuth verification

Google shows an "unverified app" screen until the app passes verification for its sensitive scope
(Google Calendar). Until verified, at most 100 people can sign in; verification removes the warning and that cap.

## Checklist

- [ ] **Homepage** (public, explains the app, links the privacy policy): the site root for logged-out visitors (`/welcome`).
- [ ] **Privacy policy** on the same domain, with the Limited Use statement: `/privacy`.
- [ ] **Search Console**: verify ownership of the site address (see below).
- [ ] **Branding** in Google Cloud → Google Auth Platform: home page = site root, privacy = `/privacy`, terms = `/terms`, authorized domain = the site's domain, no logo.
- [ ] **Data access**: the scopes listed below are added, with the justifications below.
- [ ] **Demo video** (unlisted YouTube link), following the shot list below.
- [ ] **Submit**: Google Auth Platform → Verification Center → Submit for verification.

## Search Console (domain ownership)

1. Open <https://search.google.com/search-console> with the same Google account that owns the Cloud project.
2. **Add property** → **URL prefix** → enter the site address (e.g. `https://your-app.vercel.app/`).
3. Choose **HTML tag**, copy only the `content` value (e.g. `abc123…`).
4. In Vercel → Settings → Environment Variables add `GOOGLE_SITE_VERIFICATION` = that value, then redeploy.
5. Back in Search Console, click **Verify**.

## Scopes and justifications

| Scope | Sensitivity | Justification |
|---|---|---|
| `openid`, `email`, `profile` | non-sensitive | Signs the person in and checks their Google account was invited (the app is invite only); shows their name. |
| `https://www.googleapis.com/auth/calendar.readonly` | sensitive | The Calendar and Today screens show the user's events from all their calendars, and the week planner reads event times so it can suggest study, gym and project blocks only in free time, including the travel time between places. It needs every calendar the user selects in Settings; `calendar.events.readonly` alone can't list the calendars and their colours, and the user chooses which calendars count. |
| `https://www.googleapis.com/auth/calendar.events` | sensitive | The Calendar page lets the user add, edit and delete events in their own calendars (for example a game from 22:00 to 00:00), including right-click → Delete. With calendar sync on (Settings → Calendar sync), the app also keeps the user's school classes, gym, tutoring, accepted plan blocks and task due dates in a "Personal Hub" calendar the user created, so they're on their phone, and applies edits made there back in the app. The app only changes an event when the user saves, accepts or deletes it in the app, or when it is one of the events the app manages in the "Personal Hub" calendar. Read-only access would make this impossible. |
| `https://www.googleapis.com/auth/drive.file` | non-sensitive | Saves files the user uploads (footage, screenshots) and exported carousel images into a "Personal Hub" folder the app creates. The narrowest Drive scope; it can't see other files. |

**What breaks with narrower scopes:** without `calendar.readonly` the planner can't see existing commitments (tutoring, events) and would schedule on top of them; without `calendar.events` the user's schedule can't appear in their calendar on their phone.

## Demo video

A finished, edited demo (about 1½ minutes, English captions, real footage of each permission in use) is rendered from the `demo-video` project next to this repo. Upload it to YouTube as **Unlisted** and paste the link in **Data Access → Demo video**.

## Demo video shot list (2–3 minutes, English)

Record the screen with sound off or a short English narration. Keep the app's name "Personal Hub" visible.

1. **Homepage:** open the site address logged out; scroll the homepage; click **Privacy policy** and show the Limited Use paragraph; go back.
2. **Consent screen:** click **Sign in with Google**, pick the account. At the bottom-left of Google's screens set the language to **English (United States)**. Show the full consent screen, scrolling so every requested permission is visible, then allow.
3. **calendar.readonly:** open **Calendar**: show existing Google Calendar events appearing in the week view. Open **Settings → Calendars** to show the calendar list.
4. **Planner:** on **Today** or **Home → Schedule**, tap **Plan my week**; show suggestions placed around existing events with travel time.
5. **calendar.events:** in **Settings → Calendar sync** tap **Sync now**; switch to Google Calendar and show the classes, gym and tutoring in the "Personal Hub" calendar. Accept a suggestion and show it appear there; move an event in Google Calendar, reload Personal Hub and show the new time.
6. **drive.file:** open a reel → **Upload to Drive**, pick a file; open the Drive folder link and show the file inside "Personal Hub".
7. End on **Settings → Your Google data** (privacy link, revoke access).

Upload to YouTube as **Unlisted** and paste the link in the verification form.

## Gmail (separate, later)

Gmail (`gmail.readonly`, `gmail.send`) is asked for only when someone connects it on the Email page, so the main
verification above doesn't depend on it. Gmail scopes are **restricted**: beyond 100 users they need Google's review plus a
yearly third-party security assessment (CASA). To turn Gmail on: Google Cloud → APIs & Services → enable **Gmail API**,
and add both scopes under Google Auth Platform → Data Access.

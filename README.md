# ☀️ Sunbeam Planner

A warm day, week and month planner that runs entirely in your browser and links to your **Microsoft Outlook** calendar and email.

- **Day / Week / Month** views, with search, sub-steps, priorities and repeating plans
- **Quote of the day** at the top, built in (no outside service), changing at midnight Cairo time. It follows special days (New Year, Ramadan, the Eids, Sham el-Nessim, Mother's Day…) and your work week: fresh starts on Sunday, finishing well on Thursday, rest at the weekend. Edit `assets/js/quotes.js` to add your own.
- **Work week Sunday–Thursday, 9 AM–5 PM Cairo time.** Weeks start on Sunday, Friday and Saturday are shown as the weekend, and work plans outside your hours get a 🌙 marker. All of this is set in `config.js` (`timeZone`, `weekStartsOn`, `workDays`, `workHours`).
- **Outlook calendar sync**: new plans become calendar events. Checking a plan off adds a ✓ to the event, and deleting the plan removes the event.
- **Import Outlook meetings** for the next 30 days so you see them next to your plans
- **Email your plan** (day or week) from your own mailbox, through Microsoft Graph
- **Reminders** that chime 15 minutes before a flagged plan, with optional desktop notifications
- Focus timer, evening theme, gentle sounds, JSON backup/restore, CSV and `.ics` export

There's no server and no build step. Your plans are kept in your browser's `localStorage`. Sunbeam talks to Microsoft directly from your browser, using your own sign-in.

---

## 1. Put it on GitHub Pages

1. Create a new repository on GitHub, for example `sunbeam-planner`.
2. Push these files to it:
   ```bash
   git init
   git add .
   git commit -m "Sunbeam planner"
   git branch -M main
   git remote add origin https://github.com/<your-username>/sunbeam-planner.git
   git push -u origin main
   ```
3. On GitHub, open **Settings → Pages**. Under *Build and deployment*, choose **Deploy from a branch**, then pick `main` and `/ (root)`, and press **Save**.
4. After about a minute your planner is live at `https://<your-username>.github.io/sunbeam-planner/`.

## 2. Connect Outlook (one-time, about 5 minutes)

Microsoft requires every app that reads a calendar to be registered. Registration is free.

1. Go to the [Microsoft Entra admin center → App registrations](https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade) and choose **New registration**.
   - **Name:** `Sunbeam Planner`
   - **Supported account types:** pick *Accounts in this organizational directory only* if you only use your work account. Pick *Any Entra ID tenant + personal Microsoft accounts* if you also want to use a personal Outlook.com account.
   - **Redirect URI:** platform **Single-page application (SPA)**, value:
     ```
     https://<your-username>.github.io/sunbeam-planner/auth-redirect.html
     ```
     The app's Outlook tab → *One-time setup* shows the exact URL to paste.
2. Open **API permissions → Add a permission → Microsoft Graph → Delegated permissions** and add:
   - `Calendars.ReadWrite`
   - `Mail.Send`
   - (`User.Read` is already there)
3. From the **Overview** page, copy the **Application (client) ID**.
4. Paste it into `config.js` (`clientId: '...'`) and push again. If you chose *this organizational directory only* in step 1, also change `authority` to your tenant, e.g. `https://login.microsoftonline.com/cef-eg.org`. Otherwise sign-in fails with error AADSTS50194. You can also paste it in the app under Outlook → One-time setup, but that only saves it in the browser you're using.
5. Open your site, go to the **Outlook** tab, and press **Connect Microsoft account**.

> **Work or school accounts:** many organisations block users from approving apps themselves. If you see *"Need admin approval"*, ask your IT admin to grant consent for the app in Entra (**API permissions → Grant admin consent**). If your account can't register apps at all, a personal Microsoft account can register the app instead.

The client ID is a public identifier, not a password, so committing it to a public repository is fine. Sunbeam never sees or stores your password.

### Testing locally

Microsoft sign-in doesn't work from a `file://` page. Serve the folder instead:

```bash
python -m http.server 5500
```

Then add `http://localhost:5500/auth-redirect.html` as a second SPA redirect URI in your app registration and open `http://localhost:5500`.

## How sync behaves

| You do this in Sunbeam | What happens in Outlook |
| --- | --- |
| Add a plan with "Add to my Outlook calendar" ticked | An event is created (category **Sunbeam**, reminder 15 min before if flagged) |
| Check a plan off / un-check it | The event title gets / loses a ✓ |
| Snooze a reminder | The event moves |
| Delete a plan | The event is deleted |
| Delete an imported Outlook meeting | Nothing. It's only hidden in Sunbeam; your real meeting is never touched. |

Plans created while you were signed out can be sent later with **Push unsynced plans**.

## Files

```
index.html          page layout
auth-redirect.html  blank page Microsoft returns to after sign-in
config.js           your Microsoft client ID
assets/css/         styles (incl. evening theme)
assets/js/sound.js  Web Audio chimes
assets/js/outlook.js  Microsoft sign-in + Graph calls
assets/js/app.js    planner logic
```

## Publishing an update

GitHub Pages lets browsers keep files for up to 10 minutes. When you change any file in `assets/` or `config.js`, also change the `?v=…` number on its `<link>`/`<script>` tag at the top and bottom of `index.html` (for example to today's date). That way browsers fetch the new file instead of mixing it with an old cached one.

## Moving your data

Data lives in each browser separately. A page opened from disk and the same page on GitHub Pages count as different sites, so they keep separate data. Use **Data → Download backup** on the old one and **Data → Restore backup** on the new one.

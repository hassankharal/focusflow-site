# FocusFlow Launch Site

Static-first marketing website for FocusFlow with a real waitlist backend:
- static HTML/CSS/JS frontend
- Vercel serverless API endpoints
- Supabase database for waitlist + founding-offer qualification

## Project Structure

- `index.html` - Primary launch/marketing page
- `styles.css` - Shared premium dark theme and responsive layout
- `script.js` - Countdown + waitlist form + dynamic founding-offer counter
- `terms.html` - Terms page
- `privacy.html` - Privacy page
- `favicon.svg` - Site icon
- `api/waitlist.js` - Waitlist submission endpoint (server-side qualification)
- `api/waitlist-status.js` - Current spots/offer-status endpoint
- `api/_lib/supabase.js` - Shared API utilities
- `supabase/schema.sql` - Database schema + SQL functions
- `vercel.json` - `www` redirect + clean legal rewrites (`/terms`, `/privacy`)

## Local Preview (Static Only)

```bash
cd /Users/hassankharal/Downloads/focusflow-site
python3 -m http.server 8080
```

Open:
- `http://localhost:8080/`
- `http://localhost:8080/terms.html`
- `http://localhost:8080/privacy.html`

This verifies layout/copy/navigation only.

## Local Testing With API Endpoints

For full end-to-end waitlist testing, run with Vercel local dev so `/api/*` routes are active:

```bash
cd /Users/hassankharal/Downloads/focusflow-site
npx vercel dev
```

Then open:
- `http://localhost:3000/`
- `http://localhost:3000/api/waitlist-status`

## Countdown Logic

- Launch target is **July 1, 2026 at 00:00 America/Winnipeg**.
- In code this is set to `2026-07-01T05:00:00Z` (Winnipeg midnight in CDT).
- `script.js` updates days/hours/minutes/seconds every second.
- On/after launch, countdown hides and a release-state message is shown.
- QA override: append `?launchTs=<unix-ms>` to test near-future or post-launch states locally.

## Founding Offer Logic (First 25)

- Offer: first **25 unique** signups get **1 year free**.
- Unique identity uses `normalized_email` (`trim + lowercase`) stored server-side.
- Qualification is decided server-side in SQL (`signup_waitlist` function), not in browser code.
- Duplicate signups are detected and return a duplicate response.
- `spots_remaining` is clamped and never goes below zero.

## Supabase Setup

1. Create a Supabase project.
2. Open **SQL Editor**.
3. Run `supabase/schema.sql`.
4. Confirm table and functions exist:
   - `waitlist_signups`
   - `signup_waitlist(...)`
   - `waitlist_offer_status(...)`

## Database Schema Notes

`waitlist_signups` includes:
- `email`
- `normalized_email` (unique)
- `full_name` (optional)
- `source` (optional)
- `metadata` (jsonb)
- `signup_rank` (deterministic order)
- `qualifies_free_year` (boolean)
- `created_at`

The SQL function uses advisory locking to keep rank/qualification deterministic during concurrency.

## Required Environment Variables

Set in Vercel Project Settings -> Environment Variables:

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (server only)
- `WAITLIST_FREE_YEAR_LIMIT` - Optional, defaults to `25`

Do not expose `SUPABASE_SERVICE_ROLE_KEY` in client-side code.

## Deploy to Vercel

1. Push repository to GitHub.
2. In Vercel: **Add New Project** -> import this repo.
3. Framework preset: keep default (`Other`/static).
4. Build/install/output settings: leave empty.
5. Add required environment variables.
6. Deploy.

After deploy, test:
- `/`
- `/terms` and `/privacy`
- `/api/waitlist-status`

## Connect Custom Domain (`focusflow.app`)

1. Vercel project -> **Settings** -> **Domains**.
2. Add `focusflow.app`.
3. Add `www.focusflow.app`.
4. Set `focusflow.app` as primary.
5. Apply DNS records from Vercel at your registrar.
6. Confirm `www` redirects to apex (handled by `vercel.json`).

## Hosting Note

Website hosting should run on **Vercel** (or similar static+serverless host).

## Email Note (iCloud)

Custom-domain email (for example iCloud custom email) is separate from website hosting.
You can keep website on Vercel and email on iCloud domain email without conflict.

## Test Duplicate Email Behavior

1. Submit a new email via waitlist form.
2. Submit same email again.
3. Expected: API returns `duplicate: true` and UI shows "already on the waitlist" state.

## Test Fully-Claimed Promo State

Option A (real):
1. Insert or submit until 25 unique qualifying signups exist.
2. Submit the 26th unique email.
3. Expected: signup succeeds, `qualified_for_free_year: false`, and spots show `0`.

Option B (temporary lower limit for staging):
1. Set `WAITLIST_FREE_YEAR_LIMIT=2` in staging env.
2. Submit 3 unique emails.
3. Verify 3rd does not qualify and UI shows fully-claimed state.

## Quick QA Checklist

- Countdown renders and updates every second.
- Countdown switches to release-state on/after launch time.
- Waitlist status fetch updates spots on page load.
- Waitlist submit handles success/duplicate/error cleanly.
- Offer spots never show negative values.
- Legal pages are readable and linked.
- Header/footer links work on mobile and desktop.

# FocusFlow Launch Site

Static-first launch website for FocusFlow with a real waitlist backend:
- static HTML/CSS/JS frontend
- Vercel serverless API endpoints
- Supabase database for waitlist + founding-offer qualification
- Plausible analytics for conversion events

## Project Structure

- `index.html` - Primary launch page
- `styles.css` - Shared premium dark UI system and responsive layout
- `script.js` - Countdown, waitlist UX, launch-state switching, analytics events
- `terms.html` - Terms page
- `privacy.html` - Privacy page
- `favicon.svg` - Browser icon
- `og-image.svg` - Open Graph image
- `robots.txt` - Search crawler directives
- `sitemap.xml` - Crawl sitemap
- `api/waitlist.js` - Waitlist submission endpoint
- `api/waitlist-status.js` - Spots remaining / offer status endpoint
- `api/_lib/supabase.js` - Shared API utilities
- `supabase/schema.sql` - Supabase schema + SQL functions
- `vercel.json` - `www` redirect + clean rewrites for `/terms` and `/privacy`

## Local Preview (Static UI)

```bash
cd /Users/hassankharal/Downloads/focusflow-site
python3 -m http.server 8080
```

Open:
- `http://localhost:8080/`
- `http://localhost:8080/terms.html`
- `http://localhost:8080/privacy.html`

## Local Testing With API Endpoints

Use Vercel local runtime for `/api/*`:

```bash
cd /Users/hassankharal/Downloads/focusflow-site
npx vercel dev
```

Then open:
- `http://localhost:3000/`
- `http://localhost:3000/api/waitlist-status`

## Countdown Logic

- Launch target is **July 1, 2026 at 00:00 America/Winnipeg**.
- In code, target timestamp is `2026-07-01T05:00:00Z`.
- `script.js` updates days/hours/minutes/seconds every second.
- On/after launch, countdown hides and release-state UI appears.
- QA override: append `?launchTs=<unix-ms>` to force pre/post launch states.

## Founding Offer Logic (First 25)

- Offer: first **25 unique** signups receive **1 year free**.
- Unique identity is `normalized_email` (`trim + lowercase`) server-side.
- Qualification is computed server-side in SQL (`signup_waitlist`), not in browser code.
- Duplicate emails are gracefully handled.
- Spots remaining is clamped and never negative.

## Supabase Setup

1. Create a Supabase project.
2. Open **SQL Editor**.
3. Run `supabase/schema.sql`.
4. Confirm these objects exist:
   - table: `waitlist_signups`
   - function: `signup_waitlist(...)`
   - function: `waitlist_offer_status(...)`

## Database Schema Notes

`waitlist_signups` includes:
- `email`
- `normalized_email` (unique)
- `full_name` (optional)
- `source` (optional)
- `metadata` (jsonb)
- `signup_rank` (deterministic sequence)
- `qualifies_free_year` (boolean)
- `created_at`

`signup_waitlist(...)` uses advisory locking to keep rank + qualification fair under concurrency.

## Required Environment Variables

Set in Vercel Project Settings -> Environment Variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `WAITLIST_FREE_YEAR_LIMIT` (optional, defaults to `25`)

Never expose `SUPABASE_SERVICE_ROLE_KEY` in client-side code.

## Analytics (Plausible)

Frontend loads Plausible for domain `focusflow.app`.
Events fired:
- `Hero CTA Click`
- `Final CTA Click`
- `Waitlist Submit Attempt`
- `Waitlist Submit Success`
- `Waitlist Duplicate`
- `Founding Offer Claimed`
- `Founding Offer Missed`
- `Waitlist Submit Error`

UTM params are captured and sent in waitlist metadata:
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`
- `utm_term`

## Deploy to Vercel

1. Push to GitHub.
2. In Vercel: **Add New Project** -> import repo.
3. Framework preset: leave as static/other.
4. Build/install/output settings: keep empty.
5. Add required env vars.
6. Deploy.

Post-deploy checks:
- `/`
- `/terms`
- `/privacy`
- `/api/waitlist-status`

## Custom Domain: `focusflow.app`

1. Vercel project -> **Settings** -> **Domains**.
2. Add `focusflow.app`.
3. Add `www.focusflow.app`.
4. Set `focusflow.app` as primary.
5. Configure DNS records shown by Vercel.
6. Confirm `www` redirects to apex (configured in `vercel.json`).

## Hosting Note

Website hosting should be done via **Vercel** (or similar static + serverless host).

## iCloud Email Note

iCloud custom domain email can remain separate from website hosting.
Website can stay on Vercel while email runs on iCloud.

## Test Duplicate Email Behavior

1. Submit a new email in waitlist form.
2. Submit the same email again.
3. Expect duplicate response and "already on the waitlist" message.

## Test Fully-Claimed Promo State

Option A (real data):
1. Reach 25 qualifying unique signups.
2. Submit 26th unique email.
3. Expect signup success with `qualified_for_free_year=false` and `spots_remaining=0`.

Option B (staging shortcut):
1. Set `WAITLIST_FREE_YEAR_LIMIT=2`.
2. Submit 3 unique emails.
3. Confirm 3rd signup misses founding offer and UI shows claimed state.

## Fairness Validation SQL (Production)

```sql
select
  count(*) filter (where qualifies_free_year) as claimed,
  greatest(0, 25 - count(*) filter (where qualifies_free_year)) as remaining
from public.waitlist_signups;

select signup_rank, normalized_email, qualifies_free_year, created_at
from public.waitlist_signups
order by signup_rank asc;
```

## Final Release Checklist (Order)

1. Run SQL schema/functions in Supabase.
2. Set Vercel environment variables.
3. Deploy to Vercel production.
4. Connect/verify domains (`focusflow.app`, `www`).
5. Verify Plausible events and waitlist conversion flow.

## Quick QA Checklist

- Countdown renders and updates every second.
- Release state appears correctly after launch timestamp.
- Waitlist form works with email-only flow.
- Success/duplicate/error states are readable and explicit.
- Spots remaining never goes below zero.
- Legal pages are readable and linked.
- Header/footer/nav are keyboard accessible.
- Mobile layout is usable at 360px width.

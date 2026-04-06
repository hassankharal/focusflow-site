# FocusFlow Marketing Site

A lightweight static marketing website for FocusFlow, built with plain HTML and CSS for fast deployment on Vercel.

## Project Structure

- `index.html` - Landing page (value proposition, benefits, FAQ, and waitlist CTAs)
- `terms.html` - Terms of Use page
- `privacy.html` - Privacy Policy page
- `styles.css` - Shared styling for all pages
- `vercel.json` - Optional Vercel redirect config (`www.focusflow.app` -> `focusflow.app`)
- `README.txt` - Original starter note (kept for reference)

## Run Locally

### Option 1: Open directly

Open `index.html` in your browser.

### Option 2: Use a local static server (recommended)

```bash
cd /Users/hassankharal/Downloads/focusflow-site
python3 -m http.server 8080
```

Then visit:

- `http://localhost:8080/`
- `http://localhost:8080/terms.html`
- `http://localhost:8080/privacy.html`

## Deploy to Vercel

## Option A: Vercel Dashboard (simplest)

1. Push this folder to a GitHub repository.
2. In Vercel, click **Add New Project** and import the repo.
3. Framework preset: **Other** (or leave auto-detected for static files).
4. Build command: leave empty.
5. Output directory: leave empty.
6. Deploy.

## Option B: Vercel CLI

```bash
cd /Users/hassankharal/Downloads/focusflow-site
npx vercel
npx vercel --prod
```

## Connect `focusflow.app`

1. Open your project in Vercel -> **Settings** -> **Domains**.
2. Add `focusflow.app`.
3. Add `www.focusflow.app`.
4. Update DNS records at your domain provider to the values Vercel shows.
5. Keep `focusflow.app` as the primary domain.
6. `vercel.json` includes a redirect from `www.focusflow.app` to `https://focusflow.app`.

## Production Notes

- `terms.html` and `privacy.html` are starter legal templates and should be reviewed by legal counsel before production use.
- Replace `hello@focusflow.app` with your final support/contact address if needed.

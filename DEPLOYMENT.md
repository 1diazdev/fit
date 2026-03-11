# Deployment Guide

This app supports multiple deployment platforms. Choose based on your needs:

## 🚀 Deployment Options

### ✅ Vercel (Recommended - Currently Active)

**Pros:**
- ✅ Fast deployments
- ✅ Automatic previews for PRs
- ✅ Custom domain support
- ✅ Serverless functions (for future API routes)
- ✅ Cron jobs for data updates

**Current Status:** ✅ Working

**Setup:**
1. Connect your GitHub repo to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically on push to main

**Cron Jobs** (configured in `vercel.json`):
- Strava data: Daily at 6:00 AM UTC
- Hevy data: Daily at 6:15 AM UTC
- Google Fit data: Daily at 6:30 AM UTC

**Environment Variables:**
```bash
STRAVA_CLIENT_ID
STRAVA_CLIENT_SECRET
STRAVA_REFRESH_TOKEN
GOOGLE_FIT_CLIENT_ID
GOOGLE_FIT_CLIENT_SECRET
GOOGLE_FIT_REFRESH_TOKEN
HEVY_API_KEY
```

### ✅ GitHub Pages

**Pros:**
- ✅ Free for public repos
- ✅ Simple setup
- ✅ Good for static sites

**Cons:**
- ⚠️ Uses `/fit/` base path (repo name)
- ⚠️ No serverless functions
- ⚠️ Must rely on GitHub Actions for data updates

**Current Status:** ✅ Configured (base path support added)

**Setup:**
1. Enable GitHub Pages in repo settings
2. Choose "GitHub Actions" as source
3. Workflow `.github/workflows/deploy-github-pages.yml` handles deployment

**URL:** `https://JuanPabloDiaz.github.io/fit/`

**Note:** The app automatically handles the `/fit/` base path when `ASTRO_BASE_PATH=/fit/` is set.

### ⏸️ Netlify (Disabled)

**Status:** ⏸️ Disabled (config renamed to `netlify.toml.disabled`)

**Why disabled:**
- Currently using Vercel and GitHub Pages
- Netlify Functions need updates to work properly
- Can be re-enabled later if needed

**To re-enable:**
1. Rename `netlify.toml.disabled` to `netlify.toml`
2. Update Netlify Functions in `netlify/functions/`
3. Configure environment variables in Netlify dashboard

## 🔧 How Base Path Works

The app uses `import.meta.env.BASE_URL` for dynamic routing.

## 📦 Build Configuration

### For Vercel (no base path)
```bash
bun run build
```

### For GitHub Pages (with base path)
```bash
ASTRO_BASE_PATH=/fit/ bun run build
```

See full documentation for more details.

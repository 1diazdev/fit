# Quick Deployment Guide

## 🎯 Current Setup

**Active Deployments:**

- ✅ **Vercel** - https://fit.jpdiaz.dev (primary)
- ✅ **GitHub Pages** - https://JuanPabloDiaz.github.io/fit/ (backup)

**Disabled:**

- ⏸️ **Netlify** - Config saved as `netlify.toml.disabled`

## 🚀 Quick Start - Vercel

1. Connect GitHub repo to Vercel
2. Add environment variables
3. Push to main → auto-deploy

## 🚀 Quick Start - GitHub Pages

1. Enable in Settings → Pages → Source: "GitHub Actions"
2. Add secrets in Settings → Secrets → Actions
3. Push to main → auto-deploy

## 🔄 Data Updates

GitHub Actions runs daily at 6am UTC:

- Fetches from Strava, Google Fit, Hevy
- Saves to `public/*.json`
- Auto-commits changes

## 📝 Local Development

```bash
bun dev              # Start dev server
bun run update-all   # Update data
bun run build        # Build for production
```

## 📚 Full Documentation

See `DEPLOYMENT.md` for complete guide.

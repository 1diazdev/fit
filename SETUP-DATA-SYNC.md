# Data Sync Setup Guide

This guide explains how to set up automated daily data syncing from Strava, Google Fit, and Hevy.

## 🎯 Quick Start

### 1. Add GitHub Secrets

Go to your repository → Settings → Secrets and variables → Actions

Add these secrets:

```bash
# Strava (see DOCS-STRAVA.md for OAuth setup)
STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_client_secret
STRAVA_REFRESH_TOKEN=your_refresh_token

# Google Fit (run bun run googlefit-setup first)
GOOGLE_FIT_CLIENT_ID=your_client_id
GOOGLE_FIT_CLIENT_SECRET=your_client_secret
GOOGLE_FIT_REFRESH_TOKEN=your_refresh_token

# Hevy (get from Hevy app settings)
HEVY_API_KEY=hvy_your_api_key

# Optional - to trigger Netlify rebuild after data update
NETLIFY_BUILD_HOOK=https://api.netlify.com/build_hooks/your_hook_id
```

### 2. Enable GitHub Actions

The workflow `.github/workflows/update-all-data.yml` will:
- Run daily at 6am UTC (1am EST / 2am EDT)
- Fetch data from all APIs
- Save to `public/*.json`
- Commit changes
- Optionally trigger Netlify rebuild

### 3. Manual Data Update

```bash
# Update all sources at once
bun run update-all

# Or update individually
bun run strava-script
bun run googlefit-script
bun run hevy-script
```

## 🐛 Troubleshooting Google Fit Data

### Data Doesn't Match Google Fit Mobile App

**Problem**: Your web app shows different step counts than the Google Fit mobile app.

**Solution**: Use the comparison script to debug:

```bash
bun run compare-googlefit
```

This will:
1. List ALL available data sources in your Google Fit account
2. Show data from each source for the last 7 days
3. Compare with the aggregate endpoint (what the app uses)
4. Help you identify which source matches your mobile app

### Common Scenarios

#### Scenario 1: Using a fitness tracker (Zepp, Fitbit, etc.)

Your Google Fit app may prioritize data from your specific device. Look for data sources like:

```
raw:com.google.step_count.delta:com.zepp.health:
raw:com.google.step_count.delta:com.mi.health:
```

**Fix**: Update `src/services/googleFitService.ts` to use that specific data source.

#### Scenario 2: Phone + Wearable sync issues

Google Fit may be showing "merged" data that combines multiple sources.

**Fix**: Use the `merge_step_deltas` data source:
```
derived:com.google.step_count.delta:com.google.android.gms:merge_step_deltas
```

#### Scenario 3: Timezone differences

The script uses `America/New_York` timezone. If you're in a different timezone, dates may be off by a day.

**Fix**: Update timezone in `googleFitService.ts`:

```typescript
const nyDate = new Date(
  date.toLocaleString("en-US", { timeZone: "YOUR_TIMEZONE" })
);
```

### Verify Data Sources

```bash
# Run debug script to see raw API responses
bun run debug-googlefit

# Compare all data sources
bun run compare-googlefit
```

## 📊 Data Files

After running the scripts, you'll have:

```
public/
  ├── last-activities.json  # Strava activities (365 days)
  ├── health-data.json      # Google Fit data (90-365 days)
  └── hevy-data.json        # Hevy workouts (all)
```

These files are:
- ✅ Committed to git
- ✅ Updated daily by GitHub Actions
- ✅ Read during build (no API calls = fast builds!)
- ✅ Used as cache for the website

## 🚀 How It Works

### Daily Update Cycle

```
6:00 AM UTC - GitHub Action triggers
  ↓
Fetch from APIs (Strava, Google Fit, Hevy)
  ↓
Save to public/*.json
  ↓
Commit & push to git
  ↓
(Optional) Trigger Netlify rebuild
  ↓
Website uses updated data
```

### Build Process

```
Astro Build starts
  ↓
Services read public/*.json (NOT APIs)
  ↓
Data is cached with memoize()
  ↓
Pages render with cached data
  ↓
Fast build! ⚡
```

## 🔧 Advanced Configuration

### Change Update Frequency

Edit `.github/workflows/update-all-data.yml`:

```yaml
on:
  schedule:
    - cron: "0 6 * * *"  # Daily at 6am UTC
    # Change to:
    # - cron: "0 */6 * * *"  # Every 6 hours
    # - cron: "0 6,18 * * *"  # 6am and 6pm UTC
```

### Adjust Data Range

Edit individual scripts:

```typescript
// In googlefit-script.ts
const stepsData = await fetchStepsData(365);  // Change days
const sleepData = await fetchSleepData(90);   // Max 90 days
```

### Test Mode with Dummy Data

Set in `.env`:

```bash
USE_DUMMY_HEALTH_DATA=true
HEALTH_DATA_FILE=health-data-dummy.json
```

Now the services will use dummy data instead of calling APIs.

## ❓ FAQ

**Q: Why not call APIs during build?**
A: API calls make builds slow and can fail due to rate limits or timeouts.

**Q: How fresh is the data?**
A: Updated daily at 6am UTC. You can trigger manual updates anytime.

**Q: What if an API fails?**
A: The workflow uses `continue-on-error: true` so one failure won't block others.

**Q: Can I trigger updates manually?**
A: Yes! Run `bun run update-all` or use GitHub Actions UI to trigger the workflow.

**Q: Why are my Google Fit numbers different?**
A: Run `bun run compare-googlefit` to debug data source differences.

## 📝 Next Steps

1. ✅ Add all secrets to GitHub
2. ✅ Run manual update to test: `bun run update-all`
3. ✅ Check JSON files are created: `ls -lh public/*.json`
4. ✅ Commit and push to trigger GitHub Action
5. ✅ If Google Fit data is wrong, run `bun run compare-googlefit`
6. ✅ Verify daily updates are working

## 🆘 Get Help

- Check logs in GitHub Actions tab
- Run debug scripts: `bun run debug-googlefit`
- Compare data: `bun run compare-googlefit`
- Read architecture: See `ARCHITECTURE.md`

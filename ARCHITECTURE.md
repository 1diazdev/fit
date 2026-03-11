# Fitness Matrix - Architecture & Data Flow

## 🏗️ System Architecture

### Data Flow Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    DAILY DATA UPDATE CYCLE                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  GitHub Actions (6am UTC daily)                                │
│       ↓                                                          │
│  ┌─────────────┬─────────────────┬──────────────┐              │
│  │ Strava API  │ Google Fit API  │  Hevy API    │              │
│  └──────┬──────┴────────┬─────────┴──────┬───────┘              │
│         ↓               ↓                ↓                      │
│  ┌──────────────────────────────────────────────┐              │
│  │  Scripts (bun run xxx-script)                │              │
│  │  - strava-script.ts                          │              │
│  │  - googlefit-script.ts                       │              │
│  │  - hevy-script.ts                            │              │
│  └──────────────────┬───────────────────────────┘              │
│                     ↓                                           │
│  ┌──────────────────────────────────────────────┐              │
│  │  Public JSON Files (committed to git)        │              │
│  │  - public/last-activities.json  (Strava)     │              │
│  │  - public/health-data.json      (Google Fit) │              │
│  │  - public/hevy-data.json        (Hevy)       │              │
│  └──────────────────┬───────────────────────────┘              │
│                     ↓                                           │
│  ┌──────────────────────────────────────────────┐              │
│  │  Git Commit & Push                           │              │
│  └──────────────────┬───────────────────────────┘              │
│                     ↓                                           │
│  ┌──────────────────────────────────────────────┐              │
│  │  Netlify Build Trigger (optional)            │              │
│  └──────────────────────────────────────────────┘              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                       BUILD TIME                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Astro Build Process                                            │
│       ↓                                                          │
│  ┌──────────────────────────────────────────────┐              │
│  │  Read Static JSON Files                      │              │
│  │  (NO API calls = fast builds!)               │              │
│  └──────────────────┬───────────────────────────┘              │
│                     ↓                                           │
│  ┌──────────────────────────────────────────────┐              │
│  │  Services with Memoization Cache             │              │
│  │  - stravaService.ts                          │              │
│  │  - googleFitService.ts                       │              │
│  │  - hevyService.ts                            │              │
│  │  - dataAggregationService.ts                 │              │
│  └──────────────────┬───────────────────────────┘              │
│                     ↓                                           │
│  ┌──────────────────────────────────────────────┐              │
│  │  Astro Pages & Components                    │              │
│  │  - index.astro (main dashboard)              │              │
│  │  - Components render with cached data        │              │
│  └──────────────────┬───────────────────────────┘              │
│                     ↓                                           │
│  ┌──────────────────────────────────────────────┐              │
│  │  Static HTML Output (dist/)                  │              │
│  └──────────────────────────────────────────────┘              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 📊 Data Sources

### 1. Strava

**Script**: `scripts/strava-script.ts`
**Output**: `public/last-activities.json`
**Frequency**: Daily via GitHub Actions
**Data Range**: 365 days

```typescript
{
  "2025-03-11": 10737,  // distance in meters
  "2025-03-10": 5050.3,
  // ...
}
```

### 2. Google Fit

**Script**: `scripts/googlefit-script.ts`
**Output**: `public/health-data.json`
**Frequency**: Daily via GitHub Actions
**Data Ranges**:

- Steps: 365 days
- Sleep: 90 days (API limit)
- Heart Rate: 30 days
- Move Minutes: 30 days
- HR Zones: 30 days

```typescript
{
  "steps": {
    "2025-03-11": { steps: 10885, distance: 7500, calories: 158 }
  },
  "sleep": {
    "2025-03-11": {
      totalMinutes: 420,
      deepMinutes: 105,
      lightMinutes: 210,
      remMinutes: 105,
      sleepScore: 85
    }
  },
  "heartRate": { ... },
  "moveMinutes": { ... },
  "heartRateZones": { ... },
  "lastUpdated": "2025-03-11T06:00:00Z",
  "source": "Google Fit"
}
```

### 3. Hevy

**Script**: `scripts/hevy-script.ts`
**Output**: `public/hevy-data.json`
**Frequency**: Daily via GitHub Actions

```typescript
{
  "workouts": [ /* array of workout objects */ ],
  "workoutCount": 150,
  "lastUpdated": "2025-03-11T06:00:00Z",
  "source": "Hevy"
}
```

## 🔧 Build Optimization Strategy

### Problem: Slow Builds

**Before**: Services called APIs during build → slow, error-prone
**After**: Services read pre-fetched JSON → fast, reliable

### Solution: Pre-fetch + Static JSON

1. **GitHub Actions** runs daily and calls APIs
2. **Scripts** save data to `public/*.json`
3. **Git commits** the updated JSON files
4. **Build reads** static JSON files (no API calls)
5. **Memoization** caches data in memory during build

### Benefits

- ✅ **Fast builds** - No API rate limits or timeouts
- ✅ **Reliable** - Data is pre-validated and committed
- ✅ **Persistent** - Data survives build failures
- ✅ **Debuggable** - Can inspect JSON files directly
- ✅ **Testable** - Can use dummy data files

## 🐛 Debugging Data Inconsistencies

### Google Fit Data Not Matching Mobile App

**Common Causes**:

1. **Different data sources** - App may use device-specific source (e.g., Zepp, Fitbit)
2. **Timezone handling** - Our code uses `America/New_York`
3. **Data aggregation** - We use `com.google.step_count.delta` which aggregates all sources
4. **Sync delays** - Google Fit may not sync immediately

**Debug Script**: `bun run compare-googlefit`

This script:

- Lists ALL available data sources
- Shows data from each source separately
- Compares with aggregate endpoint
- Helps identify which source matches your mobile app

**Recommended Fix**:

1. Run `bun run compare-googlefit`
2. Check which data source has the most complete data
3. Compare totals with Google Fit mobile app
4. Update `googleFitService.ts` to use the correct data source

### Common Data Source IDs

```
Steps:
  - derived:com.google.step_count.delta:com.google.android.gms:estimated_steps
  - derived:com.google.step_count.delta:com.google.android.gms:merge_step_deltas
  - raw:com.google.step_count.delta:com.mi.health:
  - raw:com.google.step_count.delta:com.zepp.health:

Distance:
  - derived:com.google.distance.delta:com.google.android.gms:merge_distance_delta

Calories:
  - derived:com.google.calories.expended:com.google.android.gms:merge_calories_expended
```

## 🔄 Manual Data Updates

```bash
# Update all data sources
bun run update-all

# Update individual sources
bun run strava-script
bun run googlefit-script
bun run hevy-script

# Debug Google Fit data
bun run compare-googlefit
bun run debug-googlefit
```

## 🚀 Deployment

### Netlify

**Build Command**: `bun build`
**Output**: `dist/`
**Functions**: `netlify/functions/` (optional, for on-demand updates)

### Environment Variables

Required in both GitHub Secrets and Netlify:

```bash
# Strava
STRAVA_CLIENT_ID
STRAVA_CLIENT_SECRET
STRAVA_REFRESH_TOKEN

# Google Fit
GOOGLE_FIT_CLIENT_ID
GOOGLE_FIT_CLIENT_SECRET
GOOGLE_FIT_REFRESH_TOKEN

# Hevy
HEVY_API_KEY

# Optional - Netlify Build Hook
NETLIFY_BUILD_HOOK
```

## 📝 Notes

- **Timezone**: All dates use `America/New_York` for consistency
- **Caching**: `memoize()` caches data for the current day
- **Error Handling**: Scripts use `continue-on-error: true` to prevent one failure from blocking others
- **Dummy Data**: Test mode uses `*-dummy.json` files when `USE_DUMMY_HEALTH_DATA=true`

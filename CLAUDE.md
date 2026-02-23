# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

The Fitness Matrix is an Astro-based web application that visualizes fitness data from Strava and Hevy APIs in a Matrix-inspired terminal interface. It displays activity heatmaps, workout statistics, and interactive maps.

**Tech Stack**: Astro 5.x, Bun runtime, TypeScript, Tailwind CSS

## Development Commands

```bash
bun dev              # Start dev server (http://localhost:4321)
bun build            # Build for production (runs astro check first)
bun preview          # Preview production build
bun test             # Run Vitest tests
bun lint             # Lint with ESLint
bun format           # Format with Prettier
bun strava-script    # Manually fetch Strava data to public/last-activities.json
bun clean            # Remove artifacts and reinstall dependencies
```

**Node version**: >=18.17.1 required. Use Bun as the package manager.

## Architecture

### Service Layer (`src/services/`)

**stravaService.ts** - Strava API integration

- `getBearerToken()`: Refreshes OAuth token using environment variables (STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN)
- `fetchActivities(page, perPage)`: Fetch recent activities
- `fetchDistanceData()`: Fetch 365 days of activity data for heatmap
- `processDistanceData(distanceMap)`: Convert to heatmap-ready format with Sunday alignment
- `getLastActivityDate(activityType?)`: Get date of most recent activity
- `getLastActivityInfo(activityType?)`: Get detailed info about last activity
- `getActivityStats(activities)`: Calculate statistics by activity type

**Critical**: All date handling uses "America/New_York" timezone to ensure consistent day boundaries across heatmap visualization.

**hevyService.ts** - Hevy API integration

- `fetchHevyData(apiKey?)`: Fetch all workouts (sorted newest first)
- `fetchWorkoutCount(apiKey?)`: Get total workout count
- Exports TypeScript interfaces: `Workout`, `Exercise`, `Set`

### Key Components

- **HeatmapGrid.astro**: 365-day visualization with Matrix green gradient coloring
- **DaysSinceLast.astro**: Activity status indicators (EXCELLENT/WARNING/CRITICAL based on days since last activity)
- **ActivityMap.astro**: Leaflet map with polyline route rendering
- **HevyWorkoutCount.astro**: Workout count displayed in binary Matrix style
- **MatrixBackground.astro**: Animated Matrix rain effect

### Pages Structure

- `index.astro`: Main dashboard with heatmap
- `last.astro`: Latest activities with stats
- `map.astro`: Interactive map view
- `hevy.astro`: Hevy workout dashboard
- `about.astro`: About page

### Utilities

- `heatmapUtils.ts`: Matrix color gradients and animation styles (matrixFade, digitalGlitch, matrixRain)
- `formatUtils.ts`: Distance and time formatting

## Environment Variables

Required in `.env` (see `.env.sample` for template):

```bash
STRAVA_CLIENT_ID=...
STRAVA_CLIENT_SECRET=...
STRAVA_REFRESH_TOKEN=...
HEVY_API_KEY=...
```

For Strava OAuth setup instructions, see `DOCS-STRAVA.md`. The refresh token must be obtained through the OAuth authorization flow.

## Automated Data Updates

GitHub Actions workflow (`.github/workflows/strava-build.yml`) runs daily at 6am UTC:

1. Executes `bun run strava-script`
2. Fetches last 365 days of Strava activities
3. Summarizes distance by date (EST timezone, UTC-5)
4. Updates `public/last-activities.json`
5. Auto-commits changes

Uses repository secrets for Strava credentials.

## Important Implementation Details

**Timezone Handling**: All Strava date processing uses "America/New_York" timezone. This is critical for heatmap day alignment - activities are bucketed by NY local date, not UTC. The heatmap grid starts on Sunday and processes 365 days of data.

**API Rate Limits**: Strava API has rate limits. The service gracefully handles "Rate Limit Exceeded" responses.

**Matrix Theme**: Use Matrix green (`#00ff00`, `rgb(0, 255, 0)`) for active states and dark backgrounds. Color gradient in heatmap ranges from very dark green to neon green based on activity intensity.

**Development vs Production**: Some functions (like `getLastActivityDate`) return mock data in development mode to avoid excessive API calls during development.

## Deployment

- Platform: Netlify (config in `netlify.toml`)
- Live URL: https://fit.jpdiaz.dev
- Build command: `bun build`
- Output directory: `dist/`

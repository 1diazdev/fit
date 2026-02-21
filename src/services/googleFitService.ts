/**
 * Google Fit API Service
 *
 * Official Google Fit API integration for health data.
 * Fetches steps, sleep, heart rate, and activity data.
 *
 * API Documentation: https://developers.google.com/fit
 *
 * Required scopes:
 * - https://www.googleapis.com/auth/fitness.activity.read
 * - https://www.googleapis.com/auth/fitness.body.read
 * - https://www.googleapis.com/auth/fitness.heart_rate.read
 * - https://www.googleapis.com/auth/fitness.sleep.read
 */

import { memoize } from '@/lib/dataCache';

// ============================================================================
// INTERFACES
// ============================================================================

export interface GoogleFitTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface StepsData {
  [date: string]: {
    steps: number;
    distance: number; // meters
    calories: number;
  };
}

export interface SleepData {
  [date: string]: {
    totalMinutes: number;
    deepMinutes: number;
    lightMinutes: number;
    remMinutes: number;
    sleepScore: number;
  };
}

export interface HeartRateData {
  [date: string]: {
    min: number;
    max: number;
    avg: number;
    resting: number;
  };
}

export interface HeartRateZones {
  [date: string]: {
    zone1Minutes: number; // 50-60% max HR (very light)
    zone2Minutes: number; // 60-70% max HR (light)
    zone3Minutes: number; // 70-80% max HR (moderate)
    zone4Minutes: number; // 80-90% max HR (hard)
    zone5Minutes: number; // 90-100% max HR (maximum)
    totalActiveMinutes: number;
  };
}

export interface MoveMinutesData {
  [date: string]: {
    activeMinutes: number; // Any activity
    heartMinutes: number; // Moderate to vigorous activity (heart points)
  };
}

export interface HealthStats {
  steps: number;
  distance: number;
  calories: number;
  heartRate: {
    current: number;
    resting: number;
  };
  sleepMinutes: number;
  activeMinutes: number;
  heartMinutes: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const GOOGLE_FIT_API_BASE = 'https://www.googleapis.com/fitness/v1/users/me';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

// Data source IDs
const DATA_SOURCES = {
  STEPS: 'derived:com.google.step_count.delta:com.google.android.gms:estimated_steps',
  DISTANCE: 'derived:com.google.distance.delta:com.google.android.gms:merge_distance_delta',
  CALORIES: 'derived:com.google.calories.expended:com.google.android.gms:merge_calories_expended',
  HEART_RATE: 'derived:com.google.heart_rate.bpm:com.google.android.gms:merge_heart_rate_bpm',
  SLEEP: 'derived:com.google.sleep.segment:com.google.android.gms:merged',
  ACTIVE_MINUTES: 'derived:com.google.active_minutes:com.google.android.gms:merge_active_minutes',
  HEART_MINUTES: 'derived:com.google.heart_minutes:com.google.android.gms:merge_heart_minutes',
};

// ============================================================================
// AUTHENTICATION
// ============================================================================

/**
 * Exchange authorization code for tokens
 * This is called once during setup after user authorizes the app
 */
export async function exchangeCodeForTokens(code: string): Promise<GoogleFitTokens> {
  const clientId = import.meta.env.GOOGLE_FIT_CLIENT_ID;
  const clientSecret = import.meta.env.GOOGLE_FIT_CLIENT_SECRET;
  const redirectUri = import.meta.env.GOOGLE_FIT_REDIRECT_URI || 'http://localhost:3000/callback';

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code for tokens: ${error}`);
  }

  return await response.json();
}

/**
 * Refresh the access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const clientId = import.meta.env.GOOGLE_FIT_CLIENT_ID;
  const clientSecret = import.meta.env.GOOGLE_FIT_CLIENT_SECRET;

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh access token: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Get current access token (from environment or by refreshing)
 */
export async function getAccessToken(): Promise<string> {
  const refreshToken = import.meta.env.GOOGLE_FIT_REFRESH_TOKEN;

  if (!refreshToken) {
    throw new Error(
      'GOOGLE_FIT_REFRESH_TOKEN not found. Run the setup script first: bun run googlefit-setup'
    );
  }

  return await refreshAccessToken(refreshToken);
}

// ============================================================================
// DATA FETCHING
// ============================================================================

/**
 * Get time range in milliseconds for Google Fit API
 */
function getTimeRangeMillis(days: number): { startTimeMillis: number; endTimeMillis: number } {
  const now = new Date();
  const endTime = now.getTime();
  const startTime = endTime - days * 24 * 60 * 60 * 1000;

  return {
    startTimeMillis: startTime,
    endTimeMillis: endTime,
  };
}

/**
 * Convert nanoseconds to date string (America/New_York timezone)
 */
function nanosToDateString(nanos: string): string {
  const millis = parseInt(nanos) / 1000000;
  const date = new Date(millis);
  const nyDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));

  const year = nyDate.getFullYear();
  const month = String(nyDate.getMonth() + 1).padStart(2, '0');
  const day = String(nyDate.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Fetch steps data from Google Fit
 * Fetches in chunks to avoid "aggregate duration too large" error
 */
export async function fetchStepsData(days: number = 365): Promise<StepsData> {
  const today = new Date().toISOString().split('T')[0];
  return memoize(`googlefit-steps-${today}-${days}`, async () => {
    const accessToken = await getAccessToken();
    const stepsData: StepsData = {};

    // Google Fit API limit: ~90 days per request
    const CHUNK_SIZE = 90;
    const chunks = Math.ceil(days / CHUNK_SIZE);

    console.log(`   Fetching ${days} days in ${chunks} chunks of ${CHUNK_SIZE} days each...`);

    // Fetch data in chunks
    for (let i = 0; i < chunks; i++) {
      const chunkDays = Math.min(CHUNK_SIZE, days - i * CHUNK_SIZE);
      const { startTimeMillis, endTimeMillis } = getTimeRangeMillis((i + 1) * CHUNK_SIZE);
      const chunkStart = endTimeMillis - chunkDays * 24 * 60 * 60 * 1000;

      console.log(`   Chunk ${i + 1}/${chunks}: ${chunkDays} days...`);

      const stepsUrl = `${GOOGLE_FIT_API_BASE}/dataset:aggregate`;
      const stepsResponse = await fetch(stepsUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          aggregateBy: [{
            dataTypeName: 'com.google.step_count.delta',
          }, {
            dataTypeName: 'com.google.distance.delta',
          }, {
            dataTypeName: 'com.google.calories.expended',
          }],
          bucketByTime: { durationMillis: 86400000 }, // 1 day
          startTimeMillis: chunkStart,
          endTimeMillis,
        }),
      });

      if (!stepsResponse.ok) {
        const errorText = await stepsResponse.text();
        console.error(`Steps API Error (chunk ${i + 1}):`, errorText);
        throw new Error(`Google Fit API error: ${stepsResponse.status} - ${errorText}`);
      }

      const data = await stepsResponse.json();

      // Process buckets
      if (data.bucket) {
        for (const bucket of data.bucket) {
          const dateStr = nanosToDateString(bucket.startTimeMillis + '000000');

          let steps = 0;
          let distance = 0;
          let calories = 0;

          for (const dataset of bucket.dataset) {
            for (const point of dataset.point) {
              if (dataset.dataSourceId.includes('step_count')) {
                steps += point.value[0]?.intVal || 0;
              } else if (dataset.dataSourceId.includes('distance')) {
                distance += point.value[0]?.fpVal || 0;
              } else if (dataset.dataSourceId.includes('calories')) {
                calories += point.value[0]?.fpVal || 0;
              }
            }
          }

          stepsData[dateStr] = { steps, distance, calories };
        }
      }

      // Small delay between chunks to be nice to the API
      if (i < chunks - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return stepsData;
  });
}

/**
 * Fetch sleep data from Google Fit
 * Note: Sleep data might not be available for all time periods
 * Reduced to 90 days max due to API limitations
 */
export async function fetchSleepData(days: number = 90): Promise<SleepData> {
  const today = new Date().toISOString().split('T')[0];
  // Limit sleep data to 90 days max
  const actualDays = Math.min(days, 90);

  return memoize(`googlefit-sleep-${today}-${actualDays}`, async () => {
    const accessToken = await getAccessToken();
    const { startTimeMillis, endTimeMillis } = getTimeRangeMillis(actualDays);

    const sleepData: SleepData = {};

    // Convert to nanoseconds for sessions API
    const startTimeNanos = (startTimeMillis * 1000000).toString();
    const endTimeNanos = (endTimeMillis * 1000000).toString();

    console.log(`   Fetching sleep sessions (${actualDays} days)...`);

    const sleepUrl = `${GOOGLE_FIT_API_BASE}/sessions`;
    const sleepResponse = await fetch(
      `${sleepUrl}?startTime=${startTimeNanos}&endTime=${endTimeNanos}&activityType=72`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!sleepResponse.ok) {
      const errorText = await sleepResponse.text();
      console.warn('Sleep API returned error (continuing without sleep data):', errorText);
      // Sleep data is optional - don't fail the entire fetch
      return {};
    }

    const data = await sleepResponse.json();

    if (data.session) {
      for (const session of data.session) {
        const dateStr = nanosToDateString(session.startTimeMillis);
        const startMs = parseInt(session.startTimeMillis);
        const endMs = parseInt(session.endTimeMillis);
        const totalMinutes = (endMs - startMs) / (1000 * 60);

        // Google Fit sleep segments: 1=awake, 2=sleep, 3=out-of-bed, 4=light, 5=deep, 6=REM
        let deepMinutes = 0;
        let lightMinutes = 0;
        let remMinutes = 0;

        // These would come from detailed sleep segments if available
        // For now, estimate based on total sleep
        lightMinutes = totalMinutes * 0.5; // ~50% light
        deepMinutes = totalMinutes * 0.25; // ~25% deep
        remMinutes = totalMinutes * 0.25; // ~25% REM

        const sleepScore = calculateSleepScore(totalMinutes, deepMinutes, remMinutes);

        sleepData[dateStr] = {
          totalMinutes,
          deepMinutes,
          lightMinutes,
          remMinutes,
          sleepScore,
        };
      }
    }

    return sleepData;
  });
}

/**
 * Calculate sleep score (0-100)
 */
function calculateSleepScore(total: number, deep: number, rem: number): number {
  let score = 0;

  // Total sleep (0-40 points)
  if (total >= 420 && total <= 540) score += 40;
  else if (total >= 360) score += 30;
  else score += 20;

  // Deep sleep (0-30 points)
  const deepPercent = (deep / total) * 100;
  if (deepPercent >= 15 && deepPercent <= 25) score += 30;
  else if (deepPercent >= 10) score += 20;
  else score += 10;

  // REM sleep (0-30 points)
  const remPercent = (rem / total) * 100;
  if (remPercent >= 20 && remPercent <= 25) score += 30;
  else if (remPercent >= 15) score += 20;
  else score += 10;

  return Math.min(100, score);
}

/**
 * Fetch heart rate data from Google Fit
 * Note: 30 days should work in single request, but we keep chunk logic for consistency
 */
export async function fetchHeartRateData(days: number = 30): Promise<HeartRateData> {
  const today = new Date().toISOString().split('T')[0];
  return memoize(`googlefit-heartrate-${today}-${days}`, async () => {
    const accessToken = await getAccessToken();
    const { startTimeMillis, endTimeMillis } = getTimeRangeMillis(days);

    const hrData: HeartRateData = {};

    // 30 days should work in one request, but use safe limit just in case
    const hrUrl = `${GOOGLE_FIT_API_BASE}/dataset:aggregate`;
    const hrResponse = await fetch(hrUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        aggregateBy: [{
          dataTypeName: 'com.google.heart_rate.bpm',
        }],
        bucketByTime: { durationMillis: 86400000 },
        startTimeMillis,
        endTimeMillis,
      }),
    });

    if (!hrResponse.ok) {
      const errorText = await hrResponse.text();
      console.error('Heart Rate API Error Response:', errorText);
      // Heart rate data might not be available - don't fail completely
      console.warn('Continuing without heart rate data');
      return {};
    }

    const data = await hrResponse.json();

    if (data.bucket) {
      for (const bucket of data.bucket) {
        const dateStr = nanosToDateString(bucket.startTimeMillis + '000000');

        const hrValues: number[] = [];

        for (const dataset of bucket.dataset) {
          for (const point of dataset.point) {
            const hr = point.value[0]?.fpVal || 0;
            if (hr > 0) hrValues.push(hr);
          }
        }

        if (hrValues.length > 0) {
          const min = Math.min(...hrValues);
          const max = Math.max(...hrValues);
          const avg = Math.round(hrValues.reduce((a, b) => a + b, 0) / hrValues.length);
          const resting = Math.round(hrValues.slice(0, 10).reduce((a, b) => a + b, 0) / 10);

          hrData[dateStr] = { min, max, avg, resting };
        }
      }
    }

    return hrData;
  });
}

/**
 * Fetch move minutes data from Google Fit
 * Includes active minutes (any activity) and heart minutes (moderate to vigorous)
 */
export async function fetchMoveMinutesData(days: number = 30): Promise<MoveMinutesData> {
  const today = new Date().toISOString().split('T')[0];
  return memoize(`googlefit-move-${today}-${days}`, async () => {
    const accessToken = await getAccessToken();
    const { startTimeMillis, endTimeMillis } = getTimeRangeMillis(days);

    const moveData: MoveMinutesData = {};

    console.log(`   Fetching move minutes (${days} days)...`);

    const moveUrl = `${GOOGLE_FIT_API_BASE}/dataset:aggregate`;
    const moveResponse = await fetch(moveUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        aggregateBy: [{
          dataTypeName: 'com.google.active_minutes',
        }, {
          dataTypeName: 'com.google.heart_minutes',
        }],
        bucketByTime: { durationMillis: 86400000 },
        startTimeMillis,
        endTimeMillis,
      }),
    });

    if (!moveResponse.ok) {
      const errorText = await moveResponse.text();
      console.warn('Move Minutes API returned error (continuing without move data):', errorText);
      return {};
    }

    const data = await moveResponse.json();

    if (data.bucket) {
      for (const bucket of data.bucket) {
        const dateStr = nanosToDateString(bucket.startTimeMillis + '000000');

        let activeMinutes = 0;
        let heartMinutes = 0;

        for (const dataset of bucket.dataset) {
          for (const point of dataset.point) {
            if (dataset.dataSourceId.includes('active_minutes')) {
              activeMinutes += point.value[0]?.intVal || 0;
            } else if (dataset.dataSourceId.includes('heart_minutes')) {
              heartMinutes += point.value[0]?.fpVal || 0;
            }
          }
        }

        moveData[dateStr] = { activeMinutes, heartMinutes };
      }
    }

    return moveData;
  });
}

/**
 * Calculate heart rate zones from heart rate data
 * Uses standard 5-zone model based on max heart rate (220 - age)
 *
 * Note: This is a basic calculation. For more accurate zones,
 * individual max HR testing is recommended.
 */
export async function fetchHeartRateZones(days: number = 30, age: number = 30): Promise<HeartRateZones> {
  const today = new Date().toISOString().split('T')[0];
  return memoize(`googlefit-hr-zones-${today}-${days}`, async () => {
    const accessToken = await getAccessToken();
    const { startTimeMillis, endTimeMillis } = getTimeRangeMillis(days);

    const zonesData: HeartRateZones = {};
    const maxHR = 220 - age;

    // Zone thresholds
    const zone1 = [maxHR * 0.50, maxHR * 0.60]; // Very light
    const zone2 = [maxHR * 0.60, maxHR * 0.70]; // Light
    const zone3 = [maxHR * 0.70, maxHR * 0.80]; // Moderate
    const zone4 = [maxHR * 0.80, maxHR * 0.90]; // Hard
    const zone5 = [maxHR * 0.90, maxHR * 1.00]; // Maximum

    console.log(`   Fetching heart rate zones (${days} days, age ${age}, max HR ${maxHR})...`);

    // Get detailed heart rate data (not aggregated by day)
    const hrUrl = `${GOOGLE_FIT_API_BASE}/dataset:aggregate`;
    const hrResponse = await fetch(hrUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        aggregateBy: [{
          dataTypeName: 'com.google.heart_rate.bpm',
        }],
        bucketByTime: { durationMillis: 60000 }, // 1 minute buckets for zone calculation
        startTimeMillis,
        endTimeMillis,
      }),
    });

    if (!hrResponse.ok) {
      const errorText = await hrResponse.text();
      console.warn('HR Zones API returned error (continuing without zone data):', errorText);
      return {};
    }

    const data = await hrResponse.json();

    if (data.bucket) {
      // Group by date and calculate time in each zone
      const dailyZones: { [date: string]: number[] } = {};

      for (const bucket of data.bucket) {
        const dateStr = nanosToDateString(bucket.startTimeMillis + '000000');

        if (!dailyZones[dateStr]) {
          dailyZones[dateStr] = [0, 0, 0, 0, 0]; // [zone1, zone2, zone3, zone4, zone5]
        }

        for (const dataset of bucket.dataset) {
          for (const point of dataset.point) {
            const hr = point.value[0]?.fpVal || 0;
            if (hr > 0) {
              // Determine which zone this HR belongs to
              if (hr >= zone1[0] && hr < zone1[1]) dailyZones[dateStr][0]++;
              else if (hr >= zone2[0] && hr < zone2[1]) dailyZones[dateStr][1]++;
              else if (hr >= zone3[0] && hr < zone3[1]) dailyZones[dateStr][2]++;
              else if (hr >= zone4[0] && hr < zone4[1]) dailyZones[dateStr][3]++;
              else if (hr >= zone5[0]) dailyZones[dateStr][4]++;
            }
          }
        }
      }

      // Convert counts to minutes and build final data structure
      for (const [dateStr, zones] of Object.entries(dailyZones)) {
        zonesData[dateStr] = {
          zone1Minutes: zones[0],
          zone2Minutes: zones[1],
          zone3Minutes: zones[2],
          zone4Minutes: zones[3],
          zone5Minutes: zones[4],
          totalActiveMinutes: zones.reduce((a, b) => a + b, 0),
        };
      }
    }

    return zonesData;
  });
}

/**
 * Fetch today's health stats
 */
export async function fetchTodayStats(): Promise<HealthStats> {
  const today = new Date().toISOString().split('T')[0];
  return memoize(`googlefit-today-${today}`, async () => {
    const [steps, sleep, hr, move] = await Promise.all([
      fetchStepsData(1),
      fetchSleepData(1),
      fetchHeartRateData(1),
      fetchMoveMinutesData(1),
    ]);

    const todayNY = nanosToDateString(Date.now().toString() + '000000');
    const todaySteps = steps[todayNY] || { steps: 0, distance: 0, calories: 0 };
    const todaySleep = sleep[todayNY] || { totalMinutes: 0, deepMinutes: 0, lightMinutes: 0, remMinutes: 0, sleepScore: 0 };
    const todayHR = hr[todayNY] || { min: 0, max: 0, avg: 0, resting: 0 };
    const todayMove = move[todayNY] || { activeMinutes: 0, heartMinutes: 0 };

    return {
      steps: todaySteps.steps,
      distance: todaySteps.distance,
      calories: todaySteps.calories,
      heartRate: {
        current: todayHR.avg,
        resting: todayHR.resting,
      },
      sleepMinutes: todaySleep.totalMinutes,
      activeMinutes: todayMove.activeMinutes,
      heartMinutes: todayMove.heartMinutes,
    };
  });
}

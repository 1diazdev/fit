/**
 * Zepp/Amazfit API Service
 *
 * Provides authentication and data fetching for Zepp/Amazfit health data.
 * Based on reverse-engineered Huami/Zepp API endpoints.
 *
 * References:
 * - https://github.com/argrento/huami-token
 * - https://github.com/bentasker/zepp_to_influxdb
 */

import { memoize } from '@/lib/dataCache';
import {
  parseBase64Steps,
  parseBase64HeartRate,
  parseBase64Sleep,
  calculateSleepScore,
  convertToNewYorkDate,
  aggregateSteps,
  calculateAverageHR,
  getHRRange,
} from '@/utils/zeppDataUtils';

// ============================================================================
// INTERFACES
// ============================================================================

export interface ZeppTokenResponse {
  token_info: {
    access_token: string;
    refresh_token: string;
    user_id: string;
    expires_in: number; // seconds
    token_type: string;
  };
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

export interface HealthStats {
  steps: number;
  distance: number;
  calories: number;
  heartRate: {
    current: number;
    resting: number;
  };
  sleepMinutes: number;
}

// ============================================================================
// AUTHENTICATION
// ============================================================================

/**
 * Authenticate with Zepp/Amazfit using email/password
 *
 * This is used ONE TIME to generate a refresh token.
 * The refresh token is then stored in environment variables.
 *
 * @param email - Zepp account email
 * @param password - Zepp account password
 * @returns Token response with access and refresh tokens
 */
export async function authenticateZepp(
  email: string,
  password: string
): Promise<ZeppTokenResponse> {
  const apiUrl = 'https://api-mifit-de2.huami.com/v2/registrations/tokens';

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'MiFit/4.6.0 (iPhone; iOS 14.4; Scale/2.00)',
    },
    body: JSON.stringify({
      email,
      password,
      grant_type: 'password',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Zepp authentication failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data as ZeppTokenResponse;
}

/**
 * Refresh the Zepp access token using a refresh token
 *
 * @param refreshToken - The long-lived refresh token (valid ~10 years)
 * @returns New access token
 */
export async function refreshZeppToken(refreshToken: string): Promise<string> {
  const apiUrl = 'https://api-mifit-de2.huami.com/v2/registrations/tokens';

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'MiFit/4.6.0 (iPhone; iOS 14.4; Scale/2.00)',
    },
    body: JSON.stringify({
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Zepp token refresh failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.token_info.access_token;
}

/**
 * Get current access token (from environment or by refreshing)
 *
 * @returns Bearer token for API requests
 */
export async function getZeppBearerToken(): Promise<string> {
  const refreshToken = import.meta.env.ZEPP_REFRESH_TOKEN;

  if (!refreshToken) {
    throw new Error(
      'ZEPP_REFRESH_TOKEN not found in environment variables. ' +
      'Run the zepp-setup script to generate a refresh token.'
    );
  }

  const accessToken = await refreshZeppToken(refreshToken);
  return `Bearer ${accessToken}`;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Format date for Zepp API (YYYY-MM-DD)
 */
function formatDateForAPI(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ============================================================================
// DATA FETCHING
// ============================================================================

/**
 * Fetch steps data for the last N days
 *
 * @param days - Number of days to fetch (default: 365)
 * @returns Steps data indexed by date
 */
export async function fetchStepsData(days: number = 365): Promise<StepsData> {
  // Memoize with date key to cache for the day
  const today = new Date().toISOString().split('T')[0];
  return memoize(`zepp-steps-${today}-${days}`, async () => {
    const bearer = await getZeppBearerToken();
    const stepsData: StepsData = {};

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    const fromDate = formatDateForAPI(startDate);
    const toDate = formatDateForAPI(endDate);

    try {
      const response = await fetch(
        `https://api-mifit-de2.huami.com/v1/data/band_data.json?query_type=summary&device_type=0&from_date=${fromDate}&to_date=${toDate}`,
        {
          headers: {
            'Authorization': bearer,
            'User-Agent': 'MiFit/4.6.0 (iPhone; iOS 14.4; Scale/2.00)',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Zepp API error: ${response.status}`);
      }

      const data = await response.json();

      // Process the response
      // The API typically returns data in the format:
      // { data: { [date]: { steps, distance, calories, ... } } }
      if (data.data) {
        for (const [dateKey, dayData] of Object.entries(data.data)) {
          const date = convertToNewYorkDate(new Date(dateKey));

          stepsData[date] = {
            steps: (dayData as any).steps || 0,
            distance: (dayData as any).distance || 0,
            calories: (dayData as any).calories || 0,
          };
        }
      }

      return stepsData;
    } catch (error) {
      console.error('Error fetching Zepp steps data:', error);
      return {};
    }
  });
}

/**
 * Fetch sleep data for the last N days
 *
 * @param days - Number of days to fetch (default: 365)
 * @returns Sleep data indexed by date
 */
export async function fetchSleepData(days: number = 365): Promise<SleepData> {
  const today = new Date().toISOString().split('T')[0];
  return memoize(`zepp-sleep-${today}-${days}`, async () => {
    const bearer = await getZeppBearerToken();
    const sleepData: SleepData = {};

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    const fromDate = formatDateForAPI(startDate);
    const toDate = formatDateForAPI(endDate);

    try {
      const response = await fetch(
        `https://api-mifit-de2.huami.com/v1/data/band_data.json?query_type=sleep&device_type=0&from_date=${fromDate}&to_date=${toDate}`,
        {
          headers: {
            'Authorization': bearer,
            'User-Agent': 'MiFit/4.6.0 (iPhone; iOS 14.4; Scale/2.00)',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Zepp API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.data) {
        for (const [dateKey, dayData] of Object.entries(data.data)) {
          const date = convertToNewYorkDate(new Date(dateKey));
          const sleepInfo = dayData as any;

          // Parse sleep stages if available in base64 format
          let segments: any[] = [];
          if (sleepInfo.sleep_data_base64) {
            segments = parseBase64Sleep(sleepInfo.sleep_data_base64);
          }

          sleepData[date] = {
            totalMinutes: sleepInfo.total_sleep || 0,
            deepMinutes: sleepInfo.deep_sleep || 0,
            lightMinutes: sleepInfo.light_sleep || 0,
            remMinutes: sleepInfo.rem_sleep || 0,
            sleepScore: segments.length > 0 ? calculateSleepScore(segments) : sleepInfo.sleep_score || 0,
          };
        }
      }

      return sleepData;
    } catch (error) {
      console.error('Error fetching Zepp sleep data:', error);
      return {};
    }
  });
}

/**
 * Fetch heart rate data for the last N days
 *
 * @param days - Number of days to fetch (default: 30)
 * @returns Heart rate data indexed by date
 */
export async function fetchHeartRateData(days: number = 30): Promise<HeartRateData> {
  const today = new Date().toISOString().split('T')[0];
  return memoize(`zepp-heartrate-${today}-${days}`, async () => {
    const bearer = await getZeppBearerToken();
    const hrData: HeartRateData = {};

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    const fromDate = formatDateForAPI(startDate);
    const toDate = formatDateForAPI(endDate);

    try {
      const response = await fetch(
        `https://api-mifit-de2.huami.com/v1/data/band_data.json?query_type=heartrate&device_type=0&from_date=${fromDate}&to_date=${toDate}`,
        {
          headers: {
            'Authorization': bearer,
            'User-Agent': 'MiFit/4.6.0 (iPhone; iOS 14.4; Scale/2.00)',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Zepp API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.data) {
        for (const [dateKey, dayData] of Object.entries(data.data)) {
          const date = convertToNewYorkDate(new Date(dateKey));
          const hrInfo = dayData as any;

          // Parse HR readings if in base64 format
          let readings: number[] = [];
          if (hrInfo.heartrate_data_base64) {
            readings = parseBase64HeartRate(hrInfo.heartrate_data_base64);
          }

          const range = readings.length > 0 ? getHRRange(readings) : { min: 0, max: 0 };
          const avg = readings.length > 0 ? calculateAverageHR(readings) : 0;

          hrData[date] = {
            min: range.min || hrInfo.min_hr || 0,
            max: range.max || hrInfo.max_hr || 0,
            avg: avg || hrInfo.avg_hr || 0,
            resting: hrInfo.resting_hr || 0,
          };
        }
      }

      return hrData;
    } catch (error) {
      console.error('Error fetching Zepp heart rate data:', error);
      return {};
    }
  });
}

/**
 * Fetch today's health stats
 *
 * @returns Current day health statistics
 */
export async function fetchTodayStats(): Promise<HealthStats> {
  const today = new Date().toISOString().split('T')[0];
  return memoize(`zepp-today-${today}`, async () => {
    try {
      // Fetch today's data from all sources
      const [steps, sleep, hr] = await Promise.all([
        fetchStepsData(1),
        fetchSleepData(1),
        fetchHeartRateData(1),
      ]);

      const todayNY = convertToNewYorkDate(new Date());
      const todaySteps = steps[todayNY] || { steps: 0, distance: 0, calories: 0 };
      const todaySleep = sleep[todayNY] || { totalMinutes: 0, deepMinutes: 0, lightMinutes: 0, remMinutes: 0, sleepScore: 0 };
      const todayHR = hr[todayNY] || { min: 0, max: 0, avg: 0, resting: 0 };

      return {
        steps: todaySteps.steps,
        distance: todaySteps.distance,
        calories: todaySteps.calories,
        heartRate: {
          current: todayHR.avg,
          resting: todayHR.resting,
        },
        sleepMinutes: todaySleep.totalMinutes,
      };
    } catch (error) {
      console.error('Error fetching today stats:', error);
      return {
        steps: 0,
        distance: 0,
        calories: 0,
        heartRate: { current: 0, resting: 0 },
        sleepMinutes: 0,
      };
    }
  });
}

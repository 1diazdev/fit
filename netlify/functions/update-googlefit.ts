import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { writeFile } from "fs/promises";
import { join } from "path";

// Schedule: Run daily at 6:30 AM UTC (30 mins after Strava)
export const schedule = "30 6 * * *";

interface GoogleFitTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface StepsData {
  [date: string]: {
    steps: number;
    distance: number;
    calories: number;
  };
}

interface SleepData {
  [date: string]: {
    totalMinutes: number;
    deepMinutes: number;
    lightMinutes: number;
    remMinutes: number;
    sleepScore: number;
  };
}

interface HeartRateData {
  [date: string]: {
    min: number;
    max: number;
    avg: number;
    resting: number;
  };
}

interface HealthData {
  steps: StepsData;
  sleep: SleepData;
  heartRate: HeartRateData;
  lastUpdated: string;
  source: string;
  dataRange: {
    stepsDays: number;
    sleepDays: number;
    heartRateDays: number;
  };
}

const GOOGLE_FIT_API_BASE = "https://www.googleapis.com/fitness/v1/users/me";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

// Refresh access token
const refreshAccessToken = async (refreshToken: string): Promise<string> => {
  const clientId = process.env.GOOGLE_FIT_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_FIT_CLIENT_SECRET;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Missing Google Fit credentials in environment variables");
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh access token: ${error}`);
  }

  const data: GoogleFitTokenResponse = await response.json();
  return data.access_token;
};

// Convert nanoseconds to date string (America/New_York timezone)
const nanosToDateString = (nanos: string): string => {
  const millis = parseInt(nanos) / 1000000;
  const date = new Date(millis);
  const nyDate = new Date(
    date.toLocaleString("en-US", { timeZone: "America/New_York" }),
  );

  const year = nyDate.getFullYear();
  const month = String(nyDate.getMonth() + 1).padStart(2, "0");
  const day = String(nyDate.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

// Get time range in milliseconds
const getTimeRangeMillis = (
  days: number,
): { startTimeMillis: number; endTimeMillis: number } => {
  const now = new Date();
  const endTime = now.getTime();
  const startTime = endTime - days * 24 * 60 * 60 * 1000;

  return { startTimeMillis: startTime, endTimeMillis: endTime };
};

// Fetch steps data (with chunking to avoid API limits)
const fetchStepsData = async (
  accessToken: string,
  days: number = 90,
): Promise<StepsData> => {
  const stepsData: StepsData = {};
  const CHUNK_SIZE = 90;
  const chunks = Math.ceil(days / CHUNK_SIZE);

  for (let i = 0; i < chunks; i++) {
    const chunkDays = Math.min(CHUNK_SIZE, days - i * CHUNK_SIZE);
    const { startTimeMillis, endTimeMillis } = getTimeRangeMillis(
      (i + 1) * CHUNK_SIZE,
    );
    const chunkStart = endTimeMillis - chunkDays * 24 * 60 * 60 * 1000;

    const stepsUrl = `${GOOGLE_FIT_API_BASE}/dataset:aggregate`;
    const stepsResponse = await fetch(stepsUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        aggregateBy: [
          { dataTypeName: "com.google.step_count.delta" },
          { dataTypeName: "com.google.distance.delta" },
          { dataTypeName: "com.google.calories.expended" },
        ],
        bucketByTime: { durationMillis: 86400000 }, // 1 day
        startTimeMillis: chunkStart,
        endTimeMillis,
      }),
    });

    if (!stepsResponse.ok) {
      console.error(
        `Steps API error (chunk ${i + 1}):`,
        await stepsResponse.text(),
      );
      continue;
    }

    const data = await stepsResponse.json();

    if (data.bucket) {
      for (const bucket of data.bucket) {
        const dateStr = nanosToDateString(bucket.startTimeMillis + "000000");
        let steps = 0,
          distance = 0,
          calories = 0;

        for (const dataset of bucket.dataset) {
          for (const point of dataset.point) {
            if (dataset.dataSourceId.includes("step_count")) {
              steps += point.value[0]?.intVal || 0;
            } else if (dataset.dataSourceId.includes("distance")) {
              distance += point.value[0]?.fpVal || 0;
            } else if (dataset.dataSourceId.includes("calories")) {
              calories += point.value[0]?.fpVal || 0;
            }
          }
        }

        stepsData[dateStr] = { steps, distance, calories };
      }
    }

    // Small delay between chunks
    if (i < chunks - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return stepsData;
};

// Fetch sleep data (limited to 90 days)
const fetchSleepData = async (
  accessToken: string,
  days: number = 90,
): Promise<SleepData> => {
  const sleepData: SleepData = {};
  const actualDays = Math.min(days, 90);
  const { startTimeMillis, endTimeMillis } = getTimeRangeMillis(actualDays);

  const startTimeNanos = (startTimeMillis * 1000000).toString();
  const endTimeNanos = (endTimeMillis * 1000000).toString();

  const sleepUrl = `${GOOGLE_FIT_API_BASE}/sessions`;
  try {
    const sleepResponse = await fetch(
      `${sleepUrl}?startTime=${startTimeNanos}&endTime=${endTimeNanos}&activityType=72`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!sleepResponse.ok) {
      console.warn("Sleep API error (continuing without sleep data)");
      return {};
    }

    const data = await sleepResponse.json();

    if (data.session) {
      for (const session of data.session) {
        const dateStr = nanosToDateString(session.startTimeMillis);
        const startMs = parseInt(session.startTimeMillis);
        const endMs = parseInt(session.endTimeMillis);
        const totalMinutes = (endMs - startMs) / (1000 * 60);

        // Estimate sleep phases (would come from detailed segments if available)
        const lightMinutes = totalMinutes * 0.5;
        const deepMinutes = totalMinutes * 0.25;
        const remMinutes = totalMinutes * 0.25;

        const sleepScore = calculateSleepScore(
          totalMinutes,
          deepMinutes,
          remMinutes,
        );

        sleepData[dateStr] = {
          totalMinutes,
          deepMinutes,
          lightMinutes,
          remMinutes,
          sleepScore,
        };
      }
    }
  } catch (error) {
    console.warn("Sleep fetch failed (continuing):", error);
  }

  return sleepData;
};

// Calculate sleep score (0-100)
const calculateSleepScore = (
  total: number,
  deep: number,
  rem: number,
): number => {
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
};

// Fetch heart rate data
const fetchHeartRateData = async (
  accessToken: string,
  days: number = 30,
): Promise<HeartRateData> => {
  const hrData: HeartRateData = {};
  const { startTimeMillis, endTimeMillis } = getTimeRangeMillis(days);

  const hrUrl = `${GOOGLE_FIT_API_BASE}/dataset:aggregate`;
  try {
    const hrResponse = await fetch(hrUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        aggregateBy: [{ dataTypeName: "com.google.heart_rate.bpm" }],
        bucketByTime: { durationMillis: 86400000 },
        startTimeMillis,
        endTimeMillis,
      }),
    });

    if (!hrResponse.ok) {
      console.warn("Heart Rate API error (continuing without HR data)");
      return {};
    }

    const data = await hrResponse.json();

    if (data.bucket) {
      for (const bucket of data.bucket) {
        const dateStr = nanosToDateString(bucket.startTimeMillis + "000000");
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
          const avg = Math.round(
            hrValues.reduce((a, b) => a + b, 0) / hrValues.length,
          );
          const resting = Math.round(
            hrValues.slice(0, 10).reduce((a, b) => a + b, 0) / 10,
          );

          hrData[dateStr] = { min, max, avg, resting };
        }
      }
    }
  } catch (error) {
    console.warn("HR fetch failed (continuing):", error);
  }

  return hrData;
};

export const handler: Handler = async (
  event: HandlerEvent,
  context: HandlerContext,
) => {
  const isScheduled = event.headers["x-netlify-event"] === "schedule";

  try {
    console.log(
      "[Netlify/GoogleFit] Starting data update...",
      isScheduled ? "(scheduled)" : "(manual)",
    );

    const refreshToken = process.env.GOOGLE_FIT_REFRESH_TOKEN;
    if (!refreshToken) {
      throw new Error("GOOGLE_FIT_REFRESH_TOKEN not found");
    }

    const accessToken = await refreshAccessToken(refreshToken);

    // Fetch all health data
    const [stepsData, sleepData, heartRateData] = await Promise.all([
      fetchStepsData(accessToken, 90),
      fetchSleepData(accessToken, 90),
      fetchHeartRateData(accessToken, 30),
    ]);

    const healthData: HealthData = {
      steps: stepsData,
      sleep: sleepData,
      heartRate: heartRateData,
      lastUpdated: new Date().toISOString(),
      source: "Google Fit",
      dataRange: {
        stepsDays: Object.keys(stepsData).length,
        sleepDays: Object.keys(sleepData).length,
        heartRateDays: Object.keys(heartRateData).length,
      },
    };

    // Write to dist/public directory (Netlify serves from dist/)
    const publicPath = join(process.cwd(), "dist", "health-data.json");
    await writeFile(publicPath, JSON.stringify(healthData, null, 2));

    console.log(
      "[Netlify/GoogleFit] Successfully updated health data:",
      healthData.dataRange,
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        ...healthData.dataRange,
        timestamp: new Date().toISOString(),
        platform: "netlify",
      }),
    };
  } catch (error) {
    console.error("[Netlify/GoogleFit] Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        platform: "netlify",
      }),
    };
  }
};

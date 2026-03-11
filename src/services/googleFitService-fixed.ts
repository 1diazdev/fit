/**
 * Google Fit API Service - FIXED VERSION
 *
 * This version uses specific data sources instead of relying on Google's
 * default aggregation, which can miss data from certain devices/apps.
 */

import { memoize } from "@/lib/dataCache";

const GOOGLE_FIT_API_BASE = "https://www.googleapis.com/fitness/v1/users/me";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

// Specific data source IDs that include ALL your data
const DATA_SOURCES = {
  // This includes phone + Zepp watch + all connected apps
  STEPS: "derived:com.google.step_count.delta:com.google.android.gms:estimated_steps",
  DISTANCE: "derived:com.google.distance.delta:com.google.android.gms:merge_distance_delta",
  CALORIES: "derived:com.google.calories.expended:com.google.android.gms:merge_calories_expended",
};

export interface StepsData {
  [date: string]: {
    steps: number;
    distance: number;
    calories: number;
  };
}

function nanosToDateString(nanos: string): string {
  const millis = parseInt(nanos) / 1000000;
  const date = new Date(millis);
  const nyDate = new Date(
    date.toLocaleString("en-US", { timeZone: "America/New_York" })
  );

  const year = nyDate.getFullYear();
  const month = String(nyDate.getMonth() + 1).padStart(2, "0");
  const day = String(nyDate.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const clientId = import.meta.env.GOOGLE_FIT_CLIENT_ID;
  const clientSecret = import.meta.env.GOOGLE_FIT_CLIENT_SECRET;

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
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

  const data = await response.json();
  return data.access_token;
}

export async function getAccessToken(): Promise<string> {
  const refreshToken = import.meta.env.GOOGLE_FIT_REFRESH_TOKEN;

  if (!refreshToken) {
    throw new Error(
      "GOOGLE_FIT_REFRESH_TOKEN not found. Run the setup script first: bun run googlefit-setup"
    );
  }

  return await refreshAccessToken(refreshToken);
}

/**
 * Fetch steps data using SPECIFIC data source (not default aggregate)
 * This ensures we get ALL data including Zepp watch, apps, etc.
 */
export async function fetchStepsDataFixed(days: number = 365): Promise<StepsData> {
  const today = new Date().toISOString().split("T")[0];
  return memoize(`googlefit-steps-fixed-${today}-${days}`, async () => {
    const accessToken = await getAccessToken();
    const stepsData: StepsData = {};

    const CHUNK_SIZE = 90;
    const chunks = Math.ceil(days / CHUNK_SIZE);

    console.log(
      `   [FIXED] Fetching ${days} days in ${chunks} chunks using specific data sources...`
    );

    for (let i = 0; i < chunks; i++) {
      const chunkDays = Math.min(CHUNK_SIZE, days - i * CHUNK_SIZE);
      const now = Date.now();
      const endTimeMillis = now - i * CHUNK_SIZE * 24 * 60 * 60 * 1000;
      const startTimeMillis = endTimeMillis - chunkDays * 24 * 60 * 60 * 1000;

      console.log(`   Chunk ${i + 1}/${chunks}: ${chunkDays} days...`);

      // Use SPECIFIC data sources with dataSourceId instead of dataTypeName
      const stepsUrl = `${GOOGLE_FIT_API_BASE}/dataset:aggregate`;
      const stepsResponse = await fetch(stepsUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          aggregateBy: [
            {
              // Use specific data source ID instead of generic type name
              dataSourceId: DATA_SOURCES.STEPS,
            },
            {
              dataSourceId: DATA_SOURCES.DISTANCE,
            },
            {
              dataSourceId: DATA_SOURCES.CALORIES,
            },
          ],
          bucketByTime: { durationMillis: 86400000 }, // 1 day
          startTimeMillis,
          endTimeMillis,
        }),
      });

      if (!stepsResponse.ok) {
        const errorText = await stepsResponse.text();
        console.error(`Steps API Error (chunk ${i + 1}):`, errorText);
        throw new Error(
          `Google Fit API error: ${stepsResponse.status} - ${errorText}`
        );
      }

      const data = await stepsResponse.json();

      // Process buckets
      if (data.bucket) {
        for (const bucket of data.bucket) {
          const dateStr = nanosToDateString(bucket.startTimeMillis + "000000");

          let steps = 0;
          let distance = 0;
          let calories = 0;

          for (const dataset of bucket.dataset) {
            for (const point of dataset.point) {
              // Check by data source ID instead of just checking if it "includes" a keyword
              if (dataset.dataSourceId === DATA_SOURCES.STEPS) {
                steps += point.value[0]?.intVal || 0;
              } else if (dataset.dataSourceId === DATA_SOURCES.DISTANCE) {
                distance += point.value[0]?.fpVal || 0;
              } else if (dataset.dataSourceId === DATA_SOURCES.CALORIES) {
                calories += point.value[0]?.fpVal || 0;
              }
            }
          }

          // Only store if we have valid data
          if (steps > 0 || distance > 0 || calories > 0) {
            stepsData[dateStr] = { steps, distance, calories };
          }
        }
      }

      // Small delay between chunks
      if (i < chunks - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    console.log(`   ✅ Fetched ${Object.keys(stepsData).length} days with data`);
    return stepsData;
  });
}

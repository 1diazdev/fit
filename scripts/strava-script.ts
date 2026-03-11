import {
  needsBootstrap,
  mergeByDateKey,
  mergeByUniqueId,
  saveJSON,
  loadJSON,
  calculateDataRange,
  getDateRangeString,
} from "./lib/jsonMerger";

// Define interfaces for Strava API responses
interface StravaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  token_type: string;
  // Add other properties if available and needed
}

interface StravaActivity {
  id: number;
  name: string;
  distance: number;
  start_date: string; // ISO 8601 date string
  type: string;
  sport_type: string;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  start_latlng?: [number, number];
  end_latlng?: [number, number];
  map?: {
    summary_polyline?: string;
  };
}

interface StravaData {
  distances: Record<string, number>;
  activities: StravaActivity[];
  lastUpdated?: string;
  source?: string;
}

const STRAVA_CLIENT_ID: string = process.env.STRAVA_CLIENT_ID!;
const STRAVA_CLIENT_SECRET: string = process.env.STRAVA_CLIENT_SECRET!;
const STRAVA_REFRESH_TOKEN: string = process.env.STRAVA_REFRESH_TOKEN!;

if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET || !STRAVA_REFRESH_TOKEN) {
  console.error("❌ Missing STRAVA credentials in environment variables");
  process.exit(1);
}

const getBearerToken = async (): Promise<string> => {
  const response = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      refresh_token: STRAVA_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });

  const data: StravaTokenResponse = await response.json();
  if (!data.access_token) {
    throw new Error(`Strava auth failed: ${JSON.stringify(data)}`);
  }

  return `Bearer ${data.access_token}`;
};

const getAllActivities = async (
  bearer: string,
  days: number = 365,
): Promise<StravaActivity[]> => {
  const afterTimestamp = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;
  let page = 1;
  let all: StravaActivity[] = [];

  console.log(`  Fetching Strava activities (last ${days} days)...`);

  while (true) {
    const url = `https://www.strava.com/api/v3/athlete/activities?after=${afterTimestamp}&per_page=200&page=${page}`;
    const res = await fetch(url, {
      headers: { Authorization: bearer },
    });

    const data: StravaActivity[] | { message?: string; errors?: any[] } =
      await res.json();

    // Check for Strava API error response
    if (!Array.isArray(data)) {
      if ("message" in data && data.message === "Rate Limit Exceeded") {
        console.warn("Strava API rate limit exceeded. Please try again later.");
      } else {
        console.error("Failed to fetch activities:", data);
      }
      break;
    }

    if (data.length === 0) break;

    all = all.concat(data);
    page++;
  }

  return all;
};

interface DistanceMap {
  [key: string]: number;
}

const summarizeDistance = (activities: StravaActivity[]): DistanceMap => {
  const distance: DistanceMap = {};

  for (const activity of activities) {
    const date = new Date(activity.start_date);
    const estDate = new Date(date.getTime() - 5 * 60 * 60 * 1000); // UTC-5
    const key = `${estDate.getFullYear()}-${
      estDate.getMonth() + 1
    }-${estDate.getDate()}`;

    distance[key] = (distance[key] || 0) + activity.distance;
  }

  return distance;
};

const main = async (): Promise<void> => {
  console.log("🏃 Strava Data Fetch Script (Incremental)\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const outputPath = "public/last-activities.json"; // Keep same filename for compatibility

  try {
    // Step 1: Determine if we need bootstrap or incremental update
    const isBootstrap = await needsBootstrap({
      jsonPath: outputPath,
      maxStaleDays: 2,
    });

    // Step 2: Determine how many days to fetch
    const daysToFetch = isBootstrap ? 365 : 7;

    console.log(
      `\n🔄 Mode: ${isBootstrap ? "BOOTSTRAP (365 days)" : "INCREMENTAL (7 days)"}\n`,
    );

    const startTime = Date.now();

    // Step 3: Fetch new data
    const bearer = await getBearerToken();
    const newActivities = await getAllActivities(bearer, daysToFetch);
    const newDistanceMap = summarizeDistance(newActivities);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`  ✅ Fetched ${newActivities.length} activities in ${elapsed}s\n`);

    // Step 4: Load existing data and merge (if incremental)
    let finalDistances = newDistanceMap;
    let finalActivities = newActivities;

    if (!isBootstrap) {
      console.log("🔀 Merging with existing data...\n");
      const existingData = await loadJSON<StravaData>(outputPath);

      if (existingData) {
        // Merge distances by date (newer values overwrite)
        finalDistances = mergeByDateKey(
          existingData.distances || {},
          newDistanceMap,
        );

        // Merge activities by unique ID (preserves historical data)
        finalActivities = mergeByUniqueId(
          existingData.activities || [],
          newActivities,
          "id",
        );
      }
    }

    // Step 5: Calculate statistics
    const totalDistanceDays = calculateDataRange(finalDistances);
    const totalActivities = finalActivities.length;

    console.log("📊 Total Data Summary:");
    console.log(
      `   Distances: ${totalDistanceDays} days (${getDateRangeString(finalDistances)})`,
    );
    console.log(`   Activities: ${totalActivities} total\n`);

    // Step 6: Save with metadata
    const stravaData: StravaData = {
      distances: finalDistances,
      activities: finalActivities,
      lastUpdated: new Date().toISOString(),
      source: "Strava",
    };

    await saveJSON(outputPath, stravaData, {
      source: "Strava",
    });

    // Calculate file size
    const stats = await import("fs").then((fs) =>
      fs.promises.stat(outputPath),
    );
    const fileSizeKB = (stats.size / 1024).toFixed(2);
    console.log(`   File size: ${fileSizeKB} KB\n`);

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(
      `✨ Strava ${isBootstrap ? "bootstrap" : "incremental update"} complete!\n`,
    );
  } catch (err: any) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
};

main();

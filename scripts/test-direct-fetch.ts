/**
 * Test fetching directly from a specific data source (not aggregate)
 */

import { refreshAccessToken } from "../src/services/googleFitService-fixed";

const GOOGLE_FIT_API_BASE = "https://www.googleapis.com/fitness/v1/users/me";
const DATA_SOURCE =
  "derived:com.google.step_count.delta:com.google.android.gms:estimated_steps";

function nanosToDateString(nanos: string): string {
  const millis = parseInt(nanos) / 1000000;
  const date = new Date(millis);
  const nyDate = new Date(
    date.toLocaleString("en-US", { timeZone: "America/New_York" }),
  );
  const year = nyDate.getFullYear();
  const month = String(nyDate.getMonth() + 1).padStart(2, "0");
  const day = String(nyDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function main() {
  console.log("🧪 Testing DIRECT data source fetch\n");

  const refreshToken = process.env.GOOGLE_FIT_REFRESH_TOKEN;
  if (!refreshToken) {
    console.error("❌ No refresh token");
    process.exit(1);
  }

  const accessToken = await refreshAccessToken(refreshToken);

  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  console.log(`📊 Fetching from: ${DATA_SOURCE}\n`);

  // Fetch directly from the data source (not aggregate)
  const url = `${GOOGLE_FIT_API_BASE}/dataSources/${encodeURIComponent(DATA_SOURCE)}/datasets/${sevenDaysAgo * 1000000}-${now * 1000000}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    console.error(`❌ Error: ${response.statusText}`);
    const error = await response.text();
    console.error(error);
    process.exit(1);
  }

  const data = await response.json();
  const points = data.point || [];

  console.log(`✅ Found ${points.length} data points\n`);

  // Group by date
  const byDate: Record<string, number> = {};
  for (const point of points) {
    const dateStr = nanosToDateString(point.startTimeNanos);
    const value = point.value[0]?.intVal || point.value[0]?.fpVal || 0;
    byDate[dateStr] = (byDate[dateStr] || 0) + value;
  }

  console.log("Daily totals:");
  const dates = Object.keys(byDate).sort();
  for (const date of dates) {
    console.log(`   ${date}: ${byDate[date].toLocaleString()} steps`);
  }

  const total = Object.values(byDate).reduce((a, b) => a + b, 0);
  console.log(`\n   📊 Total: ${total.toLocaleString()} steps\n`);

  console.log("💡 Compare 3/10 with your Google Fit app!");
  console.log(
    `   3/10 in this fetch: ${byDate["2026-03-10"]?.toLocaleString() || "0"} steps`,
  );
  console.log(`   Your Google Fit app: 34,891 steps\n`);
}

main();

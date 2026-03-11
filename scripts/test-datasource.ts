/**
 * Test specific data sources to find which has correct data
 */

import { refreshAccessToken } from "../src/services/googleFitService";

const GOOGLE_FIT_API_BASE = "https://www.googleapis.com/fitness/v1/users/me";

async function testDataSource(accessToken: string, dataSourceId: string) {
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  const dataUrl = `${GOOGLE_FIT_API_BASE}/dataSources/${encodeURIComponent(dataSourceId)}/datasets/${sevenDaysAgo * 1000000}-${now * 1000000}`;

  try {
    const response = await fetch(dataUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      console.error(`❌ Error: ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    const points = data.point || [];

    // Group by date
    const byDate: Record<string, number> = {};
    for (const point of points) {
      const date = new Date(parseInt(point.startTimeNanos) / 1000000);
      const dateStr = date.toLocaleDateString("en-US", {
        timeZone: "America/New_York",
      });
      const value = point.value[0]?.intVal || point.value[0]?.fpVal || 0;
      byDate[dateStr] = (byDate[dateStr] || 0) + value;
    }

    return byDate;
  } catch (error) {
    console.error(`❌ Failed:`, error);
    return null;
  }
}

async function main() {
  console.log("🔍 Testing Google Fit Data Sources\n");

  const refreshToken = process.env.GOOGLE_FIT_REFRESH_TOKEN;
  if (!refreshToken) {
    console.error("❌ GOOGLE_FIT_REFRESH_TOKEN not found\n");
    process.exit(1);
  }

  const accessToken = await refreshAccessToken(refreshToken);

  // Test the main candidates
  const dataSources = [
    "derived:com.google.step_count.delta:com.google.android.fit:samsung:SM-S926U:b85f349c:top_level",
    "derived:com.google.step_count.delta:com.google.android.gms:estimated_steps",
    "derived:com.google.step_count.delta:com.google.android.gms:merge_step_deltas",
  ];

  console.log("Testing each data source for last 7 days:\n");

  for (const ds of dataSources) {
    console.log(`\n📊 ${ds.substring(0, 80)}...`);
    const data = await testDataSource(accessToken, ds);

    if (data) {
      const dates = Object.keys(data).sort();
      console.log("\nDaily totals:");
      for (const date of dates) {
        console.log(`   ${date}: ${data[date].toLocaleString()} steps`);
      }

      const total = Object.values(data).reduce((a, b) => a + b, 0);
      console.log(`\n   📊 Total: ${total.toLocaleString()} steps`);
    }
  }

  console.log("\n\n💡 Compare these totals with your Google Fit app!");
  console.log("The source with matching totals is the correct one.\n");
}

main();

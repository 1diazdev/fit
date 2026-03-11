/**
 * Compare Google Fit Data Script
 *
 * This script helps debug why Google Fit data doesn't match the mobile app
 * by showing all available data sources and their data
 */

import { refreshAccessToken } from "../src/services/googleFitService";

const GOOGLE_FIT_API_BASE = "https://www.googleapis.com/fitness/v1/users/me";

interface DataSource {
  dataStreamId: string;
  dataType: {
    name: string;
    field: Array<{ name: string; format: string }>;
  };
  type: string;
  device?: {
    manufacturer?: string;
    model?: string;
    type?: string;
  };
  application?: {
    name?: string;
  };
}

const main = async () => {
  console.log("🔍 Google Fit Data Comparison Tool\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const refreshToken = process.env.GOOGLE_FIT_REFRESH_TOKEN;

  if (!refreshToken) {
    console.error("❌ GOOGLE_FIT_REFRESH_TOKEN not found\n");
    process.exit(1);
  }

  try {
    console.log("🔑 Getting access token...\n");
    const accessToken = await refreshAccessToken(refreshToken);
    console.log("✅ Access token obtained\n");

    // 1. List ALL data sources
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📊 STEP 1: Available Data Sources\n");

    const dsResponse = await fetch(`${GOOGLE_FIT_API_BASE}/dataSources`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!dsResponse.ok) {
      throw new Error(`Failed to fetch data sources: ${dsResponse.statusText}`);
    }

    const dsData = await dsResponse.json();
    const dataSources: DataSource[] = dsData.dataSource || [];

    console.log(`Found ${dataSources.length} data sources\n`);

    // Filter step count sources
    const stepSources = dataSources.filter(
      (ds) =>
        ds.dataType.name === "com.google.step_count.delta" ||
        ds.dataType.name === "com.google.step_count.cumulative"
    );

    console.log("📍 Step Count Data Sources:\n");
    stepSources.forEach((ds, i) => {
      console.log(`${i + 1}. ${ds.dataStreamId}`);
      console.log(`   Type: ${ds.type}`);
      if (ds.device) {
        console.log(
          `   Device: ${ds.device.manufacturer || "Unknown"} ${ds.device.model || ""}`
        );
      }
      if (ds.application) {
        console.log(`   App: ${ds.application.name || "Unknown"}`);
      }
      console.log("");
    });

    // 2. Fetch data from EACH source for today
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📊 STEP 2: Data from Each Source (Last 7 Days)\n");

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    for (const source of stepSources) {
      console.log(`\n🔎 Fetching from: ${source.dataStreamId.substring(0, 60)}...`);

      const dataUrl = `${GOOGLE_FIT_API_BASE}/dataSources/${encodeURIComponent(source.dataStreamId)}/datasets/${sevenDaysAgo * 1000000}-${now * 1000000}`;

      try {
        const dataResponse = await fetch(dataUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (dataResponse.ok) {
          const data = await dataResponse.json();
          const points = data.point || [];

          console.log(`   ✅ Found ${points.length} data points`);

          if (points.length > 0) {
            // Show last 3 points
            console.log(`   Last 3 points:`);
            points.slice(-3).forEach((point: any) => {
              const date = new Date(parseInt(point.startTimeNanos) / 1000000);
              const value = point.value[0]?.intVal || point.value[0]?.fpVal || 0;
              console.log(
                `      ${date.toLocaleDateString()} ${date.toLocaleTimeString()}: ${value} steps`
              );
            });

            // Calculate total
            const total = points.reduce(
              (sum: number, point: any) =>
                sum + (point.value[0]?.intVal || point.value[0]?.fpVal || 0),
              0
            );
            console.log(`   📊 Total: ${total.toLocaleString()} steps`);
          }
        } else {
          console.log(`   ❌ Error: ${dataResponse.statusText}`);
        }
      } catch (error) {
        console.log(`   ❌ Failed to fetch: ${error}`);
      }
    }

    // 3. Test aggregate endpoint (what we actually use)
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📊 STEP 3: Aggregate Endpoint (What the App Uses)\n");

    const aggregateUrl = `${GOOGLE_FIT_API_BASE}/dataset:aggregate`;

    // Test different data type names
    const dataTypeVariants = [
      "com.google.step_count.delta",
      "com.google.step_count.cumulative",
    ];

    for (const dataTypeName of dataTypeVariants) {
      console.log(`\n🔎 Testing: ${dataTypeName}`);

      const aggResponse = await fetch(aggregateUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          aggregateBy: [{ dataTypeName }],
          bucketByTime: { durationMillis: 86400000 }, // 1 day
          startTimeMillis: sevenDaysAgo,
          endTimeMillis: now,
        }),
      });

      if (aggResponse.ok) {
        const data = await aggResponse.json();

        if (data.bucket && data.bucket.length > 0) {
          console.log(`   ✅ Found ${data.bucket.length} day buckets`);

          // Show each day
          data.bucket.forEach((bucket: any) => {
            const date = new Date(parseInt(bucket.startTimeMillis));
            let steps = 0;

            bucket.dataset.forEach((ds: any) => {
              ds.point.forEach((point: any) => {
                steps += point.value[0]?.intVal || 0;
              });
            });

            if (steps > 0) {
              console.log(
                `      ${date.toLocaleDateString()}: ${steps.toLocaleString()} steps`
              );
            }
          });
        } else {
          console.log(`   ⚠️  No data in buckets`);
        }
      } else {
        const error = await aggResponse.text();
        console.log(`   ❌ Error: ${error}`);
      }
    }

    // 4. Recommendations
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("💡 RECOMMENDATIONS\n");

    console.log("1. Check which data source has the most complete data");
    console.log("2. Compare totals with your Google Fit mobile app");
    console.log("3. The app may be using a specific device source (e.g., Zepp)");
    console.log(
      "4. Try using 'derived:...:merged' sources for most accurate data"
    );
    console.log("\n5. Common data sources:");
    console.log(
      "   - derived:com.google.step_count.delta:com.google.android.gms:estimated_steps"
    );
    console.log(
      "   - derived:com.google.step_count.delta:com.google.android.gms:merge_step_deltas"
    );
    console.log(
      "   - raw:com.google.step_count.delta:<device_specific>\n"
    );

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  }
};

main();

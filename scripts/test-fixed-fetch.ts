/**
 * Test the fixed Google Fit fetch that uses specific data sources
 */

import { fetchStepsDataFixed } from "../src/services/googleFitService-fixed";

async function main() {
  console.log("🧪 Testing Fixed Google Fit Fetch\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  try {
    console.log("📊 Fetching last 7 days with SPECIFIC data sources...\n");

    const stepsData = await fetchStepsDataFixed(7);

    console.log("\n✅ Results:\n");

    const dates = Object.keys(stepsData).sort();
    for (const date of dates) {
      const data = stepsData[date];
      console.log(
        `   ${date}: ${data.steps.toLocaleString()} steps, ${(data.distance / 1000).toFixed(2)} km, ${Math.round(data.calories)} cal`
      );
    }

    const totalSteps = dates.reduce((sum, date) => sum + stepsData[date].steps, 0);
    console.log(`\n   📊 Total: ${totalSteps.toLocaleString()} steps`);

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("\n💡 Compare with your Google Fit app!");
    console.log("   The numbers should now match! ✅\n");
  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  }
}

main();

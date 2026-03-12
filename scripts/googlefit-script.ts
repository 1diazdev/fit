/**
 * Google Fit Daily Data Fetch Script
 *
 * Fetches health data from Google Fit API and saves to public/health-data.json
 *
 * This script should be run daily (via Netlify/Vercel Cron or GitHub Actions)
 * to keep health data up-to-date.
 *
 * Data fetched:
 *   - Steps, distance, calories (365 days)
 *   - Sleep data (90 days)
 *   - Heart rate (30 days)
 *   - Move minutes: active & heart minutes (30 days)
 *   - Heart rate zones (30 days)
 *
 * Usage:
 *   bun run googlefit-script
 *
 * Requirements:
 *   - GOOGLE_FIT_REFRESH_TOKEN must be set in environment variables
 *   - Run googlefit-setup script first if you don't have a refresh token
 */

import {
  fetchStepsData,
  fetchSleepData,
  fetchHeartRateData,
  fetchMoveMinutesData,
  fetchHeartRateZones,
} from "../src/services/googleFitService";
import {
  needsBootstrap,
  mergeByDateKey,
  saveJSON,
  loadJSON,
  calculateDataRange,
  getDateRangeString,
} from "./lib/jsonMerger";

interface HealthData {
  steps: any;
  sleep: any;
  heartRate: any;
  moveMinutes: any;
  heartRateZones: any;
  lastUpdated: string;
  source: string;
  dataRange: {
    stepsDays: number;
    sleepDays: number;
    heartRateDays: number;
    moveMinutesDays: number;
    heartRateZonesDays: number;
  };
}

const main = async (): Promise<void> => {
  console.log("📊 Google Fit Health Data Fetch Script (Incremental)\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Verify refresh token exists
  const refreshToken = process.env.GOOGLE_FIT_REFRESH_TOKEN;
  if (!refreshToken) {
    console.error(
      "❌ Error: GOOGLE_FIT_REFRESH_TOKEN not found in environment variables\n",
    );
    console.log("💡 Run the setup script first:");
    console.log("   bun run googlefit-setup\n");
    process.exit(1);
  }

  console.log("✅ Refresh token found");
  console.log(`   Token: ${refreshToken.substring(0, 20)}...\n`);

  const outputPath = "public/health-data.json";

  try {
    // Step 1: Determine if we need bootstrap or incremental update
    const isBootstrap = await needsBootstrap({
      jsonPath: outputPath,
      maxStaleDays: 2,
    });

    // Step 2: Determine how many days to fetch
    const stepsDays = isBootstrap ? 90 : 7;
    const sleepDays = isBootstrap ? 90 : 7;
    const hrDays = isBootstrap ? 30 : 7;
    const moveDays = isBootstrap ? 30 : 7;
    const zonesDays = isBootstrap ? 30 : 7;

    console.log(
      `\n🔄 Mode: ${isBootstrap ? "BOOTSTRAP (full fetch)" : "INCREMENTAL (recent only)"}\n`,
    );
    console.log(`  📈 Fetching steps data (${stepsDays} days)...`);
    console.log(`  😴 Fetching sleep data (${sleepDays} days)...`);
    console.log(`  ❤️  Fetching heart rate data (${hrDays} days)...`);
    console.log(`  🏃 Fetching move minutes (${moveDays} days)...`);
    console.log(`  🎯 Fetching heart rate zones (${zonesDays} days)...\n`);

    const startTime = Date.now();

    // Step 3: Fetch new data
    const [
      newStepsData,
      newSleepData,
      newHeartRateData,
      newMoveMinutesData,
      newHeartRateZonesData,
    ] = await Promise.all([
      fetchStepsData(stepsDays),
      fetchSleepData(sleepDays),
      fetchHeartRateData(hrDays),
      fetchMoveMinutesData(moveDays),
      fetchHeartRateZones(zonesDays, 30),
    ]);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Data fetched successfully in ${elapsed}s\n`);

    // Step 4: Load existing data (if incremental)
    let finalStepsData = newStepsData;
    let finalSleepData = newSleepData;
    let finalHeartRateData = newHeartRateData;
    let finalMoveMinutesData = newMoveMinutesData;
    let finalHeartRateZonesData = newHeartRateZonesData;

    if (!isBootstrap) {
      console.log("🔀 Merging with existing data...\n");
      const existingData = await loadJSON<HealthData>(outputPath);

      if (existingData) {
        finalStepsData = mergeByDateKey(existingData.steps || {}, newStepsData);
        finalSleepData = mergeByDateKey(existingData.sleep || {}, newSleepData);
        finalHeartRateData = mergeByDateKey(
          existingData.heartRate || {},
          newHeartRateData,
        );
        finalMoveMinutesData = mergeByDateKey(
          existingData.moveMinutes || {},
          newMoveMinutesData,
        );
        finalHeartRateZonesData = mergeByDateKey(
          existingData.heartRateZones || {},
          newHeartRateZonesData,
        );
      }
    }

    // Step 5: Calculate statistics
    const totalStepsDays = calculateDataRange(finalStepsData);
    const totalSleepDays = calculateDataRange(finalSleepData);
    const totalHrDays = calculateDataRange(finalHeartRateData);
    const totalMoveDays = calculateDataRange(finalMoveMinutesData);
    const totalZonesDays = calculateDataRange(finalHeartRateZonesData);

    console.log("📊 Total Data Summary:");
    console.log(
      `   Steps: ${totalStepsDays} days (${getDateRangeString(finalStepsData)})`,
    );
    console.log(
      `   Sleep: ${totalSleepDays} days (${getDateRangeString(finalSleepData)})`,
    );
    console.log(
      `   Heart rate: ${totalHrDays} days (${getDateRangeString(finalHeartRateData)})`,
    );
    console.log(
      `   Move minutes: ${totalMoveDays} days (${getDateRangeString(finalMoveMinutesData)})`,
    );
    console.log(
      `   HR zones: ${totalZonesDays} days (${getDateRangeString(finalHeartRateZonesData)})\n`,
    );

    // Calculate quick stats from recent data
    if (totalStepsDays > 0) {
      const totalSteps = Object.values(finalStepsData).reduce(
        (sum, day: any) => sum + day.steps,
        0,
      );
      const avgSteps = Math.round(totalSteps / totalStepsDays);
      console.log(`   Average daily steps: ${avgSteps.toLocaleString()}`);

      const totalDistance = Object.values(finalStepsData).reduce(
        (sum, day: any) => sum + day.distance,
        0,
      );
      const avgDistance = (totalDistance / totalStepsDays / 1000).toFixed(2);
      console.log(`   Average daily distance: ${avgDistance} km`);
    }

    if (totalSleepDays > 0) {
      const totalSleep = Object.values(finalSleepData).reduce(
        (sum, day: any) => sum + day.totalMinutes,
        0,
      );
      const avgSleep = Math.round(totalSleep / totalSleepDays);
      const avgHours = Math.floor(avgSleep / 60);
      const avgMinutes = avgSleep % 60;
      console.log(`   Average sleep: ${avgHours}h ${avgMinutes}m per night`);
    }

    if (totalHrDays > 0) {
      const avgHeartRates = Object.values(finalHeartRateData)
        .map((day: any) => day.avg)
        .filter(hr => hr > 0);
      if (avgHeartRates.length > 0) {
        const overallAvg = Math.round(
          avgHeartRates.reduce((a, b) => a + b, 0) / avgHeartRates.length,
        );
        console.log(`   Average heart rate: ${overallAvg} bpm`);
      }
    }

    // Step 6: Prepare data with metadata
    const healthData: HealthData = {
      steps: finalStepsData,
      sleep: finalSleepData,
      heartRate: finalHeartRateData,
      moveMinutes: finalMoveMinutesData,
      heartRateZones: finalHeartRateZonesData,
      lastUpdated: new Date().toISOString(),
      source: "Google Fit",
      dataRange: {
        stepsDays: totalStepsDays,
        sleepDays: totalSleepDays,
        heartRateDays: totalHrDays,
        moveMinutesDays: totalMoveDays,
        heartRateZonesDays: totalZonesDays,
      },
    };

    // Step 7: Save to JSON with metadata
    await saveJSON(outputPath, healthData, {
      source: "Google Fit",
      dataRange: {
        stepsDays: totalStepsDays,
        sleepDays: totalSleepDays,
        heartRateDays: totalHrDays,
        moveMinutesDays: totalMoveDays,
        heartRateZonesDays: totalZonesDays,
      },
    });

    // Calculate file size
    const stats = await import("fs").then(fs => fs.promises.stat(outputPath));
    const fileSizeKB = (stats.size / 1024).toFixed(2);
    console.log(`   File size: ${fileSizeKB} KB\n`);

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(
      `✨ Google Fit ${isBootstrap ? "bootstrap" : "incremental update"} complete!\n`,
    );

    console.log("📝 Data is now available at:");
    console.log("   - public/health-data.json (for Astro components)");
    console.log("   - Synced from your Google Fit account");
    console.log(
      `   - ${isBootstrap ? "Full historical data loaded" : "Latest data merged with existing"}\n`,
    );
  } catch (error) {
    console.error("\n❌ Error fetching Google Fit data:\n");
    if (error instanceof Error) {
      console.error(`   ${error.message}\n`);

      if (error.message.includes("401") || error.message.includes("403")) {
        console.log("💡 Authentication error:");
        console.log("   - Your refresh token may have expired");
        console.log("   - Try regenerating it with: bun run googlefit-setup");
        console.log("   - Make sure you granted all required permissions\n");
      } else if (error.message.includes("GOOGLE_FIT_REFRESH_TOKEN")) {
        console.log("💡 Missing refresh token:");
        console.log("   - Run: bun run googlefit-setup\n");
      }
    } else {
      console.error("   Unknown error occurred\n");
    }

    console.log("💡 General troubleshooting:");
    console.log("   - Check your internet connection");
    console.log("   - Verify Google Fit API is enabled in Cloud Console");
    console.log("   - Check API quotas in Google Cloud Console\n");

    process.exit(1);
  }
};

// Run the script
main();

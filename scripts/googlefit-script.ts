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

import { writeFile } from 'fs/promises';
import {
  fetchStepsData,
  fetchSleepData,
  fetchHeartRateData,
  fetchMoveMinutesData,
  fetchHeartRateZones,
} from '../src/services/googleFitService';

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
  console.log('📊 Google Fit Health Data Fetch Script\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Verify refresh token exists
  const refreshToken = process.env.GOOGLE_FIT_REFRESH_TOKEN;
  if (!refreshToken) {
    console.error('❌ Error: GOOGLE_FIT_REFRESH_TOKEN not found in environment variables\n');
    console.log('💡 Run the setup script first:');
    console.log('   bun run googlefit-setup\n');
    process.exit(1);
  }

  console.log('✅ Refresh token found');
  console.log(`   Token: ${refreshToken.substring(0, 20)}...\n`);

  try {
    console.log('🔄 Fetching health data from Google Fit API...\n');

    console.log('  📈 Fetching steps data (365 days)...');
    console.log('  😴 Fetching sleep data (90 days - API limit)...');
    console.log('  ❤️  Fetching heart rate data (30 days)...');
    console.log('  🏃 Fetching move minutes (30 days)...');
    console.log('  🎯 Fetching heart rate zones (30 days)...\n');

    const startTime = Date.now();

    const [stepsData, sleepData, heartRateData, moveMinutesData, heartRateZonesData] = await Promise.all([
      fetchStepsData(365),
      fetchSleepData(90), // Limited to 90 days due to API constraints
      fetchHeartRateData(30),
      fetchMoveMinutesData(30),
      fetchHeartRateZones(30, 30), // 30 days, age 30 (adjust age as needed)
    ]);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`✅ Data fetched successfully in ${elapsed}s\n`);

    // Count data points
    const stepsDays = Object.keys(stepsData).length;
    const sleepDays = Object.keys(sleepData).length;
    const hrDays = Object.keys(heartRateData).length;
    const moveDays = Object.keys(moveMinutesData).length;
    const zonesDays = Object.keys(heartRateZonesData).length;

    console.log('📊 Data Summary:');
    console.log(`   Steps data: ${stepsDays} days`);
    console.log(`   Sleep data: ${sleepDays} days`);
    console.log(`   Heart rate data: ${hrDays} days`);
    console.log(`   Move minutes: ${moveDays} days`);
    console.log(`   HR zones: ${zonesDays} days\n`);

    // Calculate some quick stats
    if (stepsDays > 0) {
      const totalSteps = Object.values(stepsData).reduce((sum, day: any) => sum + day.steps, 0);
      const avgSteps = Math.round(totalSteps / stepsDays);
      console.log(`   Average daily steps: ${avgSteps.toLocaleString()}`);

      const totalDistance = Object.values(stepsData).reduce((sum, day: any) => sum + day.distance, 0);
      const avgDistance = (totalDistance / stepsDays / 1000).toFixed(2);
      console.log(`   Average daily distance: ${avgDistance} km`);
    }

    if (sleepDays > 0) {
      const totalSleep = Object.values(sleepData).reduce((sum, day: any) => sum + day.totalMinutes, 0);
      const avgSleep = Math.round(totalSleep / sleepDays);
      const avgHours = Math.floor(avgSleep / 60);
      const avgMinutes = avgSleep % 60;
      console.log(`   Average sleep: ${avgHours}h ${avgMinutes}m per night`);
    }

    if (hrDays > 0) {
      const avgHeartRates = Object.values(heartRateData).map((day: any) => day.avg).filter(hr => hr > 0);
      if (avgHeartRates.length > 0) {
        const overallAvg = Math.round(avgHeartRates.reduce((a, b) => a + b, 0) / avgHeartRates.length);
        console.log(`   Average heart rate: ${overallAvg} bpm`);
      }
    }

    if (moveDays > 0) {
      const totalActive = Object.values(moveMinutesData).reduce((sum, day: any) => sum + day.activeMinutes, 0);
      const avgActive = Math.round(totalActive / moveDays);
      console.log(`   Average active minutes: ${avgActive} min/day`);

      const totalHeart = Object.values(moveMinutesData).reduce((sum, day: any) => sum + day.heartMinutes, 0);
      const avgHeart = Math.round(totalHeart / moveDays);
      console.log(`   Average heart minutes: ${avgHeart} min/day`);
    }

    if (zonesDays > 0) {
      const totalZoneMinutes = Object.values(heartRateZonesData).reduce(
        (sum, day: any) => sum + day.totalActiveMinutes, 0
      );
      const avgZoneMinutes = Math.round(totalZoneMinutes / zonesDays);
      console.log(`   Average time in HR zones: ${avgZoneMinutes} min/day`);
    }

    // Prepare data for JSON
    const healthData: HealthData = {
      steps: stepsData,
      sleep: sleepData,
      heartRate: heartRateData,
      moveMinutes: moveMinutesData,
      heartRateZones: heartRateZonesData,
      lastUpdated: new Date().toISOString(),
      source: 'Google Fit',
      dataRange: {
        stepsDays,
        sleepDays,
        heartRateDays: hrDays,
        moveMinutesDays: moveDays,
        heartRateZonesDays: zonesDays,
      },
    };

    // Write to public directory
    const outputPath = 'public/health-data.json';
    await writeFile(outputPath, JSON.stringify(healthData, null, 2));

    console.log(`\n✅ Health data saved to ${outputPath}`);

    // Calculate file size
    const stats = await import('fs').then(fs => fs.promises.stat(outputPath));
    const fileSizeKB = (stats.size / 1024).toFixed(2);
    console.log(`   File size: ${fileSizeKB} KB\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✨ Google Fit data fetch complete!\n');

    console.log('📝 Data is now available at:');
    console.log('   - public/health-data.json (for Astro components)');
    console.log('   - Synced from your Google Fit account');
    console.log('   - Includes data from Zepp and other connected apps\n');
  } catch (error) {
    console.error('\n❌ Error fetching Google Fit data:\n');
    if (error instanceof Error) {
      console.error(`   ${error.message}\n`);

      if (error.message.includes('401') || error.message.includes('403')) {
        console.log('💡 Authentication error:');
        console.log('   - Your refresh token may have expired');
        console.log('   - Try regenerating it with: bun run googlefit-setup');
        console.log('   - Make sure you granted all required permissions\n');
      } else if (error.message.includes('GOOGLE_FIT_REFRESH_TOKEN')) {
        console.log('💡 Missing refresh token:');
        console.log('   - Run: bun run googlefit-setup\n');
      }
    } else {
      console.error('   Unknown error occurred\n');
    }

    console.log('💡 General troubleshooting:');
    console.log('   - Check your internet connection');
    console.log('   - Verify Google Fit API is enabled in Cloud Console');
    console.log('   - Check API quotas in Google Cloud Console\n');

    process.exit(1);
  }
};

// Run the script
main();

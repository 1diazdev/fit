/**
 * Zepp/Amazfit Daily Data Fetch Script
 *
 * Fetches health data from Zepp API and saves to public/zepp-health-data.json
 *
 * This script should be run daily (automatically via GitHub Actions or Netlify/Vercel Cron)
 * to keep health data up-to-date.
 *
 * Usage:
 *   bun run zepp-script
 *
 * Requirements:
 *   - ZEPP_REFRESH_TOKEN must be set in environment variables
 *   - Run zepp-setup script first if you don't have a refresh token
 */

import { writeFile } from 'fs/promises';
import {
  fetchStepsData,
  fetchSleepData,
  fetchHeartRateData,
} from '../src/services/zeppService';

interface HealthData {
  steps: any;
  sleep: any;
  heartRate: any;
  lastUpdated: string;
  dataRange: {
    stepsDays: number;
    sleepDays: number;
    heartRateDays: number;
  };
}

const main = async (): Promise<void> => {
  console.log('📊 Zepp Health Data Fetch Script\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Verify refresh token exists
  const refreshToken = process.env.ZEPP_REFRESH_TOKEN;
  if (!refreshToken) {
    console.error('❌ Error: ZEPP_REFRESH_TOKEN not found in environment variables\n');
    console.log('💡 Run the setup script first:');
    console.log('   bun run zepp-setup\n');
    process.exit(1);
  }

  console.log('✅ Refresh token found');
  console.log(`   Token: ${refreshToken.substring(0, 20)}...\n`);

  try {
    console.log('🔄 Fetching health data from Zepp API...\n');

    // Fetch data in parallel for efficiency
    console.log('  📈 Fetching steps data (365 days)...');
    console.log('  😴 Fetching sleep data (365 days)...');
    console.log('  ❤️  Fetching heart rate data (30 days)...\n');

    const startTime = Date.now();

    const [stepsData, sleepData, heartRateData] = await Promise.all([
      fetchStepsData(365),
      fetchSleepData(365),
      fetchHeartRateData(30),
    ]);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`✅ Data fetched successfully in ${elapsed}s\n`);

    // Count data points
    const stepsDays = Object.keys(stepsData).length;
    const sleepDays = Object.keys(sleepData).length;
    const hrDays = Object.keys(heartRateData).length;

    console.log('📊 Data Summary:');
    console.log(`   Steps data: ${stepsDays} days`);
    console.log(`   Sleep data: ${sleepDays} days`);
    console.log(`   Heart rate data: ${hrDays} days\n`);

    // Calculate some quick stats
    if (stepsDays > 0) {
      const totalSteps = Object.values(stepsData).reduce((sum, day: any) => sum + day.steps, 0);
      const avgSteps = Math.round(totalSteps / stepsDays);
      console.log(`   Average daily steps: ${avgSteps.toLocaleString()}`);
    }

    if (sleepDays > 0) {
      const totalSleep = Object.values(sleepData).reduce((sum, day: any) => sum + day.totalMinutes, 0);
      const avgSleep = Math.round(totalSleep / sleepDays);
      const avgHours = Math.floor(avgSleep / 60);
      const avgMinutes = avgSleep % 60;
      console.log(`   Average sleep: ${avgHours}h ${avgMinutes}m per night`);
    }

    // Prepare data for JSON
    const healthData: HealthData = {
      steps: stepsData,
      sleep: sleepData,
      heartRate: heartRateData,
      lastUpdated: new Date().toISOString(),
      dataRange: {
        stepsDays,
        sleepDays,
        heartRateDays: hrDays,
      },
    };

    // Write to public directory
    const outputPath = 'public/zepp-health-data.json';
    await writeFile(outputPath, JSON.stringify(healthData, null, 2));

    console.log(`\n✅ Health data saved to ${outputPath}`);

    // Calculate file size
    const stats = await import('fs').then(fs => fs.promises.stat(outputPath));
    const fileSizeKB = (stats.size / 1024).toFixed(2);
    console.log(`   File size: ${fileSizeKB} KB\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✨ Zepp data fetch complete!\n');
  } catch (error) {
    console.error('\n❌ Error fetching Zepp data:\n');
    if (error instanceof Error) {
      console.error(`   ${error.message}\n`);
    } else {
      console.error('   Unknown error occurred\n');
    }

    console.log('💡 Troubleshooting:');
    console.log('   - Verify ZEPP_REFRESH_TOKEN is correct and not expired');
    console.log('   - Check your internet connection');
    console.log('   - The Zepp API may be temporarily unavailable');
    console.log('   - Try regenerating your refresh token with: bun run zepp-setup\n');

    process.exit(1);
  }
};

// Run the script
main();

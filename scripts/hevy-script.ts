/**
 * Hevy Daily Data Fetch Script
 *
 * Fetches workout data from Hevy API and saves to public/hevy-data.json
 *
 * Usage:
 *   bun run hevy-script
 *
 * Requirements:
 *   - HEVY_API_KEY must be set in environment variables
 */

import { writeFile } from "fs/promises";
import { fetchHevyData, fetchWorkoutCount } from "../src/services/hevyService";

interface HevyDataOutput {
  workouts: any[];
  workoutCount: number;
  lastUpdated: string;
  source: string;
}

const main = async (): Promise<void> => {
  console.log("💪 Hevy Workout Data Fetch Script\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const apiKey = process.env.HEVY_API_KEY;
  if (!apiKey) {
    console.error(
      "❌ Error: HEVY_API_KEY not found in environment variables\n",
    );
    console.log("💡 Add your API key to your .env file:");
    console.log("   HEVY_API_KEY=hvy_your_actual_api_key_here\n");
    process.exit(1);
  }

  console.log("✅ API key found");
  console.log(
    `   Key: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}\n`,
  );

  try {
    console.log("🔄 Fetching workout data from Hevy API...\n");

    const startTime = Date.now();

    const [workouts, workoutCount] = await Promise.all([
      fetchHevyData(apiKey),
      fetchWorkoutCount(apiKey),
    ]);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`✅ Data fetched successfully in ${elapsed}s\n`);

    console.log("📊 Data Summary:");
    console.log(`   Total workouts: ${workoutCount}`);
    console.log(`   Workouts fetched: ${workouts.length}`);

    if (workouts.length > 0) {
      const lastWorkout = workouts[0];
      console.log(`   Last workout: ${lastWorkout.title}`);
      console.log(
        `   Date: ${new Date(lastWorkout.start_time).toLocaleDateString()}`,
      );
      console.log(`   Exercises: ${lastWorkout.exercises.length}\n`);
    }

    // Prepare data for JSON
    const hevyData: HevyDataOutput = {
      workouts,
      workoutCount,
      lastUpdated: new Date().toISOString(),
      source: "Hevy",
    };

    // Write to public directory
    const outputPath = "public/hevy-data.json";
    await writeFile(outputPath, JSON.stringify(hevyData, null, 2));

    console.log(`✅ Hevy data saved to ${outputPath}`);

    // Calculate file size
    const stats = await import("fs").then(fs => fs.promises.stat(outputPath));
    const fileSizeKB = (stats.size / 1024).toFixed(2);
    console.log(`   File size: ${fileSizeKB} KB\n`);

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✨ Hevy data fetch complete!\n");
  } catch (error) {
    console.error("\n❌ Error fetching Hevy data:\n");
    if (error instanceof Error) {
      console.error(`   ${error.message}\n`);

      if (
        error.message.includes("401") ||
        error.message.includes("Authentication")
      ) {
        console.log("💡 Authentication error:");
        console.log("   - Your API key may be invalid or expired");
        console.log("   - Get a new API key from Hevy app settings\n");
      }
    } else {
      console.error("   Unknown error occurred\n");
    }

    process.exit(1);
  }
};

// Run the script
main();

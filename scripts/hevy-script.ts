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

import { fetchHevyData, fetchWorkoutCount } from "../src/services/hevyService";
import {
  needsBootstrap,
  mergeByUniqueId,
  saveJSON,
  loadJSON,
} from "./lib/jsonMerger";

interface HevyDataOutput {
  workouts: any[];
  workoutCount: number;
  lastUpdated: string;
  source: string;
}

const main = async (): Promise<void> => {
  console.log("💪 Hevy Workout Data Fetch Script (Incremental)\n");
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

  const outputPath = "public/hevy-data.json";

  try {
    // Step 1: Check if we need to update
    // Note: Hevy API doesn't support date filtering, so we always fetch all
    // But we can skip if data was updated recently
    const isBootstrap = await needsBootstrap({
      jsonPath: outputPath,
      maxStaleDays: 2,
    });

    console.log(
      `\n🔄 Mode: ${isBootstrap ? "BOOTSTRAP (full fetch)" : "UPDATE (merge with existing)"}\n`,
    );

    // Step 2: Fetch data from Hevy API
    console.log("🔄 Fetching workout data from Hevy API...");
    console.log(
      "   Note: Hevy API returns all workouts (no date filtering)\n",
    );

    const startTime = Date.now();

    const [newWorkouts, workoutCount] = await Promise.all([
      fetchHevyData(apiKey),
      fetchWorkoutCount(apiKey),
    ]);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Fetched ${newWorkouts.length} workouts in ${elapsed}s\n`);

    // Step 3: Merge with existing data (preserves deleted workouts)
    let finalWorkouts = newWorkouts;

    if (!isBootstrap) {
      console.log("🔀 Merging with existing data...");
      console.log(
        "   This preserves workouts deleted from Hevy but keeps your history\n",
      );

      const existingData = await loadJSON<HevyDataOutput>(outputPath);

      if (existingData && existingData.workouts) {
        finalWorkouts = mergeByUniqueId(
          existingData.workouts,
          newWorkouts,
          "id",
        );
      }
    }

    // Step 4: Calculate statistics
    console.log("📊 Data Summary:");
    console.log(`   Total workouts in history: ${finalWorkouts.length}`);
    console.log(`   Workouts from API: ${newWorkouts.length}`);
    console.log(`   API reported count: ${workoutCount}`);

    if (finalWorkouts.length > 0) {
      const lastWorkout = finalWorkouts[0];
      console.log(`\n   Most recent workout: ${lastWorkout.title}`);
      console.log(
        `   Date: ${new Date(lastWorkout.start_time).toLocaleDateString()}`,
      );
      console.log(`   Exercises: ${lastWorkout.exercises.length}\n`);
    }

    // Step 5: Save with metadata
    const hevyData: HevyDataOutput = {
      workouts: finalWorkouts,
      workoutCount: finalWorkouts.length, // Use actual count
      lastUpdated: new Date().toISOString(),
      source: "Hevy",
    };

    await saveJSON(outputPath, hevyData, {
      source: "Hevy",
    });

    // Calculate file size
    const stats = await import("fs").then((fs) =>
      fs.promises.stat(outputPath),
    );
    const fileSizeKB = (stats.size / 1024).toFixed(2);
    console.log(`   File size: ${fileSizeKB} KB\n`);

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(
      `✨ Hevy ${isBootstrap ? "bootstrap" : "update"} complete!\n`,
    );
    console.log("💡 Historical workouts preserved even if deleted from Hevy\n");
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

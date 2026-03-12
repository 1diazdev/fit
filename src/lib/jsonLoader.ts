/**
 * Shared JSON Loader Utility
 *
 * This utility loads pre-generated JSON data files to avoid API calls during build.
 * All services and pages should use this to ensure consistent data loading.
 *
 * CRITICAL: Build process should NEVER call APIs directly - always use these loaders.
 */

import { readFile } from "fs/promises";
import { resolve } from "path";

export interface HealthData {
  steps: Record<string, { steps: number; distance: number; calories: number }>;
  sleep?: Record<string, any>;
  heartRate?: Record<string, any>;
  moveMinutes?: Record<string, any>;
  heartRateZones?: Record<string, any>;
  lastUpdated?: string;
  source?: string;
  dataRange?: {
    stepsDays?: number;
    sleepDays?: number;
  };
}

export interface StravaData {
  distances: Record<string, number>; // Date -> distance in meters
  activities?: Array<{
    id: number;
    name: string;
    distance: number;
    moving_time: number;
    elapsed_time: number;
    total_elevation_gain: number;
    type: string;
    sport_type: string;
    start_date: string;
    start_latlng?: [number, number];
    end_latlng?: [number, number];
    map?: {
      summary_polyline?: string;
    };
  }>;
  lastUpdated?: string;
  source?: string;
}

export interface HevyData {
  workouts: Array<{
    id: string;
    user_id?: string;
    title: string;
    description: string | null;
    routine_id?: string;
    start_time: string;
    end_time: string;
    created_at: string;
    updated_at: string;
    exercises: Array<any>; // Use any to match actual Hevy service Exercise interface
  }>;
  lastUpdated?: string;
  source?: string;
}

export interface AllData {
  health: HealthData;
  strava: StravaData;
  hevy: HevyData;
}

/**
 * Load all data from pre-generated JSON files
 * This is MUCH faster than calling APIs and prevents rate limits
 * Returns null if JSONs don't exist (will fallback to empty data)
 */
export async function loadAllDataFromJSON(): Promise<AllData | null> {
  const cwd = process.cwd();

  try {
    console.log("[JSONLoader] Loading from JSON files...");

    // Load health data (Google Fit)
    let healthData: HealthData = { steps: {} };
    try {
      const healthPath = resolve(cwd, "public", "health-data.json");
      const healthRaw = await readFile(healthPath, "utf-8");
      healthData = JSON.parse(healthRaw);
    } catch {
      console.warn("[JSONLoader] health-data.json not found, using empty data");
    }

    // Load Strava data
    let stravaData: StravaData = { distances: {} };
    try {
      const stravaPath = resolve(cwd, "public", "last-activities.json");
      const stravaRaw = await readFile(stravaPath, "utf-8");
      const distances = JSON.parse(stravaRaw);

      // Old format: just distances object
      // New format (future): { distances: {...}, activities: [...] }
      if (typeof distances === "object" && !Array.isArray(distances)) {
        if (distances.distances) {
          // New format
          stravaData = distances as StravaData;
        } else {
          // Old format - just distances
          stravaData = { distances };
        }
      }
    } catch {
      console.warn(
        "[JSONLoader] last-activities.json not found, using empty data",
      );
    }

    // Load Hevy data
    let hevyData: HevyData = { workouts: [] };
    try {
      const hevyPath = resolve(cwd, "public", "hevy-data.json");
      const hevyRaw = await readFile(hevyPath, "utf-8");
      hevyData = JSON.parse(hevyRaw);
    } catch {
      console.warn("[JSONLoader] hevy-data.json not found, using empty data");
    }

    console.log("[JSONLoader] ✅ Loaded all data from JSON files");

    return {
      health: healthData,
      strava: stravaData,
      hevy: hevyData,
    };
  } catch (error) {
    console.error("[JSONLoader] Error loading JSON files:", error);
    return null;
  }
}

/**
 * Load only health data from JSON
 */
export async function loadHealthDataFromJSON(): Promise<HealthData | null> {
  const cwd = process.cwd();

  try {
    const healthPath = resolve(cwd, "public", "health-data.json");
    const healthRaw = await readFile(healthPath, "utf-8");
    return JSON.parse(healthRaw);
  } catch (error) {
    console.warn("[JSONLoader] Could not load health-data.json:", error);
    return null;
  }
}

/**
 * Load only Strava data from JSON
 */
export async function loadStravaDataFromJSON(): Promise<StravaData | null> {
  const cwd = process.cwd();

  try {
    const stravaPath = resolve(cwd, "public", "last-activities.json");
    const stravaRaw = await readFile(stravaPath, "utf-8");
    const data = JSON.parse(stravaRaw);

    // Handle old format (just distances object) vs new format
    if (data.distances) {
      return data as StravaData;
    } else {
      return { distances: data };
    }
  } catch (error) {
    console.warn("[JSONLoader] Could not load last-activities.json:", error);
    return null;
  }
}

/**
 * Load only Hevy data from JSON
 */
export async function loadHevyDataFromJSON(): Promise<HevyData | null> {
  const cwd = process.cwd();

  try {
    const hevyPath = resolve(cwd, "public", "hevy-data.json");
    const hevyRaw = await readFile(hevyPath, "utf-8");
    return JSON.parse(hevyRaw);
  } catch (error) {
    console.warn("[JSONLoader] Could not load hevy-data.json:", error);
    return null;
  }
}

/**
 * JSON Merger Utilities for Incremental Data Updates
 *
 * These utilities enable scripts to fetch only recent data (7 days)
 * and merge it with existing JSON files, instead of fetching all
 * historical data (90+ days) on every run.
 *
 * Key concepts:
 * - Bootstrap: First run or when data is stale (fetch 90+ days)
 * - Incremental: Daily updates (fetch only last 7 days)
 */

import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";

// ============================================================================
// TYPES
// ============================================================================

export interface BootstrapConfig {
  jsonPath: string;
  maxStaleDays?: number; // Days before we consider data too old (default: 2)
}

export interface MergeMetadata {
  lastUpdated: string; // ISO 8601 timestamp
  source: string; // e.g., "Google Fit", "Strava", "Hevy"
  dataRange?: {
    [key: string]: number; // e.g., { stepsDays: 365, sleepDays: 90 }
  };
}

// ============================================================================
// BOOTSTRAP DETECTION
// ============================================================================

/**
 * Determines if we need a full bootstrap (90+ days) or incremental update (7 days)
 *
 * Bootstrap is needed when:
 * 1. JSON file doesn't exist
 * 2. JSON is corrupted/unreadable
 * 3. JSON hasn't been updated in > maxStaleDays (default 2)
 *
 * @returns true if bootstrap needed, false if incremental update OK
 */
export async function needsBootstrap(
  config: BootstrapConfig,
): Promise<boolean> {
  const { jsonPath, maxStaleDays = 2 } = config;

  // Check 1: File exists?
  if (!existsSync(jsonPath)) {
    console.log(`🔄 BOOTSTRAP: JSON file doesn't exist (${jsonPath})`);
    return true;
  }

  try {
    // Check 2: File readable and valid JSON?
    const content = await readFile(jsonPath, "utf-8");
    const data = JSON.parse(content);

    // Check 3: Has lastUpdated field?
    if (!data.lastUpdated) {
      console.log("🔄 BOOTSTRAP: No lastUpdated field found");
      return true;
    }

    // Check 4: Is data stale?
    const lastUpdate = new Date(data.lastUpdated);
    const now = new Date();
    const daysSinceUpdate = Math.floor(
      (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysSinceUpdate > maxStaleDays) {
      console.log(
        `🔄 BOOTSTRAP: Data is stale (${daysSinceUpdate} days since last update)`,
      );
      return true;
    }

    console.log(
      `✅ INCREMENTAL: Data is fresh (updated ${daysSinceUpdate} day(s) ago)`,
    );
    return false;
  } catch (error) {
    console.log(`🔄 BOOTSTRAP: Error reading JSON (${error})`);
    return true;
  }
}

// ============================================================================
// MERGE STRATEGIES
// ============================================================================

/**
 * Merge data by date key (for time-series data like steps, sleep, HR)
 *
 * Strategy: New data overwrites existing data for the same date
 * This ensures we always have the latest values for each day
 *
 * @param existing - Existing data object { "2026-01-01": {...}, "2026-01-02": {...} }
 * @param newData - New data to merge in (same structure)
 * @returns Merged object with all dates
 */
export function mergeByDateKey<T extends Record<string, any>>(
  existing: T,
  newData: T,
): T {
  const merged = { ...existing };

  let addedCount = 0;
  let updatedCount = 0;

  for (const [date, value] of Object.entries(newData)) {
    if (merged[date]) {
      updatedCount++;
    } else {
      addedCount++;
    }
    merged[date] = value;
  }

  if (addedCount > 0 || updatedCount > 0) {
    console.log(
      `  📅 Merged by date: +${addedCount} new, ~${updatedCount} updated`,
    );
  }

  return merged;
}

/**
 * Merge data by unique ID (for entities like activities, workouts)
 *
 * Strategy: Preserves all unique items by ID, prevents duplicates
 * Useful for preserving historical data that might be deleted from source API
 *
 * @param existing - Existing array of items with unique IDs
 * @param newData - New array of items to merge
 * @param idField - Field name to use as unique ID (default: "id")
 * @returns Merged array with no duplicates, sorted by ID descending
 */
export function mergeByUniqueId<T extends Record<string, any>>(
  existing: T[],
  newData: T[],
  idField: string = "id",
): T[] {
  // Create a Map for efficient lookups
  const itemMap = new Map<any, T>();

  // Add existing items first
  for (const item of existing) {
    itemMap.set(item[idField], item);
  }

  let addedCount = 0;
  let updatedCount = 0;

  // Add/update with new items
  for (const item of newData) {
    const id = item[idField];
    if (itemMap.has(id)) {
      // Update existing (new data might have corrections)
      itemMap.set(id, item);
      updatedCount++;
    } else {
      // Add new
      itemMap.set(id, item);
      addedCount++;
    }
  }

  if (addedCount > 0 || updatedCount > 0) {
    console.log(
      `  🔑 Merged by ID: +${addedCount} new, ~${updatedCount} updated`,
    );
  }

  // Convert back to array and sort by ID descending (newest first)
  return Array.from(itemMap.values()).sort((a, b) => {
    const idA = a[idField];
    const idB = b[idField];
    if (typeof idA === "string" && typeof idB === "string") {
      return idB.localeCompare(idA);
    }
    return idB - idA;
  });
}

// ============================================================================
// SAVE UTILITIES
// ============================================================================

/**
 * Save JSON with metadata and pretty formatting
 *
 * @param filePath - Path to save JSON file
 * @param data - Data to save (will be merged with metadata)
 * @param metadata - Metadata to add (lastUpdated, source, etc.)
 */
export async function saveJSON(
  filePath: string,
  data: any,
  metadata: Partial<MergeMetadata> = {},
): Promise<void> {
  const enrichedData = {
    ...data,
    lastUpdated: metadata.lastUpdated || new Date().toISOString(),
    source: metadata.source || "Unknown",
    ...(metadata.dataRange && { dataRange: metadata.dataRange }),
  };

  await writeFile(filePath, JSON.stringify(enrichedData, null, 2), "utf-8");

  console.log(`💾 Saved to ${filePath}`);
  console.log(`   Last updated: ${enrichedData.lastUpdated}`);
  console.log(`   Source: ${enrichedData.source}`);
}

/**
 * Load existing JSON data (returns null if doesn't exist or is invalid)
 */
export async function loadJSON<T>(filePath: string): Promise<T | null> {
  try {
    if (!existsSync(filePath)) {
      return null;
    }
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch (error) {
    console.warn(`⚠️  Failed to load ${filePath}:`, error);
    return null;
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Calculate data range (how many days of data we have for each metric)
 */
export function calculateDataRange(data: Record<string, any>): number {
  return Object.keys(data).filter((key) => !key.startsWith("_")).length;
}

/**
 * Get date range string for logging
 */
export function getDateRangeString(data: Record<string, any>): string {
  const dates = Object.keys(data)
    .filter((key) => !key.startsWith("_"))
    .sort();

  if (dates.length === 0) return "No data";

  const oldest = dates[0];
  const newest = dates[dates.length - 1];

  if (oldest === newest) {
    return oldest;
  }

  return `${oldest} to ${newest} (${dates.length} days)`;
}

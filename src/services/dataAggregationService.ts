/**
 * Data Aggregation Service - OPTIMIZED VERSION
 *
 * Centralized service to aggregate all health and fitness data for any date.
 * READS FROM PRE-GENERATED JSON FILES for fast builds (no API calls!)
 * Only falls back to API calls if JSONs don't exist.
 */

import { memoize } from "@/lib/dataCache";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { StravaActivity } from "./stravaService";
import type { Workout as HevyWorkout } from "./hevyService";
import { fetchActivities } from "./stravaService";
import { fetchHevyData } from "./hevyService";
import { loadAllDataFromJSON } from "@lib/jsonLoader";
import {
  fetchStepsData,
  fetchSleepData,
  fetchHeartRateData,
  fetchMoveMinutesData,
  fetchHeartRateZones,
  type StepsData,
  type SleepData,
  type HeartRateData,
  type MoveMinutesData,
  type HeartRateZones,
} from "./googleFitService";

// ============================================================================
// INTERFACES
// ============================================================================

export interface DayData {
  date: string; // YYYY-MM-DD
  steps: {
    count: number;
    distance: number; // meters
    calories: number;
  };
  activities: StravaActivity[];
  workouts: HevyWorkout[];
  sleep: {
    totalMinutes: number;
    deepMinutes: number;
    lightMinutes: number;
    remMinutes: number;
    sleepScore: number;
  } | null;
  heartRate: {
    min: number;
    max: number;
    avg: number;
    resting: number;
  } | null;
  moveMinutes: {
    activeMinutes: number;
    heartMinutes: number;
  };
  heartRateZones: {
    zone1Minutes: number;
    zone2Minutes: number;
    zone3Minutes: number;
    zone4Minutes: number;
    zone5Minutes: number;
    totalActiveMinutes: number;
  } | null;
}

export interface ComparisonData {
  vsYesterday: {
    steps: number; // Difference (positive = more today)
    activities: number; // Difference
    sleepScore: number; // Difference
    heartMinutes: number; // Difference
  };
  vs7DayAvg: {
    steps: number; // Difference vs 7-day average
    heartMinutes: number; // Difference
    workouts: number; // Difference
    distance: number; // Difference (meters)
  };
  vs30DayAvg: {
    steps: number; // Difference vs 30-day average
    distance: number; // Difference (meters)
    calories: number; // Difference
  };
}

export interface StreakData {
  steps: {
    current: number; // Current streak of days with 10k+ steps
    longest: number; // Longest streak ever
  };
  activities: {
    current: number; // Current streak of days with activity
    longest: number; // Longest streak ever
  };
  workouts: {
    current: number; // Current streak of workout days
    longest: number; // Longest streak ever
  };
}

interface DummyHealthData {
  steps?: Record<string, { steps: number; distance: number; calories: number }>;
  heartRate?: Record<string, { resting: number; avg: number; max: number }>;
  moveMinutes?: Record<string, { active: number; heart: number }>;
  sleep?: Record<
    string,
    { duration: number; deep: number; light: number; rem: number }
  >;
}

const DUMMY_DATA_ENABLED =
  String(import.meta.env.USE_DUMMY_HEALTH_DATA || "").toLowerCase() === "true";
const DUMMY_DATA_FILE = String(
  import.meta.env.HEALTH_DATA_FILE || "health-data-dummy.json",
);

export interface TestModeSnapshot {
  stepsData: StepsData;
  moveMinutesData: MoveMinutesData;
  heartRateData: HeartRateData;
  distanceMap: Record<string, number>;
  activities: StravaActivity[];
  workouts: HevyWorkout[];
  workoutCount: number;
}

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Load all data from pre-generated JSON files
 * Uses shared jsonLoader utility for consistency across the app
 * This is MUCH faster than calling APIs and prevents rate limits
 * Returns null if JSONs don't exist (will fallback to API)
 */
async function loadDataFromJSON() {
  try {
    console.log("[DataAggregation] Loading from JSON files...");

    const jsonData = await loadAllDataFromJSON();
    if (!jsonData) {
      return null;
    }

    console.log("[DataAggregation] ✅ Loaded from JSON (fast!)");

    return {
      health: jsonData.health,
      hevy: jsonData.hevy.workouts || [],
      strava: jsonData.strava.activities || [],
      fromJSON: true,
    };
  } catch (error) {
    console.warn("[DataAggregation] Could not load from JSON:", error);
    return null;
  }
}

/**
 * Get all data for a specific date
 * OPTIMIZED: Reads from JSON files first, only calls APIs as fallback
 */
export async function getDataForDate(date: string): Promise<DayData> {
  return memoize(`day-data-${date}`, async () => {
    console.log(`[DataAggregation] Fetching data for ${date}...`);

    // PRIORITY 1: Load from JSON files (fast!)
    const jsonData = await loadDataFromJSON();
    if (jsonData?.fromJSON) {
      console.log(`[DataAggregation] ✅ Using JSON data (fast build!)`);

      const stepsData = jsonData.health.steps || {};
      const sleepData = jsonData.health.sleep || {};
      const hrData = jsonData.health.heartRate || {};
      const moveData = jsonData.health.moveMinutes || {};
      const hrZones = jsonData.health.heartRateZones || {};

      // Extract data for specific date
      const rawSteps = stepsData[date] || {
        steps: 0,
        distance: 0,
        calories: 0,
      };
      const daySleep = sleepData[date] || null;
      const dayHR = hrData[date] || null;
      const dayMove = moveData[date] || { activeMinutes: 0, heartMinutes: 0 };
      const dayHRZones = hrZones[date] || null;

      // Filter activities for this date (jsonData.strava is already the activities array)
      const stravaActivities = Array.isArray(jsonData.strava)
        ? jsonData.strava
        : [];
      const dayActivities = stravaActivities.filter(
        (activity: StravaActivity) => {
          const activityDate = new Date(activity.start_date);
          const nyDate = new Date(
            activityDate.toLocaleString("en-US", {
              timeZone: "America/New_York",
            }),
          );
          const activityDateStr = formatDate(nyDate);
          return activityDateStr === date;
        },
      );

      // Filter workouts for this date (jsonData.hevy is already the workouts array)
      const hevyWorkouts = Array.isArray(jsonData.hevy) ? jsonData.hevy : [];
      const dayWorkouts = hevyWorkouts.filter((workout: HevyWorkout) => {
        const workoutDate = new Date(workout.start_time);
        const nyDate = new Date(
          workoutDate.toLocaleString("en-US", { timeZone: "America/New_York" }),
        );
        const workoutDateStr = formatDate(nyDate);
        return workoutDateStr === date;
      });

      return {
        date,
        steps: {
          count: rawSteps.steps,
          distance: rawSteps.distance,
          calories: rawSteps.calories,
        },
        activities: dayActivities,
        workouts: dayWorkouts,
        sleep: daySleep,
        heartRate: dayHR,
        moveMinutes: dayMove,
        heartRateZones: dayHRZones,
      };
    }

    // PRIORITY 2: Dummy data (for testing)
    const dummyData = await loadDummyHealthData();
    if (dummyData) {
      const rawSteps = dummyData.steps?.[date] || {
        steps: 0,
        distance: 0,
        calories: 0,
      };
      const rawSleep = dummyData.sleep?.[date];
      const rawHeartRate = dummyData.heartRate?.[date];
      const rawMove = dummyData.moveMinutes?.[date] || { active: 0, heart: 0 };

      return {
        date,
        steps: {
          count: rawSteps.steps,
          distance: normalizeDistanceMeters(rawSteps.distance),
          calories: rawSteps.calories,
        },
        activities: [],
        workouts: [],
        sleep: rawSleep
          ? {
              totalMinutes: rawSleep.duration,
              deepMinutes: rawSleep.deep,
              lightMinutes: rawSleep.light,
              remMinutes: rawSleep.rem,
              sleepScore: Math.min(
                100,
                Math.round((rawSleep.duration / 480) * 100),
              ),
            }
          : null,
        heartRate: rawHeartRate
          ? {
              min: rawHeartRate.resting,
              max: rawHeartRate.max,
              avg: rawHeartRate.avg,
              resting: rawHeartRate.resting,
            }
          : null,
        moveMinutes: {
          activeMinutes: rawMove.active,
          heartMinutes: rawMove.heart,
        },
        heartRateZones: null,
      };
    }

    // PRIORITY 3: API calls (slowest, only as fallback)
    console.log(
      `[DataAggregation] ⚠️ JSONs not found, calling APIs (slow build)...`,
    );

    // Calculate how many days back from today
    const targetDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    targetDate.setHours(0, 0, 0, 0);
    const daysBack = Math.ceil(
      (today.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    // Fetch all data sources in parallel
    const [
      stepsData,
      sleepData,
      hrData,
      moveData,
      hrZones,
      stravaActivities,
      hevyWorkouts,
    ] = await Promise.all([
      fetchStepsData(Math.min(daysBack + 1, 365)).catch(
        () => ({}) as StepsData,
      ),
      fetchSleepData(Math.min(daysBack + 1, 90)).catch(() => ({}) as SleepData),
      fetchHeartRateData(Math.min(daysBack + 1, 30)).catch(
        () => ({}) as HeartRateData,
      ),
      fetchMoveMinutesData(Math.min(daysBack + 1, 30)).catch(
        () => ({}) as MoveMinutesData,
      ),
      fetchHeartRateZones(Math.min(daysBack + 1, 30)).catch(
        () => ({}) as HeartRateZones,
      ),
      fetchActivities(1, 100).catch(() => [] as StravaActivity[]),
      fetchHevyData().catch(() => [] as HevyWorkout[]),
    ]);

    // Extract data for the specific date
    const rawSteps = stepsData[date] || { steps: 0, distance: 0, calories: 0 };
    const daySteps = {
      count: rawSteps.steps,
      distance: rawSteps.distance,
      calories: rawSteps.calories,
    };
    const daySleep = sleepData[date] || null;
    const dayHR = hrData[date] || null;
    const dayMove = moveData[date] || { activeMinutes: 0, heartMinutes: 0 };
    const dayHRZones = hrZones[date] || null;

    // Filter Strava activities for this date
    const dayActivities = stravaActivities.filter(activity => {
      const activityDate = new Date(activity.start_date);
      const nyDate = new Date(
        activityDate.toLocaleString("en-US", { timeZone: "America/New_York" }),
      );
      const activityDateStr = formatDate(nyDate);
      return activityDateStr === date;
    });

    // Filter Hevy workouts for this date
    const dayWorkouts = hevyWorkouts.filter(workout => {
      const workoutDate = new Date(workout.start_time);
      const nyDate = new Date(
        workoutDate.toLocaleString("en-US", { timeZone: "America/New_York" }),
      );
      const workoutDateStr = formatDate(nyDate);
      return workoutDateStr === date;
    });

    return {
      date,
      steps: daySteps,
      activities: dayActivities,
      workouts: dayWorkouts,
      sleep: daySleep,
      heartRate: dayHR,
      moveMinutes: dayMove,
      heartRateZones: dayHRZones,
    };
  });
}

export function isTestDataMode(): boolean {
  return DUMMY_DATA_ENABLED;
}

export async function getTestModeSnapshot(): Promise<TestModeSnapshot | null> {
  const dummyData = await loadDummyHealthData();
  if (!dummyData) return null;

  const stepsData = toStepsData(dummyData);
  const moveMinutesData = toMoveMinutesData(dummyData);
  const heartRateData = toHeartRateData(dummyData);

  let workoutCount = 0;
  try {
    const hevyFilePath = resolve(
      process.cwd(),
      "public",
      "hevy-workouts-dummy.json",
    );
    const hevyRaw = await readFile(hevyFilePath, "utf-8");
    const hevyData = JSON.parse(hevyRaw);
    workoutCount = hevyData.workouts?.length || 0;
  } catch {
    console.warn("[DataAggregation] Could not load hevy-workouts-dummy.json");
  }

  return {
    stepsData,
    moveMinutesData,
    heartRateData,
    distanceMap: Object.fromEntries(
      Object.entries(stepsData).map(([date, stats]) => [date, stats.distance]),
    ),
    activities: [],
    workouts: [],
    workoutCount,
  };
}

/**
 * Get comparison data (vs yesterday, 7-day avg, 30-day avg)
 */
export async function getComparisons(date: string): Promise<ComparisonData> {
  return memoize(`comparisons-${date}`, async () => {
    console.log(`[DataAggregation] Calculating comparisons for ${date}...`);

    // PRIORITY 1: Load from JSON (fast!)
    const jsonData = await loadDataFromJSON();
    if (jsonData?.fromJSON) {
      console.log(
        `[DataAggregation] ✅ Using JSON for comparisons (no API calls)`,
      );
      const stepsData = jsonData.health.steps || {};
      const moveData = jsonData.health.moveMinutes || {};
      const stravaActivities = Array.isArray(jsonData.strava)
        ? jsonData.strava
        : [];
      const hevyWorkouts = Array.isArray(jsonData.hevy) ? jsonData.hevy : [];

      return calculateComparisonMetrics(
        date,
        stepsData,
        moveData,
        stravaActivities,
        hevyWorkouts,
      );
    }

    // PRIORITY 2: Dummy data (for testing)
    const dummyData = await loadDummyHealthData();
    if (dummyData) {
      const stepsData = toStepsData(dummyData);
      const moveData = toMoveMinutesData(dummyData);

      return calculateComparisonMetrics(date, stepsData, moveData, [], []);
    }

    // PRIORITY 3: API calls (slowest, only as fallback)
    console.log(
      `[DataAggregation] ⚠️ No JSON found, calling APIs for comparisons...`,
    );
    const targetDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    targetDate.setHours(0, 0, 0, 0);
    const daysBack = Math.ceil(
      (today.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    // Fetch historical data
    const [stepsData, moveData, stravaActivities, hevyWorkouts] =
      await Promise.all([
        fetchStepsData(Math.min(daysBack + 31, 365)).catch(
          () => ({}) as StepsData,
        ),
        fetchMoveMinutesData(Math.min(daysBack + 31, 30)).catch(
          () => ({}) as MoveMinutesData,
        ),
        fetchActivities(1, 200).catch(() => [] as StravaActivity[]),
        fetchHevyData().catch(() => [] as HevyWorkout[]),
      ]);

    return calculateComparisonMetrics(
      date,
      stepsData,
      moveData,
      stravaActivities,
      hevyWorkouts,
    );
  });
}

/**
 * Calculate streaks (consecutive days meeting goals)
 */
export async function calculateStreaks(dateStr: string): Promise<StreakData> {
  return memoize(`streaks-${dateStr}`, async () => {
    console.log(`[DataAggregation] Calculating streaks up to ${dateStr}...`);

    // PRIORITY 1: Load from JSON (fast!)
    const jsonData = await loadDataFromJSON();
    if (jsonData?.fromJSON) {
      console.log(`[DataAggregation] ✅ Using JSON for streaks (no API calls)`);
      const stepsData = jsonData.health.steps || {};
      const stravaActivities = Array.isArray(jsonData.strava)
        ? jsonData.strava
        : [];
      const hevyWorkouts = Array.isArray(jsonData.hevy) ? jsonData.hevy : [];

      const targetDate = new Date(dateStr);
      const last365Days = buildDayRange(formatDate(targetDate), 365);

      const stepSeries = last365Days.map(
        date => (stepsData[date]?.steps || 0) >= 10000,
      );
      const stepStreaks = calculateStreakFromSeries(stepSeries);

      const activitySeries = last365Days.map(date =>
        stravaActivities.some(a => getActivityDate(a) === date),
      );
      const activityStreaks = calculateStreakFromSeries(activitySeries);

      const workoutSeries = last365Days.map(date =>
        hevyWorkouts.some(w => getWorkoutDate(w) === date),
      );
      const workoutStreaks = calculateStreakFromSeries(workoutSeries);

      return {
        steps: stepStreaks,
        activities: activityStreaks,
        workouts: workoutStreaks,
      };
    }

    // PRIORITY 2: Dummy data (for testing)
    const dummyData = await loadDummyHealthData();
    if (dummyData) {
      const stepsData = toStepsData(dummyData);
      const last365Days = buildDayRange(dateStr, 365);

      const stepSeries = last365Days.map(
        date => (stepsData[date]?.steps || 0) >= 10000,
      );
      const stepStreaks = calculateStreakFromSeries(stepSeries);

      return {
        steps: stepStreaks,
        activities: { current: 0, longest: 0 },
        workouts: { current: 0, longest: 0 },
      };
    }

    // PRIORITY 3: API calls (slowest, only as fallback)
    console.log(
      `[DataAggregation] ⚠️ No JSON found, calling APIs for streaks...`,
    );
    // Fetch historical data (365 days should be enough)
    const [stepsData, stravaActivities, hevyWorkouts] = await Promise.all([
      fetchStepsData(365).catch(() => ({}) as StepsData),
      fetchActivities(1, 200).catch(() => [] as StravaActivity[]),
      fetchHevyData().catch(() => [] as HevyWorkout[]),
    ]);

    const targetDate = new Date(dateStr);

    // Generate last 365 days
    const last365Days = buildDayRange(formatDate(targetDate), 365);

    const stepSeries = last365Days.map(
      date => (stepsData[date]?.steps || 0) >= 10000,
    );
    const stepStreaks = calculateStreakFromSeries(stepSeries);

    const activitySeries = last365Days.map(date =>
      stravaActivities.some(a => getActivityDate(a) === date),
    );
    const activityStreaks = calculateStreakFromSeries(activitySeries);

    const workoutSeries = last365Days.map(date =>
      hevyWorkouts.some(w => getWorkoutDate(w) === date),
    );
    const workoutStreaks = calculateStreakFromSeries(workoutSeries);

    return {
      steps: stepStreaks,
      activities: activityStreaks,
      workouts: workoutStreaks,
    };
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Get activity date in America/New_York timezone
 */
function getActivityDate(activity: StravaActivity): string {
  const activityDate = new Date(activity.start_date);
  const nyDate = new Date(
    activityDate.toLocaleString("en-US", { timeZone: "America/New_York" }),
  );
  return formatDate(nyDate);
}

/**
 * Get workout date in America/New_York timezone
 */
function getWorkoutDate(workout: HevyWorkout): string {
  const workoutDate = new Date(workout.start_time);
  const nyDate = new Date(
    workoutDate.toLocaleString("en-US", { timeZone: "America/New_York" }),
  );
  return formatDate(nyDate);
}

/**
 * Calculate average of an array of numbers
 */
function calculateAverage(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
}

function toStepsData(dummyData: DummyHealthData): StepsData {
  const output: StepsData = {};
  for (const [date, value] of Object.entries(dummyData.steps || {})) {
    output[date] = {
      steps: value.steps || 0,
      distance: normalizeDistanceMeters(value.distance || 0),
      calories: value.calories || 0,
    };
  }
  return output;
}

function toMoveMinutesData(dummyData: DummyHealthData): MoveMinutesData {
  const output: MoveMinutesData = {};
  for (const [date, value] of Object.entries(dummyData.moveMinutes || {})) {
    output[date] = {
      activeMinutes: value.active || 0,
      heartMinutes: value.heart || 0,
    };
  }
  return output;
}

function toHeartRateData(dummyData: DummyHealthData): HeartRateData {
  const output: HeartRateData = {};
  for (const [date, value] of Object.entries(dummyData.heartRate || {})) {
    output[date] = {
      min: value.resting || 0,
      max: value.max || 0,
      avg: value.avg || 0,
      resting: value.resting || 0,
    };
  }
  return output;
}

function buildDayRange(dateStr: string, days: number): string[] {
  const targetDate = new Date(dateStr);
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(targetDate);
    d.setDate(d.getDate() - i);
    return formatDate(d);
  }).reverse();
}

function calculateStreakFromSeries(series: boolean[]): {
  current: number;
  longest: number;
} {
  let current = 0;
  let longest = 0;
  let temp = 0;

  for (const hit of series) {
    if (hit) {
      temp++;
      longest = Math.max(longest, temp);
    } else {
      temp = 0;
    }
  }

  current = temp;
  return { current, longest };
}

function calculateComparisonMetrics(
  date: string,
  stepsData: StepsData,
  moveData: MoveMinutesData,
  stravaActivities: StravaActivity[],
  hevyWorkouts: HevyWorkout[],
): ComparisonData {
  const targetDate = new Date(date);

  // Get yesterday's date
  const yesterday = new Date(targetDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatDate(yesterday);

  // Calculate yesterday comparison
  const todaySteps = stepsData[date]?.steps || 0;
  const yesterdaySteps = stepsData[yesterdayStr]?.steps || 0;
  const todayActivities = stravaActivities.filter(
    a => getActivityDate(a) === date,
  ).length;
  const yesterdayActivities = stravaActivities.filter(
    a => getActivityDate(a) === yesterdayStr,
  ).length;
  const todayHeartMinutes = moveData[date]?.heartMinutes || 0;
  const yesterdayHeartMinutes = moveData[yesterdayStr]?.heartMinutes || 0;

  // Calculate 7-day average
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(targetDate);
    d.setDate(d.getDate() - i - 1); // -1 to exclude today
    return formatDate(d);
  });

  const avg7Steps = calculateAverage(
    last7Days.map(d => stepsData[d]?.steps || 0),
  );
  const avg7HeartMinutes = calculateAverage(
    last7Days.map(d => moveData[d]?.heartMinutes || 0),
  );
  const avg7Distance = calculateAverage(
    last7Days.map(d => stepsData[d]?.distance || 0),
  );
  const avg7Workouts =
    hevyWorkouts.filter(w => {
      const workoutDate = getWorkoutDate(w);
      return last7Days.includes(workoutDate);
    }).length / 7;

  const todayDistance = stepsData[date]?.distance || 0;
  const todayWorkouts = hevyWorkouts.filter(
    w => getWorkoutDate(w) === date,
  ).length;

  // Calculate 30-day average
  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(targetDate);
    d.setDate(d.getDate() - i - 1);
    return formatDate(d);
  });

  const avg30Steps = calculateAverage(
    last30Days.map(d => stepsData[d]?.steps || 0),
  );
  const avg30Distance = calculateAverage(
    last30Days.map(d => stepsData[d]?.distance || 0),
  );
  const avg30Calories = calculateAverage(
    last30Days.map(d => stepsData[d]?.calories || 0),
  );
  const todayCalories = stepsData[date]?.calories || 0;

  return {
    vsYesterday: {
      steps: todaySteps - yesterdaySteps,
      activities: todayActivities - yesterdayActivities,
      sleepScore: 0, // TODO: Implement sleep score comparison
      heartMinutes: todayHeartMinutes - yesterdayHeartMinutes,
    },
    vs7DayAvg: {
      steps: Math.round(todaySteps - avg7Steps),
      heartMinutes: Math.round(todayHeartMinutes - avg7HeartMinutes),
      workouts: todayWorkouts - avg7Workouts,
      distance: Math.round(todayDistance - avg7Distance),
    },
    vs30DayAvg: {
      steps: Math.round(todaySteps - avg30Steps),
      distance: Math.round(todayDistance - avg30Distance),
      calories: Math.round(todayCalories - avg30Calories),
    },
  };
}

async function loadDummyHealthData(): Promise<DummyHealthData | null> {
  if (!DUMMY_DATA_ENABLED) return null;

  return memoize(`dummy-health-data-${DUMMY_DATA_FILE}`, async () => {
    try {
      const filePath = resolve(process.cwd(), "public", DUMMY_DATA_FILE);
      const raw = await readFile(filePath, "utf-8");
      console.log(`[DataAggregation] Using dummy data from ${DUMMY_DATA_FILE}`);
      return JSON.parse(raw) as DummyHealthData;
    } catch (error) {
      console.warn(
        `[DataAggregation] Dummy data enabled but failed to load ${DUMMY_DATA_FILE}:`,
        error,
      );
      return null;
    }
  });
}

function normalizeDistanceMeters(distance: number): number {
  if (distance <= 0) return 0;
  // Dummy fixtures usually store kilometers; convert small values to meters.
  return distance <= 100 ? distance * 1000 : distance;
}

/**
 * Data Aggregation Service
 *
 * Centralized service to aggregate all health and fitness data for any date.
 * Combines data from Strava, Hevy, and Google Fit APIs.
 */

import { memoize } from '@/lib/dataCache';
import type { StravaActivity } from './stravaService';
import type { Workout as HevyWorkout } from './hevyService';
import { fetchActivities } from './stravaService';
import { fetchHevyData } from './hevyService';
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
} from './googleFitService';

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

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Get all data for a specific date
 */
export async function getDataForDate(date: string): Promise<DayData> {
  return memoize(`day-data-${date}`, async () => {
    console.log(`[DataAggregation] Fetching data for ${date}...`);

    // Calculate how many days back from today
    const targetDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    targetDate.setHours(0, 0, 0, 0);
    const daysBack = Math.ceil((today.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));

    // Fetch all data sources in parallel
    const [stepsData, sleepData, hrData, moveData, hrZones, stravaActivities, hevyWorkouts] =
      await Promise.all([
        fetchStepsData(Math.max(daysBack + 1, 7)).catch(() => ({} as StepsData)),
        fetchSleepData(Math.min(Math.max(daysBack + 1, 7), 90)).catch(() => ({} as SleepData)),
        fetchHeartRateData(Math.min(Math.max(daysBack + 1, 7), 30)).catch(() => ({} as HeartRateData)),
        fetchMoveMinutesData(Math.min(Math.max(daysBack + 1, 7), 30)).catch(() => ({} as MoveMinutesData)),
        fetchHeartRateZones(Math.min(Math.max(daysBack + 1, 7), 30)).catch(() => ({} as HeartRateZones)),
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
        activityDate.toLocaleString('en-US', { timeZone: 'America/New_York' })
      );
      const activityDateStr = formatDate(nyDate);
      return activityDateStr === date;
    });

    // Filter Hevy workouts for this date
    const dayWorkouts = hevyWorkouts.filter(workout => {
      const workoutDate = new Date(workout.start_time);
      const nyDate = new Date(
        workoutDate.toLocaleString('en-US', { timeZone: 'America/New_York' })
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

/**
 * Get comparison data (vs yesterday, 7-day avg, 30-day avg)
 */
export async function getComparisons(date: string): Promise<ComparisonData> {
  return memoize(`comparisons-${date}`, async () => {
    console.log(`[DataAggregation] Calculating comparisons for ${date}...`);

    const targetDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    targetDate.setHours(0, 0, 0, 0);
    const daysBack = Math.ceil((today.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));

    // Fetch historical data
    const [stepsData, moveData, stravaActivities, hevyWorkouts] = await Promise.all([
      fetchStepsData(Math.max(daysBack + 31, 365)).catch(() => ({} as StepsData)),
      fetchMoveMinutesData(Math.min(Math.max(daysBack + 31, 30), 365)).catch(() => ({} as MoveMinutesData)),
      fetchActivities(1, 200).catch(() => [] as StravaActivity[]),
      fetchHevyData().catch(() => [] as HevyWorkout[]),
    ]);

    // Get yesterday's date
    const yesterday = new Date(targetDate);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = formatDate(yesterday);

    // Calculate yesterday comparison
    const todaySteps = stepsData[date]?.steps || 0;
    const yesterdaySteps = stepsData[yesterdayStr]?.steps || 0;
    const todayActivities = stravaActivities.filter(a => getActivityDate(a) === date).length;
    const yesterdayActivities = stravaActivities.filter(a => getActivityDate(a) === yesterdayStr).length;
    const todayHeartMinutes = moveData[date]?.heartMinutes || 0;
    const yesterdayHeartMinutes = moveData[yesterdayStr]?.heartMinutes || 0;

    // Calculate 7-day average
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(targetDate);
      d.setDate(d.getDate() - i - 1); // -1 to exclude today
      return formatDate(d);
    });

    const avg7Steps = calculateAverage(last7Days.map(d => stepsData[d]?.steps || 0));
    const avg7HeartMinutes = calculateAverage(last7Days.map(d => moveData[d]?.heartMinutes || 0));
    const avg7Distance = calculateAverage(last7Days.map(d => stepsData[d]?.distance || 0));
    const avg7Workouts = hevyWorkouts.filter(w => {
      const workoutDate = getWorkoutDate(w);
      return last7Days.includes(workoutDate);
    }).length / 7;

    const todayDistance = stepsData[date]?.distance || 0;
    const todayWorkouts = hevyWorkouts.filter(w => getWorkoutDate(w) === date).length;

    // Calculate 30-day average
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(targetDate);
      d.setDate(d.getDate() - i - 1);
      return formatDate(d);
    });

    const avg30Steps = calculateAverage(last30Days.map(d => stepsData[d]?.steps || 0));
    const avg30Distance = calculateAverage(last30Days.map(d => stepsData[d]?.distance || 0));
    const avg30Calories = calculateAverage(last30Days.map(d => stepsData[d]?.calories || 0));
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
  });
}

/**
 * Calculate streaks (consecutive days meeting goals)
 */
export async function calculateStreaks(dateStr: string): Promise<StreakData> {
  return memoize(`streaks-${dateStr}`, async () => {
    console.log(`[DataAggregation] Calculating streaks up to ${dateStr}...`);

    // Fetch historical data (365 days should be enough)
    const [stepsData, stravaActivities, hevyWorkouts] = await Promise.all([
      fetchStepsData(365).catch(() => ({} as StepsData)),
      fetchActivities(1, 200).catch(() => [] as StravaActivity[]),
      fetchHevyData().catch(() => [] as HevyWorkout[]),
    ]);

    const targetDate = new Date(dateStr);

    // Generate last 365 days
    const last365Days = Array.from({ length: 365 }, (_, i) => {
      const d = new Date(targetDate);
      d.setDate(d.getDate() - i);
      return formatDate(d);
    }).reverse(); // Oldest to newest

    // Calculate step streaks (10k+ steps)
    let currentStepsStreak = 0;
    let longestStepsStreak = 0;
    let tempStepsStreak = 0;

    for (const date of last365Days) {
      const steps = stepsData[date]?.steps || 0;
      if (steps >= 10000) {
        tempStepsStreak++;
        longestStepsStreak = Math.max(longestStepsStreak, tempStepsStreak);
      } else {
        tempStepsStreak = 0;
      }
    }
    currentStepsStreak = tempStepsStreak;

    // Calculate activity streaks (at least 1 activity per day)
    let currentActivityStreak = 0;
    let longestActivityStreak = 0;
    let tempActivityStreak = 0;

    for (const date of last365Days) {
      const hasActivity = stravaActivities.some(a => getActivityDate(a) === date);
      if (hasActivity) {
        tempActivityStreak++;
        longestActivityStreak = Math.max(longestActivityStreak, tempActivityStreak);
      } else {
        tempActivityStreak = 0;
      }
    }
    currentActivityStreak = tempActivityStreak;

    // Calculate workout streaks (at least 1 workout per day)
    let currentWorkoutStreak = 0;
    let longestWorkoutStreak = 0;
    let tempWorkoutStreak = 0;

    for (const date of last365Days) {
      const hasWorkout = hevyWorkouts.some(w => getWorkoutDate(w) === date);
      if (hasWorkout) {
        tempWorkoutStreak++;
        longestWorkoutStreak = Math.max(longestWorkoutStreak, tempWorkoutStreak);
      } else {
        tempWorkoutStreak = 0;
      }
    }
    currentWorkoutStreak = tempWorkoutStreak;

    return {
      steps: {
        current: currentStepsStreak,
        longest: longestStepsStreak,
      },
      activities: {
        current: currentActivityStreak,
        longest: longestActivityStreak,
      },
      workouts: {
        current: currentWorkoutStreak,
        longest: longestWorkoutStreak,
      },
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
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get activity date in America/New_York timezone
 */
function getActivityDate(activity: StravaActivity): string {
  const activityDate = new Date(activity.start_date);
  const nyDate = new Date(
    activityDate.toLocaleString('en-US', { timeZone: 'America/New_York' })
  );
  return formatDate(nyDate);
}

/**
 * Get workout date in America/New_York timezone
 */
function getWorkoutDate(workout: HevyWorkout): string {
  const workoutDate = new Date(workout.start_time);
  const nyDate = new Date(
    workoutDate.toLocaleString('en-US', { timeZone: 'America/New_York' })
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

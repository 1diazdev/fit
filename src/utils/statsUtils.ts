/**
 * Statistics Utilities
 *
 * Functions for calculating trends, streaks, personal records, and insights.
 */

import type {
  DayData,
  StreakData,
  ComparisonData,
} from "@/services/dataAggregationService";
import type { StravaActivity } from "@/services/stravaService";
import type { Workout as HevyWorkout } from "@/services/hevyService";
import type { StepsData } from "@/services/googleFitService";

// ============================================================================
// INTERFACES
// ============================================================================

export interface PersonalRecords {
  maxSteps: { value: number; date: string };
  longestRun: { distance: number; date: string; name: string };
  fastestPace: { pace: number; date: string; name: string }; // min/km
  mostWorkouts: { count: number; date: string }; // in a single day
  longestWorkout: { duration: number; date: string; title: string }; // minutes
  totalVolume: { weight: number; date: string; title: string }; // kg
}

export type Trend = "up" | "down" | "stable";

// ============================================================================
// STREAK CALCULATIONS
// ============================================================================

/**
 * Calculate streak of consecutive days meeting a threshold
 */
export function calculateStreak(
  data: { [date: string]: number },
  threshold: number,
  fromDate: string,
): number {
  const targetDate = new Date(fromDate);
  let streak = 0;

  // Start from the target date and go backwards
  for (let i = 0; i < 365; i++) {
    const date = new Date(targetDate);
    date.setDate(date.getDate() - i);
    const dateStr = formatDate(date);

    const value = data[dateStr] || 0;
    if (value >= threshold) {
      streak++;
    } else {
      break; // Streak broken
    }
  }

  return streak;
}

// ============================================================================
// TREND CALCULATIONS
// ============================================================================

/**
 * Calculate trend (upward/downward/stable) for a metric over N days
 */
export function calculateTrend(
  data: { [date: string]: number },
  fromDate: string,
  days: number,
): Trend {
  const targetDate = new Date(fromDate);
  const values: number[] = [];

  // Collect values for the last N days
  for (let i = 0; i < days; i++) {
    const date = new Date(targetDate);
    date.setDate(date.getDate() - i);
    const dateStr = formatDate(date);
    values.push(data[dateStr] || 0);
  }

  if (values.length < 2) return "stable";

  // Calculate linear regression slope
  const slope = calculateSlope(values);

  // Determine trend based on slope
  const threshold = 0.05; // 5% change threshold
  if (slope > threshold) return "up";
  if (slope < -threshold) return "down";
  return "stable";
}

/**
 * Calculate slope of linear regression
 */
function calculateSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;

  const xMean = (n - 1) / 2;
  const yMean = values.reduce((sum, y) => sum + y, 0) / n;

  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (values[i] - yMean);
    denominator += (i - xMean) ** 2;
  }

  return denominator === 0 ? 0 : numerator / denominator;
}

// ============================================================================
// PERSONAL RECORDS
// ============================================================================

/**
 * Get personal records from historical data
 */
export function getPersonalRecords(
  stepsData: StepsData,
  activities: StravaActivity[],
  workouts: HevyWorkout[],
): PersonalRecords {
  // Max steps
  let maxSteps = { value: 0, date: "" };
  for (const [date, data] of Object.entries(stepsData)) {
    if (data.steps > maxSteps.value) {
      maxSteps = { value: data.steps, date };
    }
  }

  // Longest run (distance)
  let longestRun = { distance: 0, date: "", name: "" };
  for (const activity of activities) {
    if (
      (activity.type === "Run" || activity.sport_type === "Run") &&
      activity.distance > longestRun.distance
    ) {
      longestRun = {
        distance: activity.distance / 1000, // Convert to km
        date: formatDate(new Date(activity.start_date)),
        name: activity.name,
      };
    }
  }

  // Fastest pace (min/km)
  let fastestPace = { pace: Infinity, date: "", name: "" };
  for (const activity of activities) {
    if (
      (activity.type === "Run" || activity.sport_type === "Run") &&
      activity.distance > 1000 && // At least 1km
      activity.moving_time > 0
    ) {
      const pace = activity.moving_time / 60 / (activity.distance / 1000); // min/km
      if (pace < fastestPace.pace) {
        fastestPace = {
          pace,
          date: formatDate(new Date(activity.start_date)),
          name: activity.name,
        };
      }
    }
  }

  // Most workouts in a single day
  const workoutsByDate: { [date: string]: number } = {};
  for (const workout of workouts) {
    const date = formatDate(new Date(workout.start_time));
    workoutsByDate[date] = (workoutsByDate[date] || 0) + 1;
  }
  let mostWorkouts = { count: 0, date: "" };
  for (const [date, count] of Object.entries(workoutsByDate)) {
    if (count > mostWorkouts.count) {
      mostWorkouts = { count, date };
    }
  }

  // Longest workout (duration)
  let longestWorkout = { duration: 0, date: "", title: "" };
  for (const workout of workouts) {
    const start = new Date(workout.start_time).getTime();
    const end = new Date(workout.end_time).getTime();
    const duration = (end - start) / 1000 / 60; // minutes

    if (duration > longestWorkout.duration) {
      longestWorkout = {
        duration,
        date: formatDate(new Date(workout.start_time)),
        title: workout.title,
      };
    }
  }

  // Total volume in a single workout (sum of all sets * weight)
  let totalVolume = { weight: 0, date: "", title: "" };
  for (const workout of workouts) {
    let volume = 0;
    for (const exercise of workout.exercises) {
      for (const set of exercise.sets) {
        volume += set.weight_kg * set.reps;
      }
    }
    if (volume > totalVolume.weight) {
      totalVolume = {
        weight: volume,
        date: formatDate(new Date(workout.start_time)),
        title: workout.title,
      };
    }
  }

  return {
    maxSteps,
    longestRun,
    fastestPace:
      fastestPace.pace === Infinity
        ? { pace: 0, date: "", name: "" }
        : fastestPace,
    mostWorkouts,
    longestWorkout,
    totalVolume,
  };
}

// ============================================================================
// INSIGHTS GENERATION
// ============================================================================

/**
 * Generate motivational insights based on data
 */
export function generateInsights(
  dayData: DayData,
  comparisons: ComparisonData,
  streaks: StreakData,
  personalRecords: PersonalRecords,
): string[] {
  const insights: string[] = [];

  // Step streak insights
  if (streaks.steps.current >= 7) {
    insights.push(`🔥 ${streaks.steps.current}-day step streak! Keep it up!`);
  } else if (dayData.steps.count >= 10000) {
    insights.push(`✅ Hit your 10K step goal today!`);
  } else if (dayData.steps.count > 0) {
    const remaining = 10000 - dayData.steps.count;
    insights.push(`🚶 ${remaining.toLocaleString()} steps to reach 10K goal`);
  }

  // Activity insights
  if (streaks.activities.current >= 5) {
    insights.push(`💪 ${streaks.activities.current}-day activity streak!`);
  }

  if (dayData.activities.length > 0) {
    const totalDistance =
      dayData.activities.reduce((sum, a) => sum + (a.distance || 0), 0) / 1000;
    if (totalDistance > 10) {
      insights.push(`🏃 Covered ${totalDistance.toFixed(1)}km today!`);
    }
  }

  // Workout insights
  if (streaks.workouts.current >= 3) {
    insights.push(`🏋️ ${streaks.workouts.current}-day workout streak!`);
  }

  if (dayData.workouts.length > 0) {
    insights.push(
      `💪 Completed ${dayData.workouts.length} workout${dayData.workouts.length > 1 ? "s" : ""} today`,
    );
  }

  // Comparison insights
  if (comparisons.vsYesterday.steps > 2000) {
    insights.push(
      `📈 ${comparisons.vsYesterday.steps.toLocaleString()} more steps than yesterday!`,
    );
  }

  if (comparisons.vs7DayAvg.steps > 3000) {
    insights.push(
      `🚀 Way above your 7-day average (+${comparisons.vs7DayAvg.steps.toLocaleString()} steps)`,
    );
  } else if (comparisons.vs7DayAvg.steps < -3000) {
    insights.push(
      `⚠️ Below your 7-day average (${Math.abs(comparisons.vs7DayAvg.steps).toLocaleString()} steps)`,
    );
  }

  // Heart minutes insights
  if (dayData.moveMinutes.heartMinutes >= 30) {
    insights.push(
      `❤️ ${dayData.moveMinutes.heartMinutes} heart minutes today!`,
    );
  }

  // Sleep insights
  if (dayData.sleep) {
    if (dayData.sleep.sleepScore >= 90) {
      insights.push(
        `😴 Excellent sleep score: ${dayData.sleep.sleepScore}/100`,
      );
    } else if (dayData.sleep.sleepScore < 70) {
      insights.push(
        `⚠️ Low sleep score: ${dayData.sleep.sleepScore}/100 - prioritize rest`,
      );
    }
  }

  // Personal records
  if (
    personalRecords.maxSteps.value > 0 &&
    dayData.steps.count === personalRecords.maxSteps.value
  ) {
    insights.push(
      `🏆 Personal record: ${dayData.steps.count.toLocaleString()} steps!`,
    );
  }

  // If no insights, provide encouragement
  if (insights.length === 0) {
    insights.push("💚 Start tracking your progress today!");
  }

  // Limit to 5 most important insights
  return insights.slice(0, 5);
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

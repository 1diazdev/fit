/**
 * Trends Utilities
 * Helper functions for preparing trend and comparison data
 */

export interface TrendDataPoint {
  date: string;
  steps: number;
  distance: number;
  calories: number;
  activities: number;
  workouts: number;
}

export interface PeriodStats {
  steps: number;
  distance: number;
  calories: number;
  activities: number;
  workouts: number;
  activeDays: number;
}

/**
 * Prepare trend data for a given number of days
 * @param stepsData - Steps data by date
 * @param activitiesData - Activities array
 * @param workoutsData - Workouts array
 * @param endDate - End date (inclusive)
 * @param days - Number of days to include
 */
export function prepareTrendData(
  stepsData: Record<
    string,
    { steps: number; distance: number; calories: number }
  >,
  activitiesData: any[],
  workoutsData: any[],
  endDate: string,
  days: number,
): TrendDataPoint[] {
  const trendData: TrendDataPoint[] = [];
  const endDateObj = new Date(endDate);

  // Generate data for each day
  for (let i = days - 1; i >= 0; i--) {
    const currentDate = new Date(endDateObj);
    currentDate.setDate(currentDate.getDate() - i);
    const dateStr = formatDateToYYYYMMDD(currentDate);

    // Get steps data
    const daySteps = stepsData[dateStr] || {
      steps: 0,
      distance: 0,
      calories: 0,
    };

    // Count activities for this day
    const dayActivities = activitiesData.filter(activity => {
      const activityDate = new Date(activity.start_date);
      const activityDateStr = formatDateToYYYYMMDD(activityDate);
      return activityDateStr === dateStr;
    });

    // Count workouts for this day
    const dayWorkouts = workoutsData.filter(workout => {
      const workoutDate = new Date(workout.start_time || workout.created_at);
      const workoutDateStr = formatDateToYYYYMMDD(workoutDate);
      return workoutDateStr === dateStr;
    });

    trendData.push({
      date: dateStr,
      steps: daySteps.steps,
      distance: daySteps.distance,
      calories: daySteps.calories,
      activities: dayActivities.length,
      workouts: dayWorkouts.length,
    });
  }

  return trendData;
}

/**
 * Calculate period statistics
 * @param trendData - Array of trend data points
 */
export function calculatePeriodStats(trendData: TrendDataPoint[]): PeriodStats {
  const stats = trendData.reduce(
    (acc, day) => ({
      steps: acc.steps + day.steps,
      distance: acc.distance + day.distance,
      calories: acc.calories + day.calories,
      activities: acc.activities + day.activities,
      workouts: acc.workouts + day.workouts,
      activeDays: acc.activeDays + (day.steps > 0 ? 1 : 0),
    }),
    {
      steps: 0,
      distance: 0,
      calories: 0,
      activities: 0,
      workouts: 0,
      activeDays: 0,
    },
  );

  return stats;
}

/**
 * Prepare comparison data (current vs previous period)
 * @param stepsData - Steps data by date
 * @param activitiesData - Activities array
 * @param workoutsData - Workouts array
 * @param endDate - End date of current period
 * @param days - Number of days in each period
 */
export function prepareComparisonData(
  stepsData: Record<
    string,
    { steps: number; distance: number; calories: number }
  >,
  activitiesData: any[],
  workoutsData: any[],
  endDate: string,
  days: number,
): { current: PeriodStats; previous: PeriodStats } {
  // Get current period data
  const currentTrend = prepareTrendData(
    stepsData,
    activitiesData,
    workoutsData,
    endDate,
    days,
  );
  const currentStats = calculatePeriodStats(currentTrend);

  // Calculate previous period end date
  const endDateObj = new Date(endDate);
  const previousEndDate = new Date(endDateObj);
  previousEndDate.setDate(previousEndDate.getDate() - days);
  const previousEndDateStr = formatDateToYYYYMMDD(previousEndDate);

  // Get previous period data
  const previousTrend = prepareTrendData(
    stepsData,
    activitiesData,
    workoutsData,
    previousEndDateStr,
    days,
  );
  const previousStats = calculatePeriodStats(previousTrend);

  return {
    current: currentStats,
    previous: previousStats,
  };
}

/**
 * Format date to YYYY-MM-DD string
 */
function formatDateToYYYYMMDD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Get period label based on number of days
 */
export function getPeriodLabel(days: number): string {
  if (days === 7) return "THIS_WEEK";
  if (days === 30) return "THIS_MONTH";
  if (days === 90) return "LAST_90_DAYS";
  return `LAST_${days}_DAYS`;
}

/**
 * Get comparison label based on number of days
 */
export function getComparisonLabel(days: number): string {
  if (days === 7) return "LAST_WEEK";
  if (days === 30) return "LAST_MONTH";
  if (days === 90) return "PREVIOUS_90_DAYS";
  return `PREVIOUS_${days}_DAYS`;
}

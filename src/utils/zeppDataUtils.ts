/**
 * Zepp/Amazfit Binary Data Parsing Utilities
 *
 * The Zepp API returns data in base64-encoded binary format.
 * This module provides functions to decode and parse that data.
 *
 * Based on reverse engineering from:
 * - https://github.com/bentasker/zepp_to_influxdb
 * - Community research on Huami/Zepp data formats
 */

// ============================================================================
// BINARY PARSING
// ============================================================================

/**
 * Parse base64-encoded steps data from Zepp API
 *
 * The binary format contains:
 * - Steps count (per minute or aggregated)
 * - Distance traveled
 * - Calories burned
 *
 * @param base64Data - Base64 string from API response
 * @returns Array of step counts
 */
export function parseBase64Steps(base64Data: string): number[] {
  try {
    // Decode base64 to binary
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);

    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Parse binary data
    // Format: Each entry is typically 2-4 bytes representing step count
    const steps: number[] = [];

    // Simple parsing: treat every 2 bytes as a uint16 (little-endian)
    for (let i = 0; i < bytes.length - 1; i += 2) {
      const stepCount = bytes[i] | (bytes[i + 1] << 8);
      steps.push(stepCount);
    }

    return steps;
  } catch (error) {
    console.error('Error parsing base64 steps data:', error);
    return [];
  }
}

/**
 * Parse base64-encoded heart rate data from Zepp API
 *
 * @param base64Data - Base64 string from API response
 * @returns Array of heart rate values (bpm)
 */
export function parseBase64HeartRate(base64Data: string): number[] {
  try {
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);

    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Heart rate is typically 1 byte per reading
    const heartRates: number[] = [];

    for (let i = 0; i < bytes.length; i++) {
      const hr = bytes[i];
      // Filter out invalid readings (0 or 255 typically means no reading)
      if (hr > 0 && hr < 255) {
        heartRates.push(hr);
      }
    }

    return heartRates;
  } catch (error) {
    console.error('Error parsing base64 heart rate data:', error);
    return [];
  }
}

/**
 * Sleep segment information
 */
export interface SleepSegment {
  type: 'deep' | 'light' | 'rem' | 'awake';
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
}

/**
 * Parse base64-encoded sleep data from Zepp API
 *
 * @param base64Data - Base64 string from API response
 * @returns Array of sleep segments
 */
export function parseBase64Sleep(base64Data: string): SleepSegment[] {
  try {
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);

    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const segments: SleepSegment[] = [];

    // Sleep data format is more complex
    // Simplified parsing - actual format may vary
    // Each segment typically includes:
    // - Sleep stage (1 byte): 0=awake, 1=light, 2=deep, 3=rem
    // - Duration (2 bytes)
    // - Timestamp (4 bytes)

    for (let i = 0; i < bytes.length - 7; i += 7) {
      const stage = bytes[i];
      const duration = bytes[i + 1] | (bytes[i + 2] << 8); // minutes
      const timestamp =
        bytes[i + 3] |
        (bytes[i + 4] << 8) |
        (bytes[i + 5] << 16) |
        (bytes[i + 6] << 24);

      const type =
        stage === 0 ? 'awake' :
        stage === 1 ? 'light' :
        stage === 2 ? 'deep' :
        'rem';

      const startTime = new Date(timestamp * 1000);
      const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

      segments.push({
        type,
        startTime,
        endTime,
        durationMinutes: duration,
      });
    }

    return segments;
  } catch (error) {
    console.error('Error parsing base64 sleep data:', error);
    return [];
  }
}

// ============================================================================
// DATA TRANSFORMATION
// ============================================================================

/**
 * Calculate sleep score based on sleep segments
 *
 * @param segments - Array of sleep segments
 * @returns Sleep score (0-100)
 */
export function calculateSleepScore(segments: SleepSegment[]): number {
  if (segments.length === 0) return 0;

  const totalMinutes = segments.reduce((sum, seg) => sum + seg.durationMinutes, 0);
  const deepMinutes = segments
    .filter(seg => seg.type === 'deep')
    .reduce((sum, seg) => sum + seg.durationMinutes, 0);
  const remMinutes = segments
    .filter(seg => seg.type === 'rem')
    .reduce((sum, seg) => sum + seg.durationMinutes, 0);
  const awakeMinutes = segments
    .filter(seg => seg.type === 'awake')
    .reduce((sum, seg) => sum + seg.durationMinutes, 0);

  // Simple scoring algorithm
  let score = 0;

  // Total sleep duration (0-40 points)
  // Optimal: 7-9 hours (420-540 minutes)
  if (totalMinutes >= 420 && totalMinutes <= 540) {
    score += 40;
  } else if (totalMinutes >= 360 && totalMinutes < 420) {
    score += 30;
  } else if (totalMinutes >= 540 && totalMinutes < 600) {
    score += 35;
  } else {
    score += 20;
  }

  // Deep sleep percentage (0-30 points)
  // Optimal: 15-25% of total sleep
  const deepPercentage = (deepMinutes / totalMinutes) * 100;
  if (deepPercentage >= 15 && deepPercentage <= 25) {
    score += 30;
  } else if (deepPercentage >= 10 && deepPercentage < 15) {
    score += 20;
  } else {
    score += 10;
  }

  // REM sleep percentage (0-20 points)
  // Optimal: 20-25% of total sleep
  const remPercentage = (remMinutes / totalMinutes) * 100;
  if (remPercentage >= 20 && remPercentage <= 25) {
    score += 20;
  } else if (remPercentage >= 15 && remPercentage < 20) {
    score += 15;
  } else {
    score += 10;
  }

  // Awake time penalty (0-10 points)
  // Less awake time is better
  const awakePercentage = (awakeMinutes / totalMinutes) * 100;
  if (awakePercentage < 5) {
    score += 10;
  } else if (awakePercentage < 10) {
    score += 5;
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * Determine heart rate zone based on HR and age
 *
 * @param hr - Heart rate in bpm
 * @param age - User's age
 * @returns Zone name
 */
export function determineHeartRateZone(hr: number, age: number = 30): string {
  const maxHR = 220 - age;

  const zones = [
    { min: 0, max: 0.6 * maxHR, name: 'Resting' },
    { min: 0.6 * maxHR, max: 0.7 * maxHR, name: 'Fat Burn' },
    { min: 0.7 * maxHR, max: 0.8 * maxHR, name: 'Cardio' },
    { min: 0.8 * maxHR, max: 0.9 * maxHR, name: 'Peak' },
    { min: 0.9 * maxHR, max: Infinity, name: 'Maximum' },
  ];

  const zone = zones.find(z => hr >= z.min && hr < z.max);
  return zone?.name || 'Unknown';
}

/**
 * Convert UTC date to New York timezone date string
 *
 * @param utcDate - Date in UTC
 * @returns Date string in YYYY-MM-DD format (New York time)
 */
export function convertToNewYorkDate(utcDate: Date): string {
  const newYorkDate = new Date(
    utcDate.toLocaleString('en-US', { timeZone: 'America/New_York' })
  );

  const year = newYorkDate.getFullYear();
  const month = String(newYorkDate.getMonth() + 1).padStart(2, '0');
  const day = String(newYorkDate.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Aggregate minute-level steps data into daily totals
 *
 * @param minuteSteps - Array of steps per minute
 * @returns Total steps for the day
 */
export function aggregateSteps(minuteSteps: number[]): number {
  return minuteSteps.reduce((sum, steps) => sum + steps, 0);
}

/**
 * Calculate average heart rate from array
 *
 * @param heartRates - Array of heart rate readings
 * @returns Average HR
 */
export function calculateAverageHR(heartRates: number[]): number {
  if (heartRates.length === 0) return 0;
  const sum = heartRates.reduce((acc, hr) => acc + hr, 0);
  return Math.round(sum / heartRates.length);
}

/**
 * Get min and max from heart rate array
 *
 * @param heartRates - Array of heart rate readings
 * @returns Object with min and max
 */
export function getHRRange(heartRates: number[]): { min: number; max: number } {
  if (heartRates.length === 0) return { min: 0, max: 0 };

  return {
    min: Math.min(...heartRates),
    max: Math.max(...heartRates),
  };
}

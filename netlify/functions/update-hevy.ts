import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { writeFile } from 'fs/promises';
import { join } from 'path';

// Schedule: Run daily at 6:15 AM UTC (cron format)
export const schedule = '15 6 * * *';

interface Workout {
  id: string;
  user_id?: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  created_at: string;
  updated_at: string;
  exercises: any[];
}

const fetchHevyWorkouts = async (apiKey: string): Promise<Workout[]> => {
  const apiUrl = 'https://api.hevyapp.com/v1/workouts';

  const response = await fetch(apiUrl, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Hevy API error: ${response.status} - ${errorBody}`);
  }

  const data = await response.json();
  if (!data || !Array.isArray(data.workouts)) {
    throw new Error('Unexpected data structure from Hevy API');
  }

  // Sort workouts by start_time in descending order (newest first)
  return data.workouts.sort(
    (a: Workout, b: Workout) =>
      new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
  );
};

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const isScheduled = event.headers['x-netlify-event'] === 'schedule';

  try {
    console.log('[Netlify/Hevy] Starting data update...', isScheduled ? '(scheduled)' : '(manual)');

    const hevyApiKey = process.env.HEVY_API_KEY;
    if (!hevyApiKey) {
      throw new Error('HEVY_API_KEY not found in environment variables');
    }

    const workouts = await fetchHevyWorkouts(hevyApiKey);

    // Write to dist directory for Netlify
    const publicPath = join(process.cwd(), 'dist', 'hevy-workouts.json');
    await writeFile(publicPath, JSON.stringify(workouts, null, 2));

    console.log(`[Netlify/Hevy] Successfully updated ${workouts.length} workouts`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        workoutCount: workouts.length,
        timestamp: new Date().toISOString(),
        platform: 'netlify'
      }),
    };
  } catch (error) {
    console.error('[Netlify/Hevy] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        platform: 'netlify'
      }),
    };
  }
};

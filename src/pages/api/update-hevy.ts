import type { APIRoute } from 'astro';
import { writeFile } from 'fs/promises';
import { join } from 'path';

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

export const GET: APIRoute = async ({ request }) => {
  // Verify authorization from Vercel Cron
  const authHeader = request.headers.get('authorization');
  const cronSecret = import.meta.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    console.log('[Hevy Cron] Starting data update...');

    const hevyApiKey = import.meta.env.HEVY_API_KEY;
    if (!hevyApiKey) {
      throw new Error('HEVY_API_KEY not found in environment variables');
    }

    const workouts = await fetchHevyWorkouts(hevyApiKey);

    // Write to public directory
    const publicPath = join(process.cwd(), 'public', 'hevy-workouts.json');
    await writeFile(publicPath, JSON.stringify(workouts, null, 2));

    console.log(`[Hevy Cron] Successfully updated ${workouts.length} workouts`);

    return new Response(JSON.stringify({
      success: true,
      workoutCount: workouts.length,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[Hevy Cron] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// Export prerender = false to make this a server endpoint in hybrid mode
export const prerender = false;

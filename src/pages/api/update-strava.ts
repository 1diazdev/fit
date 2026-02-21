import type { APIRoute } from 'astro';
import { writeFile } from 'fs/promises';
import { join } from 'path';

interface StravaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  token_type: string;
}

interface StravaActivity {
  id: number;
  name: string;
  distance: number;
  start_date: string;
  type: string;
}

interface DistanceMap {
  [key: string]: number;
}

const getBearerToken = async (): Promise<string> => {
  const clientId = import.meta.env.STRAVA_CLIENT_ID;
  const clientSecret = import.meta.env.STRAVA_CLIENT_SECRET;
  const refreshToken = import.meta.env.STRAVA_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing Strava credentials in environment variables');
  }

  const response = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const data: StravaTokenResponse = await response.json();
  if (!data.access_token) {
    throw new Error(`Strava auth failed: ${JSON.stringify(data)}`);
  }

  return `Bearer ${data.access_token}`;
};

const getAllActivities = async (bearer: string): Promise<StravaActivity[]> => {
  const oneYearAgo = Math.floor(Date.now() / 1000) - 365 * 24 * 60 * 60;
  let page = 1;
  let all: StravaActivity[] = [];

  while (true) {
    const url = `https://www.strava.com/api/v3/athlete/activities?after=${oneYearAgo}&per_page=200&page=${page}`;
    const res = await fetch(url, {
      headers: { Authorization: bearer },
    });

    const data: StravaActivity[] | { message?: string; errors?: any[] } =
      await res.json();

    if (!Array.isArray(data)) {
      if ('message' in data && data.message === 'Rate Limit Exceeded') {
        console.warn('Strava API rate limit exceeded');
      } else {
        console.error('Failed to fetch activities:', data);
      }
      break;
    }

    if (data.length === 0) break;

    all = all.concat(data);
    page++;
  }

  return all;
};

const summarizeDistance = (activities: StravaActivity[]): DistanceMap => {
  const distance: DistanceMap = {};

  for (const activity of activities) {
    const date = new Date(activity.start_date);
    // Convert to EST/EDT (America/New_York) - UTC-5
    const estDate = new Date(date.getTime() - 5 * 60 * 60 * 1000);
    const key = `${estDate.getFullYear()}-${estDate.getMonth() + 1}-${estDate.getDate()}`;

    distance[key] = (distance[key] || 0) + activity.distance;
  }

  return distance;
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
    console.log('[Strava Cron] Starting data update...');

    const bearer = await getBearerToken();
    const activities = await getAllActivities(bearer);
    const distanceMap = summarizeDistance(activities);

    // Write to public directory
    const publicPath = join(process.cwd(), 'public', 'last-activities.json');
    await writeFile(publicPath, JSON.stringify(distanceMap, null, 2));

    console.log(`[Strava Cron] Successfully updated ${Object.keys(distanceMap).length} days of data`);

    return new Response(JSON.stringify({
      success: true,
      activitiesCount: activities.length,
      daysTracked: Object.keys(distanceMap).length,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[Strava Cron] Error:', error);
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

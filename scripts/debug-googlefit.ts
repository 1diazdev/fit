/**
 * Debug Google Fit API requests
 */

import { refreshAccessToken } from '../src/services/googleFitService';

console.log('🔍 Debugging Google Fit API\n');

const refreshToken = process.env.GOOGLE_FIT_REFRESH_TOKEN;

if (!refreshToken) {
  console.error('❌ No refresh token found\n');
  process.exit(1);
}

const main = async () => {
  try {
    console.log('1️⃣ Getting access token...\n');
    const accessToken = await refreshAccessToken(refreshToken);
    console.log(`✅ Access token: ${accessToken.substring(0, 30)}...\n`);

    // Test simple API call
    console.log('2️⃣ Testing simple data sources list...\n');

    const dataSourcesUrl = 'https://www.googleapis.com/fitness/v1/users/me/dataSources';
    const dsResponse = await fetch(dataSourcesUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    console.log(`Status: ${dsResponse.status}\n`);

    if (dsResponse.ok) {
      const data = await dsResponse.json();
      console.log('✅ Data sources available:');
      console.log(JSON.stringify(data, null, 2).substring(0, 1000));
      console.log('\n');
    } else {
      const error = await dsResponse.text();
      console.log('❌ Error:', error, '\n');
    }

    // Test aggregate endpoint with minimal request
    console.log('3️⃣ Testing aggregate endpoint (last 7 days)...\n');

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    const aggregateUrl = 'https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate';

    const requestBody = {
      aggregateBy: [{
        dataTypeName: 'com.google.step_count.delta',
      }],
      bucketByTime: {
        durationMillis: 86400000 // 1 day
      },
      startTimeMillis: sevenDaysAgo,
      endTimeMillis: now,
    };

    console.log('Request body:');
    console.log(JSON.stringify(requestBody, null, 2));
    console.log('\n');

    const aggResponse = await fetch(aggregateUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log(`Status: ${aggResponse.status}\n`);

    if (aggResponse.ok) {
      const data = await aggResponse.json();
      console.log('✅ Success! Data:');
      console.log(JSON.stringify(data, null, 2).substring(0, 2000));
      console.log('\n');
    } else {
      const error = await aggResponse.text();
      console.log('❌ Error response:');
      console.log(error);
      console.log('\n');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
};

main();

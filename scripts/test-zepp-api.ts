/**
 * Zepp API Test Script
 *
 * Simple test to verify if the Zepp/Amazfit API is accessible and working
 *
 * Usage:
 *   1. Add ZEPP_EMAIL and ZEPP_PASSWORD to .env
 *   2. Run: bun run test-zepp
 */

console.log('🧪 Testing Zepp/Amazfit API\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const email = process.env.ZEPP_EMAIL;
const password = process.env.ZEPP_PASSWORD;

if (!email || !password) {
  console.error('❌ Missing credentials\n');
  console.log('Add to your .env file:');
  console.log('ZEPP_EMAIL=your_email@example.com');
  console.log('ZEPP_PASSWORD=your_password\n');
  process.exit(1);
}

console.log(`📧 Email: ${email}`);
console.log(`🔑 Password: ${'*'.repeat(password.length)}\n`);

const testAPI = async () => {
  const apiUrl = 'https://api-mifit-de2.huami.com/v2/registrations/tokens';

  console.log(`🔗 API Endpoint: ${apiUrl}\n`);
  console.log('🔄 Step 1: Testing API endpoint accessibility...\n');

  try {
    // First, just check if the endpoint is accessible
    console.log('   Making request to Zepp API...');

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'MiFit/4.6.0 (iPhone; iOS 14.4; Scale/2.00)',
      },
      body: JSON.stringify({
        email,
        password,
        grant_type: 'password',
      }),
    });

    console.log(`   Response status: ${response.status} ${response.statusText}\n`);

    // Read response
    const responseText = await response.text();

    if (!response.ok) {
      console.error('❌ Authentication failed!\n');
      console.log('Response body:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(responseText);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      console.log('💡 Possible reasons:');
      console.log('   - Wrong email or password');
      console.log('   - API endpoint has changed');
      console.log('   - API requires different authentication method');
      console.log('   - Account needs verification\n');

      process.exit(1);
    }

    // Parse JSON response
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('❌ Failed to parse JSON response\n');
      console.log('Raw response:');
      console.log(responseText);
      process.exit(1);
    }

    console.log('✅ API is accessible and responding!\n');
    console.log('📦 Response data structure:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(JSON.stringify(data, null, 2));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Check if we got the expected token structure
    if (data.token_info && data.token_info.access_token && data.token_info.refresh_token) {
      console.log('✅ SUCCESS! Authentication worked!\n');
      console.log('Token Information:');
      console.log(`   User ID: ${data.token_info.user_id || 'N/A'}`);
      console.log(`   Access Token: ${data.token_info.access_token.substring(0, 30)}...`);
      console.log(`   Refresh Token: ${data.token_info.refresh_token.substring(0, 30)}...`);
      console.log(`   Expires in: ${data.token_info.expires_in || 'N/A'} seconds\n`);

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🎉 Zepp API is working! You can proceed with setup.');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log('Next step: Run "bun run zepp-setup" to save the refresh token\n');

      // Test data endpoint
      console.log('🔄 Step 2: Testing data endpoint...\n');
      await testDataEndpoint(data.token_info.access_token, data.token_info.user_id);

    } else {
      console.warn('⚠️  Unexpected response structure\n');
      console.log('The API responded but the data format is different than expected.');
      console.log('The Zepp API may have changed.\n');
    }

  } catch (error) {
    console.error('\n❌ Network Error!\n');
    if (error instanceof Error) {
      console.error(`Error: ${error.message}\n`);
    }
    console.log('💡 This could mean:');
    console.log('   - No internet connection');
    console.log('   - API endpoint is down or has changed');
    console.log('   - DNS resolution failed\n');
    process.exit(1);
  }
};

const testDataEndpoint = async (accessToken: string, userId: string) => {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  const dataUrl = `https://api-mifit-de2.huami.com/v1/data/band_data.json?query_type=summary&device_type=0&from_date=${yesterday}&to_date=${today}`;

  console.log(`   Testing health data endpoint...`);
  console.log(`   Date range: ${yesterday} to ${today}\n`);

  try {
    const response = await fetch(dataUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'MiFit/4.6.0 (iPhone; iOS 14.4; Scale/2.00)',
      },
    });

    console.log(`   Data endpoint status: ${response.status} ${response.statusText}\n`);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Data endpoint works!\n');
      console.log('Sample data structure:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(JSON.stringify(data, null, 2).substring(0, 500) + '...');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      console.log('🎉 Complete success! The Zepp API integration should work.\n');
    } else {
      const errorText = await response.text();
      console.warn('⚠️  Data endpoint returned error\n');
      console.log('Response:', errorText.substring(0, 200));
      console.log('\nAuthentication works but data fetching may need adjustments.\n');
    }
  } catch (error) {
    console.warn('⚠️  Could not test data endpoint\n');
    console.log('This is okay - authentication is the main test.\n');
  }
};

testAPI();

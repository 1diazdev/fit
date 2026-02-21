/**
 * Debug Zepp API Authentication
 *
 * Tests different authentication formats to find what works
 */

console.log('🔍 Debugging Zepp API Authentication\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const email = process.env.ZEPP_EMAIL;
const password = process.env.ZEPP_PASSWORD;

if (!email || !password) {
  console.error('❌ Missing ZEPP_EMAIL or ZEPP_PASSWORD in .env\n');
  process.exit(1);
}

console.log(`📧 Email: ${email}`);
console.log(`🔑 Password: ${'*'.repeat(password.length)}\n`);

// Try different authentication methods
const testMethods = [
  {
    name: 'Method 1: JSON with Content-Type application/json',
    test: async () => {
      const response = await fetch('https://api-mifit-de2.huami.com/v2/registrations/tokens', {
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
      return response;
    }
  },
  {
    name: 'Method 2: URL-encoded form data',
    test: async () => {
      const params = new URLSearchParams({
        email,
        password,
        grant_type: 'password',
      });

      const response = await fetch('https://api-mifit-de2.huami.com/v2/registrations/tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'MiFit/4.6.0 (iPhone; iOS 14.4; Scale/2.00)',
        },
        body: params.toString(),
      });
      return response;
    }
  },
  {
    name: 'Method 3: JSON without explicit Content-Type',
    test: async () => {
      const response = await fetch('https://api-mifit-de2.huami.com/v2/registrations/tokens', {
        method: 'POST',
        headers: {
          'User-Agent': 'MiFit/4.6.0 (iPhone; iOS 14.4; Scale/2.00)',
        },
        body: JSON.stringify({
          email,
          password,
          grant_type: 'password',
        }),
      });
      return response;
    }
  },
  {
    name: 'Method 4: Different API version endpoint',
    test: async () => {
      const response = await fetch('https://api-mifit-de2.huami.com/registrations/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'MiFit/4.6.0 (iPhone; iOS 14.4; Scale/2.00)',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });
      return response;
    }
  },
  {
    name: 'Method 5: Alternative Huami endpoint',
    test: async () => {
      const response = await fetch('https://account.huami.com/v2/client/login', {
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
      return response;
    }
  },
  {
    name: 'Method 6: Account-region specific endpoint',
    test: async () => {
      const response = await fetch('https://api-user.huami.com/registrations/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'MiFit/4.6.0 (iPhone; iOS 14.4; Scale/2.00)',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });
      return response;
    }
  },
];

const runTests = async () => {
  for (let i = 0; i < testMethods.length; i++) {
    const method = testMethods[i];

    console.log(`\n🔄 Testing ${method.name}...`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      const response = await method.test();
      const status = response.status;
      const statusText = response.statusText;

      console.log(`   Status: ${status} ${statusText}`);

      const responseText = await response.text();

      if (response.ok) {
        console.log('   ✅ SUCCESS! This method works!\n');
        console.log('   Response:');
        try {
          const data = JSON.parse(responseText);
          console.log(JSON.stringify(data, null, 2));

          if (data.token_info || data.access_token || data.refresh_token) {
            console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('🎉 FOUND WORKING METHOD!');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

            console.log(`Use this method: ${method.name}\n`);
            process.exit(0);
          }
        } catch (e) {
          console.log(responseText);
        }
      } else {
        console.log(`   ❌ Failed with ${status}`);
        console.log(`   Response: ${responseText.substring(0, 200)}`);
      }

    } catch (error) {
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    // Wait a bit between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('⚠️  None of the methods worked');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('💡 Possible reasons:');
  console.log('   1. The Zepp API has changed significantly');
  console.log('   2. Your account region uses a different endpoint');
  console.log('   3. Additional authentication steps are required');
  console.log('   4. The API now requires app-specific tokens\n');
  console.log('🔍 Next steps:');
  console.log('   1. Try logging into the Zepp web interface at: https://www.zepp.com');
  console.log('   2. Check if you can export data from the Zepp app directly');
  console.log('   3. Consider using alternative data export methods\n');
};

runTests();

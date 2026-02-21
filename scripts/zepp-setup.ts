/**
 * Zepp/Amazfit One-Time Setup Script
 *
 * This script authenticates with Zepp using email/password
 * and generates a long-lived refresh token (valid ~10 years).
 *
 * Usage:
 *   1. Add ZEPP_EMAIL and ZEPP_PASSWORD to your .env file
 *   2. Run: bun run zepp-setup
 *   3. Copy the ZEPP_REFRESH_TOKEN to your .env file
 *   4. Remove ZEPP_EMAIL and ZEPP_PASSWORD from .env (optional, for security)
 *
 * The refresh token can be used to get access tokens without
 * re-entering credentials.
 */

import { authenticateZepp } from '../src/services/zeppService';

const main = async (): Promise<void> => {
  console.log('🔐 Zepp/Amazfit Setup - Generate Refresh Token\n');

  // Get credentials from environment
  const email = process.env.ZEPP_EMAIL;
  const password = process.env.ZEPP_PASSWORD;

  if (!email || !password) {
    console.error('❌ Error: ZEPP_EMAIL and ZEPP_PASSWORD must be set in .env file\n');
    console.log('📝 Add to your .env file:');
    console.log('   ZEPP_EMAIL=your_email@example.com');
    console.log('   ZEPP_PASSWORD=your_password\n');
    process.exit(1);
  }

  console.log(`📧 Email: ${email}`);
  console.log(`🔑 Password: ${'*'.repeat(password.length)}\n`);
  console.log('🔄 Authenticating with Zepp/Amazfit API...\n');

  try {
    const tokenResponse = await authenticateZepp(email, password);

    console.log('✅ Authentication successful!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 SAVE THIS REFRESH TOKEN TO YOUR .env FILE:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`ZEPP_REFRESH_TOKEN=${tokenResponse.token_info.refresh_token}\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('ℹ️  Token Information:');
    console.log(`   User ID: ${tokenResponse.token_info.user_id}`);
    console.log(`   Expires in: ${tokenResponse.token_info.expires_in} seconds (~${Math.floor(tokenResponse.token_info.expires_in / 86400)} days)`);
    console.log(`   Token type: ${tokenResponse.token_info.token_type}\n`);

    console.log('📝 Next Steps:');
    console.log('   1. Copy the ZEPP_REFRESH_TOKEN above');
    console.log('   2. Add it to your .env file');
    console.log('   3. (Optional) Remove ZEPP_EMAIL and ZEPP_PASSWORD from .env for security');
    console.log('   4. Run: bun run zepp-script to fetch health data\n');

    console.log('✨ Setup complete! The refresh token is valid for approximately 10 years.\n');
  } catch (error) {
    console.error('\n❌ Authentication failed!\n');
    if (error instanceof Error) {
      console.error(`Error: ${error.message}\n`);
    } else {
      console.error('Unknown error occurred\n');
    }

    console.log('💡 Troubleshooting:');
    console.log('   - Verify your email and password are correct');
    console.log('   - Make sure you can log in to the Zepp app');
    console.log('   - Check your internet connection');
    console.log('   - The Zepp API may be temporarily unavailable\n');

    process.exit(1);
  }
};

// Run the script
main();

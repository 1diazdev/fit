/**
 * Google Fit OAuth Setup Script
 *
 * This script helps you authorize the app and generate a refresh token
 *
 * Prerequisites:
 *   1. Create a project in Google Cloud Console
 *   2. Enable Google Fit API
 *   3. Create OAuth 2.0 credentials (Desktop app)
 *   4. Add credentials to .env file
 *
 * Usage:
 *   1. Add GOOGLE_FIT_CLIENT_ID and GOOGLE_FIT_CLIENT_SECRET to .env
 *   2. Run: bun run googlefit-setup
 *   3. Follow the authorization URL
 *   4. Paste the authorization code when prompted
 *   5. Copy the GOOGLE_FIT_REFRESH_TOKEN to .env
 */

import { exchangeCodeForTokens } from "../src/services/googleFitService";

console.log("🔐 Google Fit OAuth Setup\n");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

// Check environment variables
const clientId = process.env.GOOGLE_FIT_CLIENT_ID;
const clientSecret = process.env.GOOGLE_FIT_CLIENT_SECRET;
const redirectUri =
  process.env.GOOGLE_FIT_REDIRECT_URI || "http://localhost:3000/callback";

if (!clientId || !clientSecret) {
  console.error("❌ Missing Google Fit credentials\n");
  console.log("Add to your .env file:");
  console.log("GOOGLE_FIT_CLIENT_ID=your_client_id.apps.googleusercontent.com");
  console.log("GOOGLE_FIT_CLIENT_SECRET=your_client_secret");
  console.log("GOOGLE_FIT_REDIRECT_URI=http://localhost:3000/callback\n");
  console.log(
    "💡 Get credentials from: https://console.cloud.google.com/apis/credentials\n",
  );
  process.exit(1);
}

console.log("✅ Credentials found");
console.log(`   Client ID: ${clientId.substring(0, 30)}...`);
console.log(`   Redirect URI: ${redirectUri}\n`);

// Required scopes for Google Fit
const scopes = [
  "https://www.googleapis.com/auth/fitness.activity.read",
  "https://www.googleapis.com/auth/fitness.body.read",
  "https://www.googleapis.com/auth/fitness.heart_rate.read",
  "https://www.googleapis.com/auth/fitness.sleep.read",
  "https://www.googleapis.com/auth/fitness.location.read",
];

// Generate authorization URL
const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.searchParams.set("client_id", clientId);
authUrl.searchParams.set("redirect_uri", redirectUri);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", scopes.join(" "));
authUrl.searchParams.set("access_type", "offline");
authUrl.searchParams.set("prompt", "consent");

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("📋 STEP 1: Authorize the Application");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
console.log("1. Open this URL in your browser:\n");
console.log(authUrl.toString());
console.log("\n2. Sign in with your Google account");
console.log("3. Grant permissions to access your Google Fit data");
console.log("4. You will be redirected to a URL that looks like:");
console.log(`   ${redirectUri}?code=AUTHORIZATION_CODE`);
console.log("\n5. Copy the AUTHORIZATION_CODE from the URL\n");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

// Wait for user to paste the code
const readline = await import("readline");
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const askForCode = (): Promise<string> => {
  return new Promise(resolve => {
    rl.question("Paste the authorization code here: ", answer => {
      resolve(answer.trim());
    });
  });
};

const code = await askForCode();
rl.close();

if (!code) {
  console.error("\n❌ No authorization code provided\n");
  process.exit(1);
}

console.log("\n🔄 Exchanging authorization code for tokens...\n");

try {
  const tokens = await exchangeCodeForTokens(code);

  console.log("✅ Successfully obtained tokens!\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📋 ADD THIS TO YOUR .env FILE:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  console.log(`GOOGLE_FIT_REFRESH_TOKEN=${tokens.refresh_token}\n`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("ℹ️  Token Information:");
  console.log(`   Access Token: ${tokens.access_token.substring(0, 30)}...`);
  console.log(`   Refresh Token: ${tokens.refresh_token.substring(0, 30)}...`);
  console.log(
    `   Expires in: ${tokens.expires_in} seconds (~${Math.floor(tokens.expires_in / 3600)} hours)`,
  );
  console.log(`   Scopes: ${tokens.scope}\n`);

  console.log("📝 Next Steps:");
  console.log("   1. Copy the GOOGLE_FIT_REFRESH_TOKEN above");
  console.log("   2. Add it to your .env file");
  console.log("   3. Run: bun run googlefit-script to fetch health data\n");

  console.log("✨ Setup complete!\n");
} catch (error) {
  console.error("\n❌ Failed to exchange code for tokens!\n");
  if (error instanceof Error) {
    console.error(`Error: ${error.message}\n`);
  }

  console.log("💡 Troubleshooting:");
  console.log("   - Make sure you pasted the complete authorization code");
  console.log("   - Verify your Client ID and Client Secret are correct");
  console.log("   - Check that the redirect URI matches exactly");
  console.log(
    "   - The authorization code is single-use - generate a new one if needed\n",
  );

  process.exit(1);
}

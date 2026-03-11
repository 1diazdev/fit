# Google Fit API Setup Guide

Complete guide to set up Google Fit API integration for the Fitness Matrix project.

---

## 📋 Prerequisites

- Google account (the same one used with Zepp/Mi Fit app)
- Zepp app connected to Google Fit (✅ you already have this!)
- Access to Google Cloud Console

---

## 🚀 Step-by-Step Setup

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown (top left, next to "Google Cloud")
3. Click **"New Project"**
4. Enter project details:
   - **Project name**: `Fitness Matrix` (or your preferred name)
   - **Organization**: Leave as default (No organization)
5. Click **"Create"**
6. Wait for the project to be created (~30 seconds)

---

### Step 2: Enable Google Fit API

1. Make sure your new project is selected (check top bar)
2. Go to **"APIs & Services" → "Library"** (left sidebar)
3. Search for **"Fitness API"** or **"Google Fit API"**
4. Click on **"Fitness API"**
5. Click **"Enable"**
6. Wait for it to enable (~10 seconds)

---

### Step 3: Configure OAuth Consent Screen

Before creating credentials, you need to configure the OAuth consent screen:

1. Go to **"APIs & Services" → "OAuth consent screen"**
2. Choose **"External"** user type
3. Click **"Create"**

**OAuth Consent Screen Form:**

**App Information:**

- **App name**: `Fitness Matrix`
- **User support email**: Your email address
- **App logo**: (optional, skip for now)

**App Domain:**

- Leave blank for now (optional for testing)

**Developer contact information:**

- **Email addresses**: Your email address

4. Click **"Save and Continue"**

**Scopes:**

5. Click **"Add or Remove Scopes"**
6. Manually add these scopes (paste in the text box):
   ```
   https://www.googleapis.com/auth/fitness.activity.read
   https://www.googleapis.com/auth/fitness.body.read
   https://www.googleapis.com/auth/fitness.heart_rate.read
   https://www.googleapis.com/auth/fitness.sleep.read
   https://www.googleapis.com/auth/fitness.location.read
   ```
7. Click **"Update"**
8. Click **"Save and Continue"**

**Test Users:**

9. Click **"Add Users"**
10. Add your Google account email (the one connected to Google Fit)
11. Click **"Add"**
12. Click **"Save and Continue"**

**Summary:**

13. Review everything
14. Click **"Back to Dashboard"**

---

### Step 4: Create OAuth 2.0 Credentials

1. Go to **"APIs & Services" → "Credentials"**
2. Click **"Create Credentials"** (top bar)
3. Select **"OAuth client ID"**

**Create OAuth client ID:**

4. **Application type**: Select **"Desktop app"**
   - (If you don't see this option, select "Web application")
5. **Name**: `Fitness Matrix Desktop` (or any name)
6. Click **"Create"**

**Important:** A popup will show your credentials

7. **COPY THESE IMMEDIATELY:**
   - **Client ID**: Something like `123456789-abcdefg.apps.googleusercontent.com`
   - **Client Secret**: Something like `GOCSPX-abc123def456`

8. Click **"Download JSON"** (optional, for backup)
9. Click **"OK"**

---

### Step 5: Add Credentials to .env

1. Open your `.env` file
2. Add these lines:

```bash
# Google Fit API
GOOGLE_FIT_CLIENT_ID=paste_your_client_id_here.apps.googleusercontent.com
GOOGLE_FIT_CLIENT_SECRET=paste_your_client_secret_here
GOOGLE_FIT_REDIRECT_URI=http://localhost:3000/callback
```

**Example:**

```bash
GOOGLE_FIT_CLIENT_ID=123456789-abc123.apps.googleusercontent.com
GOOGLE_FIT_CLIENT_SECRET=GOCSPX-xyz789abc456
GOOGLE_FIT_REDIRECT_URI=http://localhost:3000/callback
```

3. Save the file

---

### Step 6: Run Setup Script

Now run the OAuth authorization flow:

```bash
bun run googlefit-setup
```

**What will happen:**

1. The script will generate an authorization URL
2. Copy the entire URL
3. Paste it in your browser
4. Sign in with your Google account
5. Grant permissions (click "Allow")
6. You'll be redirected to a URL like:
   ```
   http://localhost:3000/callback?code=4/0AY0e-g7abc123...
   ```
7. **Copy the code** (everything after `code=`)
8. Paste it in the terminal when prompted
9. The script will exchange the code for a refresh token

**Output:**

```
✅ Successfully obtained tokens!

GOOGLE_FIT_REFRESH_TOKEN=1//0eabc123def456...
```

10. **Copy the refresh token**
11. Add it to your `.env` file:

```bash
GOOGLE_FIT_REFRESH_TOKEN=1//0eabc123def456...
```

---

### Step 7: Test Data Fetch

Now test if everything works:

```bash
bun run googlefit-script
```

**Expected output:**

```
✅ Data fetched successfully in 3.45s

📊 Data Summary:
   Steps data: 365 days
   Sleep data: 123 days
   Heart rate data: 30 days

   Average daily steps: 8,234
   Average daily distance: 5.89 km
   Average sleep: 7h 23m per night
   Average heart rate: 72 bpm

✅ Health data saved to public/health-data.json
```

---

## 🎉 Success!

If you see the output above, Google Fit API is working!

Your health data from Zepp (synced via Google Fit) is now being fetched automatically.

---

## 📝 Next Steps

1. **Add to Netlify Functions** (for automatic daily updates)
2. **Create health dashboard components**
3. **Visualize your data!**

---

## 🐛 Troubleshooting

### Error: "Missing credentials"

**Solution:** Make sure you added `GOOGLE_FIT_CLIENT_ID` and `GOOGLE_FIT_CLIENT_SECRET` to `.env`

### Error: "redirect_uri_mismatch"

**Solution:**

1. Go to Google Cloud Console → Credentials
2. Click on your OAuth client ID
3. Add `http://localhost:3000/callback` to "Authorized redirect URIs"
4. Save and try again

### Error: "Access not configured"

**Solution:** Make sure you enabled the Fitness API in Step 2

### Error: "invalid_grant"

**Solution:**

1. Your refresh token may have expired
2. Run `bun run googlefit-setup` again
3. Get a new refresh token

### Error: "insufficient permissions"

**Solution:**

1. Make sure you added all 5 scopes in Step 3
2. When authorizing, make sure you clicked "Allow" for all permissions

### No data returned / Empty response

**Possible causes:**

1. You haven't used your Zepp device recently
2. Zepp hasn't synced to Google Fit yet
   - Open Zepp app
   - Go to Profile → Third-party access
   - Tap Google Fit → Sync now
3. Google Fit doesn't have data yet (takes time after first sync)

---

## 📚 Useful Links

- [Google Fit API Documentation](https://developers.google.com/fit)
- [Google Cloud Console](https://console.cloud.google.com/)
- [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/) (for testing)

---

## 🔐 Security Notes

- ✅ The refresh token is long-lived (doesn't expire)
- ✅ Store it securely in `.env` (never commit to git)
- ✅ You can revoke access anytime at: https://myaccount.google.com/permissions
- ✅ The app only has READ permissions (cannot modify your data)

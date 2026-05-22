# Android Bundle (AAB) Build Instructions for Play Store

## Prerequisites

1. **Expo Account**: You need an Expo account (free)
2. **EAS CLI**: Already installed (`eas-cli/16.28.0`)
3. **Google Play Console**: Account with app created

## Step 1: Login to Expo

```bash
npx eas login
```

If you don't have an account, create one at: https://expo.dev/signup

## Step 2: Initialize EAS Project (if not done)

```bash
npx eas build:configure
```

This will:
- Create/update `eas.json`
- Set up project ID in `app.json`

## Step 3: Build Android Bundle (AAB) for Play Store

```bash
npx eas build --platform android --profile production
```

Or use the npm script:
```bash
npm run build:android
```

## Build Options

- **Production Build (AAB)**: `npx eas build --platform android --profile production`
- **Preview Build (APK)**: `npx eas build --platform android --profile preview`

## What Happens During Build

1. EAS will upload your code to Expo's servers
2. Build will run in the cloud (takes 10-20 minutes)
3. You'll get a download link for the `.aab` file
4. Download the `.aab` file and upload to Play Store

## After Build Completes

1. Download the `.aab` file from the build page
2. Go to Google Play Console
3. Navigate to your app → Release → Production (or Internal Testing)
4. Create a new release
5. Upload the `.aab` file
6. Fill in release notes
7. Submit for review

## Important Notes

- **Package Name**: `com.jainsilver.app` (set in `app.json`)
- **Version Code**: Auto-increments with each build
- **Version Name**: `1.0.0` (update in `app.json` for new releases)
- **Icon**: Uses `jain_logo.png` (1024x1024px recommended)

## Updating App Version

Before each new build, update version in `app.json`:
```json
{
  "version": "1.0.1",  // Update this
  "android": {
    "versionCode": 2  // Increment this
  }
}
```

## Troubleshooting

### Build Fails
- Check EAS build logs: `npx eas build:list`
- Ensure all dependencies are in `package.json`
- Check `app.json` for errors

### Icon Issues
- Icon should be 1024x1024px PNG
- Use `jain_logo.png` (already configured)

### Signing Issues
- EAS handles signing automatically
- No need for manual keystore management

## Quick Commands

```bash
# Login
npx eas login

# Build for Play Store (AAB)
npx eas build --platform android --profile production

# Check build status
npx eas build:list

# View build details
npx eas build:view [BUILD_ID]
```


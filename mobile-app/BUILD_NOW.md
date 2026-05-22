# Build Android Bundle Now - Step by Step

## Your Expo Project is Ready!
- **Project**: jain-silver-plaza
- **Project ID**: 0661cda9-b036-4df9-8a50-a4c7443d3a4d
- **Dashboard**: https://expo.dev/accounts/konapalask/projects/jain-silver-plaza

## Quick Build (Choose One Method)

### Method 1: Command Line (Recommended)

1. **Link Project** (if not already linked):
   ```bash
   cd mobile-app
   npx eas init
   ```
   - Answer **Y** when asked to link to existing project
   - It will detect: @konapalask/jain-silver-plaza

2. **Build Android Bundle**:
   ```bash
   npx eas build --platform android --profile production
   ```
   - Build runs in cloud (10-20 minutes)
   - You'll get email notification when done
   - Download link will be in Expo dashboard

### Method 2: Expo Dashboard (Easiest)

1. **Go to your project**: https://expo.dev/accounts/konapalask/projects/jain-silver-plaza
2. **Click "Builds"** in left sidebar
3. **Click "New Build"** button
4. **Select**:
   - Platform: **Android**
   - Profile: **Production**
   - Build Type: **App Bundle (AAB)**
5. **Click "Build"**
6. **Wait** for build to complete (10-20 minutes)
7. **Download** the `.aab` file when ready

## After Build Completes

1. **Download** the `.aab` file from Expo dashboard
2. **Go to Google Play Console**: https://play.google.com/console
3. **Select your app** (or create new app)
   - Package name: `com.jainsilver.app`
4. **Navigate to**: Release → Production (or Internal Testing)
5. **Create new release** → Upload the `.aab` file
6. **Fill release notes**:
   ```
   Jain Silver Plaza - Initial Release
   
   Features:
   - Live silver rates updated every second
   - User registration and verification
   - Admin dashboard for rate management
   - Store location and contact information
   - Real-time rate color indicators
   ```
7. **Submit for review**

## Current App Details

- **App Name**: Jain Silver Plaza
- **Package**: com.jainsilver.app
- **Version**: 1.0.0
- **Version Code**: 1
- **Icon**: jain_logo.png
- **Build Type**: App Bundle (AAB) for Play Store

## Next Build (After First Release)

Before building again, update version in `app.json`:
```json
{
  "version": "1.0.1",  // Increment version
  "android": {
    "versionCode": 2  // Increment version code
  }
}
```

Then build again with same command.

## Troubleshooting

### Build fails?
- Check build logs in Expo dashboard
- Ensure all dependencies are installed: `npm install`
- Check `app.json` for errors

### Need help?
- Expo Docs: https://docs.expo.dev/build/introduction/
- Your project: https://expo.dev/accounts/konapalask/projects/jain-silver-plaza


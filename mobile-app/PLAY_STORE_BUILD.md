# Play Store Android Bundle (AAB) Build Guide

## Quick Start - Build Android Bundle

### Option 1: Using EAS Build (Recommended - Cloud Build)

1. **Login to Expo**:
   ```bash
   npx eas login
   ```
   (Create account at https://expo.dev/signup if needed)

2. **Configure EAS Project**:
   ```bash
   npx eas build:configure
   ```
   - Answer "Y" to create EAS project automatically
   - This will generate a project ID

3. **Build Android Bundle (AAB)**:
   ```bash
   npx eas build --platform android --profile production
   ```
   - This will build in the cloud (takes 10-20 minutes)
   - You'll get a download link when done

4. **Download and Upload to Play Store**:
   - Download the `.aab` file from the build page
   - Upload to Google Play Console → Your App → Release → Production

### Option 2: Local Build (Requires Android Studio)

If you prefer local build:

1. **Install Expo CLI**:
   ```bash
   npm install -g expo-cli
   ```

2. **Build Locally**:
   ```bash
   expo build:android -t app-bundle
   ```

## Current Configuration

- **App Name**: Jain Silver Plaza
- **Package Name**: com.jainsilver.app
- **Version**: 1.0.0
- **Version Code**: 1 (auto-increments)
- **Icon**: jain_logo.png
- **Build Type**: app-bundle (AAB) for Play Store

## Before Building

### 1. Update App Version (if needed)
Edit `app.json`:
```json
{
  "version": "1.0.0",  // Update for new releases
  "android": {
    "versionCode": 1  // Increment for each Play Store release
  }
}
```

### 2. Ensure Icon is Proper Size
- Icon should be at least 1024x1024px
- Currently using: `assets/jain_logo.png`
- If icon is too small, replace it with a larger version

### 3. Test the App First
```bash
npm start
# Then scan QR code with Expo Go app
```

## Build Commands

```bash
# Production build (AAB for Play Store)
npx eas build --platform android --profile production

# Preview build (APK for testing)
npx eas build --platform android --profile preview

# Check build status
npx eas build:list

# View specific build
npx eas build:view [BUILD_ID]
```

## After Build

1. **Download the AAB file** from Expo dashboard
2. **Go to Google Play Console**: https://play.google.com/console
3. **Select your app** (or create new app with package: `com.jainsilver.app`)
4. **Navigate to**: Release → Production (or Internal Testing)
5. **Create new release** → Upload AAB file
6. **Fill release notes**:
   ```
   Initial release of Jain Silver Plaza app
   - Live silver rates from RB Goldspot
   - User registration and verification
   - Admin dashboard for rate management
   - Store location and contact information
   ```
7. **Submit for review**

## Important Files

- `app.json` - App configuration
- `eas.json` - Build configuration
- `package.json` - Dependencies
- `assets/jain_logo.png` - App icon

## Troubleshooting

### "Not logged in" error
```bash
npx eas login
```

### "Invalid project ID" error
```bash
npx eas build:configure
# Answer Y to create new project
```

### Build fails
- Check build logs: `npx eas build:list`
- Ensure all dependencies installed: `npm install`
- Check `app.json` for syntax errors

### Icon not showing
- Ensure icon is PNG format
- Minimum size: 1024x1024px
- Check file path in `app.json`

## Next Steps After First Build

1. **Test the AAB** using Internal Testing track first
2. **Update version** in `app.json` for next release
3. **Increment versionCode** for each Play Store release
4. **Keep EAS project ID** - don't change it

## Support

- EAS Build Docs: https://docs.expo.dev/build/introduction/
- Play Store Help: https://support.google.com/googleplay/android-developer


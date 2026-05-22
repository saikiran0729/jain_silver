# Build APK for Local Installation

## Quick Build APK

### Step 1: Login to Expo (if not already logged in)
```bash
cd mobile-app
npx eas login
```
Create account at https://expo.dev/signup if needed

### Step 2: Build APK
```bash
npx eas build --platform android --profile preview
```

This will:
- Build APK in the cloud (takes 10-20 minutes)
- Send you a download link via email
- You can download the APK file directly

### Step 3: Install APK on Your Device

1. **Download the APK** from the link provided by Expo
2. **Transfer to your Android device** (via USB, email, or cloud storage)
3. **Enable "Install from Unknown Sources"** on your Android device:
   - Go to Settings → Security → Enable "Unknown Sources" or "Install Unknown Apps"
4. **Tap the APK file** on your device to install
5. **Open the app** - "Jain Silver Plaza" will be ready to use!

## Alternative: Use npm script
```bash
npm run build:android:preview
```

## Build Status

After starting the build, you can:
- Check status: `npx eas build:list`
- View in browser: https://expo.dev/accounts/konapalask/projects/jain-silver-plaza/builds

## Current Configuration

- **Build Type**: APK (Android Package)
- **Profile**: Preview (for local installation)
- **App Name**: Jain Silver Plaza
- **Package**: com.jainsilver.app
- **Version**: 1.0.0

## Notes

- APK file will be ~20-50 MB in size
- Build takes 10-20 minutes
- You'll receive email notification when build completes
- APK can be installed on any Android device (no Play Store needed)


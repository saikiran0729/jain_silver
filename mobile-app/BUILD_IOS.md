# Build iOS App Guide

## Prerequisites

1. **Apple Developer Account** - You need an active Apple Developer account ($99/year)
   - Sign up at: https://developer.apple.com/programs/

2. **EAS CLI** - Already installed in this project

## Step-by-Step Build Process

### Step 1: Set Up iOS Credentials (First Time Only)

Run this command and follow the prompts:

```bash
cd mobile-app
npx eas credentials
```

When prompted:
1. Select **iOS** platform
2. Select **preview** profile (for testing) or **production** (for App Store)
3. Answer **Y** to log in to your Apple account
4. Enter your Apple ID and password
5. EAS will automatically generate certificates and provisioning profiles

### Step 2: Build iOS App

**For Preview/Testing:**
```bash
npm run build:ios:preview
```

**For Production/App Store:**
```bash
npm run build:ios
```

### Step 3: Answer Build Prompts

During the build, you may be asked:
- **iOS app only uses standard/exempt encryption?** → Answer **Y** (Yes)
  - This is already configured in `app.json` with `ITSAppUsesNonExemptEncryption: false`

### Step 4: Download Your Build

- The build will take 15-30 minutes
- You'll receive an email when it's complete
- Download link will be provided in the terminal
- Or check: https://expo.dev/accounts/konapalask/projects/jain-silver-2/builds

## Build Output

- **Preview builds**: `.ipa` file for ad-hoc distribution (TestFlight or direct install)
- **Production builds**: `.ipa` file ready for App Store submission

## Current Configuration

- **Bundle Identifier**: `com.jainsilver.app`
- **App Name**: Jain Silver Plaza
- **Version**: 1.0.0
- **Encryption**: Standard/Exempt (configured)

## Troubleshooting

### If credentials setup fails:
1. Make sure you have an active Apple Developer account
2. Ensure your Apple ID has proper permissions
3. Try running `npx eas credentials` again

### If build fails:
1. Check your Apple Developer account status
2. Verify bundle identifier matches your Apple Developer account
3. Check build logs at: https://expo.dev/accounts/konapalask/projects/jain-silver-2/builds

## Quick Commands

```bash
# Set up credentials
npx eas credentials

# Build iOS preview
npm run build:ios:preview

# Build iOS production
npm run build:ios

# Build both Android and iOS
npm run build:all:preview
npm run build:all
```


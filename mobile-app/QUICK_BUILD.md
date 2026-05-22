# Quick Build Guide for Play Store

## Your Expo Project
- **Account**: konapalask
- **Project**: jain-silver-plaza
- **URL**: https://expo.dev/accounts/konapalask/projects/jain-silver-plaza

## To Build Android Bundle (AAB)

### Step 1: Login (if not already)
```bash
npx eas login
```

### Step 2: Link to Your Project
```bash
npx eas init
```
- Select "Link to existing project"
- Choose: jain-silver-plaza
- Or enter project ID if prompted

### Step 3: Build
```bash
npx eas build --platform android --profile production
```

## Alternative: Build from Expo Dashboard

1. Go to: https://expo.dev/accounts/konapalask/projects/jain-silver-plaza
2. Click "Builds" → "New Build"
3. Select: Android → Production → App Bundle (AAB)
4. Click "Build"
5. Wait 10-20 minutes
6. Download the `.aab` file when ready

## Upload to Play Store

1. Download the `.aab` file
2. Go to Google Play Console
3. Your App → Release → Production
4. Create new release → Upload AAB
5. Submit for review

## Current Configuration

- **Package**: com.jainsilver.app
- **Version**: 1.0.0
- **Version Code**: 1 (auto-increments)
- **Slug**: jain-silver-plaza


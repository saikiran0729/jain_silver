# Build New Release for Closed Testing

## Quick Steps

1. **Version Updated**: versionCode incremented from 1 to 2 in app.json

2. **Build the AAB**:
   ```bash
   npm run build:android
   ```
   OR
   ```bash
   npx eas build --platform android --profile production
   ```

3. **Wait for Build** (10-20 minutes):
   - Build runs in the cloud
   - You'll get a link when it's done
   - Check status at: https://expo.dev/accounts/konapalask/projects/jain-silver-2/builds

4. **Download the AAB File**:
   - Click the download link from the build page
   - Save the `.aab` file

5. **Upload to Google Play Console**:
   - Go to: https://play.google.com/console
   - Select your app
   - Navigate to: Release → Testing → Closed testing
   - Click "Create new release"
   - Upload the new `.aab` file
   - Add release notes
   - Save as draft or submit

## Current Version Info
- **Version Name**: 1.0.0
- **Version Code**: 2 (incremented)
- **Package**: com.jainsilver.app

## If Build Fails
- Make sure you're logged in: `npx eas login`
- Check you have an EAS account at expo.dev


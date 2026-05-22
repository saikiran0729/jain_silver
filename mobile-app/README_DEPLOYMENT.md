# Mobile App Deployment to Play Store

## Quick Start

1. **Install EAS CLI**
   ```bash
   npm install -g eas-cli
   ```

2. **Login to Expo**
   ```bash
   eas login
   ```

3. **Configure EAS**
   ```bash
   cd mobile-app
   eas build:configure
   ```

4. **Update API URLs**
   - Edit `config/api.js` - Set production URL
   - Edit `screens/HomeScreen.js` - Set Socket.io URL

5. **Build for Production**
   ```bash
   eas build --platform android --profile production
   ```

6. **Submit to Play Store**
   - Download AAB from Expo dashboard
   - Upload to Google Play Console
   - Complete store listing
   - Submit for review

## Before Building

### 1. Update API Configuration

**File: `mobile-app/config/api.js`**
```javascript
const API_BASE_URL = __DEV__ 
  ? 'http://YOUR_LOCAL_IP:5000/api'
  : 'https://YOUR_VERCEL_APP.vercel.app/api'; // UPDATE THIS!
```

**File: `mobile-app/screens/HomeScreen.js`**
```javascript
const SOCKET_URL = __DEV__ 
  ? 'http://YOUR_LOCAL_IP:5000'
  : 'https://YOUR_VERCEL_APP.vercel.app'; // UPDATE THIS!
```

### 2. Update app.json

- Set correct `version` and `versionCode`
- Update `extra.eas.projectId` from Expo dashboard
- Verify app icon and splash screen paths

### 3. Test Locally

```bash
npm start
# Test on physical device or emulator
```

## Build Commands

```bash
# Production build (AAB for Play Store)
eas build --platform android --profile production

# Preview build (APK for testing)
eas build --platform android --profile preview

# Check build status
eas build:list

# Download build
eas build:download
```

## Play Store Requirements

- App icon: 512x512 PNG
- Feature graphic: 1024x500 PNG
- Screenshots: At least 2 (phone and tablet)
- Privacy policy URL (required)
- Content rating questionnaire
- Short description (80 chars max)
- Full description (4000 chars max)

## Version Management

For each new release:
1. Update `version` in `app.json` (e.g., "1.0.1")
2. Increment `android.versionCode` (e.g., 2)
3. Build new AAB
4. Upload to Play Store


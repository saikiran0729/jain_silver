# Jain Silver Mobile App

React Native mobile application built with Expo.

## Installation

```bash
npm install
```

## Configuration

Update `config/api.js` with your backend URL:
- Development: Use your local IP address
- Production: Use your production backend URL

## Running the App

```bash
# Start Expo development server
npm start

# Run on Android
npm run android

# Run on iOS
npm run ios

# Run on web
npm run web
```

## Building APK

### Using EAS Build (Recommended)

```bash
# Install EAS CLI
npm install -g eas-cli

# Login
eas login

# Configure
eas build:configure

# Build APK
eas build --platform android --profile preview
```

### Using Expo CLI

```bash
expo build:android -t apk
```

## App Structure

- `screens/` - All app screens
- `config/` - Configuration files
- `context/` - React context providers
- `App.js` - Main app component

## Features

- User registration with document upload
- OTP verification
- Sign in (email/phone)
- Real-time silver rates
- Admin dashboard

## Requirements

- Node.js 14+
- Expo CLI
- Android Studio (for Android development)
- Xcode (for iOS development, macOS only)


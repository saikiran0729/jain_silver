# ⚠️ IMPORTANT: Update API URLs Before Building

Before building the production app, you **MUST** update these files with your Vercel backend URL.

## Step 1: Get Your Vercel URL

After deploying to Vercel, you'll get a URL like:
```
https://jain-silver-backend.vercel.app
```

## Step 2: Update API Configuration

### File 1: `mobile-app/config/api.js`

**Find this line:**
```javascript
const API_BASE_URL = __DEV__ 
  ? 'http://192.168.29.215:5000/api' // Your local IP address for development
  : 'https://your-vercel-app.vercel.app/api'; // Your Vercel production URL
```

**Replace `your-vercel-app.vercel.app` with your actual Vercel URL:**
```javascript
const API_BASE_URL = __DEV__ 
  ? 'http://192.168.29.215:5000/api' // Your local IP address for development
  : 'https://jain-silver-backend.vercel.app/api'; // ✅ UPDATE THIS!
```

### File 2: `mobile-app/screens/HomeScreen.js`

**Find this line (around line 22-24):**
```javascript
const SOCKET_URL = __DEV__ 
  ? 'http://192.168.29.215:5000' // Your local IP address for development
  : 'https://your-vercel-app.vercel.app'; // Your Vercel production URL
```

**Replace `your-vercel-app.vercel.app` with your actual Vercel URL:**
```javascript
const SOCKET_URL = __DEV__ 
  ? 'http://192.168.29.215:5000' // Your local IP address for development
  : 'https://jain-silver-backend.vercel.app'; // ✅ UPDATE THIS!
```

## Step 3: Verify

After updating, verify both files have the correct production URL:
- ✅ `config/api.js` - API endpoints
- ✅ `screens/HomeScreen.js` - Socket.io URL

## Step 4: Build

Now you can build the production app:
```bash
eas build --platform android --profile production
```

---

**⚠️ Remember:** If you don't update these URLs, the app won't be able to connect to your backend in production!


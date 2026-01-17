# Vercel Setup Check

## Issue: API returning source code instead of executing

If you're seeing the source code of `api/index.js` being returned, it means Vercel is treating it as a static file instead of a serverless function.

## Check These Settings in Vercel Dashboard:

1. **Root Directory**: 
   - Go to Project Settings → General
   - Root Directory should be set to: `backend`
   - NOT the root of the repository

2. **Framework Preset**:
   - Should be: `Other` or `None`
   - NOT Next.js, React, etc.

3. **Build & Development Settings**:
   - Build Command: `npm install` (or leave empty)
   - Output Directory: `.` (or leave empty)
   - Install Command: `npm install`

4. **Verify File Structure**:
   ```
   backend/
   ├── api/
   │   └── index.js    ← This should be the entry point
   ├── routes/
   ├── server.js
   ├── vercel.json
   └── package.json
   ```

## If Root Directory is Wrong:

1. Go to Vercel Dashboard → Your Project → Settings → General
2. Change "Root Directory" to: `backend`
3. Save and redeploy

## Alternative: Move vercel.json to Root

If you can't change the root directory, you could:
1. Move `vercel.json` to the repository root
2. Update paths in `vercel.json` to point to `backend/` directory
3. But this is more complex - better to set root directory to `backend`

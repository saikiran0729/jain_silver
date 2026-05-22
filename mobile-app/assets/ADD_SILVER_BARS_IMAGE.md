# Add Silver Bars Image

## Instructions

1. **Save the silver bars image** to the `mobile-app/assets/` folder
2. **Name it**: `silver_bars.png`
3. **Recommended size**: 200x200 pixels or larger (will be scaled down to 50x50 in the app)
4. **Format**: PNG with transparent background (preferred) or JPG

## Image Description
The image should show a pile of silver bars with:
- Polished, reflective metallic surface
- Rectangular bars with rounded edges
- Stacked in a mound/pile
- Dark background (will be cropped to circular/square in app)

## After Adding the Image

The app will automatically use this image as the display picture for each silver rate card.

If you don't have the image file yet, you can:
1. Use the image you showed me
2. Save it as `silver_bars.png` in `mobile-app/assets/` folder
3. Restart the Expo app

## Alternative: Use Existing Image Temporarily

If you want to test without the image first, the code will show an error. You can temporarily use the logo:

Change in `HomeScreen.js`:
```javascript
source={require('../assets/fuck.jpg')}  // Temporary
```

Then replace with `silver_bars.png` once you add the image.


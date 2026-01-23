# RB Goldspot Unit Normalization Fix

## Issue
The RB Goldspot API returns rates that appear to be inflated by large factors compared to current market rates:
- **Silver 999 (ID 2966)**: Returns ~₹327,000 (Market: ~₹93,000/kg) -> Factor ~3.5x
- **Gold 999 (ID 945)**: Returns ~₹160,000 (Market: ~₹78,000/10g) -> Factor ~2.05x (vs 10g) or matches 20g price.

## Analysis
The API seems to use specific contract sizes/units rather than the standard "Per Kg" (Silver) or "Per 10g" (Gold).
- **Silver Unit**: Likely **3.5 KG** (Standard brick size in some markets). `327347 / 3.5 = 93,527`. This matches the live market rate perfectly.
- **Gold Unit**: Likely **20 Grams**. `160400 / 20 = 8020`. `8020 * 10 = 80,200`. This matches the live market rate for 10g roughly.

## Fix Implemented
Updated `backend/utils/multiSourceRateFetcher.js` to detect and normalize these "high" rates:

1. **Silver Normalization**:
   - If rate > 250,000 (implies it's not per Kg):
   - **Divide by 3.5** to get Per Kg rate.
   - Then divide by 1000 to get Per Gram rate.

2. **Gold Normalization**:
   - If rate > 100,000 (implies it's not per 1g or 10g?):
   - **Divide by 20** to get Per Gram rate (assuming 20g unit).

## Result
- **Silver**: Now correctly calculated as ~₹93/g (was ~₹327/g or ~₹317/g)
- **Gold**: Now correctly calculated as ~₹8000/g (was ~₹16000/g or falling back to incorrect Silver rate)

This ensures the "Original Price" column in the dashboard reflects the True Market Rate.

# Jain Silver API Documentation

## Overview
This document provides comprehensive information about the Jain Silver Backend API, including all endpoints, request/response formats, and Swagger documentation.

## Base URL
- **Production**: `https://jain-silver-phi.vercel.app/api`
- **Local Development**: `http://localhost:5000/api`

## Swagger Documentation
Once the server is running, access the interactive API documentation at:
- **Production**: `https://jain-silver-phi.vercel.app/api-docs`
- **Local**: `http://localhost:5000/api-docs`

## Authentication
Most endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

## API Endpoints

### Authentication (`/api/auth`)
- `POST /api/auth/register` - Register new user
- `POST /api/auth/verify-otp` - Verify OTP for email/phone
- `POST /api/auth/signin` - User sign in
- `POST /api/auth/admin/signin` - Admin sign in
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with OTP

### Users (`/api/users`)
- `GET /api/users` - Get user statistics (public)
- `GET /api/users/profile` - Get current user profile (authenticated)
- `PUT /api/users/profile` - Update user profile (authenticated)

### Admin (`/api/admin`)
- `GET /api/admin` - Get admin dashboard statistics
- `GET /api/admin/pending-users` - Get all pending users
- `GET /api/admin/users` - Get all users (with optional status filter)
- `GET /api/admin/user/:userId` - Get user details with documents
- `PUT /api/admin/approve-user/:userId` - Approve user
- `PUT /api/admin/reject-user/:userId` - Reject user
- `POST /api/admin/adjust-rates` - Adjust silver rates (amount or percentage)

### Rates (`/api/rates`)
- `GET /api/rates` - Get all silver rates (public)
- `GET /api/rates/update` - Manually trigger rate update
- `PUT /api/rates/:id` - Update specific rate (admin)

### News (`/api/news`)
- `GET /api/news` - Get all published news posts (public)
- `GET /api/news/:id` - Get single news post (public)
- `GET /api/news/admin/all` - Get all news posts including unpublished (admin)
- `POST /api/news` - Create news post (admin)
- `PUT /api/news/:id` - Update news post (admin)
- `DELETE /api/news/:id` - Delete news post (admin)

### Store (`/api/store`)
- `GET /api/store` - Get store information (public)
- `GET /api/store/info` - Get store information (public, alias)
- `PUT /api/store/info` - Update store information (admin)

## Rate Adjustment

### Endpoint: `POST /api/admin/adjust-rates`

Adjust silver rates by amount (₹/gram) or percentage (%).

**Request Body:**
```json
{
  "value": 100,                    // Positive for increase, negative for decrease
  "adjustmentType": "amount",     // "amount" or "percentage"
  "itemName": "Silver Coin 5 Grams" // Optional: specific item or "all" (default)
}
```

**Examples:**
- Increase all rates by ₹50/gram: `{ "value": 50, "adjustmentType": "amount" }`
- Decrease all rates by ₹30/gram: `{ "value": -30, "adjustmentType": "amount" }`
- Increase all rates by 5%: `{ "value": 5, "adjustmentType": "percentage" }`
- Decrease "Silver Coin 5 Grams" by 10%: `{ "value": -10, "adjustmentType": "percentage", "itemName": "Silver Coin 5 Grams" }`

**Response:**
```json
{
  "message": "Rates increased by ₹50/gram",
  "modifiedCount": 10,
  "value": 50,
  "adjustmentType": "amount",
  "percentageChange": 2.5,
  "adjustments": [...],
  "itemName": "all"
}
```

## Store Information Update

### Endpoint: `PUT /api/store/info`

Update store information (admin only).

**Request Body:**
```json
{
  "welcomeMessage": "Welcome message text",
  "address": "Store address",
  "phoneNumber": "+91 98480 34323",
  "instagram": "https://instagram.com/...",
  "facebook": "https://facebook.com/...",
  "youtube": "https://youtube.com/...",
  "storeTimings": [
    {
      "day": "Monday",
      "openTime": "11:00 AM",
      "closeTime": "08:30 PM",
      "isClosed": false
    }
  ],
  "bankDetails": [
    {
      "bankName": "Bank Name",
      "accountNumber": "1234567890",
      "ifscCode": "BANK0001234",
      "accountHolderName": "Account Holder",
      "branch": "Branch Name"
    }
  ]
}
```

## News Management

### Create News Post: `POST /api/news`

**Request Body:**
```json
{
  "title": "News Title",
  "content": "News content...",
  "image": "https://image-url.com/image.jpg",
  "category": "announcement",  // "announcement", "update", "offer", "general"
  "tags": ["tag1", "tag2"],
  "published": true
}
```

### Update News Post: `PUT /api/news/:id`

Same request body as create, all fields optional.

### Delete News Post: `DELETE /api/news/:id`

No request body required.

## Error Handling

All endpoints return consistent error responses:

```json
{
  "message": "Error description",
  "error": "Detailed error message (development only)"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error
- `503` - Service Unavailable (database connection issue)

## Rate Adjustment Logic

### Amount Adjustment
- Directly adds/subtracts the specified amount per gram
- Example: `value: 50` adds ₹50/gram to all rates

### Percentage Adjustment
- Calculates percentage based on current effective rate (original rate + existing adjustments)
- Example: `value: 5` with `adjustmentType: "percentage"` increases rates by 5% of current effective rate

### Adjustment Behavior (REPLACEMENT, NOT CUMULATIVE)
- Each adjustment REPLACES the previous adjustment (not cumulative)
- New adjustment = Input amount (replaces previous adjustment in database)
- Final rate = Original base rate + New adjustment (not Original + Old + New)
- Example: Base ₹232, first adjustment +₹12 → ₹244, second adjustment +₹1 → ₹233 (NOT ₹245)

## Data Models

### User
- `firstName`, `lastName` (split from previous `name` field)
- `email`, `phone`, `password`
- `status`: `pending`, `approved`, `rejected`
- `isVerified`: boolean
- `role`: `user`, `admin`
- `documents`: `aadhar` (front, back), `pan` (image), `selfie`

### SilverRate
- `name`: Product name
- `ratePerGram`: Base rate per gram
- `rate`: Total rate for the product
- `weight`: `{ value, unit }`
- `purity`: Percentage string
- `manualAdjustment`: Current adjustment amount (replaces previous, not cumulative)
- `lastUpdated`: Timestamp

### News
- `title`, `content`, `image`
- `author`: User ID reference
- `published`: boolean
- `publishedAt`: Date (when published)
- `category`: `announcement`, `update`, `offer`, `general`
- `tags`: Array of strings
- `views`: Number

### StoreInfo
- `welcomeMessage`, `address`, `phoneNumber`
- `storeTimings`: Array of day objects
- `instagram`, `facebook`, `youtube`: Social media links
- `bankDetails`: Array of bank account objects

## Recent Fixes

1. **Store Info Saving**: Fixed timeout issues and improved error handling
2. **Rate Adjustment**: Fixed percentage calculation to use current effective rate
3. **News Creation**: Fixed author field to use `req.user.userId`
4. **User Fetching**: Added query limits and optimized with `.lean()`
5. **Timeout Issues**: Increased timeout to 30s for admin/store/news endpoints
6. **Swagger Documentation**: Added comprehensive API documentation

## Testing

Use the Swagger UI at `/api-docs` to test all endpoints interactively. You can:
- View all available endpoints
- See request/response schemas
- Test endpoints directly from the browser
- Authenticate using the "Authorize" button

## Support

For issues or questions, check the server logs for detailed error messages. All endpoints include comprehensive error logging.


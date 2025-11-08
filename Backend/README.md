# Blood Donation App - Backend

## Installation

```bash
cd Backend
npm install
```

## Environment Variables

Create a `.env` file in the Backend folder:

```
PORT=5000
NODE_ENV=development
JWT_SECRET=your_secret_key_here_change_in_production

# Email Configuration (Optional - for password reset)
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
```

### Email Setup (For Password Reset):
1. **Gmail Setup:**
   - Go to your Google Account settings
   - Enable 2-Step Verification
   - Generate an App Password: https://myaccount.google.com/apppasswords
   - Use the generated app password as `EMAIL_PASSWORD`

2. **Note:**
   - If email is not configured, reset tokens will be logged to console (development mode only)
   - In production, always configure email service for security

## Running the Server

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/forgot-password` - Request password reset (sends email)
- `POST /api/auth/reset-password` - Reset password with token

### Users
- `GET /api/users/profile` - Get user profile (requires auth)
- `PUT /api/users/profile` - Update user profile (requires auth)
- `PUT /api/users/donation` - Record donation (requires auth)

### Donors
- `GET /api/donors` - Get all available donors
- `GET /api/donors/:id` - Get donor by ID

### Requests
- `POST /api/requests` - Create blood request (requires auth)
- `GET /api/requests` - Get all requests
- `GET /api/requests/my-requests` - Get user's requests (requires auth)
- `PUT /api/requests/:id/fulfill` - Mark request as fulfilled (requires auth)
- `DELETE /api/requests/:id` - Delete request (requires auth)

## MongoDB Connection

The backend is configured to connect to MongoDB Atlas using the provided connection string.

## Notes

- All protected routes require a JWT token in the Authorization header
- Format: `Authorization: Bearer <token>`
- Token expires in 7 days


# Blood App Backend

Backend API for Blood Donation App deployed on Vercel.

## Vercel Deployment

This backend is configured to run as a serverless function on Vercel.

### File Structure
```
Backend/
├── api/
│   └── index.js          # Serverless function entry point
├── routes/              # API routes
├── models/              # MongoDB models
├── middleware/          # Auth middleware
├── utils/               # Utility functions
├── vercel.json          # Vercel configuration
└── package.json         # Dependencies
```

### Environment Variables (Set in Vercel Dashboard)

1. **MONGODB_URI** - MongoDB connection string
   ```
   mongodb+srv://sufianali122nb:1234sufi@cluster0.0qnf0nx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
   ```

2. **EMAIL_USER** (Optional) - Gmail address for email service
3. **EMAIL_PASSWORD** (Optional) - Gmail app password for email service
4. **JWT_SECRET** (Optional) - Secret key for JWT tokens

### API Endpoints

- `GET /` - API information
- `GET /api/health` - Health check
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/forgot-password` - Forgot password
- `POST /api/auth/reset-password` - Reset password
- `GET /api/users/profile` - Get user profile
- `GET /api/donors` - Get donors list
- `GET /api/requests` - Get blood requests
- `POST /api/requests` - Create blood request
- `GET /api/stats` - Get statistics
- `GET /api/chats/my-chats` - Get user chats
- `POST /api/chats/request/:requestId` - Create/get chat

### Local Development

```bash
npm install
npm run dev
```

Server will run on `http://localhost:5000`

### Deployment

1. Push code to GitHub
2. Vercel will automatically deploy
3. Set environment variables in Vercel Dashboard
4. Test: `https://blood-app-backend.vercel.app/api/health`

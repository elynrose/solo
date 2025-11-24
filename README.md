# Expression Video Chat App

A production-ready application that combines AI-powered avatar generation, real-time chat with expression detection, subscription management, and credit-based monetization.

## Features

### Core Features
- **AI Avatar Generation**: Create animated avatars from profile photos using fal.ai
- **Video Recording**: Record custom avatar videos with expression segments
- **Real-time Chat**: Interactive chat with AI that responds based on conversation context
- **Expression Detection**: Automatic emotion/expression classification during conversations
- **Credit System**: Flexible credit-based monetization for avatar creation and chat usage
- **Subscription Management**: Monthly/yearly subscription packages with automatic credit allocation
- **Memory Bank** (Premium): Upload PDF/TXT documents to provide knowledge base for AI responses
- **Admin Panel**: Comprehensive admin interface for managing users, avatars, expressions, categories, subscriptions, and credit packages

### Technical Features
- Firebase Authentication & Firestore database
- Firebase Storage for media files
- Stripe integration for payments and subscriptions
- Server-side FFmpeg for video processing
- PDF parsing for memory bank documents
- Material Design UI components

## Prerequisites

- **Node.js** v18 or higher
- **FFmpeg** (installed automatically via Dockerfile for deployments)
- **Firebase Project** with Authentication, Firestore, and Storage enabled
- **OpenAI API Key** with access to GPT-4o-mini
- **fal.ai API Key** (for avatar generation)
- **Stripe Account** (for payments and subscriptions)

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/elynrose/solo.git
   cd solo
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your API keys:
   ```env
   OPENAI_API_KEY=sk-your-key
   FAL_KEY=your-key:your-secret
   STRIPE_SECRET_KEY=sk_test_your-key
   STRIPE_WEBHOOK_SECRET=whsec_your-secret
   PORT=3001
   NODE_ENV=development
   ```

4. **Configure Firebase**
   - Follow the instructions in `FIREBASE_SETUP.md`
   - Add Firebase configuration to `.env` file (see `.env.example`)
   - Get your Firebase config from Firebase Console > Project Settings > General > Your apps
   - Deploy Firestore rules: `firebase deploy --only firestore:rules`
   - Deploy Firestore indexes: `firebase deploy --only firestore:indexes`

5. **Set up Firebase Admin SDK** (for webhooks)
   - Option 1: Download service account key from Firebase Console
   - Option 2: Use Application Default Credentials in your deployment platform

## Running the Application

### Development
```bash
npm start
```

The server will run on `http://localhost:3001` (or your configured PORT).

### Production

1. **Set environment variables** in your deployment platform:
   - `NODE_ENV=production`
   - `FRONTEND_URL` or `ALLOWED_ORIGINS` (for CORS)
   - All API keys and secrets

2. **Deploy Firestore rules and indexes**:
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes
   ```

3. **Configure Stripe webhook**:
   - Set webhook URL to: `https://your-domain.com/api/stripe-webhook`
   - Subscribe to events: `checkout.session.completed`, `invoice.payment_succeeded`, `customer.subscription.*`

4. **Deploy using Docker** (Railway, Render, etc.):
   - The included `Dockerfile` automatically installs FFmpeg
   - Platform will detect Dockerfile and build accordingly

## Project Structure

```
├── public/                 # Frontend files
│   ├── index.html         # Main HTML file
│   ├── realtime-client.js # Frontend JavaScript
│   ├── firebase-config.js # Firebase client configuration
│   └── video/             # Video assets
├── server.mjs             # Express backend server
├── firestore.rules        # Firestore security rules
├── firestore.indexes.json # Firestore indexes
├── storage.rules          # Firebase Storage rules
├── Dockerfile             # Docker configuration
└── package.json           # Dependencies
```

## Environment Variables

See `.env.example` for all required environment variables.

### Required
- `OPENAI_API_KEY` - OpenAI API key
- `FAL_KEY` - fal.ai API key (format: `key:secret`)
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret

### Optional
- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment (development/production)
- `FRONTEND_URL` - Frontend URL for CORS (production)
- `ALLOWED_ORIGINS` - Comma-separated allowed origins
- `GOOGLE_APPLICATION_CREDENTIALS` - Path to Firebase service account JSON

## Security

- **CORS**: Configured for production with origin restrictions
- **Security Headers**: X-Frame-Options, X-Content-Type-Options, X-XSS-Protection
- **Firestore Rules**: Comprehensive security rules for all collections
- **Environment Variables**: Sensitive keys stored in `.env` (not committed)
- **Input Validation**: All user inputs are validated and sanitized

## Admin Features

Access the admin panel by logging in as an admin user:

- **User Management**: View and manage users, toggle admin status
- **Avatar Management**: View all avatars, manage public/private status
- **Expression Management**: Create and manage expression labels and timings
- **Training Videos**: Upload and manage training videos for avatar generation
- **Subscriptions**: Manage subscription packages with monthly credit allocation
- **Pricing**: Configure avatar creation pricing
- **Credits**: Configure credit costs and manage credit packages
- **Categories**: Manage avatar categories

## Credit System

- Users can purchase credits via Stripe
- Credits are deducted for:
  - Avatar creation (varies by method: Recording=10, AI=50, URL=5)
  - Chat messages (configurable per 10,000 tokens)
- Admin can configure all credit costs and packages
- Credit packages are fully customizable with pricing and credit amounts

## Subscription System

- Monthly/yearly subscription packages
- Automatic monthly credit allocation
- Stripe integration for recurring payments
- Webhook handling for subscription events
- Admin-configurable packages with credit allocation

## Memory Bank (Premium Feature)

- Upload PDF or TXT files to provide knowledge base for AI
- Files are processed and converted to JSON format
- AI references memory bank when responding to users
- Requires active subscription to use

## Deployment

### Railway
1. Connect your GitHub repository
2. Set environment variables in Railway dashboard
3. Railway will auto-detect Dockerfile and deploy
4. Configure Stripe webhook URL

### Other Platforms
- Ensure FFmpeg is installed (or use provided Dockerfile)
- Set all required environment variables
- Configure CORS with your frontend URL
- Deploy Firestore rules and indexes

## Troubleshooting

### Common Issues

**"FFmpeg not found"**
- Ensure Dockerfile is used in deployment
- Or install FFmpeg manually: `apt-get install ffmpeg` (Linux) or `brew install ffmpeg` (macOS)

**"Firebase Admin SDK not initialized"**
- Set `GOOGLE_APPLICATION_CREDENTIALS` or configure Application Default Credentials
- Required for webhook credit allocation

**"CORS errors in production"**
- Set `FRONTEND_URL` or `ALLOWED_ORIGINS` environment variable
- Ensure your frontend domain is included

**"Stripe webhook not working"**
- Verify `STRIPE_WEBHOOK_SECRET` is set correctly
- Check webhook URL is accessible
- Ensure webhook events are subscribed in Stripe dashboard

## License

This project is private and proprietary.

## Support

For issues or questions, please contact the development team.

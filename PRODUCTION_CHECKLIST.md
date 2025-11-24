# Production Deployment Checklist

Use this checklist before deploying to production.

## Pre-Deployment

### Environment Variables
- [ ] Set `NODE_ENV=production` in your deployment platform
- [ ] Configure `FRONTEND_URL` or `ALLOWED_ORIGINS` for CORS
- [ ] Verify all API keys are set:
  - [ ] `OPENAI_API_KEY`
  - [ ] `FAL_KEY` (format: `key:secret`)
  - [ ] `STRIPE_SECRET_KEY` (use production key, not test)
  - [ ] `STRIPE_WEBHOOK_SECRET` (production webhook secret)
- [ ] Configure Firebase Admin SDK:
  - [ ] Set `GOOGLE_APPLICATION_CREDENTIALS` OR
  - [ ] Configure Application Default Credentials in deployment platform

### Firebase Configuration
- [ ] Set Firebase environment variables in `.env`:
  - [ ] `FIREBASE_API_KEY`
  - [ ] `FIREBASE_AUTH_DOMAIN`
  - [ ] `FIREBASE_PROJECT_ID`
  - [ ] `FIREBASE_STORAGE_BUCKET`
  - [ ] `FIREBASE_MESSAGING_SENDER_ID`
  - [ ] `FIREBASE_APP_ID`
- [ ] Deploy Firestore security rules: `firebase deploy --only firestore:rules`
- [ ] Deploy Firestore indexes: `firebase deploy --only firestore:indexes`
- [ ] Deploy Storage rules: `firebase deploy --only storage:rules`
- [ ] Verify Firebase Authentication is enabled
- [ ] Verify Firestore database is created
- [ ] Verify Firebase Storage is enabled

### Stripe Configuration
- [ ] Switch to production Stripe keys (not test keys)
- [ ] Configure webhook endpoint in Stripe Dashboard:
  - URL: `https://your-domain.com/api/stripe-webhook`
  - Events to subscribe:
    - `checkout.session.completed`
    - `invoice.payment_succeeded`
    - `customer.subscription.created`
    - `customer.subscription.updated`
    - `customer.subscription.deleted`
- [ ] Verify webhook secret matches `STRIPE_WEBHOOK_SECRET`
- [ ] Test webhook endpoint is accessible

### Security
- [ ] Verify `.env` file is NOT committed to Git
- [ ] Verify `.gitignore` includes `.env`
- [ ] Review Firestore security rules for production safety
- [ ] Review Storage security rules
- [ ] Verify CORS is configured with specific origins (not `*`)
- [ ] Verify security headers are enabled (X-Frame-Options, etc.)

### Code Quality
- [ ] Remove or conditionally disable all `console.log` statements (done - logs are production-aware)
- [ ] Verify error handling is in place
- [ ] Test error messages are user-friendly
- [ ] Verify no hardcoded credentials or secrets

### Infrastructure
- [ ] Verify FFmpeg is installed (Dockerfile handles this)
- [ ] Verify sufficient memory/CPU for video processing
- [ ] Configure proper file upload limits
- [ ] Set up monitoring/logging (optional but recommended)
- [ ] Configure backup strategy for Firestore data

## Post-Deployment

### Testing
- [ ] Test user registration/login
- [ ] Test avatar creation (all methods: recording, AI, URL)
- [ ] Test chat functionality
- [ ] Test credit purchase flow
- [ ] Test subscription purchase flow
- [ ] Test subscription renewal (webhook)
- [ ] Test admin panel access
- [ ] Test memory bank upload (premium feature)
- [ ] Test video merging/processing
- [ ] Test error scenarios (insufficient credits, etc.)

### Monitoring
- [ ] Set up error tracking (e.g., Sentry, LogRocket)
- [ ] Monitor server logs for errors
- [ ] Monitor Stripe webhook delivery
- [ ] Monitor Firebase usage/quota
- [ ] Set up uptime monitoring

### Documentation
- [ ] Update README with production URL
- [ ] Document any custom deployment steps
- [ ] Create runbook for common issues

## Production Environment Variables Template

```env
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://yourdomain.com
# OR
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

OPENAI_API_KEY=sk-prod-...
FAL_KEY=prod-key:prod-secret
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Firebase Client Configuration
FIREBASE_API_KEY=AIzaSy...
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:abc123

# Firebase Admin SDK
GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json
# OR configure Application Default Credentials
```

## Common Issues

### CORS Errors
- Verify `FRONTEND_URL` or `ALLOWED_ORIGINS` matches your frontend domain
- Check browser console for specific CORS error

### Webhook Not Working
- Verify webhook URL is accessible from internet
- Check `STRIPE_WEBHOOK_SECRET` matches Stripe dashboard
- Check server logs for webhook errors
- Verify Firebase Admin SDK is initialized

### FFmpeg Not Found
- Ensure Dockerfile is used in deployment
- Or manually install FFmpeg in deployment environment

### Firebase Admin SDK Not Initialized
- Set `GOOGLE_APPLICATION_CREDENTIALS` environment variable
- Or configure Application Default Credentials
- Required for webhook credit allocation

## Support

For production issues, check:
1. Server logs
2. Firebase Console (Firestore, Storage, Authentication)
3. Stripe Dashboard (webhooks, payments)
4. Browser console (client-side errors)


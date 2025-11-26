# Expression Video Chat - Mobile App

Flutter mobile application for the Expression Video Chat platform (user-facing features only).

## Features

- **Authentication**: Sign in/Sign up with Firebase Auth
- **Avatar Management**: Browse and select avatars for chat
- **Real-time Chat**: Interactive chat with AI avatars
- **Expression Detection**: Visual feedback for detected expressions
- **Credit System**: View and manage credits
- **Subscription Management**: View and manage subscriptions

## Setup

1. **Install Flutter dependencies:**
   ```bash
   cd mobile_app
   flutter pub get
   ```

2. **Configure Firebase:**
   - Add your `firebase_options.dart` file (generated from Firebase CLI)
   - Update `lib/main.dart` to use your Firebase options:
     ```dart
     await Firebase.initializeApp(
       options: DefaultFirebaseOptions.currentPlatform,
     );
     ```

3. **Configure API Base URL:**
   - The base URL is configured in `lib/config/app_config.dart`
   - Current production URL: `https://solo-production-17f9.up.railway.app`
   - To change it, update `AppConfig.baseUrl` in `lib/config/app_config.dart`

4. **Run the app:**
   ```bash
   flutter run
   ```

## Project Structure

```
lib/
├── main.dart                 # App entry point
├── config/                   # App configuration
│   └── app_config.dart       # API base URL and endpoints
├── models/                   # Data models
│   └── avatar.dart
├── providers/                # State management (Provider)
│   ├── auth_provider.dart
│   ├── avatar_provider.dart
│   ├── chat_provider.dart
│   └── credit_provider.dart
├── screens/                  # UI screens
│   ├── auth_screen.dart
│   ├── home_screen.dart
│   ├── chat_screen.dart
│   ├── avatar_creation_screen.dart
│   ├── subscription_screen.dart
│   └── credits_screen.dart
└── services/                 # Business logic
    ├── auth_service.dart
    ├── avatar_service.dart
    ├── chat_service.dart
    ├── credit_service.dart
    └── firebase_service.dart
```

## TODO

- [ ] Complete avatar creation screen (recording, AI generation, URL upload)
- [ ] Implement credit purchase flow with Stripe
- [ ] Implement subscription management
- [ ] Add video recording for avatar creation
- [ ] Add memory bank file upload
- [ ] Add expression loading from Firestore
- [ ] Add proper error handling and loading states
- [ ] Add video player controls
- [ ] Add chat session persistence

## Notes

- This is the user-facing app only (no admin features)
- Backend API must be running for chat functionality
- Firebase project must be configured with Authentication, Firestore, and Storage

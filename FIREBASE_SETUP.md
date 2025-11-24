# Firebase Setup Instructions

## 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select an existing project
3. Follow the setup wizard

## 2. Enable Authentication

1. In Firebase Console, go to **Authentication** > **Get started**
2. Click on **Sign-in method** tab
3. Enable **Email/Password** authentication
4. Click **Save**

## 3. Create Firestore Database

1. In Firebase Console, go to **Firestore Database**
2. Click **Create database**
3. Start in **test mode** (for development) or **production mode** (with security rules)
4. Choose a location for your database
5. Click **Enable**

## 4. Set Firestore Security Rules

Go to **Firestore Database** > **Rules** and add:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Chat sessions - users can only access their own sessions
    match /chatSessions/{sessionId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
  }
}
```

## 5. Get Your Firebase Configuration

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll down to **Your apps** section
3. Click the **Web** icon (`</>`) to add a web app
4. Register your app (you can use any nickname)
5. Copy the `firebaseConfig` object

## 6. Update firebase-config.js

Open `public/firebase-config.js` and replace the placeholder values:

```javascript
const firebaseConfig = {
  apiKey: "your-actual-api-key",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "your-messaging-sender-id",
  appId: "your-app-id"
};
```

## 7. Test the Setup

1. Start your server: `npm start`
2. Open the app in your browser
3. You should see the authentication modal
4. Create an account and test the chat functionality
5. Check Firestore Console to see your chat sessions being created

## Firestore Data Structure

The app creates documents in the `chatSessions` collection with this structure:

```javascript
{
  userId: "user-uid",
  createdAt: Timestamp,
  updatedAt: Timestamp,
  messages: [
    {
      userMessage: "User's message",
      aiResponse: "AI's response",
      expression: "Funny|Interested|Agree|Disagree|Neutral|Confused|Bored",
      timestamp: Timestamp
    }
  ]
}
```

## Troubleshooting

- **"Firebase: Error (auth/configuration-not-found)"**: Make sure you've updated `firebase-config.js` with your actual Firebase config
- **"Permission denied"**: Check your Firestore security rules
- **"Email already in use"**: The email is already registered, try signing in instead
- **"Invalid email"**: Make sure you're using a valid email format


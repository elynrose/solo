// Firebase configuration
// Replace these values with your Firebase project configuration
// You can find these in Firebase Console > Project Settings > General > Your apps

// TODO: Replace with your Firebase config
// Get this from Firebase Console > Project Settings > General
// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyD4MpxE0eByxg6tE_rozeC-XL3vIlNdy9M",
    authDomain: "proroster-sfc0v.firebaseapp.com",
    projectId: "proroster-sfc0v",
    storageBucket: "proroster-sfc0v.firebasestorage.app",
    messagingSenderId: "773600886962",
    appId: "1:773600886962:web:124274ea52eed97ddfc9ab"
  };
  

// Initialize Firebase (using CDN - firebase will be available globally)
if (typeof firebase !== 'undefined') {
  const app = firebase.initializeApp(firebaseConfig);
  window.firebaseAuth = firebase.auth(app);
  window.firebaseDb = firebase.firestore(app);
  window.firebaseStorage = firebase.storage(app);
  console.log('Firebase initialized');
} else {
  console.error('Firebase SDK not loaded. Make sure firebase CDN is included in index.html');
}


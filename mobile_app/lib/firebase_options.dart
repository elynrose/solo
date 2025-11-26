// File generated using Firebase config from server
// This file provides Firebase configuration for all platforms

import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

/// Default [FirebaseOptions] for use with your Firebase apps.
///
/// Example:
/// ```dart
/// import 'firebase_options.dart';
/// // ...
/// await Firebase.initializeApp(
///   options: DefaultFirebaseOptions.currentPlatform,
/// );
/// ```
class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      return web;
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      case TargetPlatform.macOS:
        return macos;
      case TargetPlatform.windows:
        throw UnsupportedError(
          'DefaultFirebaseOptions have not been configured for windows - '
          'you can reconfigure this by running the FlutterFire CLI again.',
        );
      case TargetPlatform.linux:
        throw UnsupportedError(
          'DefaultFirebaseOptions have not been configured for linux - '
          'you can reconfigure this by running the FlutterFire CLI again.',
        );
      default:
        throw UnsupportedError(
          'DefaultFirebaseOptions are not supported for this platform.',
        );
    }
  }

  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'AIzaSyD4MpxE0eByxg6tE_rozeC-XL3vIlNdy9M',
    appId: '1:773600886962:web:124274ea52eed97ddfc9ab',
    messagingSenderId: '773600886962',
    projectId: 'proroster-sfc0v',
    authDomain: 'proroster-sfc0v.firebaseapp.com',
    storageBucket: 'proroster-sfc0v.firebasestorage.app',
  );

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyAcPgLcTRu3SbYCuI1dPEGIeu943UUkGLc',
    appId: '1:773600886962:android:1bd0ef0b6e21f618dfc9ab',
    messagingSenderId: '773600886962',
    projectId: 'proroster-sfc0v',
    storageBucket: 'proroster-sfc0v.firebasestorage.app',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyD4MpxE0eByxg6tE_rozeC-XL3vIlNdy9M',
    appId: '1:773600886962:ios:124274ea52eed97ddfc9ab',
    messagingSenderId: '773600886962',
    projectId: 'proroster-sfc0v',
    storageBucket: 'proroster-sfc0v.firebasestorage.app',
    iosBundleId: 'com.expressionvideo.expressionVideoApp',
  );

  static const FirebaseOptions macos = FirebaseOptions(
    apiKey: 'AIzaSyD4MpxE0eByxg6tE_rozeC-XL3vIlNdy9M',
    appId: '1:773600886962:macos:124274ea52eed97ddfc9ab',
    messagingSenderId: '773600886962',
    projectId: 'proroster-sfc0v',
    storageBucket: 'proroster-sfc0v.firebasestorage.app',
    iosBundleId: 'com.expressionvideo.expressionVideoApp',
  );
}


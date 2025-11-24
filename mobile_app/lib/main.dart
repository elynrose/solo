import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:provider/provider.dart';
import 'screens/auth_screen.dart';
import 'screens/home_screen.dart';
import 'screens/chat_screen.dart';
import 'screens/avatar_creation_screen.dart';
import 'screens/subscription_screen.dart';
import 'screens/credits_screen.dart';
import 'providers/auth_provider.dart';
import 'providers/avatar_provider.dart';
import 'providers/chat_provider.dart';
import 'providers/credit_provider.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize Firebase - you'll need to add your firebase_options.dart file
  // For now, using default initialization
  // In production, use: await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  try {
    await Firebase.initializeApp();
  } catch (e) {
    // If Firebase is not configured, the app will still run but Firebase features won't work
    debugPrint('Firebase initialization error: $e');
  }
  
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => AvatarProvider()),
        ChangeNotifierProvider(create: (_) => ChatProvider()),
        ChangeNotifierProvider(create: (_) => CreditProvider()),
      ],
      child: MaterialApp(
        title: 'Expression Video Chat',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(
            seedColor: const Color(0xFF6366F1),
            primary: const Color(0xFF6366F1),
            secondary: const Color(0xFF8B5CF6),
          ),
          useMaterial3: true,
          cardTheme: CardTheme(
            elevation: 2,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
        ),
        home: const AuthWrapper(),
        routes: {
          '/home': (context) => const HomeScreen(),
          '/chat': (context) => const ChatScreen(avatar: null),
          '/avatar-creation': (context) => const AvatarCreationScreen(),
          '/subscription': (context) => const SubscriptionScreen(),
          '/credits': (context) => const CreditsScreen(),
        },
      ),
    );
  }
}

class AuthWrapper extends StatelessWidget {
  const AuthWrapper({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<AuthProvider>(
      builder: (context, authProvider, _) {
        if (authProvider.isLoading) {
          return const Scaffold(
            body: Center(
              child: CircularProgressIndicator(),
            ),
          );
        }
        
        if (authProvider.user == null) {
          return const AuthScreen();
        }
        
        return const HomeScreen();
      },
    );
  }
}

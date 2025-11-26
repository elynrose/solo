import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:provider/provider.dart';
import 'firebase_options.dart';
import 'screens/auth_screen.dart';
import 'screens/home_screen.dart';
import 'screens/chat_screen.dart';
import 'screens/avatar_creation_screen.dart';
import 'screens/subscription_screen.dart';
import 'screens/credits_screen.dart';
import 'providers/auth_provider.dart' as app_providers;
import 'providers/avatar_provider.dart';
import 'providers/chat_provider.dart';
import 'providers/credit_provider.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize Firebase with platform-specific options
  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
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
        ChangeNotifierProvider(create: (_) => app_providers.AuthProvider()),
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
          cardTheme: CardThemeData(
            elevation: 2,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
        ),
        home: const AuthWrapper(),
        routes: {
          '/home': (context) => const HomeScreen(),
          // Chat route requires avatar parameter - handled via navigation with arguments
          '/avatar-creation': (context) => const AvatarCreationScreen(),
          '/subscription': (context) => const SubscriptionScreen(),
          '/credits': (context) => const CreditsScreen(),
        },
      ),
    );
  }
}

class AuthWrapper extends StatefulWidget {
  const AuthWrapper({super.key});

  @override
  State<AuthWrapper> createState() => _AuthWrapperState();
}

class _AuthWrapperState extends State<AuthWrapper> {
  @override
  Widget build(BuildContext context) {
    // Use StreamBuilder as a backup to ensure we catch auth state changes
    return StreamBuilder<User?>(
      stream: FirebaseAuth.instance.authStateChanges(),
      builder: (context, snapshot) {
        // Also get the provider for other functionality
        final authProvider = Provider.of<app_providers.AuthProvider>(context, listen: false);
        
        debugPrint('AuthWrapper StreamBuilder: hasData=${snapshot.hasData}, user=${snapshot.data?.uid ?? "null"}');
        debugPrint('AuthWrapper Provider: isLoading=${authProvider.isLoading}, user=${authProvider.user?.uid ?? "null"}');
        
        // Show loading while checking auth state
        if (snapshot.connectionState == ConnectionState.waiting || authProvider.isLoading) {
          debugPrint('AuthWrapper: showing loading');
          return const Scaffold(
            body: Center(
              child: CircularProgressIndicator(),
            ),
          );
        }
        
        // Use StreamBuilder data as source of truth, but sync with provider
        final user = snapshot.data ?? authProvider.user;
        
        if (user == null) {
          debugPrint('AuthWrapper: showing AuthScreen');
          return const AuthScreen();
        }
        
        debugPrint('AuthWrapper: showing HomeScreen for user ${user.uid}');
        return const HomeScreen();
      },
    );
  }
}

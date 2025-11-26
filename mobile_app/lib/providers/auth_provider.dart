import 'package:flutter/foundation.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../services/auth_service.dart';

class AuthProvider with ChangeNotifier {
  final AuthService _authService = AuthService();
  User? _user;
  bool _isLoading = true;

  User? get user => _user;
  bool get isLoading => _isLoading;
  bool get isAuthenticated => _user != null;

  AuthProvider() {
    _init();
  }

  void _init() {
    // Get initial user state
    _user = _authService.currentUser;
    debugPrint('AuthProvider init: user = ${_user?.uid ?? "null"}');
    _isLoading = false;
    notifyListeners();
    
    // Listen for auth state changes
    _authService.authStateChanges.listen((user) {
      debugPrint('AuthProvider authStateChanges: user = ${user?.uid ?? "null"}');
      _user = user;
      _isLoading = false;
      notifyListeners();
    });
  }

  Future<void> signIn(String email, String password) async {
    try {
      _isLoading = true;
      notifyListeners();
      debugPrint('AuthProvider signIn: starting...');
      final userCredential = await _authService.signInWithEmailAndPassword(
        email: email,
        password: password,
      );
      debugPrint('AuthProvider signIn: success, user = ${userCredential.user?.uid}');
      // Update user immediately after successful sign-in
      _user = userCredential.user;
      _isLoading = false;
      debugPrint('AuthProvider signIn: calling notifyListeners()');
      notifyListeners();
      debugPrint('AuthProvider signIn: notifyListeners() called');
    } catch (e) {
      debugPrint('AuthProvider signIn: error = $e');
      _isLoading = false;
      notifyListeners();
      rethrow;
    }
  }

  Future<void> signUp(String email, String password) async {
    try {
      _isLoading = true;
      notifyListeners();
      final userCredential = await _authService.signUpWithEmailAndPassword(
        email: email,
        password: password,
      );
      // Update user immediately after successful sign-up
      _user = userCredential.user;
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _isLoading = false;
      notifyListeners();
      rethrow;
    }
  }

  Future<void> signInWithGoogle() async {
    try {
      _isLoading = true;
      notifyListeners();
      debugPrint('AuthProvider signInWithGoogle: starting...');
      final userCredential = await _authService.signInWithGoogle();
      debugPrint('AuthProvider signInWithGoogle: success, user = ${userCredential.user?.uid}');
      // Update user immediately after successful Google sign-in
      _user = userCredential.user;
      _isLoading = false;
      debugPrint('AuthProvider signInWithGoogle: calling notifyListeners()');
      notifyListeners();
      debugPrint('AuthProvider signInWithGoogle: notifyListeners() called');
    } catch (e) {
      debugPrint('AuthProvider signInWithGoogle: error = $e');
      _isLoading = false;
      notifyListeners();
      rethrow;
    }
  }

  Future<void> signOut() async {
    await _authService.signOut();
  }
}


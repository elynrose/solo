import 'package:flutter/foundation.dart';
import '../services/credit_service.dart';

class CreditProvider with ChangeNotifier {
  final CreditService _creditService = CreditService();
  
  int _credits = 0;
  Map<String, dynamic>? _userProfile;
  Map<String, dynamic> _creditConfig = {};
  List<Map<String, dynamic>> _creditPackages = [];
  List<Map<String, dynamic>> _subscriptionPackages = [];
  Map<String, dynamic>? _activeSubscription;
  List<Map<String, dynamic>> _creditTransactions = [];
  List<Map<String, dynamic>> _paymentHistory = [];
  bool _isLoading = false;
  String? _error;

  // Getters
  int get credits => _credits;
  Map<String, dynamic>? get userProfile => _userProfile;
  Map<String, dynamic> get creditConfig => _creditConfig;
  List<Map<String, dynamic>> get creditPackages => _creditPackages;
  List<Map<String, dynamic>> get subscriptionPackages => _subscriptionPackages;
  Map<String, dynamic>? get activeSubscription => _activeSubscription;
  List<Map<String, dynamic>> get creditTransactions => _creditTransactions;
  List<Map<String, dynamic>> get paymentHistory => _paymentHistory;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get hasActiveSubscription => _activeSubscription != null;

  CreditProvider() {
    loadData();
  }

  Future<void> loadData() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      // Load all data in parallel
      final results = await Future.wait([
        _creditService.getUserProfile(),
        _creditService.getUserCredits(),
        _creditService.getCreditConfig(),
        _creditService.getCreditPackages(),
        _creditService.getSubscriptionPackages(),
        _creditService.getActiveSubscription(),
      ]);

      _userProfile = results[0] as Map<String, dynamic>?;
      _credits = results[1] as int;
      _creditConfig = results[2] as Map<String, dynamic>;
      _creditPackages = results[3] as List<Map<String, dynamic>>;
      _subscriptionPackages = results[4] as List<Map<String, dynamic>>;
      _activeSubscription = results[5] as Map<String, dynamic>?;
    } catch (e) {
      debugPrint('Error loading credit data: $e');
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadTransactionHistory() async {
    try {
      _creditTransactions = await _creditService.getCreditTransactions();
      notifyListeners();
    } catch (e) {
      debugPrint('Error loading transactions: $e');
    }
  }

  Future<void> loadPaymentHistory() async {
    try {
      _paymentHistory = await _creditService.getPaymentHistory();
      notifyListeners();
    } catch (e) {
      debugPrint('Error loading payments: $e');
    }
  }

  void startWatchingCredits() {
    _creditService.watchUserCredits().listen((credits) {
      _credits = credits;
      notifyListeners();
    });
  }

  void startWatchingProfile() {
    _creditService.watchUserProfile().listen((profile) {
      _userProfile = profile;
      _credits = profile?['credits'] ?? 0;
      notifyListeners();
    });
  }

  void clearData() {
    _credits = 0;
    _userProfile = null;
    _activeSubscription = null;
    _creditTransactions = [];
    _paymentHistory = [];
    notifyListeners();
  }
}

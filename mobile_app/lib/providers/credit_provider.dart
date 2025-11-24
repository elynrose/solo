import 'package:flutter/foundation.dart';
import '../services/credit_service.dart';

class CreditProvider with ChangeNotifier {
  final CreditService _creditService = CreditService();
  int _credits = 0;
  Map<String, dynamic> _creditConfig = {};
  List<Map<String, dynamic>> _creditPackages = [];
  Map<String, dynamic>? _activeSubscription;
  bool _isLoading = false;

  int get credits => _credits;
  Map<String, dynamic> get creditConfig => _creditConfig;
  List<Map<String, dynamic>> get creditPackages => _creditPackages;
  Map<String, dynamic>? get activeSubscription => _activeSubscription;
  bool get isLoading => _isLoading;
  bool get hasActiveSubscription => _activeSubscription != null;

  CreditProvider() {
    loadData();
  }

  Future<void> loadData() async {
    _isLoading = true;
    notifyListeners();

    try {
      _credits = await _creditService.getUserCredits();
      _creditConfig = await _creditService.getCreditConfig();
      _creditPackages = await _creditService.getCreditPackages();
      _activeSubscription = await _creditService.getActiveSubscription();
    } catch (e) {
      debugPrint('Error loading credit data: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void refreshCredits() {
    _creditService.watchUserCredits().listen((credits) {
      _credits = credits;
      notifyListeners();
    });
  }
}


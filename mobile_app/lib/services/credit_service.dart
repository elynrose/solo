import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

class CreditService {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final FirebaseAuth _auth = FirebaseAuth.instance;

  String? get currentUserId => _auth.currentUser?.uid;

  // Get user's full profile including credits
  Future<Map<String, dynamic>?> getUserProfile() async {
    final userId = currentUserId;
    if (userId == null) return null;

    final doc = await _firestore.collection('users').doc(userId).get();
    if (!doc.exists) return null;
    
    return {
      'id': doc.id,
      ...doc.data()!,
    };
  }

  Future<int> getUserCredits() async {
    final userId = currentUserId;
    if (userId == null) return 0;

    final doc = await _firestore.collection('users').doc(userId).get();
    final data = doc.data();
    return data?['credits'] ?? 0;
  }

  Stream<int> watchUserCredits() {
    final userId = currentUserId;
    if (userId == null) return Stream.value(0);

    return _firestore
        .collection('users')
        .doc(userId)
        .snapshots()
        .map((doc) => doc.data()?['credits'] ?? 0);
  }

  // Watch user profile changes
  Stream<Map<String, dynamic>?> watchUserProfile() {
    final userId = currentUserId;
    if (userId == null) return Stream.value(null);

    return _firestore
        .collection('users')
        .doc(userId)
        .snapshots()
        .map((doc) {
          if (!doc.exists) return null;
          return {
            'id': doc.id,
            ...doc.data()!,
          };
        });
  }

  Future<Map<String, dynamic>> getCreditConfig() async {
    final doc = await _firestore.collection('creditConfig').doc('default').get();
    if (!doc.exists) {
      return {
        'recording': 10,
        'ai': 50,
        'url': 5,
        'per10kTokens': 1,
      };
    }
    return doc.data() ?? {};
  }

  Future<List<Map<String, dynamic>>> getCreditPackages() async {
    final snapshot = await _firestore
        .collection('creditPackages')
        .where('active', isEqualTo: true)
        .get();

    return snapshot.docs.map((doc) {
      final data = doc.data();
      return {
        'id': doc.id,
        ...data,
      };
    }).toList();
  }

  // Get subscription packages
  Future<List<Map<String, dynamic>>> getSubscriptionPackages() async {
    final snapshot = await _firestore
        .collection('subscriptionPackages')
        .where('active', isEqualTo: true)
        .get();

    return snapshot.docs.map((doc) {
      final data = doc.data();
      return {
        'id': doc.id,
        ...data,
      };
    }).toList();
  }

  Future<Map<String, dynamic>?> getActiveSubscription() async {
    final userId = currentUserId;
    if (userId == null) return null;

    final snapshot = await _firestore
        .collection('userSubscriptions')
        .where('userId', isEqualTo: userId)
        .where('status', isEqualTo: 'active')
        .limit(1)
        .get();

    if (snapshot.docs.isEmpty) return null;

    final doc = snapshot.docs.first;
    return {
      'id': doc.id,
      ...doc.data(),
    };
  }

  // Get user's credit transaction history
  Future<List<Map<String, dynamic>>> getCreditTransactions({int limit = 20}) async {
    final userId = currentUserId;
    if (userId == null) return [];

    final snapshot = await _firestore
        .collection('creditTransactions')
        .where('userId', isEqualTo: userId)
        .orderBy('createdAt', descending: true)
        .limit(limit)
        .get();

    return snapshot.docs.map((doc) {
      final data = doc.data();
      return {
        'id': doc.id,
        ...data,
      };
    }).toList();
  }

  // Get user's payment history
  Future<List<Map<String, dynamic>>> getPaymentHistory({int limit = 20}) async {
    final userId = currentUserId;
    if (userId == null) return [];

    final snapshot = await _firestore
        .collection('payments')
        .where('userId', isEqualTo: userId)
        .orderBy('createdAt', descending: true)
        .limit(limit)
        .get();

    return snapshot.docs.map((doc) {
      final data = doc.data();
      return {
        'id': doc.id,
        ...data,
      };
    }).toList();
  }
}

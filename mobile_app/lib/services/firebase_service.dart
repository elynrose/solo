import 'package:firebase_core/firebase_core.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'dart:io';
import 'package:http/http.dart' as http;
import '../config/app_config.dart';

class FirebaseService {
  static final FirebaseService _instance = FirebaseService._internal();
  factory FirebaseService() => _instance;
  FirebaseService._internal();

  late FirebaseFirestore _firestore;
  late FirebaseStorage _storage;
  String? _baseUrl;

  FirebaseFirestore get firestore => _firestore;
  FirebaseStorage get storage => _storage;
  String? get baseUrl => _baseUrl;

  Future<void> initialize({String? baseUrl}) async {
    _firestore = FirebaseFirestore.instance;
    _storage = FirebaseStorage.instance;
    _baseUrl = baseUrl ?? AppConfig.baseUrl;
  }

  // Get Firebase config from server
  Future<Map<String, dynamic>> getFirebaseConfig() async {
    try {
      final response = await http.get(Uri.parse(AppConfig.getApiUrl(AppConfig.firebaseConfigEndpoint)));
      if (response.statusCode == 200) {
        return Map<String, dynamic>.from(
          (response.body as dynamic) is Map
              ? response.body
              : (await http.Response.fromStream(response.stream)).body
        );
      }
      throw Exception('Failed to load Firebase config');
    } catch (e) {
      throw Exception('Error fetching Firebase config: $e');
    }
  }
}


import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../models/avatar.dart';
import '../config/app_config.dart';

class ChatMessage {
  final String role; // 'user' or 'ai'
  final String content;
  final DateTime timestamp;

  ChatMessage({
    required this.role,
    required this.content,
    required this.timestamp,
  });

  Map<String, dynamic> toMap() {
    return {
      'role': role,
      'content': content,
      'timestamp': timestamp.toIso8601String(),
    };
  }
}

class ChatService {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final String baseUrl;

  ChatService({String? baseUrl}) : baseUrl = baseUrl ?? AppConfig.baseUrl;

  Future<Map<String, dynamic>> sendMessage({
    required String message,
    required String avatarId,
    required List<ChatMessage> conversationHistory,
    required List<String> expressionLabels,
    String? avatarDescription,
    String? avatarProfilePhotoUrl,
    List<Map<String, dynamic>>? memoryBank,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/api/chat'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'message': message,
          'conversationHistory': conversationHistory.map((m) => {
            'role': m.role,
            'content': m.content,
          }).toList(),
          'expressionLabels': expressionLabels,
          'avatarDescription': avatarDescription,
          'avatarProfilePhotoUrl': avatarProfilePhotoUrl,
          'memoryBank': memoryBank,
        }),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return {
          'success': true,
          'response': data['response'],
          'label': data['label'],
          'tokens': data['tokens'],
        };
      } else {
        final error = jsonDecode(response.body);
        return {
          'success': false,
          'error': error['error'] ?? error['details'] ?? 'Unknown error',
        };
      }
    } catch (e) {
      return {
        'success': false,
        'error': 'Failed to send message: ${e.toString()}',
      };
    }
  }

  Future<void> saveChatSession({
    required String avatarId,
    required List<ChatMessage> messages,
  }) async {
    final userId = _auth.currentUser?.uid;
    if (userId == null) return;

    final sessionRef = _firestore.collection('chatSessions').doc();
    await sessionRef.set({
      'userId': userId,
      'avatarId': avatarId,
      'messages': messages.map((m) => m.toMap()).toList(),
      'createdAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    });
  }

  Future<List<ChatMessage>> loadChatSession(String sessionId) async {
    final doc = await _firestore.collection('chatSessions').doc(sessionId).get();
    if (!doc.exists) return [];

    final data = doc.data();
    final messages = data?['messages'] as List<dynamic>?;
    if (messages == null) return [];

    return messages.map((m) {
      return ChatMessage(
        role: m['role'] ?? 'user',
        content: m['content'] ?? '',
        timestamp: DateTime.parse(m['timestamp'] ?? DateTime.now().toIso8601String()),
      );
    }).toList();
  }

  /// Load the most recent chat session for a specific avatar
  Future<List<ChatMessage>> loadChatHistoryForAvatar(String avatarId) async {
    final userId = _auth.currentUser?.uid;
    if (userId == null) return [];

    try {
      final querySnapshot = await _firestore
          .collection('chatSessions')
          .where('userId', isEqualTo: userId)
          .where('avatarId', isEqualTo: avatarId)
          .orderBy('updatedAt', descending: true)
          .limit(1)
          .get();

      if (querySnapshot.docs.isEmpty) return [];

      final data = querySnapshot.docs.first.data();
      final messages = data['messages'] as List<dynamic>?;
      if (messages == null) return [];

      return messages.map((m) {
        return ChatMessage(
          role: m['role'] ?? 'user',
          content: m['content'] ?? '',
          timestamp: DateTime.tryParse(m['timestamp'] ?? '') ?? DateTime.now(),
        );
      }).toList();
    } catch (e) {
      print('Error loading chat history: $e');
      return [];
    }
  }

  /// Update or create a chat session for an avatar
  Future<void> updateChatSession({
    required String avatarId,
    required List<ChatMessage> messages,
  }) async {
    final userId = _auth.currentUser?.uid;
    if (userId == null) return;

    try {
      // Find existing session for this avatar
      final querySnapshot = await _firestore
          .collection('chatSessions')
          .where('userId', isEqualTo: userId)
          .where('avatarId', isEqualTo: avatarId)
          .limit(1)
          .get();

      if (querySnapshot.docs.isNotEmpty) {
        // Update existing session
        await querySnapshot.docs.first.reference.update({
          'messages': messages.map((m) => m.toMap()).toList(),
          'updatedAt': FieldValue.serverTimestamp(),
        });
      } else {
        // Create new session
        await _firestore.collection('chatSessions').add({
          'userId': userId,
          'avatarId': avatarId,
          'messages': messages.map((m) => m.toMap()).toList(),
          'createdAt': FieldValue.serverTimestamp(),
          'updatedAt': FieldValue.serverTimestamp(),
        });
      }
    } catch (e) {
      print('Error updating chat session: $e');
    }
  }
}


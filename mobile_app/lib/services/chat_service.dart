import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../models/avatar.dart';

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

  ChatService({this.baseUrl = 'http://localhost:3001'});

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
}


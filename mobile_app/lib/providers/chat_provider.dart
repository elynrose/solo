import 'package:flutter/foundation.dart';
import '../services/chat_service.dart';
import '../models/avatar.dart';

class ChatProvider with ChangeNotifier {
  final ChatService _chatService = ChatService();
  List<ChatMessage> _messages = [];
  String? _currentExpression;
  bool _isProcessing = false;
  Map<String, dynamic>? _tokenUsage;

  List<ChatMessage> get messages => _messages;
  String? get currentExpression => _currentExpression;
  bool get isProcessing => _isProcessing;
  Map<String, dynamic>? get tokenUsage => _tokenUsage;

  Future<void> sendMessage({
    required String message,
    required Avatar avatar,
    required List<String> expressionLabels,
  }) async {
    if (_isProcessing || message.trim().isEmpty) return;

    _isProcessing = true;
    notifyListeners();

    // Add user message
    _messages.add(ChatMessage(
      role: 'user',
      content: message,
      timestamp: DateTime.now(),
    ));
    notifyListeners();

    try {
      final result = await _chatService.sendMessage(
        message: message,
        avatarId: avatar.id,
        conversationHistory: _messages,
        expressionLabels: expressionLabels,
        avatarDescription: avatar.description,
        avatarProfilePhotoUrl: avatar.profilePhotoUrl,
        memoryBank: avatar.memoryBank,
      );

      if (result['success'] == true) {
        // Add AI response
        _messages.add(ChatMessage(
          role: 'ai',
          content: result['response'] ?? '',
          timestamp: DateTime.now(),
        ));
        _currentExpression = result['label'];
        _tokenUsage = result['tokens'];
      } else {
        _messages.add(ChatMessage(
          role: 'system',
          content: 'Error: ${result['error']}',
          timestamp: DateTime.now(),
        ));
      }
    } catch (e) {
      _messages.add(ChatMessage(
        role: 'system',
        content: 'Error: ${e.toString()}',
        timestamp: DateTime.now(),
      ));
    } finally {
      _isProcessing = false;
      notifyListeners();
    }
  }

  void clearChat() {
    _messages.clear();
    _currentExpression = null;
    _tokenUsage = null;
    notifyListeners();
  }
}


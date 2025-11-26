import 'package:flutter/foundation.dart';
import '../services/chat_service.dart';
import '../models/avatar.dart';

class ChatProvider with ChangeNotifier {
  final ChatService _chatService = ChatService();
  List<ChatMessage> _messages = [];
  String? _currentExpression;
  bool _isProcessing = false;
  bool _isLoadingHistory = false;
  Map<String, dynamic>? _tokenUsage;
  String? _currentAvatarId;

  List<ChatMessage> get messages => _messages;
  String? get currentExpression => _currentExpression;
  bool get isProcessing => _isProcessing;
  bool get isLoadingHistory => _isLoadingHistory;
  Map<String, dynamic>? get tokenUsage => _tokenUsage;

  /// Load chat history for an avatar
  Future<void> loadChatHistory(String avatarId) async {
    // Don't reload if already loaded for this avatar
    if (_currentAvatarId == avatarId && _messages.isNotEmpty) {
      return;
    }

    _isLoadingHistory = true;
    _currentAvatarId = avatarId;
    notifyListeners();

    try {
      final history = await _chatService.loadChatHistoryForAvatar(avatarId);
      _messages = history;
      debugPrint('Loaded ${history.length} messages for avatar $avatarId');
    } catch (e) {
      debugPrint('Error loading chat history: $e');
      _messages = [];
    } finally {
      _isLoadingHistory = false;
      notifyListeners();
    }
  }

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
      
      // Save chat session after each message
      if (_currentAvatarId != null) {
        _chatService.updateChatSession(
          avatarId: _currentAvatarId!,
          messages: _messages,
        );
      }
    }
  }

  void clearChat() {
    _messages.clear();
    _currentExpression = null;
    _tokenUsage = null;
    _currentAvatarId = null;
    notifyListeners();
  }
}


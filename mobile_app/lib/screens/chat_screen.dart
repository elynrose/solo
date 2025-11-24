import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:video_player/video_player.dart';
import '../models/avatar.dart';
import '../providers/chat_provider.dart';
import '../providers/credit_provider.dart';
import '../services/avatar_service.dart';

class ChatScreen extends StatefulWidget {
  final Avatar avatar;

  const ChatScreen({super.key, required this.avatar});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _messageController = TextEditingController();
  final _scrollController = ScrollController();
  VideoPlayerController? _videoController;
  List<String> _expressionLabels = [];
  bool _isLoadingExpressions = true;

  @override
  void initState() {
    super.initState();
    _loadExpressions();
    _initVideo();
  }

  Future<void> _loadExpressions() async {
    // Load expressions from Firestore
    final avatarService = AvatarService();
    // For now, use default expressions - in production, load from Firestore
    setState(() {
      _expressionLabels = [
        'Funny',
        'Interested',
        'Agree',
        'Disagree',
        'Neutral',
        'Confused',
        'Bored',
      ];
      _isLoadingExpressions = false;
    });
  }

  void _initVideo() {
    _videoController = VideoPlayerController.networkUrl(
      Uri.parse(widget.avatar.videoUrl),
    );
    _videoController?.initialize().then((_) {
      setState(() {});
      _videoController?.play();
      _videoController?.setLooping(true);
    });
  }

  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.dispose();
    _videoController?.dispose();
    super.dispose();
  }

  Future<void> _sendMessage() async {
    final message = _messageController.text.trim();
    if (message.isEmpty) return;

    _messageController.clear();

    final chatProvider = Provider.of<ChatProvider>(context, listen: false);
    await chatProvider.sendMessage(
      message: message,
      avatar: widget.avatar,
      expressionLabels: _expressionLabels,
    );

    // Scroll to bottom
    if (_scrollController.hasClients) {
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.avatar.name),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: Column(
        children: [
          // Video player section
          Container(
            height: 200,
            color: Colors.black,
            child: _videoController != null &&
                    _videoController!.value.isInitialized
                ? AspectRatio(
                    aspectRatio: _videoController!.value.aspectRatio,
                    child: VideoPlayer(_videoController!),
                  )
                : const Center(child: CircularProgressIndicator()),
          ),
          // Expression indicator
          Consumer<ChatProvider>(
            builder: (context, chatProvider, _) {
              if (chatProvider.currentExpression != null) {
                return Container(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  color: Colors.blue[50],
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.mood, size: 20),
                      const SizedBox(width: 8),
                      Text(
                        'Expression: ${chatProvider.currentExpression}',
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                );
              }
              return const SizedBox.shrink();
            },
          ),
          // Chat messages
          Expanded(
            child: Consumer<ChatProvider>(
              builder: (context, chatProvider, _) {
                if (chatProvider.messages.isEmpty) {
                  return Center(
                    child: Text(
                      'Start chatting with ${widget.avatar.name}',
                      style: TextStyle(color: Colors.grey[600]),
                    ),
                  );
                }

                return ListView.builder(
                  controller: _scrollController,
                  padding: const EdgeInsets.all(16),
                  itemCount: chatProvider.messages.length,
                  itemBuilder: (context, index) {
                    final message = chatProvider.messages[index];
                    final isUser = message.role == 'user';
                    return Align(
                      alignment: isUser
                          ? Alignment.centerRight
                          : Alignment.centerLeft,
                      child: Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 12,
                        ),
                        decoration: BoxDecoration(
                          color: isUser
                              ? Theme.of(context).colorScheme.primary
                              : Colors.grey[200],
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Text(
                          message.content,
                          style: TextStyle(
                            color: isUser ? Colors.white : Colors.black87,
                          ),
                        ),
                      ),
                    );
                  },
                );
              },
            ),
          ),
          // Input section
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.1),
                  blurRadius: 4,
                  offset: const Offset(0, -2),
                ),
              ],
            ),
            child: Consumer<ChatProvider>(
              builder: (context, chatProvider, _) {
                return Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _messageController,
                        decoration: const InputDecoration(
                          hintText: 'Type a message...',
                          border: OutlineInputBorder(),
                        ),
                        enabled: !chatProvider.isProcessing,
                        onSubmitted: (_) => _sendMessage(),
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton(
                      onPressed: chatProvider.isProcessing ? null : _sendMessage,
                      icon: chatProvider.isProcessing
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.send),
                    ),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}


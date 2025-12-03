import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:video_player/video_player.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/avatar.dart';
import '../providers/chat_provider.dart';
import '../providers/credit_provider.dart';
import '../services/avatar_service.dart';
import 'terms_of_service_screen.dart';
import 'privacy_policy_screen.dart';

class ChatScreen extends StatefulWidget {
  final Avatar avatar;

  const ChatScreen({super.key, required this.avatar});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> with WidgetsBindingObserver {
  final _messageController = TextEditingController();
  final _scrollController = ScrollController();
  VideoPlayerController? _videoController;
  List<String> _expressionLabels = [];
  Map<String, ExpressionSegment> _expressionSegments = {};
  bool _isLoadingExpressions = true;
  String? _currentExpression;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _loadExpressions();
    _initVideo();
    _loadChatHistory();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);
    if (state == AppLifecycleState.resumed) {
      // When app resumes, check and correct video position
      _checkAndCorrectVideoPosition();
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Check video position when screen becomes visible again
    // Use a small delay to ensure video controller is ready
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && _videoController != null && _videoController!.value.isInitialized) {
        Future.delayed(const Duration(milliseconds: 300), () {
          if (mounted) {
            _checkAndCorrectVideoPosition();
          }
        });
      }
    });
  }

  Future<void> _loadChatHistory() async {
    final chatProvider = Provider.of<ChatProvider>(context, listen: false);
    await chatProvider.loadChatHistory(widget.avatar.id);
    _scrollToBottom();
  }

  Future<void> _loadExpressions() async {
    try {
      // Load expressions from Firestore
      final snapshot = await FirebaseFirestore.instance
          .collection('expressions')
          .get();
      
      final labels = <String>[];
      final segments = <String, ExpressionSegment>{};
      
      for (var doc in snapshot.docs) {
        final data = doc.data();
        final label = data['label'] as String?;
        final startTime = data['startTime'] as String?;
        final endTime = data['endTime'] as String?;
        
        if (label != null && startTime != null && endTime != null) {
          labels.add(label);
          segments[label] = ExpressionSegment(
            start: _timeToSeconds(startTime),
            end: _timeToSeconds(endTime),
          );
          debugPrint('Loaded expression: $label from $startTime to $endTime');
        }
      }
      
      setState(() {
        _expressionLabels = labels;
        _expressionSegments = segments;
        _isLoadingExpressions = false;
      });
      
      debugPrint('Total expressions loaded: ${labels.length}');
    } catch (e) {
      debugPrint('Error loading expressions: $e');
      // Fallback to default expressions if loading fails
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
        _expressionSegments = {
          'Funny': ExpressionSegment(start: 0, end: 12),
          'Interested': ExpressionSegment(start: 13, end: 28),
          'Agree': ExpressionSegment(start: 30, end: 37),
          'Disagree': ExpressionSegment(start: 40, end: 48),
          'Neutral': ExpressionSegment(start: 50, end: 55),
          'Confused': ExpressionSegment(start: 60, end: 68),
          'Bored': ExpressionSegment(start: 70, end: 80),
        };
        _isLoadingExpressions = false;
      });
    }
  }

  /// Convert time string (MM:SS or MM:SS.mmm) to seconds
  double _timeToSeconds(String timeStr) {
    // Check if there are milliseconds (decimal part)
    final hasMilliseconds = timeStr.contains('.');
    double milliseconds = 0.0;
    String timeWithoutMs = timeStr;
    
    if (hasMilliseconds) {
      final dotIndex = timeStr.lastIndexOf('.');
      final msPart = timeStr.substring(dotIndex + 1);
      milliseconds = double.tryParse('0.$msPart') ?? 0.0;
      timeWithoutMs = timeStr.substring(0, dotIndex);
    }
    
    final parts = timeWithoutMs.split(':');
    if (parts.length == 2) {
      final minutes = int.tryParse(parts[0]) ?? 0;
      final seconds = int.tryParse(parts[1]) ?? 0;
      return (minutes * 60 + seconds).toDouble() + milliseconds;
    } else if (parts.length == 3) {
      // Support HH:MM:SS format as well
      final hours = int.tryParse(parts[0]) ?? 0;
      final minutes = int.tryParse(parts[1]) ?? 0;
      final seconds = int.tryParse(parts[2]) ?? 0;
      return (hours * 3600 + minutes * 60 + seconds).toDouble() + milliseconds;
    }
    return 0;
  }

  void _initVideo() {
    _videoController = VideoPlayerController.networkUrl(
      Uri.parse(widget.avatar.videoUrl),
    );
    _videoController?.initialize().then((_) {
      setState(() {});
      // Don't use setLooping - we manage looping manually within segments
      _videoController?.setLooping(false);
      _videoController?.play();
      
      // Add position listener for segment looping
      _videoController?.addListener(_onVideoPositionChanged);
      
      // Start with Neutral expression if available
      _seekToExpression('Neutral');
    });
  }

  ExpressionSegment? _currentSegment;
  String? _activeExpression;
  bool _isNeutral = true;

  bool _isSeeking = false;
  int _seekStartTime = 0;
  
  /// Called whenever video position changes
  void _onVideoPositionChanged() {
    if (_videoController == null || !_videoController!.value.isInitialized) return;
    if (_currentSegment == null) return;
    if (_isSeeking) return; // Prevent re-entry during seek
    
    final positionMs = _videoController!.value.position.inMilliseconds;
    final startMs = (_currentSegment!.start * 1000).toInt();
    final endMs = (_currentSegment!.end * 1000).toInt();
    
    // Wait for seek to complete - position should be within segment range
    // Give some tolerance (500ms) for seek to complete
    if (positionMs < startMs - 500 || positionMs > endMs + 500) {
      // Position is outside segment - likely seek hasn't completed yet
      // Only act if we've been waiting too long (more than 1 second since seek started)
      if (DateTime.now().millisecondsSinceEpoch - _seekStartTime < 1000) {
        return; // Still waiting for seek to complete
      }
      // If we've been waiting too long and position is still outside, re-seek
      // This handles cases where the video continued playing while away
      if (_activeExpression != null) {
        debugPrint('Position still outside segment after seek timeout, re-seeking to $_activeExpression');
        _seekToExpression(_activeExpression);
        return;
      }
    }
    
    // Check if we've reached the end of the current segment
    if (positionMs >= endMs && positionMs <= endMs + 1000) {
      _isSeeking = true;
      
      if (_isNeutral) {
        // For Neutral, loop continuously within segment
        debugPrint('Neutral loop: position $positionMs >= end $endMs, seeking back to $startMs');
        _seekStartTime = DateTime.now().millisecondsSinceEpoch;
        _videoController?.seekTo(Duration(milliseconds: startMs)).then((_) {
          _videoController?.play();
          Future.delayed(Duration(milliseconds: 200), () {
            _isSeeking = false;
          });
        });
      } else {
        // For other expressions, return to Neutral after playing once
        debugPrint('Expression finished at $positionMs (end: $endMs), returning to Neutral');
        Future.delayed(Duration(milliseconds: 100), () {
          _isSeeking = false;
          _seekToExpression('Neutral');
        });
      }
    }
  }

  /// Seek video to the start of the given expression segment
  void _seekToExpression(String? expression) {
    debugPrint('_seekToExpression called with: $expression');
    
    if (expression == null) {
      debugPrint('Expression is null, returning');
      return;
    }
    
    if (_videoController == null) {
      debugPrint('Video controller is null, returning');
      return;
    }
    
    // Try exact match first, then case-insensitive match
    ExpressionSegment? segment = _expressionSegments[expression];
    String? matchedExpression = expression;
    
    if (segment == null) {
      // Try case-insensitive match
      for (var key in _expressionSegments.keys) {
        if (key.toLowerCase() == expression.toLowerCase()) {
          segment = _expressionSegments[key];
          matchedExpression = key;
          debugPrint('Found case-insensitive match: $key');
          break;
        }
      }
    }
    
    if (segment == null) {
      debugPrint('Expression "$expression" not found in segments. Available: ${_expressionSegments.keys.toList()}');
      return;
    }
    
    debugPrint('Seeking to expression: $matchedExpression at ${segment.start}s - ${segment.end}s');
    debugPrint('Video controller initialized: ${_videoController!.value.isInitialized}');
    
    // Update current segment and expression state
    _currentSegment = segment;
    _activeExpression = matchedExpression;
    _isNeutral = (matchedExpression?.toLowerCase() == 'neutral');
    
    // Mark as seeking and record time
    _isSeeking = true;
    _seekStartTime = DateTime.now().millisecondsSinceEpoch;
    
    // Seek to start of expression
    final startMs = (segment.start * 1000).toInt();
    debugPrint('Seeking to ${startMs}ms');
    
    _videoController?.seekTo(Duration(milliseconds: startMs)).then((_) {
      debugPrint('Seek completed to ${startMs}ms');
      _videoController?.play();
      // Wait a bit before allowing position checks again
      Future.delayed(Duration(milliseconds: 300), () {
        _isSeeking = false;
        debugPrint('Seek lock released, isNeutral: $_isNeutral');
      });
    });
    
    setState(() {
      _currentExpression = matchedExpression;
    });
  }

  /// Check if video position is within current segment bounds and correct if needed
  void _checkAndCorrectVideoPosition() {
    if (_videoController == null || !_videoController!.value.isInitialized) return;
    if (_currentSegment == null || _activeExpression == null) return;
    if (_isSeeking) return; // Don't interfere with ongoing seek
    
    final positionMs = _videoController!.value.position.inMilliseconds;
    final startMs = (_currentSegment!.start * 1000).toInt();
    final endMs = (_currentSegment!.end * 1000).toInt();
    
    // Check if position is outside segment bounds (with some tolerance)
    // If it is, re-seek to the start of the current active expression segment
    if (positionMs < startMs - 500 || positionMs > endMs + 500) {
      debugPrint('Video position $positionMs is outside segment bounds [$startMs, $endMs], re-seeking to $_activeExpression');
      _seekToExpression(_activeExpression);
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _messageController.dispose();
    _scrollController.dispose();
    _videoController?.removeListener(_onVideoPositionChanged);
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

    // Seek to the detected expression
    debugPrint('Chat response expression: ${chatProvider.currentExpression}');
    debugPrint('Available expressions: $_expressionLabels');
    debugPrint('Expression segments: ${_expressionSegments.keys.toList()}');
    if (chatProvider.currentExpression != null) {
      debugPrint('Calling _seekToExpression with: ${chatProvider.currentExpression}');
      _seekToExpression(chatProvider.currentExpression);
    } else {
      debugPrint('No expression returned from chat');
    }

    // Scroll to bottom after a short delay to ensure the message is rendered
    _scrollToBottom();
  }

  void _scrollToBottom() {
    // With reverse: true, scrolling to 0 shows the latest messages
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          0,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
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
            height: 250,
            color: Colors.black,
            child: _videoController != null &&
                    _videoController!.value.isInitialized
                ? Stack(
                    alignment: Alignment.center,
                    children: [
                      AspectRatio(
                        aspectRatio: _videoController!.value.aspectRatio,
                        child: VideoPlayer(_videoController!),
                      ),
                      // Expression label overlay
                      if (_currentExpression != null)
                        Positioned(
                          top: 8,
                          right: 8,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 6,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.black54,
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: Text(
                              _currentExpression!,
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ),
                    ],
                  )
                : const Center(child: CircularProgressIndicator()),
          ),
          // Expression indicator bar
          Consumer<ChatProvider>(
            builder: (context, chatProvider, _) {
              final expression = chatProvider.currentExpression ?? _currentExpression;
              if (expression != null) {
                return Container(
                  padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
                  color: Theme.of(context).colorScheme.primaryContainer,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.mood, size: 20),
                      const SizedBox(width: 8),
                      Text(
                        'Expression: $expression',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: Theme.of(context).colorScheme.onPrimaryContainer,
                        ),
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
                  reverse: true,
                  itemCount: chatProvider.messages.length,
                  itemBuilder: (context, index) {
                    // Reverse the index since list is reversed
                    final reversedIndex = chatProvider.messages.length - 1 - index;
                    final message = chatProvider.messages[reversedIndex];
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
                        constraints: BoxConstraints(
                          maxWidth: MediaQuery.of(context).size.width * 0.75,
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
                return SafeArea(
                  child: Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _messageController,
                          decoration: InputDecoration(
                            hintText: 'Type a message...',
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(24),
                            ),
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 12,
                            ),
                          ),
                          enabled: !chatProvider.isProcessing,
                          onSubmitted: (_) => _sendMessage(),
                        ),
                      ),
                      const SizedBox(width: 8),
                      FloatingActionButton(
                        mini: true,
                        onPressed: chatProvider.isProcessing ? null : _sendMessage,
                        child: chatProvider.isProcessing
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : const Icon(Icons.send),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
          // AI Disclaimer
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            color: Colors.grey[100],
            child: Row(
              children: [
                Icon(Icons.info_outline, size: 14, color: Colors.grey[600]),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'AI-generated responses. Not professional advice. ',
                    style: TextStyle(fontSize: 11, color: Colors.grey[600]),
                  ),
                ),
                GestureDetector(
                  onTap: () => _showLegalLinks(context),
                  child: Text(
                    'Terms & Privacy',
                    style: TextStyle(
                      fontSize: 11,
                      color: Theme.of(context).colorScheme.primary,
                      decoration: TextDecoration.underline,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _showLegalLinks(BuildContext context) {
    showModalBottomSheet(
      context: context,
      builder: (context) => Container(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Legal',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            ListTile(
              leading: const Icon(Icons.description),
              title: const Text('Terms of Service'),
              onTap: () {
                Navigator.pop(context);
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const TermsOfServiceScreen()),
                );
              },
            ),
            ListTile(
              leading: const Icon(Icons.privacy_tip),
              title: const Text('Privacy Policy'),
              onTap: () {
                Navigator.pop(context);
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const PrivacyPolicyScreen()),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

/// Represents a time segment for an expression in the video
class ExpressionSegment {
  final double start;
  final double end;

  ExpressionSegment({required this.start, required this.end});
}

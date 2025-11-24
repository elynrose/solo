import 'package:flutter/foundation.dart';
import '../models/avatar.dart';
import '../services/avatar_service.dart';

class AvatarProvider with ChangeNotifier {
  final AvatarService _avatarService = AvatarService();
  List<Avatar> _avatars = [];
  Avatar? _selectedAvatar;
  bool _isLoading = false;

  List<Avatar> get avatars => _avatars;
  Avatar? get selectedAvatar => _selectedAvatar;
  bool get isLoading => _isLoading;

  AvatarProvider() {
    loadAvatars();
  }

  Future<void> loadAvatars() async {
    _isLoading = true;
    notifyListeners();

    try {
      _avatars = await _avatarService.getAvatarsOnce();
    } catch (e) {
      debugPrint('Error loading avatars: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void selectAvatar(Avatar avatar) {
    _selectedAvatar = avatar;
    notifyListeners();
  }

  void clearSelection() {
    _selectedAvatar = null;
    notifyListeners();
  }
}


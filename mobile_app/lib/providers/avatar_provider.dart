import 'package:flutter/foundation.dart';
import 'dart:io';
import '../models/avatar.dart';
import '../services/avatar_service.dart';

class AvatarProvider with ChangeNotifier {
  final AvatarService _avatarService = AvatarService();
  List<Avatar> _avatars = [];
  List<Avatar> _myAvatars = [];
  List<Map<String, dynamic>> _categories = [];
  Avatar? _selectedAvatar;
  bool _isLoading = false;
  bool _isCreating = false;
  String? _error;

  List<Avatar> get avatars => _avatars;
  List<Avatar> get myAvatars => _myAvatars;
  List<Map<String, dynamic>> get categories => _categories;
  Avatar? get selectedAvatar => _selectedAvatar;
  bool get isLoading => _isLoading;
  bool get isCreating => _isCreating;
  String? get error => _error;

  AvatarProvider() {
    loadAvatars();
  }

  Future<void> loadAvatars() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      _avatars = await _avatarService.getAvatarsOnce();
    } catch (e) {
      debugPrint('Error loading avatars: $e');
    }

    try {
      _myAvatars = await _avatarService.getMyAvatars();
    } catch (e) {
      debugPrint('Error loading my avatars: $e');
    }

    try {
      _categories = await _avatarService.getCategories();
    } catch (e) {
      debugPrint('Error loading categories: $e');
    }

    _isLoading = false;
    notifyListeners();
  }

  Future<String?> createAvatarFromUrl({
    required String name,
    String? description,
    required String videoUrl,
    String? profilePhotoUrl,
    bool isPublic = false,
    String? categoryId,
    required List<Map<String, dynamic>> expressions,
  }) async {
    _isCreating = true;
    _error = null;
    notifyListeners();

    try {
      final avatarId = await _avatarService.createAvatarFromUrl(
        name: name,
        description: description,
        videoUrl: videoUrl,
        profilePhotoUrl: profilePhotoUrl,
        isPublic: isPublic,
        categoryId: categoryId,
        expressions: expressions,
      );
      
      // Reload avatars
      await loadAvatars();
      
      return avatarId;
    } catch (e) {
      debugPrint('Error creating avatar: $e');
      _error = e.toString();
      return null;
    } finally {
      _isCreating = false;
      notifyListeners();
    }
  }

  Future<String?> createAvatarWithUpload({
    required String name,
    String? description,
    required File videoFile,
    File? profilePhotoFile,
    bool isPublic = false,
    String? categoryId,
    required List<Map<String, dynamic>> expressions,
  }) async {
    _isCreating = true;
    _error = null;
    notifyListeners();

    try {
      final avatarId = await _avatarService.createAvatarWithUpload(
        name: name,
        description: description,
        videoFile: videoFile,
        profilePhotoFile: profilePhotoFile,
        isPublic: isPublic,
        categoryId: categoryId,
        expressions: expressions,
      );
      
      await loadAvatars();
      return avatarId;
    } catch (e) {
      debugPrint('Error creating avatar: $e');
      _error = e.toString();
      return null;
    } finally {
      _isCreating = false;
      notifyListeners();
    }
  }

  Future<bool> updateAvatar({
    required String avatarId,
    String? name,
    String? description,
    String? videoUrl,
    String? profilePhotoUrl,
    bool? isPublic,
    String? categoryId,
  }) async {
    try {
      await _avatarService.updateAvatar(
        avatarId: avatarId,
        name: name,
        description: description,
        videoUrl: videoUrl,
        profilePhotoUrl: profilePhotoUrl,
        isPublic: isPublic,
        categoryId: categoryId,
      );
      await loadAvatars();
      return true;
    } catch (e) {
      debugPrint('Error updating avatar: $e');
      _error = e.toString();
      return false;
    }
  }

  Future<bool> deleteAvatar(String avatarId) async {
    try {
      await _avatarService.deleteAvatar(avatarId);
      await loadAvatars();
      return true;
    } catch (e) {
      debugPrint('Error deleting avatar: $e');
      _error = e.toString();
      return false;
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

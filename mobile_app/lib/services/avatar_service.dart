import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'dart:io';
import '../models/avatar.dart';

class AvatarService {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final FirebaseStorage _storage = FirebaseStorage.instance;
  final FirebaseAuth _auth = FirebaseAuth.instance;

  String? get currentUserId => _auth.currentUser?.uid;

  // Get all avatars visible to current user
  Stream<List<Avatar>> getAvatars() {
    final userId = _auth.currentUser?.uid;
    if (userId == null) return Stream.value([]);

    return _firestore
        .collection('avatars')
        .where('isPublic', isEqualTo: true)
        .snapshots()
        .map((snapshot) {
      final avatars = <Avatar>[];
      for (var doc in snapshot.docs) {
        avatars.add(Avatar.fromFirestore(doc));
      }
      
      // Also get user's private avatars
      _firestore
          .collection('avatars')
          .where('createdBy', isEqualTo: userId)
          .where('isPublic', isEqualTo: false)
          .get()
          .then((snapshot) {
        for (var doc in snapshot.docs) {
          if (!avatars.any((a) => a.id == doc.id)) {
            avatars.add(Avatar.fromFirestore(doc));
          }
        }
      });
      
      return avatars;
    });
  }

  Future<List<Avatar>> getAvatarsOnce() async {
    final userId = _auth.currentUser?.uid;
    if (userId == null) {
      print('AvatarService: No user logged in');
      return [];
    }

    final avatars = <Avatar>[];
    final addedIds = <String>{};

    try {
      // Get public avatars
      final publicAvatars = await _firestore
          .collection('avatars')
          .where('isPublic', isEqualTo: true)
          .get();
      
      print('AvatarService: Found ${publicAvatars.docs.length} public avatars');
      
      for (var doc in publicAvatars.docs) {
        if (!addedIds.contains(doc.id)) {
          avatars.add(Avatar.fromFirestore(doc));
          addedIds.add(doc.id);
        }
      }
    } catch (e) {
      print('AvatarService: Error loading public avatars: $e');
    }

    try {
      // Get user's own avatars (both public and private)
      final myAvatars = await _firestore
          .collection('avatars')
          .where('createdBy', isEqualTo: userId)
          .get();
      
      print('AvatarService: Found ${myAvatars.docs.length} user avatars');
      
      for (var doc in myAvatars.docs) {
        if (!addedIds.contains(doc.id)) {
          avatars.add(Avatar.fromFirestore(doc));
          addedIds.add(doc.id);
        }
      }
    } catch (e) {
      print('AvatarService: Error loading user avatars: $e');
    }

    print('AvatarService: Total avatars: ${avatars.length}');
    return avatars;
  }

  // Get user's own avatars
  Future<List<Avatar>> getMyAvatars() async {
    final userId = currentUserId;
    if (userId == null) return [];

    final snapshot = await _firestore
        .collection('avatars')
        .where('createdBy', isEqualTo: userId)
        .get();

    return snapshot.docs.map((doc) => Avatar.fromFirestore(doc)).toList();
  }

  Future<Avatar?> getAvatar(String avatarId) async {
    final doc = await _firestore.collection('avatars').doc(avatarId).get();
    if (!doc.exists) return null;
    return Avatar.fromFirestore(doc);
  }

  // Get avatar categories
  Future<List<Map<String, dynamic>>> getCategories() async {
    final snapshot = await _firestore
        .collection('avatarCategories')
        .where('active', isEqualTo: true)
        .orderBy('name')
        .get();

    return snapshot.docs.map((doc) {
      return {
        'id': doc.id,
        ...doc.data(),
      };
    }).toList();
  }

  // Create avatar from URL
  Future<String> createAvatarFromUrl({
    required String name,
    String? description,
    required String videoUrl,
    String? profilePhotoUrl,
    bool isPublic = false,
    String? categoryId,
    required List<Map<String, dynamic>> expressions,
  }) async {
    final userId = currentUserId;
    if (userId == null) throw Exception('Not authenticated');

    final docRef = await _firestore.collection('avatars').add({
      'name': name,
      'description': description,
      'videoUrl': videoUrl,
      'profilePhotoUrl': profilePhotoUrl,
      'createdBy': userId,
      'isPublic': isPublic,
      'categoryId': categoryId,
      'createdAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    });

    // Add expressions as subcollection
    for (var expression in expressions) {
      await _firestore
          .collection('avatars')
          .doc(docRef.id)
          .collection('expressions')
          .add(expression);
    }

    return docRef.id;
  }

  // Create avatar with uploaded video
  Future<String> createAvatarWithUpload({
    required String name,
    String? description,
    required File videoFile,
    File? profilePhotoFile,
    bool isPublic = false,
    String? categoryId,
    required List<Map<String, dynamic>> expressions,
  }) async {
    final userId = currentUserId;
    if (userId == null) throw Exception('Not authenticated');

    // Upload video
    final videoUrl = await uploadVideo(videoFile, userId);
    
    // Upload profile photo if provided
    String? profilePhotoUrl;
    if (profilePhotoFile != null) {
      profilePhotoUrl = await uploadImage(profilePhotoFile, userId);
    }

    return createAvatarFromUrl(
      name: name,
      description: description,
      videoUrl: videoUrl,
      profilePhotoUrl: profilePhotoUrl,
      isPublic: isPublic,
      categoryId: categoryId,
      expressions: expressions,
    );
  }

  // Update avatar
  Future<void> updateAvatar({
    required String avatarId,
    String? name,
    String? description,
    String? videoUrl,
    String? profilePhotoUrl,
    bool? isPublic,
    String? categoryId,
  }) async {
    final updates = <String, dynamic>{
      'updatedAt': FieldValue.serverTimestamp(),
    };

    if (name != null) updates['name'] = name;
    if (description != null) updates['description'] = description;
    if (videoUrl != null) updates['videoUrl'] = videoUrl;
    if (profilePhotoUrl != null) updates['profilePhotoUrl'] = profilePhotoUrl;
    if (isPublic != null) updates['isPublic'] = isPublic;
    if (categoryId != null) updates['categoryId'] = categoryId;

    await _firestore.collection('avatars').doc(avatarId).update(updates);
  }

  // Delete avatar
  Future<void> deleteAvatar(String avatarId) async {
    // Delete expressions subcollection
    final expressions = await _firestore
        .collection('avatars')
        .doc(avatarId)
        .collection('expressions')
        .get();
    
    for (var doc in expressions.docs) {
      await doc.reference.delete();
    }

    // Delete avatar document
    await _firestore.collection('avatars').doc(avatarId).delete();
  }

  // Upload video file to Firebase Storage
  Future<String> uploadVideo(File videoFile, String userId) async {
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    final filename = 'avatars/$userId/$timestamp-${videoFile.path.split('/').last}';
    final ref = _storage.ref().child(filename);
    
    await ref.putFile(videoFile);
    return await ref.getDownloadURL();
  }

  // Upload image file to Firebase Storage
  Future<String> uploadImage(File imageFile, String userId) async {
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    final filename = 'avatars/$userId/$timestamp-${imageFile.path.split('/').last}';
    final ref = _storage.ref().child(filename);
    
    await ref.putFile(imageFile);
    return await ref.getDownloadURL();
  }
}

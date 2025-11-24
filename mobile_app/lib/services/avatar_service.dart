import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'dart:io';
import '../models/avatar.dart';

class AvatarService {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final FirebaseStorage _storage = FirebaseStorage.instance;
  final FirebaseAuth _auth = FirebaseAuth.instance;

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
    if (userId == null) return [];

    final publicAvatars = await _firestore
        .collection('avatars')
        .where('isPublic', isEqualTo: true)
        .get();

    final privateAvatars = await _firestore
        .collection('avatars')
        .where('createdBy', isEqualTo: userId)
        .where('isPublic', isEqualTo: false)
        .get();

    final avatars = <Avatar>[];
    
    for (var doc in publicAvatars.docs) {
      avatars.add(Avatar.fromFirestore(doc));
    }
    
    for (var doc in privateAvatars.docs) {
      if (!avatars.any((a) => a.id == doc.id)) {
        avatars.add(Avatar.fromFirestore(doc));
      }
    }
    
    return avatars;
  }

  Future<Avatar?> getAvatar(String avatarId) async {
    final doc = await _firestore.collection('avatars').doc(avatarId).get();
    if (!doc.exists) return null;
    return Avatar.fromFirestore(doc);
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


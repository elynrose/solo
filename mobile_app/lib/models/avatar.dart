import 'package:cloud_firestore/cloud_firestore.dart';

class Avatar {
  final String id;
  final String name;
  final String? description;
  final String videoUrl;
  final String? profilePhotoUrl;
  final String createdBy;
  final bool isPublic;
  final String? categoryId;
  final List<Map<String, dynamic>>? memoryBank;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  Avatar({
    required this.id,
    required this.name,
    this.description,
    required this.videoUrl,
    this.profilePhotoUrl,
    required this.createdBy,
    this.isPublic = false,
    this.categoryId,
    this.memoryBank,
    this.createdAt,
    this.updatedAt,
  });

  factory Avatar.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return Avatar(
      id: doc.id,
      name: data['name'] ?? '',
      description: data['description'],
      videoUrl: data['videoUrl'] ?? '',
      profilePhotoUrl: data['profilePhotoUrl'],
      createdBy: data['createdBy'] ?? '',
      isPublic: data['isPublic'] ?? false,
      categoryId: data['categoryId'],
      memoryBank: data['memoryBank'] != null
          ? List<Map<String, dynamic>>.from(data['memoryBank'])
          : null,
      createdAt: data['createdAt']?.toDate(),
      updatedAt: data['updatedAt']?.toDate(),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'name': name,
      'description': description,
      'videoUrl': videoUrl,
      'profilePhotoUrl': profilePhotoUrl,
      'createdBy': createdBy,
      'isPublic': isPublic,
      'categoryId': categoryId,
      'memoryBank': memoryBank,
    };
  }
}

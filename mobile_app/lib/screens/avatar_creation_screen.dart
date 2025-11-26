// Re-export the create avatar screen for backwards compatibility
export 'create_avatar_screen.dart';

import 'package:flutter/material.dart';
import 'create_avatar_screen.dart';

// Alias for backwards compatibility
class AvatarCreationScreen extends StatelessWidget {
  const AvatarCreationScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const CreateAvatarScreen();
  }
}

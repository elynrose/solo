import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../providers/avatar_provider.dart';
import '../providers/credit_provider.dart';
import '../providers/auth_provider.dart' as app_providers;
import '../models/avatar.dart';
import 'chat_screen.dart';
import 'avatar_creation_screen.dart';
import 'subscription_screen.dart';
import 'credits_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Expression Video Chat'),
        actions: [
          Consumer<CreditProvider>(
            builder: (context, creditProvider, _) {
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: Row(
                  children: [
                    Icon(Icons.monetization_on, color: Colors.amber),
                    const SizedBox(width: 4),
                    Text(
                      '${creditProvider.credits}',
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.credit_card),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const CreditsScreen()),
              );
            },
            tooltip: 'Buy Credits',
          ),
          IconButton(
            icon: const Icon(Icons.subscriptions),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const SubscriptionScreen()),
              );
            },
            tooltip: 'Subscriptions',
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () async {
              await Provider.of<app_providers.AuthProvider>(context, listen: false).signOut();
            },
            tooltip: 'Logout',
          ),
        ],
      ),
      body: Consumer<AvatarProvider>(
        builder: (context, avatarProvider, _) {
          if (avatarProvider.isLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          if (avatarProvider.avatars.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.person_outline,
                    size: 64,
                    color: Colors.grey[400],
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'No avatars available',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Create your first avatar to get started',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Colors.grey[600],
                    ),
                  ),
                ],
              ),
            );
          }

          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(16),
                child: ElevatedButton.icon(
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const AvatarCreationScreen(),
                      ),
                    );
                  },
                  icon: const Icon(Icons.add),
                  label: const Text('Create Avatar'),
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 24,
                      vertical: 12,
                    ),
                  ),
                ),
              ),
              Expanded(
                child: GridView.builder(
                  padding: const EdgeInsets.all(16),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    crossAxisSpacing: 16,
                    mainAxisSpacing: 16,
                    childAspectRatio: 0.75,
                  ),
                  itemCount: avatarProvider.avatars.length,
                  itemBuilder: (context, index) {
                    final avatar = avatarProvider.avatars[index];
                    return _AvatarCard(avatar: avatar);
                  },
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _AvatarCard extends StatelessWidget {
  final Avatar avatar;

  const _AvatarCard({required this.avatar});

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () {
          Provider.of<AvatarProvider>(context, listen: false)
              .selectAvatar(avatar);
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => ChatScreen(avatar: avatar),
            ),
          );
        },
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: avatar.profilePhotoUrl != null && avatar.profilePhotoUrl!.isNotEmpty
                  ? CachedNetworkImage(
                      imageUrl: avatar.profilePhotoUrl!,
                      fit: BoxFit.cover,
                      placeholder: (context, url) => Container(
                        color: Colors.grey[200],
                        child: const Center(child: CircularProgressIndicator()),
                      ),
                      errorWidget: (context, url, error) => Container(
                        color: Colors.grey[200],
                        child: const Center(child: Icon(Icons.person, size: 48)),
                      ),
                    )
                  : Container(
                      color: Theme.of(context).colorScheme.primaryContainer,
                      child: Center(
                        child: Text(
                          avatar.name.isNotEmpty ? avatar.name[0].toUpperCase() : '?',
                          style: TextStyle(
                            fontSize: 48,
                            fontWeight: FontWeight.bold,
                            color: Theme.of(context).colorScheme.primary,
                          ),
                        ),
                      ),
                    ),
            ),
            Padding(
              padding: const EdgeInsets.all(8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    avatar.name,
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (avatar.description != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      avatar.description!,
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.grey[600],
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}


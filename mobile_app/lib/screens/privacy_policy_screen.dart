import 'package:flutter/material.dart';

class PrivacyPolicyScreen extends StatelessWidget {
  const PrivacyPolicyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Privacy Policy'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Privacy Policy',
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Last updated: November 2024',
              style: TextStyle(color: Colors.grey[600]),
            ),
            const SizedBox(height: 24),
            _buildSection(
              context,
              '1. Information We Collect',
              'We collect the following types of information:\n\n'
              '• Account Information: Email address, name, and authentication data\n'
              '• Usage Data: Chat messages, avatar interactions, and app usage patterns\n'
              '• Payment Information: Transaction history (processed securely via Stripe)\n'
              '• Device Information: Device type, operating system, and app version\n'
              '• Uploaded Content: Videos, images, and documents you upload for avatars',
            ),
            _buildSection(
              context,
              '2. How We Use Your Information',
              '• To provide and maintain the Service\n'
              '• To process transactions and manage your account\n'
              '• To improve and personalize your experience\n'
              '• To communicate with you about the Service\n'
              '• To detect and prevent fraud or abuse\n'
              '• To comply with legal obligations',
            ),
            _buildSection(
              context,
              '3. AI Processing',
              'Your chat messages are processed by AI systems to generate responses. This data may be:\n\n'
              '• Sent to third-party AI providers (e.g., OpenAI) for processing\n'
              '• Used to improve AI response quality\n'
              '• Stored temporarily for conversation context\n\n'
              'We recommend not sharing sensitive personal information in chat conversations.',
            ),
            _buildSection(
              context,
              '4. Data Storage and Security',
              '• Data is stored securely using Firebase/Google Cloud infrastructure\n'
              '• We implement industry-standard security measures\n'
              '• Payment data is handled by Stripe and never stored on our servers\n'
              '• We cannot guarantee absolute security of data transmission',
            ),
            _buildSection(
              context,
              '5. Data Sharing',
              'We may share your information with:\n\n'
              '• Service providers who assist in operating our Service\n'
              '• AI providers for processing chat interactions\n'
              '• Payment processors for handling transactions\n'
              '• Law enforcement when required by law\n\n'
              'We do not sell your personal information to third parties.',
            ),
            _buildSection(
              context,
              '6. Your Rights',
              'You have the right to:\n\n'
              '• Access your personal data\n'
              '• Request correction of inaccurate data\n'
              '• Request deletion of your data\n'
              '• Export your data\n'
              '• Opt out of marketing communications\n\n'
              'To exercise these rights, contact us through the app.',
            ),
            _buildSection(
              context,
              '7. Data Retention',
              '• Account data is retained while your account is active\n'
              '• Chat history may be retained for service improvement\n'
              '• You can request deletion of your data at any time\n'
              '• Some data may be retained for legal compliance',
            ),
            _buildSection(
              context,
              '8. Children\'s Privacy',
              'The Service is not intended for children under 13. We do not knowingly collect data from children under 13. If you believe a child has provided us data, please contact us.',
            ),
            _buildSection(
              context,
              '9. International Data Transfers',
              'Your data may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place for such transfers.',
            ),
            _buildSection(
              context,
              '10. Changes to This Policy',
              'We may update this Privacy Policy from time to time. We will notify you of significant changes through the app or email.',
            ),
            _buildSection(
              context,
              '11. Contact Us',
              'For privacy-related questions or concerns, please contact us through the app.',
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _buildSection(BuildContext context, String title, String content) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            content,
            style: TextStyle(
              color: Colors.grey[800],
              height: 1.6,
            ),
          ),
        ],
      ),
    );
  }
}


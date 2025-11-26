import 'package:flutter/material.dart';

class TermsOfServiceScreen extends StatelessWidget {
  const TermsOfServiceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Terms of Service'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Terms of Service',
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
              '1. Acceptance of Terms',
              'By accessing and using Expression Video Chat ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.',
            ),
            _buildSection(
              context,
              '2. Description of Service',
              'Expression Video Chat is an AI-powered avatar chat platform that allows users to interact with virtual avatars. The Service uses artificial intelligence to generate responses and expressions.',
            ),
            _buildSection(
              context,
              '3. AI-Generated Content Disclaimer',
              'IMPORTANT: All responses and interactions provided by avatars are AI-generated. The content should NOT be considered as:\n\n'
              '• Professional advice (medical, legal, financial, or otherwise)\n'
              '• Factual or accurate information\n'
              '• A substitute for professional consultation\n\n'
              'AI can make mistakes, hallucinate information, and produce inaccurate or inappropriate content. Users should independently verify any information received through the Service.',
            ),
            _buildSection(
              context,
              '4. User Responsibilities',
              '• You must be at least 13 years old to use the Service\n'
              '• You are responsible for maintaining the confidentiality of your account\n'
              '• You agree not to use the Service for any illegal or unauthorized purpose\n'
              '• You agree not to attempt to manipulate or abuse the AI system\n'
              '• You agree not to upload harmful, offensive, or inappropriate content',
            ),
            _buildSection(
              context,
              '5. Credits and Payments',
              '• Credits are required to use certain features of the Service\n'
              '• All purchases are final and non-refundable unless required by law\n'
              '• Subscription credits expire at the end of each billing period\n'
              '• We reserve the right to modify pricing at any time',
            ),
            _buildSection(
              context,
              '6. Intellectual Property',
              '• The Service and its original content are owned by Expression Video Chat\n'
              '• User-created avatars remain the property of the user\n'
              '• You grant us a license to use content you upload for Service operation',
            ),
            _buildSection(
              context,
              '7. Limitation of Liability',
              'THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. WE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES RESULTING FROM YOUR USE OF THE SERVICE.\n\n'
              'We are not responsible for any decisions made based on AI-generated content.',
            ),
            _buildSection(
              context,
              '8. Termination',
              'We reserve the right to terminate or suspend your account at any time for any reason, including violation of these Terms.',
            ),
            _buildSection(
              context,
              '9. Changes to Terms',
              'We may modify these Terms at any time. Continued use of the Service after changes constitutes acceptance of the new Terms.',
            ),
            _buildSection(
              context,
              '10. Contact',
              'For questions about these Terms, please contact us through the app.',
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


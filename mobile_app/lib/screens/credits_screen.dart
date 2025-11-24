import 'package:flutter/material.dart';

class CreditsScreen extends StatelessWidget {
  const CreditsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Buy Credits'),
      ),
      body: const Center(
        child: Text('Credit Purchase - Coming Soon'),
      ),
    );
  }
}


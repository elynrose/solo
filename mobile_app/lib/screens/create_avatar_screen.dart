import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import 'package:video_player/video_player.dart';
import 'dart:io';
import '../providers/avatar_provider.dart';
import '../providers/credit_provider.dart';

class CreateAvatarScreen extends StatefulWidget {
  const CreateAvatarScreen({super.key});

  @override
  State<CreateAvatarScreen> createState() => _CreateAvatarScreenState();
}

class _CreateAvatarScreenState extends State<CreateAvatarScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _videoUrlController = TextEditingController();
  final _profilePhotoUrlController = TextEditingController();
  
  int _currentStep = 0;
  String _creationType = 'url'; // 'url', 'upload'
  bool _isPublic = false;
  String? _selectedCategoryId;
  
  File? _videoFile;
  File? _profilePhotoFile;
  VideoPlayerController? _videoController;
  
  final List<ExpressionEntry> _expressions = [
    ExpressionEntry(label: 'Neutral', startTime: '00:00', endTime: '00:05'),
  ];

  @override
  void dispose() {
    _nameController.dispose();
    _descriptionController.dispose();
    _videoUrlController.dispose();
    _profilePhotoUrlController.dispose();
    _videoController?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Create Avatar'),
      ),
      body: Consumer2<AvatarProvider, CreditProvider>(
        builder: (context, avatarProvider, creditProvider, _) {
          final creditConfig = creditProvider.creditConfig;
          final userCredits = creditProvider.credits;
          
          int requiredCredits = 0;
          if (_creationType == 'url') {
            requiredCredits = creditConfig['url'] ?? 5;
          } else {
            requiredCredits = creditConfig['recording'] ?? 10;
          }
          
          final hasEnoughCredits = userCredits >= requiredCredits;

          return Stepper(
            currentStep: _currentStep,
            onStepContinue: () => _handleStepContinue(avatarProvider, hasEnoughCredits, requiredCredits),
            onStepCancel: _handleStepCancel,
            controlsBuilder: (context, details) {
              return Padding(
                padding: const EdgeInsets.only(top: 16),
                child: Row(
                  children: [
                    if (_currentStep < 2)
                      ElevatedButton(
                        onPressed: details.onStepContinue,
                        child: const Text('Continue'),
                      )
                    else
                      ElevatedButton(
                        onPressed: avatarProvider.isCreating || !hasEnoughCredits
                            ? null
                            : details.onStepContinue,
                        child: avatarProvider.isCreating
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : Text('Create ($requiredCredits credits)'),
                      ),
                    const SizedBox(width: 12),
                    if (_currentStep > 0)
                      TextButton(
                        onPressed: details.onStepCancel,
                        child: const Text('Back'),
                      ),
                  ],
                ),
              );
            },
            steps: [
              // Step 1: Choose creation type
              Step(
                title: const Text('Choose Method'),
                content: _buildMethodStep(creditConfig),
                isActive: _currentStep >= 0,
                state: _currentStep > 0 ? StepState.complete : StepState.indexed,
              ),
              // Step 2: Avatar details
              Step(
                title: const Text('Avatar Details'),
                content: _buildDetailsStep(avatarProvider),
                isActive: _currentStep >= 1,
                state: _currentStep > 1 ? StepState.complete : StepState.indexed,
              ),
              // Step 3: Expressions
              Step(
                title: const Text('Expressions'),
                content: _buildExpressionsStep(),
                isActive: _currentStep >= 2,
                state: _currentStep > 2 ? StepState.complete : StepState.indexed,
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildMethodStep(Map<String, dynamic> creditConfig) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'How would you like to create your avatar?',
          style: Theme.of(context).textTheme.bodyLarge,
        ),
        const SizedBox(height: 16),
        
        // URL Option
        _buildMethodCard(
          title: 'From URL',
          description: 'Link to an existing video',
          icon: Icons.link,
          credits: creditConfig['url'] ?? 5,
          isSelected: _creationType == 'url',
          onTap: () => setState(() => _creationType = 'url'),
        ),
        const SizedBox(height: 12),
        
        // Upload Option
        _buildMethodCard(
          title: 'Upload Video',
          description: 'Upload from your device',
          icon: Icons.upload_file,
          credits: creditConfig['recording'] ?? 10,
          isSelected: _creationType == 'upload',
          onTap: () => setState(() => _creationType = 'upload'),
        ),
      ],
    );
  }

  Widget _buildMethodCard({
    required String title,
    required String description,
    required IconData icon,
    required int credits,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return Card(
      elevation: isSelected ? 4 : 1,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: isSelected
              ? Theme.of(context).colorScheme.primary
              : Colors.transparent,
          width: 2,
        ),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: isSelected
                      ? Theme.of(context).colorScheme.primaryContainer
                      : Colors.grey[200],
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  icon,
                  color: isSelected
                      ? Theme.of(context).colorScheme.primary
                      : Colors.grey[600],
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),
                    Text(
                      description,
                      style: TextStyle(color: Colors.grey[600]),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.green.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '$credits credits',
                  style: const TextStyle(
                    color: Colors.green,
                    fontWeight: FontWeight.w500,
                    fontSize: 12,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDetailsStep(AvatarProvider avatarProvider) {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Name
          TextFormField(
            controller: _nameController,
            decoration: const InputDecoration(
              labelText: 'Avatar Name *',
              hintText: 'Enter a name for your avatar',
              border: OutlineInputBorder(),
            ),
            validator: (value) {
              if (value == null || value.trim().isEmpty) {
                return 'Please enter a name';
              }
              return null;
            },
          ),
          const SizedBox(height: 16),
          
          // Description
          TextFormField(
            controller: _descriptionController,
            decoration: const InputDecoration(
              labelText: 'Description',
              hintText: 'Describe your avatar',
              border: OutlineInputBorder(),
            ),
            maxLines: 3,
          ),
          const SizedBox(height: 16),
          
          // Video Input
          if (_creationType == 'url') ...[
            TextFormField(
              controller: _videoUrlController,
              decoration: const InputDecoration(
                labelText: 'Video URL *',
                hintText: 'https://example.com/video.mp4',
                border: OutlineInputBorder(),
              ),
              validator: (value) {
                if (value == null || value.trim().isEmpty) {
                  return 'Please enter a video URL';
                }
                if (!Uri.tryParse(value)!.isAbsolute) {
                  return 'Please enter a valid URL';
                }
                return null;
              },
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _profilePhotoUrlController,
              decoration: const InputDecoration(
                labelText: 'Profile Photo URL',
                hintText: 'https://example.com/photo.jpg',
                border: OutlineInputBorder(),
              ),
            ),
          ] else ...[
            // Video Upload
            Card(
              child: InkWell(
                onTap: _pickVideo,
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    children: [
                      Icon(
                        _videoFile != null ? Icons.check_circle : Icons.videocam,
                        size: 48,
                        color: _videoFile != null ? Colors.green : Colors.grey[400],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _videoFile != null
                            ? 'Video selected'
                            : 'Tap to select video',
                        style: TextStyle(
                          color: _videoFile != null ? Colors.green : Colors.grey[600],
                        ),
                      ),
                      if (_videoFile != null)
                        Text(
                          _videoFile!.path.split('/').last,
                          style: TextStyle(color: Colors.grey[500], fontSize: 12),
                        ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),
            // Profile Photo Upload
            Card(
              child: InkWell(
                onTap: _pickProfilePhoto,
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    children: [
                      Icon(
                        _profilePhotoFile != null ? Icons.check_circle : Icons.photo,
                        size: 48,
                        color: _profilePhotoFile != null ? Colors.green : Colors.grey[400],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _profilePhotoFile != null
                            ? 'Photo selected'
                            : 'Tap to select profile photo (optional)',
                        style: TextStyle(
                          color: _profilePhotoFile != null ? Colors.green : Colors.grey[600],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
          const SizedBox(height: 16),
          
          // Category
          if (avatarProvider.categories.isNotEmpty) ...[
            DropdownButtonFormField<String>(
              value: _selectedCategoryId,
              decoration: const InputDecoration(
                labelText: 'Category',
                border: OutlineInputBorder(),
              ),
              items: [
                const DropdownMenuItem(value: null, child: Text('No category')),
                ...avatarProvider.categories.map((cat) {
                  return DropdownMenuItem(
                    value: cat['id'] as String,
                    child: Text(cat['name'] as String),
                  );
                }),
              ],
              onChanged: (value) => setState(() => _selectedCategoryId = value),
            ),
            const SizedBox(height: 16),
          ],
          
          // Public toggle
          SwitchListTile(
            title: const Text('Make Public'),
            subtitle: const Text('Allow others to use this avatar'),
            value: _isPublic,
            onChanged: (value) => setState(() => _isPublic = value),
          ),
        ],
      ),
    );
  }

  Widget _buildExpressionsStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Define expression timestamps in your video',
          style: Theme.of(context).textTheme.bodyLarge,
        ),
        const SizedBox(height: 8),
        Text(
          'Format: MM:SS or MM:SS.mmm (e.g., 00:05 or 00:05.123)',
          style: TextStyle(color: Colors.grey[600], fontSize: 12),
        ),
        const SizedBox(height: 16),
        
        ..._expressions.asMap().entries.map((entry) {
          final index = entry.key;
          final expression = entry.value;
          return _buildExpressionRow(index, expression);
        }),
        
        const SizedBox(height: 16),
        OutlinedButton.icon(
          onPressed: _addExpression,
          icon: const Icon(Icons.add),
          label: const Text('Add Expression'),
        ),
      ],
    );
  }

  Widget _buildExpressionRow(int index, ExpressionEntry expression) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          children: [
            Row(
              children: [
                Expanded(
                  flex: 2,
                  child: TextFormField(
                    initialValue: expression.label,
                    decoration: const InputDecoration(
                      labelText: 'Label',
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                    onChanged: (value) => expression.label = value,
                  ),
                ),
                const SizedBox(width: 8),
                if (index > 0)
                  IconButton(
                    icon: const Icon(Icons.delete, color: Colors.red),
                    onPressed: () => _removeExpression(index),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    initialValue: expression.startTime,
                    decoration: const InputDecoration(
                      labelText: 'Start',
                      hintText: '00:00',
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                    onChanged: (value) => expression.startTime = value,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: TextFormField(
                    initialValue: expression.endTime,
                    decoration: const InputDecoration(
                      labelText: 'End',
                      hintText: '00:05',
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                    onChanged: (value) => expression.endTime = value,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _addExpression() {
    setState(() {
      _expressions.add(ExpressionEntry(
        label: '',
        startTime: '',
        endTime: '',
      ));
    });
  }

  void _removeExpression(int index) {
    setState(() {
      _expressions.removeAt(index);
    });
  }

  Future<void> _pickVideo() async {
    final picker = ImagePicker();
    final result = await picker.pickVideo(source: ImageSource.gallery);
    
    if (result != null) {
      setState(() {
        _videoFile = File(result.path);
      });
    }
  }

  Future<void> _pickProfilePhoto() async {
    final picker = ImagePicker();
    final result = await picker.pickImage(source: ImageSource.gallery);
    
    if (result != null) {
      setState(() {
        _profilePhotoFile = File(result.path);
      });
    }
  }

  void _handleStepContinue(AvatarProvider avatarProvider, bool hasEnoughCredits, int requiredCredits) {
    if (_currentStep == 0) {
      setState(() => _currentStep = 1);
    } else if (_currentStep == 1) {
      if (_formKey.currentState?.validate() ?? false) {
        if (_creationType == 'upload' && _videoFile == null) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Please select a video file')),
          );
          return;
        }
        setState(() => _currentStep = 2);
      }
    } else if (_currentStep == 2) {
      if (!hasEnoughCredits) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Not enough credits. You need $requiredCredits credits.'),
            backgroundColor: Colors.red,
          ),
        );
        return;
      }
      _createAvatar(avatarProvider);
    }
  }

  void _handleStepCancel() {
    if (_currentStep > 0) {
      setState(() => _currentStep--);
    }
  }

  Future<void> _createAvatar(AvatarProvider avatarProvider) async {
    // Validate expressions
    final validExpressions = _expressions
        .where((e) => e.label.isNotEmpty && e.startTime.isNotEmpty && e.endTime.isNotEmpty)
        .map((e) => {
          'label': e.label,
          'startTime': e.startTime,
          'endTime': e.endTime,
        })
        .toList();

    if (validExpressions.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please add at least one expression')),
      );
      return;
    }

    String? avatarId;
    
    if (_creationType == 'url') {
      avatarId = await avatarProvider.createAvatarFromUrl(
        name: _nameController.text.trim(),
        description: _descriptionController.text.trim(),
        videoUrl: _videoUrlController.text.trim(),
        profilePhotoUrl: _profilePhotoUrlController.text.trim().isEmpty
            ? null
            : _profilePhotoUrlController.text.trim(),
        isPublic: _isPublic,
        categoryId: _selectedCategoryId,
        expressions: validExpressions,
      );
    } else {
      avatarId = await avatarProvider.createAvatarWithUpload(
        name: _nameController.text.trim(),
        description: _descriptionController.text.trim(),
        videoFile: _videoFile!,
        profilePhotoFile: _profilePhotoFile,
        isPublic: _isPublic,
        categoryId: _selectedCategoryId,
        expressions: validExpressions,
      );
    }

    if (!mounted) return;

    if (avatarId != null) {
      // Refresh credits
      Provider.of<CreditProvider>(context, listen: false).loadData();
      
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Avatar created successfully!'),
          backgroundColor: Colors.green,
        ),
      );
      Navigator.pop(context, true);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error: ${avatarProvider.error ?? 'Failed to create avatar'}'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }
}

class ExpressionEntry {
  String label;
  String startTime;
  String endTime;

  ExpressionEntry({
    required this.label,
    required this.startTime,
    required this.endTime,
  });
}


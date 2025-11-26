import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:intl/intl.dart';
import '../providers/credit_provider.dart';
import '../config/app_config.dart';
import 'subscription_screen.dart';

class CreditsScreen extends StatefulWidget {
  const CreditsScreen({super.key});

  @override
  State<CreditsScreen> createState() => _CreditsScreenState();
}

class _CreditsScreenState extends State<CreditsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = Provider.of<CreditProvider>(context, listen: false);
      provider.loadData();
      provider.startWatchingProfile();
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Credits'),
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: 'Buy Credits'),
            Tab(text: 'History'),
          ],
        ),
      ),
      body: Consumer<CreditProvider>(
        builder: (context, creditProvider, _) {
          if (creditProvider.isLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          return TabBarView(
            controller: _tabController,
            children: [
              _buildBuyCreditsTab(context, creditProvider),
              _buildHistoryTab(context, creditProvider),
            ],
          );
        },
      ),
    );
  }

  Widget _buildBuyCreditsTab(BuildContext context, CreditProvider creditProvider) {
    return RefreshIndicator(
      onRefresh: () => creditProvider.loadData(),
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Credit Balance Card
            _buildBalanceCard(context, creditProvider),
            const SizedBox(height: 24),
            
            // Credit Costs Info
            _buildCreditCostsCard(context, creditProvider),
            const SizedBox(height: 24),
            
            // Credit Packages
            Text(
              'Buy Credits',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),
            
            if (creditProvider.creditPackages.isEmpty)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    children: [
                      Icon(
                        Icons.shopping_cart_outlined,
                        size: 48,
                        color: Colors.grey[400],
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'No credit packages available',
                        style: TextStyle(color: Colors.grey[600]),
                      ),
                    ],
                  ),
                ),
              )
            else
              ...creditProvider.creditPackages.map((package) {
                return _buildPackageCard(context, package);
              }),
          ],
        ),
      ),
    );
  }

  Widget _buildHistoryTab(BuildContext context, CreditProvider creditProvider) {
    return FutureBuilder(
      future: Future.wait([
        creditProvider.loadTransactionHistory(),
        creditProvider.loadPaymentHistory(),
      ]),
      builder: (context, snapshot) {
        final transactions = creditProvider.creditTransactions;
        final payments = creditProvider.paymentHistory;

        if (transactions.isEmpty && payments.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.history, size: 64, color: Colors.grey[400]),
                const SizedBox(height: 16),
                Text(
                  'No transaction history',
                  style: TextStyle(color: Colors.grey[600], fontSize: 16),
                ),
              ],
            ),
          );
        }

        // Combine and sort by date
        final allItems = <Map<String, dynamic>>[];
        for (var t in transactions) {
          allItems.add({...t, '_type': 'transaction'});
        }
        for (var p in payments) {
          allItems.add({...p, '_type': 'payment'});
        }
        
        allItems.sort((a, b) {
          final aDate = a['createdAt'];
          final bDate = b['createdAt'];
          if (aDate == null || bDate == null) return 0;
          return bDate.compareTo(aDate);
        });

        return RefreshIndicator(
          onRefresh: () async {
            await creditProvider.loadTransactionHistory();
            await creditProvider.loadPaymentHistory();
          },
          child: ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: allItems.length,
            itemBuilder: (context, index) {
              final item = allItems[index];
              return _buildHistoryItem(context, item);
            },
          ),
        );
      },
    );
  }

  Widget _buildHistoryItem(BuildContext context, Map<String, dynamic> item) {
    final isTransaction = item['_type'] == 'transaction';
    final isCredit = isTransaction && (item['amount'] ?? 0) > 0;
    
    IconData icon;
    Color iconColor;
    String title;
    String subtitle;
    String amountText;
    Color amountColor;

    if (isTransaction) {
      final amount = item['amount'] ?? 0;
      final type = item['type'] ?? 'unknown';
      
      icon = amount > 0 ? Icons.add_circle : Icons.remove_circle;
      iconColor = amount > 0 ? Colors.green : Colors.red;
      title = _getTransactionTitle(type);
      subtitle = item['description'] ?? '';
      amountText = '${amount > 0 ? '+' : ''}$amount credits';
      amountColor = amount > 0 ? Colors.green : Colors.red;
    } else {
      final amount = (item['amount'] ?? 0) / 100;
      final status = item['status'] ?? 'unknown';
      
      icon = Icons.payment;
      iconColor = status == 'succeeded' ? Colors.green : Colors.orange;
      title = 'Payment';
      subtitle = item['description'] ?? 'Credit purchase';
      amountText = '\$${amount.toStringAsFixed(2)}';
      amountColor = Colors.grey[700]!;
    }

    final createdAt = item['createdAt'];
    String dateText = '';
    if (createdAt != null) {
      final date = createdAt.toDate();
      dateText = DateFormat('MMM d, yyyy h:mm a').format(date);
    }

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: iconColor.withOpacity(0.1),
          child: Icon(icon, color: iconColor),
        ),
        title: Text(title),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (subtitle.isNotEmpty) Text(subtitle),
            Text(
              dateText,
              style: TextStyle(color: Colors.grey[500], fontSize: 12),
            ),
          ],
        ),
        trailing: Text(
          amountText,
          style: TextStyle(
            color: amountColor,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  }

  String _getTransactionTitle(String type) {
    switch (type) {
      case 'purchase':
        return 'Credit Purchase';
      case 'subscription':
        return 'Monthly Credits';
      case 'avatar_recording':
        return 'Avatar Recording';
      case 'avatar_ai':
        return 'AI Avatar Generation';
      case 'avatar_url':
        return 'URL Avatar';
      case 'chat':
        return 'Chat Usage';
      case 'refund':
        return 'Refund';
      default:
        return 'Transaction';
    }
  }

  Widget _buildBalanceCard(BuildContext context, CreditProvider creditProvider) {
    final profile = creditProvider.userProfile;
    final userName = profile?['name'] ?? profile?['email'] ?? 'User';
    
    return Card(
      elevation: 4,
      child: Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          gradient: LinearGradient(
            colors: [
              Theme.of(context).colorScheme.primary,
              Theme.of(context).colorScheme.secondary,
            ],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Welcome, $userName',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Colors.white70,
                  ),
                ),
                if (creditProvider.hasActiveSubscription)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.amber,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.star, color: Colors.black87, size: 14),
                        SizedBox(width: 4),
                        Text(
                          'PREMIUM',
                          style: TextStyle(
                            color: Colors.black87,
                            fontWeight: FontWeight.bold,
                            fontSize: 10,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 16),
            const Icon(
              Icons.account_balance_wallet,
              size: 48,
              color: Colors.white,
            ),
            const SizedBox(height: 12),
            Text(
              'Your Balance',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                color: Colors.white70,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              '${creditProvider.credits}',
              style: Theme.of(context).textTheme.displayMedium?.copyWith(
                color: Colors.white,
                fontWeight: FontWeight.bold,
              ),
            ),
            Text(
              'credits',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                color: Colors.white70,
              ),
            ),
            if (!creditProvider.hasActiveSubscription) ...[
              const SizedBox(height: 16),
              OutlinedButton(
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const SubscriptionScreen()),
                  );
                },
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.white,
                  side: const BorderSide(color: Colors.white),
                ),
                child: const Text('Upgrade to Premium'),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildCreditCostsCard(BuildContext context, CreditProvider creditProvider) {
    final config = creditProvider.creditConfig;
    
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.info_outline, color: Theme.of(context).colorScheme.primary),
                const SizedBox(width: 8),
                Text(
                  'Credit Costs',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            _buildCostRow(
              context,
              Icons.videocam,
              'Recording Avatar',
              '${config['recording'] ?? 10} credits',
            ),
            const Divider(height: 24),
            _buildCostRow(
              context,
              Icons.auto_awesome,
              'AI Generated Avatar',
              '${config['ai'] ?? 50} credits',
            ),
            const Divider(height: 24),
            _buildCostRow(
              context,
              Icons.link,
              'URL Link Avatar',
              '${config['url'] ?? 5} credits',
            ),
            const Divider(height: 24),
            _buildCostRow(
              context,
              Icons.chat,
              'Chat (per 10K tokens)',
              '${config['per10kTokens'] ?? 1} credits',
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCostRow(BuildContext context, IconData icon, String label, String cost) {
    return Row(
      children: [
        Icon(icon, size: 20, color: Colors.grey[600]),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            label,
            style: TextStyle(color: Colors.grey[700]),
          ),
        ),
        Text(
          cost,
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: Theme.of(context).colorScheme.primary,
          ),
        ),
      ],
    );
  }

  Widget _buildPackageCard(BuildContext context, Map<String, dynamic> package) {
    final credits = package['credits'] ?? 0;
    final price = (package['price'] ?? 0) / 100;
    final name = package['name'] ?? 'Credit Package';
    final isPopular = package['popular'] == true;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => _purchasePackage(context, package),
        child: Stack(
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.primaryContainer,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(
                      Icons.monetization_on,
                      color: Theme.of(context).colorScheme.primary,
                      size: 28,
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          name,
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '$credits credits',
                          style: TextStyle(
                            color: Colors.grey[600],
                            fontSize: 14,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        '\$${price.toStringAsFixed(2)}',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 18,
                          color: Theme.of(context).colorScheme.primary,
                        ),
                      ),
                      if (credits > 0 && price > 0)
                        Text(
                          '\$${(price / credits * 100).toStringAsFixed(1)}/100',
                          style: TextStyle(
                            color: Colors.grey[500],
                            fontSize: 12,
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(width: 8),
                  Icon(
                    Icons.chevron_right,
                    color: Colors.grey[400],
                  ),
                ],
              ),
            ),
            if (isPopular)
              Positioned(
                top: 0,
                right: 0,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: const BoxDecoration(
                    color: Colors.amber,
                    borderRadius: BorderRadius.only(
                      bottomLeft: Radius.circular(8),
                    ),
                  ),
                  child: const Text(
                    'POPULAR',
                    style: TextStyle(
                      color: Colors.black87,
                      fontWeight: FontWeight.bold,
                      fontSize: 10,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _purchasePackage(BuildContext context, Map<String, dynamic> package) async {
    final packageId = package['id'];
    final packageName = package['name'] ?? 'Credit Package';
    
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Purchase $packageName'),
        content: const Text(
          'You will be redirected to complete the purchase. Continue?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Continue'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Row(
          children: [
            SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
            ),
            SizedBox(width: 12),
            Text('Preparing checkout...'),
          ],
        ),
        duration: Duration(seconds: 10),
      ),
    );

    try {
      final checkoutUrl = '${AppConfig.baseUrl}/credits?package=$packageId';
      final uri = Uri.parse(checkoutUrl);
      
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      } else {
        throw Exception('Could not open checkout page');
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).hideCurrentSnackBar();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error: ${e.toString()}'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }
}

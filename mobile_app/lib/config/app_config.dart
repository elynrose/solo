class AppConfig {
  // Backend API base URL
  static const String baseUrl = 'https://solo-production-17f9.up.railway.app';
  
  // API endpoints
  static const String chatEndpoint = '/api/chat';
  static const String firebaseConfigEndpoint = '/api/firebase-config';
  
  // Helper method to get full URL
  static String getApiUrl(String endpoint) {
    return '$baseUrl$endpoint';
  }
}


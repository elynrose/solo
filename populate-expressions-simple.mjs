import { execSync } from 'child_process';
import 'dotenv/config';

const projectId = "proroster-sfc0v";

// Default expressions from the app
const defaultExpressions = [
  { label: 'Funny', startTime: '00:00', endTime: '00:12', color: '#FF6B6B' },
  { label: 'Interested', startTime: '00:13', endTime: '00:28', color: '#4ECDC4' },
  { label: 'Agree', startTime: '00:30', endTime: '00:37', color: '#95E1D3' },
  { label: 'Disagree', startTime: '00:40', endTime: '00:48', color: '#F38181' },
  { label: 'Neutral', startTime: '00:50', endTime: '00:55', color: '#999999' },
  { label: 'Confused', startTime: '01:00', endTime: '01:08', color: '#FFD93D' },
  { label: 'Bored', startTime: '01:10', endTime: '01:20', color: '#6C757D' },
];

async function populateExpressions() {
  try {
    console.log('Using Firebase CLI to populate expressions...\n');
    
    // Use Firebase CLI to set each expression
    for (const expr of defaultExpressions) {
      const data = {
        label: expr.label,
        startTime: expr.startTime,
        endTime: expr.endTime,
        color: expr.color,
        createdAt: { '.sv': 'timestamp' },
        updatedAt: { '.sv': 'timestamp' }
      };
      
      // Create a temporary JSON file for this expression
      const fs = await import('fs');
      const path = await import('path');
      const os = await import('os');
      
      const tempFile = path.join(os.tmpdir(), `expr-${expr.label}-${Date.now()}.json`);
      fs.writeFileSync(tempFile, JSON.stringify(data, null, 2));
      
      try {
        // Try to use firebase firestore:set (if available)
        // Otherwise, we'll need to use the REST API
        console.log(`Adding expression: ${expr.label}...`);
        
        // Use Node.js to make REST API call to Firestore
        const fetch = (await import('node-fetch')).default;
        
        // Get access token from Firebase CLI
        let accessToken = null;
        try {
          // Try to read from Firebase CLI config
          const homedir = os.homedir();
          const configPath = path.join(homedir, '.config', 'configstore', 'firebase-tools.json');
          if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            // Firebase CLI stores tokens differently, so we'll use a different approach
          }
        } catch (e) {
          // Continue with REST API approach
        }
        
        // Use Firestore REST API
        const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/expressions`;
        
        // For now, let's use a simpler approach - create a script that the user can run
        // after setting up authentication
        console.log('⚠️  Direct API access requires authentication.');
        console.log('\nAlternative: Use the Firebase Console to add expressions manually,');
        console.log('or set up a service account key.\n');
        console.log('Here are the expressions to add:\n');
        
        defaultExpressions.forEach(expr => {
          console.log(`Label: ${expr.label}`);
          console.log(`  Start: ${expr.startTime}`);
          console.log(`  End: ${expr.endTime}`);
          console.log(`  Color: ${expr.color}\n`);
        });
        
        // Clean up temp file
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
        
        return;
      } catch (error) {
        console.error(`Error adding ${expr.label}:`, error.message);
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Actually, let's create a better solution using the web interface
// For now, let's output the data in a format that can be easily imported
console.log('📝 Expressions to populate:\n');
console.log(JSON.stringify(defaultExpressions, null, 2));
console.log('\n💡 To populate these expressions:');
console.log('1. Go to Firebase Console > Firestore Database');
console.log('2. Create a document in the "expressions" collection for each expression above');
console.log('3. Or use the admin panel in the app to create them\n');

populateExpressions();


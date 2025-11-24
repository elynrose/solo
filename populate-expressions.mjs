import admin from 'firebase-admin';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
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

// Try to initialize with service account key if provided
let app;
if (!admin.apps.length) {
  try {
    // Check for service account key file
    const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
                                path.join(process.cwd(), 'service-account-key.json');
    
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: projectId
      });
      app = admin.app();
      console.log('✓ Initialized with service account key\n');
    } else {
      // Try Application Default Credentials
      admin.initializeApp({
        projectId: projectId,
        credential: admin.credential.applicationDefault()
      });
      app = admin.app();
      console.log('✓ Initialized with Application Default Credentials\n');
    }
  } catch (error) {
    console.error('❌ Error initializing Firebase Admin:', error.message);
    console.log('\n📋 To populate expressions, you have these options:\n');
    console.log('Option 1: Use Service Account Key (Recommended)');
    console.log('  1. Go to Firebase Console > Project Settings > Service Accounts');
    console.log('  2. Click "Generate new private key"');
    console.log('  3. Save the file as "service-account-key.json" in this directory');
    console.log('  4. Run this script again\n');
    console.log('Option 2: Use the Admin Panel in the App');
    console.log('  1. Sign in as an admin user');
    console.log('  2. Go to Admin > Expression Management');
    console.log('  3. Click "Create Expression" and add each expression manually\n');
    console.log('Option 3: Use Firebase Console');
    console.log('  1. Go to Firebase Console > Firestore Database');
    console.log('  2. Create documents in the "expressions" collection');
    console.log('  3. Use the following data:\n');
    console.log(JSON.stringify(defaultExpressions, null, 2));
    process.exit(1);
  }
}

const db = admin.firestore();

async function populateExpressions() {
  try {
    console.log('Checking existing expressions...');
    
    // Check if expressions already exist
    const expressionsRef = db.collection('expressions');
    const existingExpressions = await expressionsRef.get();
    
    if (!existingExpressions.empty) {
      console.log(`Found ${existingExpressions.size} existing expressions.`);
      const existingLabels = [];
      existingExpressions.forEach(doc => {
        existingLabels.push(doc.data().label);
      });
      console.log('Existing labels:', existingLabels.join(', '));
      
      // Only add expressions that don't exist
      const labelsToAdd = defaultExpressions.filter(
        expr => !existingLabels.includes(expr.label)
      );
      
      if (labelsToAdd.length === 0) {
        console.log('\n✅ All default expressions already exist. Nothing to add.');
        return;
      }
      
      console.log(`\nAdding ${labelsToAdd.length} new expressions...\n`);
      
      for (const expr of labelsToAdd) {
        await expressionsRef.add({
          ...expr,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`✓ Added: ${expr.label} (${expr.startTime} - ${expr.endTime}, ${expr.color})`);
      }
    } else {
      console.log('No expressions found. Adding all default expressions...\n');
      
      for (const expr of defaultExpressions) {
        await expressionsRef.add({
          ...expr,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`✓ Added: ${expr.label} (${expr.startTime} - ${expr.endTime}, ${expr.color})`);
      }
    }
    
    console.log('\n✅ Successfully populated expressions collection!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error populating expressions:', error.message);
    if (error.code === 'permission-denied' || error.code === 7) {
      console.log('\n⚠️  Permission denied. Make sure you are using a service account with proper permissions.');
    }
    process.exit(1);
  }
}

populateExpressions();

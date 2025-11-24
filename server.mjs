import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import { fal } from '@fal-ai/client';
import multer from 'multer';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, unlink, mkdtemp } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import fetch from 'node-fetch';
import Stripe from 'stripe';
import admin from 'firebase-admin';
import pdf from 'pdf-parse';
import 'dotenv/config';

const execAsync = promisify(exec);

// Create an Express application
const app = express();
// Enable CORS so the frontend (often served on a different port) can call this API
app.use(cors());

// Stripe webhook endpoint must be defined BEFORE JSON parser (needs raw body)
// We'll define it after other setup but before JSON middleware
let webhookDefined = false;

// Parse JSON request bodies (for all routes except webhook)
app.use((req, res, next) => {
  // Skip JSON parsing for webhook endpoint
  if (req.path === '/api/stripe-webhook') {
    return next();
  }
  express.json()(req, res, next);
});

// Configure multer for file uploads (in memory)
const upload = multer({ storage: multer.memoryStorage() });

// Configure fal.ai client
if (process.env.FAL_KEY) {
  try {
  fal.config({
    credentials: process.env.FAL_KEY
  });
    console.log('fal.ai client configured successfully');
    console.log('FAL_KEY format:', process.env.FAL_KEY.includes(':') ? 'key:secret format detected' : 'Warning: FAL_KEY may need to be in key:secret format');
  } catch (configError) {
    console.error('Error configuring fal.ai client:', configError);
  }
} else {
  console.log('fal.ai not configured - set FAL_KEY in .env');
}

// Initialize the OpenAI client. The API key should be supplied via the environment.
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Verify FFmpeg is available
async function checkFFmpeg() {
  try {
    const { stdout } = await execAsync('ffmpeg -version');
    console.log('FFmpeg is available');
    console.log('FFmpeg version:', stdout.split('\n')[0]);
    return true;
  } catch (error) {
    console.error('FFmpeg not found. Please ensure FFmpeg is installed.');
    console.error('On Railway, FFmpeg will be installed via Dockerfile');
    return false;
  }
}

// Check FFmpeg on startup
checkFFmpeg();

// Initialize Firebase Admin SDK
let firestoreDb = null;
(async () => {
  try {
    if (!admin.apps.length) {
      // Try to initialize with service account key if available
      const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      if (serviceAccountPath) {
        try {
          const serviceAccount = JSON.parse(await readFile(serviceAccountPath, 'utf-8'));
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
          });
          firestoreDb = admin.firestore();
          console.log('Firebase Admin SDK initialized with service account');
        } catch (fileError) {
          console.warn('Could not read service account file:', fileError.message);
        }
      }
      
      if (!firestoreDb) {
        // Try Application Default Credentials (for Railway/Cloud environments)
        try {
          admin.initializeApp({
            credential: admin.credential.applicationDefault()
          });
          firestoreDb = admin.firestore();
          console.log('Firebase Admin SDK initialized with Application Default Credentials');
        } catch (adcError) {
          console.warn('Firebase Admin SDK not initialized:', adcError.message);
          console.warn('Monthly credit addition will not work in webhooks. Set GOOGLE_APPLICATION_CREDENTIALS or use Application Default Credentials.');
        }
      }
    } else {
      firestoreDb = admin.firestore();
    }
  } catch (error) {
    console.warn('Firebase Admin SDK initialization error:', error.message);
  }
})();

// Initialize Stripe
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-11-20.acacia',
  });
  console.log('Stripe initialized');
} else {
  console.log('Stripe not configured - set STRIPE_SECRET_KEY in .env');
}

// Get video dimensions using ffprobe
async function getVideoDimensions(videoUrl) {
  try {
    // ffprobe can work with HTTP URLs directly, but we need to escape the URL properly
    // For local files, use direct path
    let probeUrl = videoUrl;
    
    // Escape the URL for shell safety
    const escapedUrl = videoUrl.replace(/'/g, "'\\''").replace(/"/g, '\\"');
    
    // Try ffprobe with the URL directly (works with HTTP/HTTPS URLs)
    const { stdout } = await execAsync(`ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of json "${escapedUrl}"`, {
      timeout: 30000 // 30 second timeout
    });
    
    const data = JSON.parse(stdout);
    if (data.streams && data.streams.length > 0 && data.streams[0].width && data.streams[0].height) {
      return {
        width: data.streams[0].width,
        height: data.streams[0].height
      };
    }
    
    return null;
  } catch (error) {
    // If direct URL doesn't work, try downloading a small portion
    // (ffprobe should work with HTTP URLs, but some servers may not support range requests)
    console.warn('Could not get video dimensions directly, trying alternative method:', error.message);
    
    try {
      // For remote URLs, try downloading just the header/metadata
      const response = await fetch(videoUrl, {
        method: 'HEAD',
        headers: { 'Range': 'bytes=0-10000' } // Just get first 10KB for metadata
      });
      
      if (response.ok || response.status === 206) {
        // Save to temp file
        const tempDir = await mkdtemp(join(tmpdir(), 'video-probe-'));
        const tempPath = join(tempDir, 'video.mp4');
        const buffer = Buffer.from(await response.arrayBuffer());
        await writeFile(tempPath, buffer);
        
        try {
          const { stdout } = await execAsync(`ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of json "${tempPath}"`);
          const data = JSON.parse(stdout);
          if (data.streams && data.streams.length > 0) {
            const dimensions = {
              width: data.streams[0].width,
              height: data.streams[0].height
            };
            return dimensions;
          }
        } finally {
          // Cleanup temp file
          await unlink(tempPath).catch(() => {});
        }
      }
    } catch (fallbackError) {
      console.warn('Fallback method also failed:', fallbackError.message);
    }
    
    return null;
  }
}

// Convert dimensions to fal.ai resolution format
function getFalResolution(width, height) {
  // fal.ai accepts: '480p', '720p', '1080p', '1440p', '2160p' or custom width/height
  // Try to match standard resolutions
  if (width === 1920 && height === 1080) return '1080p';
  if (width === 1280 && height === 720) return '720p';
  if (width === 854 && height === 480) return '480p';
  if (width === 2560 && height === 1440) return '1440p';
  if (width === 3840 && height === 2160) return '2160p';
  
  // For non-standard resolutions, return the closest standard or use custom
  // fal.ai also accepts width and height directly
  return { width, height };
}

/**
 * POST /api/chat
 *
 * This endpoint processes a chat message:
 * 1. Classifies the emotion/expression from the user's message
 * 2. Generates an AI response to the message
 * Returns both the expression label and the AI response.
 */
app.post('/api/chat', async (req, res) => {
  try {
    const { message, conversationHistory, expressionLabels, avatarDescription, memoryBank } = req.body;
    
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Build conversation history for context
    const historyText = conversationHistory && conversationHistory.length > 0
      ? conversationHistory.map(msg => `${msg.role === 'user' ? 'User' : 'AI'}: ${msg.content}`).join('\n')
      : '';

    // Dynamically build the expression categories string from database
    const categories = expressionLabels && expressionLabels.length > 0
      ? expressionLabels.map(label => `- "${label}"`).join('\n')
      : `- "Funny"\n- "Interested"\n- "Agree"\n- "Disagree"\n- "Neutral"\n- "Confused"\n- "Bored"`;

    // First, classify the expression from the user's message
    const classifyResponse = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
            {
              role: 'system',
              content: `You are an emotion and engagement classifier for a chat conversation.
Your job is to analyze the user's message and classify their current expression into one of these categories:
${categories}

IMPORTANT: You must respond with ONLY valid JSON using this exact schema:
{
  "label": "<one of the labels above>",
  "confidence": <0-1 float>
}

Use "Neutral" as the default if uncertain.`
            },
        {
          role: 'user',
          content: `Conversation history:
"""${historyText}"""

User's current message:
"""${message}"""

Classify the user's expression from their current message. Respond with ONLY the JSON object.`
        }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    });

    const classifyContent = classifyResponse.choices[0].message.content;
    let expressionData;
    
    try {
      expressionData = JSON.parse(classifyContent);
    } catch (parseError) {
      const jsonMatch = classifyContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        expressionData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse expression JSON response');
      }
    }

    // Ensure confidence is a number
    if (expressionData.confidence == null) {
      expressionData.confidence = 0.5;
    }

    // Treat extremely low-confidence guesses as neutral
    if (expressionData.confidence < 0.3) {
      expressionData.label = 'Neutral';
    }

    // Now generate an AI response to the user's message
    const chatMessages = [];
    
    // Add conversation history
    if (conversationHistory && conversationHistory.length > 0) {
      conversationHistory.forEach(msg => {
        chatMessages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      });
    }
    
    // Add the current user message
    chatMessages.push({
      role: 'user',
      content: message
    });

    // Build system prompt with avatar personality if provided
    let systemPrompt = 'You are a helpful, friendly, and engaging conversational assistant. Respond naturally and conversationally to the user\'s messages.';
    
    if (avatarDescription && avatarDescription.trim()) {
      systemPrompt = `You are a conversational assistant with the following personality and characteristics:
${avatarDescription}

Respond naturally and conversationally to the user's messages, staying true to this personality.`;
    }
    
    // Add memory bank context if provided
    if (memoryBank && memoryBank.length > 0) {
      const memoryBankText = memoryBank.map((mem, idx) => {
        return `[Memory Document ${idx + 1}: ${mem.filename || `Document ${idx + 1}`}]\n${mem.content}`;
      }).join('\n\n---\n\n');
      
      systemPrompt += `\n\nIMPORTANT CONTEXT - MEMORY BANK:\nThe following documents contain important information that you should reference when responding to the user. Use this knowledge to provide accurate and informed responses:\n\n${memoryBankText}\n\nWhen the user asks questions, refer to the memory bank documents above to provide accurate information.`;
    }
    
    const aiResponse = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        ...chatMessages
      ],
      temperature: 0.7
    });

    const aiMessage = aiResponse.choices[0].message.content;

    // Combine token usage from both API calls
    const classifyUsage = classifyResponse.usage || {};
    const chatUsage = aiResponse.usage || {};
    
    const totalTokens = {
      prompt: (classifyUsage.prompt_tokens || 0) + (chatUsage.prompt_tokens || 0),
      completion: (classifyUsage.completion_tokens || 0) + (chatUsage.completion_tokens || 0),
      total: (classifyUsage.total_tokens || 0) + (chatUsage.total_tokens || 0)
    };
    
    // Return the expression label, AI response, and token usage
    res.json({ 
      label: expressionData.label,
      response: aiMessage,
      tokens: totalTokens
    });
  } catch (error) {
    console.error('Error processing chat:', error);
    res.status(500).json({ 
      error: 'Failed to process chat message',
      details: error.message 
    });
  }
});

// Configure multer for multiple file uploads (in memory)
const uploadMultiple = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB per file
});

// Configure multer for memory bank files (PDF and TXT)
const uploadMemoryBank = multer({ 
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 20 // Max 20 files
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['application/pdf', 'text/plain'];
    if (allowedMimes.includes(file.mimetype) || file.originalname.toLowerCase().endsWith('.pdf') || file.originalname.toLowerCase().endsWith('.txt')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and TXT files are allowed'), false);
    }
  }
});

/**
 * POST /api/process-memory-bank
 * Process PDF and TXT files and convert to JSON format
 */
app.post('/api/process-memory-bank', uploadMemoryBank.array('files', 20), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files provided' });
  }

  const processedFiles = [];

  try {
    for (const file of req.files) {
      let content = '';
      const filename = file.originalname;
      const fileType = filename.toLowerCase().endsWith('.pdf') ? 'pdf' : 'txt';

      if (fileType === 'pdf') {
        try {
          const pdfData = await pdf(file.buffer);
          content = pdfData.text;
        } catch (pdfError) {
          console.error(`Error parsing PDF ${filename}:`, pdfError);
          return res.status(400).json({ 
            error: `Failed to parse PDF file: ${filename}`,
            details: pdfError.message 
          });
        }
      } else {
        // TXT file
        content = file.buffer.toString('utf-8');
      }

      // Convert to JSON format
      const processedFile = {
        filename: filename,
        type: fileType,
        content: content,
        size: file.size,
        processedAt: new Date().toISOString()
      };

      processedFiles.push(processedFile);
    }

    res.json({
      success: true,
      files: processedFiles,
      count: processedFiles.length
    });
  } catch (error) {
    console.error('Error processing memory bank files:', error);
    res.status(500).json({
      error: 'Failed to process memory bank files',
      details: error.message
    });
  }
});

/**
 * POST /api/merge-videos
 * 
 * Merges multiple video segments using FFmpeg
 * Accepts video files as multipart/form-data (much faster than base64)
 * Falls back to base64 if needed for compatibility
 */
app.post('/api/merge-videos', uploadMultiple.array('videos', 20), async (req, res) => {
  let tempDir = null;
  let tempFiles = [];
  
  try {
    // Verify FFmpeg is available
    try {
      await execAsync('ffmpeg -version');
    } catch (ffmpegError) {
      return res.status(503).json({ 
        error: 'FFmpeg not available',
        message: 'FFmpeg is required for video merging. Please ensure it is installed on the server.'
      });
    }

    let videoBuffers = [];

    // Check if files were uploaded via multipart/form-data (preferred method)
    if (req.files && req.files.length > 0) {
      console.log(`Received ${req.files.length} video files via multipart upload`);
      req.files.forEach((file) => {
        videoBuffers.push(file.buffer);
      });
    } else if (req.body.videoSegments && Array.isArray(req.body.videoSegments)) {
      // Fallback: base64 encoded videos (slower but compatible)
      console.log(`Received ${req.body.videoSegments.length} video segments as base64`);
      req.body.videoSegments.forEach((base64Data) => {
        // Convert base64 to buffer (handle data URL format)
        const base64String = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
        const buffer = Buffer.from(base64String, 'base64');
        videoBuffers.push(buffer);
      });
    } else {
      return res.status(400).json({ error: 'No video files or segments provided' });
    }

    if (videoBuffers.length === 0) {
      return res.status(400).json({ error: 'No video segments to merge' });
    }

    if (videoBuffers.length === 1) {
      // If only one segment, return it directly as base64
      return res.json({
        success: true,
        videoUrl: `data:video/webm;base64,${videoBuffers[0].toString('base64')}`,
        message: 'Only one segment, returning as-is'
      });
    }

    console.log(`Merging ${videoBuffers.length} video segments using FFmpeg...`);

    // Create temporary directory for processing
    tempDir = await mkdtemp(join(tmpdir(), 'video-merge-'));
    console.log('Created temp directory:', tempDir);

    // Write input files to temp directory
    const inputFiles = [];
    for (let i = 0; i < videoBuffers.length; i++) {
      const inputPath = join(tempDir, `input_${i}.webm`);
      await writeFile(inputPath, videoBuffers[i]);
      inputFiles.push(inputPath);
      tempFiles.push(inputPath);
      console.log(`Written input file ${i + 1}/${videoBuffers.length}: ${inputPath}`);
    }

    // Create concat file list for FFmpeg
    const concatFilePath = join(tempDir, 'concat.txt');
    const concatContent = inputFiles.map(file => `file '${file}'`).join('\n');
    await writeFile(concatFilePath, concatContent);
    tempFiles.push(concatFilePath);
    console.log('Created concat file:', concatFilePath);

    // Output file path
    const outputPath = join(tempDir, 'output.webm');
    tempFiles.push(outputPath);

    // Run FFmpeg to merge videos
    // Using concat demuxer with copy codec (fast, no re-encoding)
    const ffmpegCommand = `ffmpeg -f concat -safe 0 -i "${concatFilePath}" -c copy "${outputPath}" -y`;
    console.log('Running FFmpeg command:', ffmpegCommand);

    try {
      const { stdout, stderr } = await execAsync(ffmpegCommand, {
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer for output
      });
      
      if (stderr) {
        console.log('FFmpeg stderr (usually just info):', stderr);
      }
      console.log('FFmpeg merge completed successfully');
    } catch (ffmpegError) {
      console.error('FFmpeg error:', ffmpegError);
      console.error('FFmpeg stderr:', ffmpegError.stderr);
      throw new Error(`FFmpeg merge failed: ${ffmpegError.message}`);
    }

    // Read the merged video file
    const mergedVideoBuffer = await readFile(outputPath);
    console.log(`Merged video size: ${(mergedVideoBuffer.length / 1024 / 1024).toFixed(2)} MB`);

    // Convert to base64 data URL for response
    // Note: For large files, you might want to upload to storage and return URL instead
    const videoBase64 = mergedVideoBuffer.toString('base64');
    const videoDataUrl = `data:video/webm;base64,${videoBase64}`;

    // Clean up temp files
    for (const file of tempFiles) {
      try {
        await unlink(file);
      } catch (unlinkError) {
        console.warn(`Failed to delete temp file ${file}:`, unlinkError);
      }
    }
    try {
      await unlink(tempDir).catch(() => {}); // Directory might not be empty yet
    } catch (e) {}

    console.log('Video merge completed successfully');

    res.json({
      success: true,
      videoUrl: videoDataUrl,
      message: 'Videos merged successfully'
    });

  } catch (error) {
    console.error('=== Error merging videos with FFmpeg ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    // Clean up temp files on error
    if (tempFiles.length > 0) {
      for (const file of tempFiles) {
        try {
          await unlink(file).catch(() => {});
        } catch (e) {}
      }
    }
    
    res.status(500).json({
      error: 'Failed to merge videos',
      details: error.message,
      errorType: error.constructor.name
    });
  }
});

/**
 * POST /api/training-video
 * 
 * Uploads and stores a training video for AI avatar generation
 */
app.post('/api/training-video', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    // For now, we'll return the file as base64
    // In production, you'd upload to Firebase Storage or similar
    const base64Video = req.file.buffer.toString('base64');
    const dataUrl = `data:${req.file.mimetype};base64,${base64Video}`;

    res.json({
      success: true,
      videoUrl: dataUrl,
      message: 'Training video uploaded successfully. Store this URL in your database.'
    });
  } catch (error) {
    console.error('Error uploading training video:', error);
    res.status(500).json({
      error: 'Failed to upload training video',
      details: error.message
    });
  }
});

/**
 * POST /api/generate-avatar-video
 * 
 * Generates avatar videos using fal.ai API by replacing character in training video with profile photo
 * This endpoint starts the generation and returns immediately with a request ID for polling
 */
app.post('/api/generate-avatar-video', async (req, res) => {
  console.log('=== /api/generate-avatar-video endpoint called ===');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  
  try {
    if (!process.env.FAL_KEY) {
      console.error('FAL_KEY not found in environment');
      return res.status(503).json({ 
        error: 'fal.ai not configured',
        message: 'Please set FAL_KEY in .env'
      });
    }
    
    console.log('FAL_KEY is configured');
    
    // Verify fal client is properly configured
    try {
      // Test that fal client is accessible
      if (typeof fal.queue === 'undefined' || typeof fal.queue.submit !== 'function') {
        throw new Error('fal.queue.submit is not available. fal.ai client may not be properly initialized.');
      }
      console.log('fal.ai client verified - queue.submit method is available');
    } catch (clientError) {
      console.error('fal.ai client verification failed:', clientError);
      return res.status(503).json({
        error: 'fal.ai client not properly initialized',
        details: clientError.message
      });
    }

    const { profilePhotoUrl, trainingVideoUrl, avatarId } = req.body;
    console.log('Extracted parameters:', { 
      hasProfilePhotoUrl: !!profilePhotoUrl, 
      hasTrainingVideoUrl: !!trainingVideoUrl, 
      avatarId 
    });
    
    if (!profilePhotoUrl || !trainingVideoUrl || !avatarId) {
      return res.status(400).json({ 
        error: 'profilePhotoUrl, trainingVideoUrl, and avatarId are required' 
      });
    }

    // Validate URLs
    try {
      new URL(profilePhotoUrl);
      new URL(trainingVideoUrl);
    } catch (urlError) {
      return res.status(400).json({ 
        error: 'Invalid URL format',
        details: urlError.message
      });
    }

    console.log(`Starting avatar video generation for avatar: ${avatarId}`);
    console.log(`Training video URL: ${trainingVideoUrl}`);
    console.log(`Profile photo URL: ${profilePhotoUrl}`);

    // Get training video dimensions to match resolution
    console.log('Getting training video dimensions...');
    const videoDimensions = await getVideoDimensions(trainingVideoUrl);
    let resolution = '720p'; // Default fallback
    let customResolution = null;
    
    if (videoDimensions) {
      console.log(`Training video dimensions: ${videoDimensions.width}x${videoDimensions.height}`);
      const falResolution = getFalResolution(videoDimensions.width, videoDimensions.height);
      
      if (typeof falResolution === 'string') {
        resolution = falResolution;
        console.log(`Using standard resolution: ${resolution}`);
      } else {
        // Custom resolution - fal.ai accepts width/height directly
        customResolution = falResolution;
        resolution = `${falResolution.width}x${falResolution.height}`;
        console.log(`Using custom resolution: ${resolution}`);
      }
    } else {
      console.warn('Could not determine video dimensions, using default 720p');
    }

    // Ensure the URL is properly formatted for fal.ai
    // Firebase Storage URLs should work, but we need to ensure they're publicly accessible
    // Don't decode the entire URL - only decode if it's double-encoded
    let formattedVideoUrl = trainingVideoUrl;
    let formattedPhotoUrl = profilePhotoUrl;
    
    // Check if URL contains encoded characters that need decoding
    // But preserve the token parameter which should remain encoded
    try {
      // Parse the URL to handle it properly
      const videoUrlObj = new URL(trainingVideoUrl);
      const photoUrlObj = new URL(profilePhotoUrl);
      
      // The pathname might be encoded, but the full URL should work as-is
      // fal.ai should handle Firebase Storage URLs directly
      formattedVideoUrl = trainingVideoUrl;
      formattedPhotoUrl = profilePhotoUrl;
      
      console.log(`Formatted training video URL: ${formattedVideoUrl}`);
      console.log(`Formatted profile photo URL: ${formattedPhotoUrl}`);
      console.log(`Video URL path: ${videoUrlObj.pathname}`);
      console.log(`Photo URL path: ${photoUrlObj.pathname}`);
    } catch (urlError) {
      console.warn('URL parsing error, using original URLs:', urlError);
    }

    // Submit request to fal.ai using queue (non-blocking)
    // Note: fal.ai accepts various video formats including .webm
    // The URL should be publicly accessible (Firebase Storage with proper rules)
    console.log('About to call fal.queue.submit...');
    console.log('Model: fal-ai/wan/v2.2-14b/animate/replace');
    console.log('FAL_KEY configured:', !!process.env.FAL_KEY);
    console.log('FAL_KEY format check:', process.env.FAL_KEY ? (process.env.FAL_KEY.includes(':') ? 'Has colon (key:secret format)' : 'Missing colon - may be invalid format') : 'Not set');
    
    // Build input parameters
    const inputParams = {
      video_url: formattedVideoUrl,
      image_url: formattedPhotoUrl
    };
    
    // Add resolution - use custom width/height if needed, otherwise use standard format
    if (customResolution) {
      inputParams.width = customResolution.width;
      inputParams.height = customResolution.height;
    } else {
      inputParams.resolution = resolution;
    }
    
    // Use higher quality settings for better results (matching training video quality)
    inputParams.video_quality = 'high';
    inputParams.video_write_mode = 'balanced';
    
    console.log('Input parameters:', {
      video_url: formattedVideoUrl.substring(0, 100) + '...',
      image_url: formattedPhotoUrl.substring(0, 100) + '...',
      resolution: customResolution ? `${customResolution.width}x${customResolution.height}` : resolution,
      video_quality: inputParams.video_quality,
      video_write_mode: inputParams.video_write_mode
    });
    
    console.log('Calling fal.queue.submit with full parameters...');
    let request_id;
    try {
      const submitResult = await fal.queue.submit('fal-ai/wan/v2.2-14b/animate/replace', {
        input: inputParams
      });
      
      console.log('fal.queue.submit response:', JSON.stringify(submitResult, null, 2));
      request_id = submitResult.request_id;
      
      if (!request_id) {
        throw new Error('No request_id returned from fal.ai API');
      }
    } catch (submitError) {
      console.error('Error during fal.queue.submit call:', submitError);
      console.error('Error name:', submitError.name);
      console.error('Error message:', submitError.message);
      console.error('Error stack:', submitError.stack);
      if (submitError.response) {
        console.error('Error response status:', submitError.response.status);
        console.error('Error response data:', JSON.stringify(submitError.response.data, null, 2));
      }
      if (submitError.cause) {
        console.error('Error cause:', submitError.cause);
      }
      throw submitError; // Re-throw to be caught by outer catch
    }

    console.log(`✓ fal.ai generation started successfully with request ID: ${request_id}`);

    res.json({
      success: true,
      requestId: request_id,
      status: 'QUEUED',
      message: 'Generation started. Poll /api/check-generation-status to check progress.'
    });

  } catch (error) {
    console.error('=== Error starting avatar video generation ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    // Log all error properties
    console.error('Error properties:', Object.keys(error));
    if (error.response) {
      console.error('Error response status:', error.response.status);
      console.error('Error response statusText:', error.response.statusText);
      console.error('Error response headers:', JSON.stringify(error.response.headers, null, 2));
      console.error('Error response data:', JSON.stringify(error.response.data, null, 2));
    }
    if (error.request) {
      console.error('Error request:', JSON.stringify(error.request, null, 2));
    }
    if (error.config) {
      console.error('Error config:', JSON.stringify(error.config, null, 2));
    }
    if (error.cause) {
      console.error('Error cause:', error.cause);
    }
    
    // Extract more detailed error information from fal.ai
    let errorMessage = error.message || 'Failed to start avatar video generation';
    let errorDetails = error.message;
    
    // Check if it's a fal.ai API error with details
    if (error.response?.data) {
      errorDetails = JSON.stringify(error.response.data, null, 2);
      if (error.response.data.detail) {
        // fal.ai returns errors in a detail array format
        const detailMessages = Array.isArray(error.response.data.detail)
          ? error.response.data.detail.map(d => d.msg || JSON.stringify(d)).join('; ')
          : error.response.data.detail;
        errorMessage = detailMessages;
      } else if (error.response.data.message) {
        errorMessage = error.response.data.message;
      } else if (error.response.data.error) {
        errorMessage = error.response.data.error;
      }
    } else if (error.detail) {
      // Handle fal.ai error format directly
      const detailMessages = Array.isArray(error.detail)
        ? error.detail.map(d => d.msg || JSON.stringify(d)).join('; ')
        : error.detail;
      errorMessage = detailMessages;
    }
    
    // Check for network errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      errorMessage = `Network error: Unable to reach fal.ai API (${error.code})`;
      errorDetails = `Network connection failed: ${error.message}`;
    }
    
    // Check for authentication errors
    if (error.response?.status === 401 || error.response?.status === 403) {
      errorMessage = 'Authentication failed: Invalid FAL_KEY or insufficient permissions';
      errorDetails = errorDetails || 'Check your FAL_KEY in .env file';
    }
    
    res.status(500).json({
      error: errorMessage,
      details: errorDetails,
      errorType: error.constructor.name,
      trainingVideoUrl: trainingVideoUrl, // Include for debugging
      statusCode: error.response?.status
    });
  }
});

/**
 * GET /api/check-generation-status
 * 
 * Checks the status of a fal.ai generation request
 */
app.get('/api/check-generation-status', async (req, res) => {
  console.log('=== /api/check-generation-status endpoint called ===');
  console.log('Query params:', req.query);
  
  try {
    if (!process.env.FAL_KEY) {
      console.error('FAL_KEY not found in environment');
      return res.status(503).json({ 
        error: 'fal.ai not configured',
        message: 'Please set FAL_KEY in .env'
      });
    }

    const { requestId } = req.query;
    
    if (!requestId) {
      console.error('requestId missing from query params');
      return res.status(400).json({ error: 'requestId is required' });
    }

    console.log(`Checking status for requestId: ${requestId}`);

    // Check status from fal.ai
    const status = await fal.queue.status('fal-ai/wan/v2.2-14b/animate/replace', {
      requestId: requestId,
      logs: true
    });
    
    console.log('fal.ai status response:', JSON.stringify(status, null, 2));

    // Map fal.ai status to our status values
    let mappedStatus = status.status;
    if (status.status === 'IN_QUEUE' || status.status === 'QUEUED') {
      mappedStatus = 'QUEUED';
    } else if (status.status === 'IN_PROGRESS' || status.status === 'PROCESSING') {
      mappedStatus = 'PROCESSING';
    } else if (status.status === 'COMPLETED' || status.status === 'DONE') {
      mappedStatus = 'COMPLETED';
    } else if (status.status === 'FAILED' || status.status === 'ERROR') {
      mappedStatus = 'FAILED';
    }

    res.json({
      success: true,
      status: mappedStatus,
      requestId: requestId,
      logs: status.logs || [],
      rawStatus: status.status // Include raw status for debugging
    });

  } catch (error) {
    console.error('Error checking generation status:', error);
    res.status(500).json({
      error: 'Failed to check generation status',
      details: error.message
    });
  }
});

/**
 * POST /api/complete-avatar-generation
 * 
 * Called when generation is complete - downloads video and uploads to Firebase Storage
 */
app.post('/api/complete-avatar-generation', async (req, res) => {
  try {
    if (!process.env.FAL_KEY) {
      return res.status(503).json({ 
        error: 'fal.ai not configured',
        message: 'Please set FAL_KEY in .env'
      });
    }

    const { requestId, avatarId } = req.body;
    
    if (!requestId || !avatarId) {
      return res.status(400).json({ 
        error: 'requestId and avatarId are required' 
      });
    }

    // Get the result from fal.ai
    const result = await fal.queue.result('fal-ai/wan/v2.2-14b/animate/replace', {
      requestId: requestId
    });

    // Check result structure - could be result.video.url or result.data.video.url
    let videoUrl = null;
    if (result?.video?.url) {
      videoUrl = result.video.url;
    } else if (result?.data?.video?.url) {
      videoUrl = result.data.video.url;
    }

    if (!videoUrl) {
      console.error('Unexpected result structure:', JSON.stringify(result, null, 2));
      return res.status(500).json({ 
        error: 'No video result found from fal.ai',
        details: 'Unexpected result structure'
      });
    }

    // Return the video URL - client will download and upload to Firebase Storage
    res.json({
      success: true,
      videoUrl: videoUrl,
      message: 'Video ready for upload to storage'
    });

  } catch (error) {
    console.error('Error completing avatar generation:', error);
    res.status(500).json({
      error: 'Failed to complete avatar generation',
      details: error.message
    });
  }
});

/**
 * POST /api/generate-all-expressions
 * 
 * Generates videos for all expressions using fal.ai
 */
app.post('/api/generate-all-expressions', async (req, res) => {
  try {
    if (!process.env.FAL_KEY) {
      return res.status(503).json({ 
        error: 'fal.ai not configured',
        message: 'Please set FAL_KEY in .env'
      });
    }

    const { profilePhotoUrl, trainingVideoUrl, expressions } = req.body;
    
    if (!profilePhotoUrl || !trainingVideoUrl || !expressions || !Array.isArray(expressions)) {
      return res.status(400).json({ 
        error: 'profilePhotoUrl, trainingVideoUrl, and expressions array are required' 
      });
    }

    console.log(`Generating ${expressions.length} avatar videos...`);

    // Generate videos for all expressions in parallel
    const generationPromises = expressions.map(async (expr) => {
      try {
        const result = await fal.subscribe('fal-ai/wan/v2.2-14b/animate/replace', {
          input: {
            video_url: trainingVideoUrl,
            image_url: profilePhotoUrl,
            resolution: '720p',
            video_quality: 'high',
            video_write_mode: 'balanced'
          },
          logs: false
        });

        return {
          expression: expr.label,
          videoUrl: result.video.url,
          requestId: result.requestId,
          success: true
        };
      } catch (error) {
        console.error(`Error generating video for ${expr.label}:`, error);
        return {
          expression: expr.label,
          success: false,
          error: error.message
        };
      }
    });

    const results = await Promise.all(generationPromises);
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(`Generated ${successful.length}/${expressions.length} videos successfully`);

    res.json({
      success: true,
      results,
      summary: {
        total: expressions.length,
        successful: successful.length,
        failed: failed.length
      }
    });

  } catch (error) {
    console.error('Error generating all expression videos:', error);
    res.status(500).json({
      error: 'Failed to generate expression videos',
      details: error.message
    });
  }
});

// 404 handler for API routes (must be before static file serving)
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'API endpoint not found',
    path: req.path
  });
});

// Serve static files from the public directory. When running with `npm start`
// the frontend can be accessed at http://localhost:PORT
const path = await import('node:path');
const __dirname = path.dirname(new URL(import.meta.url).pathname);
app.use(express.static(path.join(__dirname, 'public')));

// Global error handler for API routes
app.use((err, req, res, next) => {
  // Only handle JSON errors for API routes
  if (req.path.startsWith('/api/')) {
    console.error('API Error:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  } else {
    next(err);
  }
});

// Start the server
/**
 * Stripe Payment Endpoints
 */

/**
 * GET /api/subscription-packages
 * Get all available subscription packages
 */
app.get('/api/subscription-packages', async (req, res) => {
  try {
    // This will be stored in Firestore, but for now return empty array
    // Frontend will load from Firestore directly
    res.json({
      success: true,
      packages: []
    });
  } catch (error) {
    console.error('Error getting subscription packages:', error);
    res.status(500).json({
      error: 'Failed to get subscription packages',
      details: error.message
    });
  }
});

/**
 * POST /api/create-subscription-checkout
 * Create a Stripe checkout session for subscription
 */
app.post('/api/create-subscription-checkout', async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({
        error: 'Stripe not configured',
        message: 'Please set STRIPE_SECRET_KEY in .env'
      });
    }

    const { packageId, userId, successUrl, cancelUrl } = req.body;

    if (!packageId || !userId || !successUrl || !cancelUrl) {
      return res.status(400).json({
        error: 'packageId, userId, successUrl, and cancelUrl are required'
      });
    }

    // Get package details from Firestore (will be passed from frontend)
    // For now, we'll accept price and name in the request
    const { priceId, price, name, interval } = req.body;

    if (!priceId && !price) {
      return res.status(400).json({
        error: 'Either priceId (Stripe Price ID) or price (amount in cents) is required'
      });
    }

    // Create checkout session
    const sessionParams = {
      mode: 'subscription',
      customer_email: req.body.email, // Optional, can be set by user
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: userId,
      metadata: {
        userId,
        packageId,
        packageName: name || 'Subscription'
      }
    };

    // If priceId is provided, use it directly
    if (priceId) {
      sessionParams.line_items = [{
        price: priceId,
        quantity: 1
      }];
    } else {
      // Create a price on the fly (not recommended for production, but works)
      // Better to create prices in Stripe dashboard and use priceId
      const product = await stripe.products.create({
        name: name || 'Subscription',
        metadata: { packageId, userId }
      });

      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: price, // in cents
        currency: 'usd',
        recurring: {
          interval: interval || 'month' // 'month' or 'year'
        }
      });

      sessionParams.line_items = [{
        price: price.id,
        quantity: 1
      }];
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    res.json({
      success: true,
      sessionId: session.id,
      url: session.url
    });

  } catch (error) {
    console.error('Error creating subscription checkout:', error);
    res.status(500).json({
      error: 'Failed to create checkout session',
      details: error.message
    });
  }
});

/**
 * POST /api/create-avatar-payment
 * Create a Stripe checkout session for one-time avatar creation payment
 */
app.post('/api/create-avatar-payment', async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({
        error: 'Stripe not configured',
        message: 'Please set STRIPE_SECRET_KEY in .env'
      });
    }

    const { userId, avatarId, price, successUrl, cancelUrl } = req.body;

    if (!userId || !avatarId || !price || !successUrl || !cancelUrl) {
      return res.status(400).json({
        error: 'userId, avatarId, price, successUrl, and cancelUrl are required'
      });
    }

    // Create checkout session for one-time payment
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Avatar Creation',
            description: 'One-time payment for creating an AI-generated avatar'
          },
          unit_amount: Math.round(price * 100) // Convert dollars to cents
        },
        quantity: 1
      }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: userId,
      metadata: {
        userId,
        avatarId,
        type: 'avatar_creation'
      }
    });

    res.json({
      success: true,
      sessionId: session.id,
      url: session.url
    });

  } catch (error) {
    console.error('Error creating avatar payment:', error);
    res.status(500).json({
      error: 'Failed to create payment session',
      details: error.message
    });
  }
});

/**
 * POST /api/create-credit-purchase
 * Create a Stripe checkout session for buying credits
 */
app.post('/api/create-credit-purchase', async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({
        error: 'Stripe not configured',
        message: 'Please set STRIPE_SECRET_KEY in .env'
      });
    }

    const { userId, credits, price, successUrl, cancelUrl } = req.body;

    if (!userId || !credits || !price || !successUrl || !cancelUrl) {
      return res.status(400).json({
        error: 'userId, credits, price, successUrl, and cancelUrl are required'
      });
    }

    // Create checkout session for credit purchase
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${credits} Credits`,
            description: `Purchase ${credits} credits for avatar creation and chat`
          },
          unit_amount: Math.round(price * 100) // Convert dollars to cents
        },
        quantity: 1
      }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: userId,
      metadata: {
        userId,
        credits: credits.toString(),
        type: 'credit_purchase'
      }
    });

    res.json({
      success: true,
      sessionId: session.id,
      url: session.url
    });

  } catch (error) {
    console.error('Error creating credit purchase checkout:', error);
    res.status(500).json({
      error: 'Failed to create checkout session',
      details: error.message
    });
  }
});

/**
 * POST /api/stripe-webhook
 * Handle Stripe webhook events
 * Note: This endpoint uses raw body parser to verify Stripe signatures
 */
app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ error: 'Stripe not configured' });
  }

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not set');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        console.log('Checkout session completed:', session.id);
        
        // Handle subscription or one-time payment
        if (session.mode === 'subscription') {
          // Subscription created - add initial monthly credits
          const userId = session.client_reference_id;
          const packageId = session.metadata?.packageId;
          
          if (userId && packageId && firestoreDb) {
            try {
              // Get package to find monthly credits
              const packageDoc = await firestoreDb.collection('subscriptionPackages').doc(packageId).get();
              if (packageDoc.exists) {
                const packageData = packageDoc.data();
                const monthlyCredits = packageData.monthlyCredits || 0;
                
                if (monthlyCredits > 0) {
                  // Get current user credits
                  const userDoc = await firestoreDb.collection('users').doc(userId).get();
                  const currentCredits = userDoc.exists ? (userDoc.data().credits || 0) : 0;
                  const newCredits = currentCredits + monthlyCredits;
                  
                  // Update user credits
                  await firestoreDb.collection('users').doc(userId).update({
                    credits: newCredits,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                  });
                  
                  // Record transaction
                  await firestoreDb.collection('creditTransactions').add({
                    userId,
                    type: 'subscription',
                    amount: monthlyCredits,
                    reason: `Monthly credits from subscription: ${packageData.name || packageId}`,
                    balanceBefore: currentCredits,
                    balanceAfter: newCredits,
                    metadata: { packageId, subscriptionId: session.subscription },
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                  });
                  
                  console.log(`Added ${monthlyCredits} credits to user ${userId} for subscription`);
                }
              }
            } catch (error) {
              console.error('Error adding subscription credits:', error);
            }
          }
          
          console.log('Subscription created for user:', session.client_reference_id);
        } else if (session.mode === 'payment') {
          // One-time payment completed
          if (session.metadata?.type === 'credit_purchase') {
            // Credit purchase - frontend will handle adding credits
            console.log('Credit purchase completed:', {
              userId: session.metadata?.userId,
              credits: session.metadata?.credits
            });
          } else {
            // Avatar creation payment
            console.log('Payment completed for avatar:', session.metadata?.avatarId);
          }
        }
        break;

      case 'invoice.payment_succeeded':
        // Subscription renewal - add monthly credits
        const invoice = event.data.object;
        if (invoice.subscription && firestoreDb) {
          try {
            // Get subscription details from Stripe
            const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
            const customerId = subscription.customer;
            
            // Find user subscription in Firestore
            const subscriptionsSnapshot = await firestoreDb.collection('userSubscriptions')
              .where('stripeSubscriptionId', '==', invoice.subscription)
              .limit(1)
              .get();
            
            if (!subscriptionsSnapshot.empty) {
              const userSubscription = subscriptionsSnapshot.docs[0].data();
              const userId = userSubscription.userId;
              const packageId = userSubscription.packageId;
              
              if (userId && packageId) {
                // Get package to find monthly credits
                const packageDoc = await firestoreDb.collection('subscriptionPackages').doc(packageId).get();
                if (packageDoc.exists) {
                  const packageData = packageDoc.data();
                  const monthlyCredits = packageData.monthlyCredits || 0;
                  
                  if (monthlyCredits > 0) {
                    // Get current user credits
                    const userDoc = await firestoreDb.collection('users').doc(userId).get();
                    const currentCredits = userDoc.exists ? (userDoc.data().credits || 0) : 0;
                    const newCredits = currentCredits + monthlyCredits;
                    
                    // Update user credits
                    await firestoreDb.collection('users').doc(userId).update({
                      credits: newCredits,
                      updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                    
                    // Record transaction
                    await firestoreDb.collection('creditTransactions').add({
                      userId,
                      type: 'subscription',
                      amount: monthlyCredits,
                      reason: `Monthly credits from subscription renewal: ${packageData.name || packageId}`,
                      balanceBefore: currentCredits,
                      balanceAfter: newCredits,
                      metadata: { packageId, subscriptionId: invoice.subscription, invoiceId: invoice.id },
                      createdAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                    
                    console.log(`Added ${monthlyCredits} credits to user ${userId} for subscription renewal`);
                  }
                }
              }
            }
          } catch (error) {
            console.error('Error adding subscription renewal credits:', error);
          }
        }
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        const subscription = event.data.object;
        console.log('Subscription updated:', subscription.id);
        // Update user's subscription status in Firestore
        break;

      case 'customer.subscription.deleted':
        const deletedSubscription = event.data.object;
        console.log('Subscription cancelled:', deletedSubscription.id);
        // Update user's subscription status in Firestore
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Error handling webhook:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Realtime backend running on port ${PORT}`);
});
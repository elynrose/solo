// Client script for the Expression → Video Reaction app.
//
// This script handles chat functionality:
// - User types and sends messages
// - Backend classifies expression and generates AI response
// - Expression updates video position
// - AI response is displayed in chat
// - Firebase Authentication and Firestore integration

// Firebase functions will be used from the global firebase object (loaded via CDN)

// Endpoint on our backend to process chat messages
const CHAT_ENDPOINT = '/api/chat';

// Firebase imports (will be available from window after firebase-config loads)
let auth, db;

/**
 * Convert time string (MM:SS or HH:MM:SS) to seconds
 * @param {string|number} time - Time string like "00:05" or "01:23:45", or number in seconds
 * @returns {number} Seconds
 */
function timeToSeconds(time) {
  if (typeof time === 'number') {
    return time; // Already in seconds
  }
  if (typeof time === 'string') {
    const parts = time.split(':').map(Number);
    if (parts.length === 2) {
      // MM:SS format
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      // HH:MM:SS format
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
  }
  return 0;
}

// Expression segments and colors - loaded from Firestore
let EXPRESSION_SEGMENTS = {};
let EXPRESSION_COLORS = {};

// DOM elements
const tokenUsageEl = document.getElementById('tokenUsage');
const expressionLabelEl = document.getElementById('expressionLabel');
let reactionVideoEl = document.getElementById('reactionVideo');
const segmentInfoEl = document.getElementById('segmentInfo');
const chatMessagesEl = document.getElementById('chatMessages');
const chatInputEl = document.getElementById('chatInput');
const chatSendBtn = document.getElementById('chatSendBtn');

// Global state
let currentExpression = null;
let isProcessing = false;
let currentUser = null;
let currentSessionId = null;
let currentAvatarId = null;
let isSignUpMode = false;
let storage = null; // Firebase Storage instance

// Video Recording State
let recordingStream = null;
let mediaRecorder = null;
let recordedChunks = []; // Raw chunks from MediaRecorder for current expression
let recordedSegments = []; // Array of completed expression recordings {blob, expression, startTime, endTime}
let recordingExpressions = [];
let currentExpressionIndex = 0;
let isRecording = false;
let isPaused = false;
let recordingStartTime = 0;
let recordingTimerInterval = null;
let currentRecordingBlob = null;
let editingAvatarId = null;
let avatars = [];
let isAdmin = false;
let expressions = [];
let editingExpressionId = null;
let userCredits = 0; // User's current credit balance
let creditConfig = {
  recording: 10,
  ai: 50,
  url: 5,
  per10kTokens: 1
};
let isRecordedVideo = false; // Flag to track if current video is from recording
let editingCreditPackageId = null; // For credit package editing

// Token usage tracking
let totalTokens = { prompt: 0, completion: 0, total: 0 };

// Conversation history for context
// Each message is { role: 'user' | 'ai', content: string }
let conversationHistory = [];

// DOM elements for auth
const authModal = document.getElementById('authModal');
const authForm = document.getElementById('authForm');
const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const authSubmitBtn = document.getElementById('authSubmitBtn');
const authTitle = document.getElementById('authTitle');
const authToggleLink = document.getElementById('authToggleLink');
const authToggleText = document.getElementById('authToggleText');
const authError = document.getElementById('authError');
const mainContainer = document.getElementById('mainContainer');
const userInfo = document.getElementById('userInfo');
const userEmail = document.getElementById('userEmail');
const logoutBtn = document.getElementById('logoutBtn');
const sessionsPanel = document.getElementById('sessionsPanel'); // May be null if removed
const sessionsList = document.getElementById('sessionsList'); // May be null if removed
const newSessionBtn = document.getElementById('newSessionBtn');
const googleSignInBtn = document.getElementById('googleSignInBtn');

// Navigation and Avatars
// Navigation tabs removed - chat is now a page that appears when avatar is selected
const chatPage = document.getElementById('chatPage');
const chatAvatarNameEl = document.getElementById('chatAvatarName');
const avatarsPage = document.getElementById('avatarsPage');
const avatarsList = document.getElementById('avatarsList');
const createAvatarBtn = document.getElementById('createAvatarBtn');
const avatarFormModal = document.getElementById('avatarFormModal');
const avatarForm = document.getElementById('avatarForm');
const avatarFormTitle = document.getElementById('avatarFormTitle');
const avatarName = document.getElementById('avatarName');
const avatarVideoUrl = document.getElementById('avatarVideoUrl');
const avatarDescription = document.getElementById('avatarDescription');
const avatarCategory = document.getElementById('avatarCategory');
const avatarIsPublic = document.getElementById('avatarIsPublic');
const saveAvatarBtn = document.getElementById('saveAvatarBtn');
const cancelAvatarBtn = document.getElementById('cancelAvatarBtn');
const avatarFormCloseBtn = document.getElementById('avatarFormCloseBtn');
const avatarVideoPreview = document.getElementById('avatarVideoPreview');
const avatarVideoPreviewSource = document.getElementById('avatarVideoPreviewSource');
const videoPreviewGroup = document.getElementById('videoPreviewGroup');
const videoPreviewError = document.getElementById('videoPreviewError');

// Generation Progress Modal
const generationProgressModal = document.getElementById('generationProgressModal');
const progressMessage = document.getElementById('progressMessage');
const progressWarning = document.getElementById('progressWarning');
const progressBarFill = document.getElementById('progressBarFill');
const progressPercentage = document.getElementById('progressPercentage');
const progressStep1 = document.getElementById('progressStep1');
const progressStep2 = document.getElementById('progressStep2');
const progressStep3 = document.getElementById('progressStep3');
const progressStep4 = document.getElementById('progressStep4');
const generationProgressCloseBtn = document.getElementById('generationProgressCloseBtn');

// Video Recording DOM elements
const recordVideoBtn = document.getElementById('recordVideoBtn');
const useVideoUrlBtn = document.getElementById('useVideoUrlBtn');
const videoUrlInputGroup = document.getElementById('videoUrlInputGroup');
const videoRecordingGroup = document.getElementById('videoRecordingGroup');
const recordingPreview = document.getElementById('recordingPreview');
const recordingPrompt = document.getElementById('recordingPrompt');
const recordingProgress = document.getElementById('recordingProgress');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const recordingTimer = document.getElementById('recordingTimer');
const recordingIndicator = document.getElementById('recordingIndicator');
const startRecordingBtn = document.getElementById('startRecordingBtn');
const pauseRecordingBtn = document.getElementById('pauseRecordingBtn');
const resumeRecordingBtn = document.getElementById('resumeRecordingBtn');
const retryRecordingBtn = document.getElementById('retryRecordingBtn');
const nextExpressionBtn = document.getElementById('nextExpressionBtn');
const finishRecordingBtn = document.getElementById('finishRecordingBtn');

// Admin DOM elements
const adminBtn = document.getElementById('adminBtn');
const adminPage = document.getElementById('adminPage');
const backToMainBtn = document.getElementById('backToMainBtn');
const adminNavBtns = document.querySelectorAll('.admin-nav-btn');
const adminUsersSection = document.getElementById('adminUsersSection');
const adminAvatarsSection = document.getElementById('adminAvatarsSection');
const adminExpressionsSection = document.getElementById('adminExpressionsSection');
const adminTrainingVideoSection = document.getElementById('adminTrainingVideoSection');
const adminSubscriptionsSection = document.getElementById('adminSubscriptionsSection');
const adminPricingSection = document.getElementById('adminPricingSection');
const adminCategoriesSection = document.getElementById('adminCategoriesSection');
const adminModerationSection = document.getElementById('adminModerationSection');
const moderationInstructions = document.getElementById('moderationInstructions');
const blacklistedWords = document.getElementById('blacklistedWords');
const blacklistedTopics = document.getElementById('blacklistedTopics');
const saveModerationBtn = document.getElementById('saveModerationBtn');
const resetModerationBtn = document.getElementById('resetModerationBtn');
const moderationStatus = document.getElementById('moderationStatus');
const usersTableBody = document.getElementById('usersTableBody');
const adminAvatarsList = document.getElementById('adminAvatarsList');
const categoriesTableBody = document.getElementById('categoriesTableBody');
const createCategoryBtn = document.getElementById('createCategoryBtn');

// Subscription and Pricing DOM elements
const packagesTableBody = document.getElementById('packagesTableBody');
const createPackageBtn = document.getElementById('createPackageBtn');
const packageFormModal = document.getElementById('packageFormModal');
const packageForm = document.getElementById('packageForm');
const packageFormTitle = document.getElementById('packageFormTitle');
const packageFormCloseBtn = document.getElementById('packageFormCloseBtn');
const cancelPackageBtn = document.getElementById('cancelPackageBtn');
const savePackageBtn = document.getElementById('savePackageBtn');
const packageName = document.getElementById('packageName');
const packageDescription = document.getElementById('packageDescription');
const packagePrice = document.getElementById('packagePrice');
const packageInterval = document.getElementById('packageInterval');
const packageStripePriceId = document.getElementById('packageStripePriceId');
const packageMonthlyCredits = document.getElementById('packageMonthlyCredits');
const packageActive = document.getElementById('packageActive');

// Pricing configuration
const avatarCreationPrice = document.getElementById('avatarCreationPrice');
const savePricingBtn = document.getElementById('savePricingBtn');

// Subscription selection modal
const subscriptionModal = document.getElementById('subscriptionModal');
const subscriptionModalCloseBtn = document.getElementById('subscriptionModalCloseBtn');
const subscriptionPackagesList = document.getElementById('subscriptionPackagesList');
const subscribeBtn = document.getElementById('subscribeBtn');
const subscriptionStatus = document.getElementById('subscriptionStatus');
const subscriptionStatusText = document.getElementById('subscriptionStatusText');
const expressionsTableBody = document.getElementById('expressionsTableBody');
const createExpressionBtn = document.getElementById('createExpressionBtn');
const populateDefaultExpressionsBtn = document.getElementById('populateDefaultExpressionsBtn');
const expressionFormModal = document.getElementById('expressionFormModal');
const expressionForm = document.getElementById('expressionForm');
const expressionFormTitle = document.getElementById('expressionFormTitle');
const expressionFormCloseBtn = document.getElementById('expressionFormCloseBtn');
const expressionLabelInput = document.getElementById('expressionLabelInput');
const expressionStart = document.getElementById('expressionStart');
const expressionEnd = document.getElementById('expressionEnd');
const expressionColor = document.getElementById('expressionColor');
const expressionInstruction = document.getElementById('expressionInstruction');
const saveExpressionBtn = document.getElementById('saveExpressionBtn');
const cancelExpressionBtn = document.getElementById('cancelExpressionBtn');
const trainingVideoUpload = document.getElementById('trainingVideoUpload');
const saveTrainingVideoBtn = document.getElementById('saveTrainingVideoBtn');
const trainingVideoPreview = document.getElementById('trainingVideoPreview');
const trainingVideoPreviewEl = document.getElementById('trainingVideoPreviewEl');
const trainingVideoUploadForm = document.getElementById('trainingVideoUploadForm');
const uploadTrainingVideoBtn = document.getElementById('uploadTrainingVideoBtn');
const cancelTrainingVideoUploadBtn = document.getElementById('cancelTrainingVideoUploadBtn');
const trainingVideoName = document.getElementById('trainingVideoName');
const trainingVideosTableBody = document.getElementById('trainingVideosTableBody');

// Credit system DOM elements
const creditsDisplay = document.getElementById('creditsDisplay');
const creditsCount = document.getElementById('creditsCount');
const buyCreditsBtn = document.getElementById('buyCreditsBtn');
const creditPurchaseModal = document.getElementById('creditPurchaseModal');
const creditPurchaseCloseBtn = document.getElementById('creditPurchaseCloseBtn');
const creditPackagesList = document.getElementById('creditPackagesList');
const currentCreditsDisplay = document.getElementById('currentCreditsDisplay');
const adminCreditsSection = document.getElementById('adminCreditsSection');
const creditCostRecording = document.getElementById('creditCostRecording');
const creditCostAI = document.getElementById('creditCostAI');
const creditCostURL = document.getElementById('creditCostURL');
const creditCostPer10kTokens = document.getElementById('creditCostPer10kTokens');
const saveCreditConfigBtn = document.getElementById('saveCreditConfigBtn');
const createCreditPackageBtn = document.getElementById('createCreditPackageBtn');
const creditPackagesTableBody = document.getElementById('creditPackagesTableBody');

/**
 * Update the token usage display.
 * @param {Object} tokens - Token usage object with prompt, completion, and total
 */
function updateTokenUsage(tokens) {
  if (tokens) {
    totalTokens.prompt += tokens.prompt || 0;
    totalTokens.completion += tokens.completion || 0;
    totalTokens.total += tokens.total || 0;
  }
  
  tokenUsageEl.textContent = `${totalTokens.total.toLocaleString()} total (${totalTokens.prompt.toLocaleString()} prompt + ${totalTokens.completion.toLocaleString()} completion)`;
}

/**
 * Update the expression display and video position based on the label.
 * @param {Object} expressionObj - Should have a 'label' property
 */
function updateExpression(expressionObj) {
  const label = expressionObj.label || 'Neutral';
  const previousExpression = currentExpression; // Store previous before updating
  console.log('updateExpression called with label:', label, 'previous:', previousExpression);
  currentExpression = label;
  
  // Update display
  expressionLabelEl.textContent = label;
  
  // Update color and styling based on expression - ONLY use database values
  // If expressions haven't loaded yet, use a default gray color
  const color = EXPRESSION_COLORS[label] || EXPRESSION_COLORS['Neutral'] || '#999999';
  expressionLabelEl.style.color = color;
  expressionLabelEl.style.borderColor = color;
  expressionLabelEl.style.background = `linear-gradient(135deg, ${color}15 0%, ${color}25 100%)`;
  
  // Add subtle animation
  expressionLabelEl.style.transform = 'scale(1.05)';
  setTimeout(() => {
    expressionLabelEl.style.transform = 'scale(1)';
  }, 200);
  
  // Update video position based on expression (pass previous for transition detection)
  updateVideoPosition(label, previousExpression);
}

/**
 * Update video position to track the expression segment.
 * Continuously seeks to the start of the segment for the given expression.
 * @param {string} label - The expression label to seek to
 * @param {string} previousLabel - The previous expression label (for transition detection)
 */
function updateVideoPosition(label, previousLabel = null) {
  console.log('updateVideoPosition called with label:', label, 'previous:', previousLabel);
  console.log('EXPRESSION_SEGMENTS:', EXPRESSION_SEGMENTS);
  console.log('Available expressions:', Object.keys(EXPRESSION_SEGMENTS));
  
  // ONLY use expressions from database - no hardcoded fallbacks
  const segment = EXPRESSION_SEGMENTS[label];
  if (!segment) {
    // Show warning if expressions are loaded but this one isn't found
    if (Object.keys(EXPRESSION_SEGMENTS).length > 0) {
      segmentInfoEl.textContent = `No segment configured for "${label}" in database.`;
      console.warn(`Expression "${label}" not found in database. Available expressions:`, Object.keys(EXPRESSION_SEGMENTS));
    } else {
      console.warn('No expressions loaded yet. EXPRESSION_SEGMENTS is empty.');
      segmentInfoEl.textContent = 'Expressions not loaded yet.';
    }
    return;
  }
  
  console.log('Found segment for', label, ':', segment);
  
  // Check if video element exists
  if (!reactionVideoEl) {
    segmentInfoEl.textContent = `Video element not found.`;
    return;
  }
  
  // Convert time strings to seconds if needed
  const startSeconds = timeToSeconds(segment.start);
  const endSeconds = timeToSeconds(segment.end);
  
  // Function to update video position with smooth fade transition
  const updatePosition = () => {
    if (!reactionVideoEl) return;
    
    // Check if video has duration (means it's loaded)
    if (reactionVideoEl.duration && reactionVideoEl.duration > 0) {
      // Check if we're switching to a different expression (not initial load)
      const isExpressionChange = previousLabel && previousLabel !== label && previousLabel !== '';
      
      // Seek to the start of the segment
      const seekTime = Math.min(startSeconds, reactionVideoEl.duration);
      console.log(`Seeking video to ${seekTime}s (${segment.start}) for expression "${label}"`);
      
      // Function to ensure video is playing
      const ensurePlaying = () => {
        if (!reactionVideoEl || reactionVideoEl.paused) {
          const playPromise = reactionVideoEl.play();
          if (playPromise !== undefined) {
            playPromise.catch((err) => {
              // Silently handle autoplay restrictions - user can manually play
              // Only log if it's not an autoplay restriction
              if (err.name !== 'NotAllowedError' && err.name !== 'AbortError') {
                console.error('Video play error:', err);
              }
            });
          }
        }
      };
      
      // Direct seek without fade transition
      reactionVideoEl.currentTime = seekTime;
      
      // Ensure video is playing after seeking
      ensurePlaying();
      
      // Also ensure playing after seek completes
      const onSeeked = () => {
        ensurePlaying();
        reactionVideoEl.removeEventListener('seeked', onSeeked);
      };
      reactionVideoEl.addEventListener('seeked', onSeeked, { once: true });
      
      segmentInfoEl.textContent = `Tracking "${label}": ${segment.start} → ${segment.end}`;
      
      // Monitor video position
      const checkPosition = () => {
        if (!reactionVideoEl || currentExpression !== label) {
          return;
        }
        
        // Ensure video is still playing
        if (reactionVideoEl.paused) {
          ensurePlaying();
        }
        
        if (label === 'Neutral') {
          // For Neutral, loop continuously
          if (reactionVideoEl.currentTime >= endSeconds) {
            reactionVideoEl.currentTime = startSeconds;
            ensurePlaying();
          }
        } else {
          // For other expressions, play once then return to Neutral
          if (reactionVideoEl.currentTime >= endSeconds) {
            // Return to Neutral after expression segment finishes
            updateExpression({ label: 'Neutral' });
          }
        }
      };
      
      // Remove old listeners and add new one
      reactionVideoEl.removeEventListener('timeupdate', checkPosition);
      reactionVideoEl.addEventListener('timeupdate', checkPosition);
      
      // Add pause event listener to auto-resume if video unexpectedly pauses
      // Only auto-resume if we're actively tracking this expression
      const onPause = () => {
        // Only auto-resume if we're still on the same expression and video didn't end
        if (currentExpression === label && !reactionVideoEl.ended && reactionVideoEl.readyState >= 3) {
          // Small delay to avoid conflicts with seeking
          setTimeout(() => {
            if (reactionVideoEl && reactionVideoEl.paused && currentExpression === label && !reactionVideoEl.ended) {
              ensurePlaying();
            }
          }, 200);
        }
      };
      
      // Remove old pause listener and add new one
      reactionVideoEl.removeEventListener('pause', onPause);
      reactionVideoEl.addEventListener('pause', onPause);
    } else {
      // Video not loaded yet, wait for it
      const onLoaded = () => {
        if (reactionVideoEl && reactionVideoEl.duration > 0) {
          updatePosition();
        }
      };
      
      // Remove any existing listeners first
      reactionVideoEl.removeEventListener('loadedmetadata', onLoaded);
      reactionVideoEl.removeEventListener('canplay', onLoaded);
      reactionVideoEl.removeEventListener('loadeddata', onLoaded);
      
      // Add listeners for when video loads
      reactionVideoEl.addEventListener('loadedmetadata', onLoaded, { once: true });
      reactionVideoEl.addEventListener('canplay', onLoaded, { once: true });
      reactionVideoEl.addEventListener('loadeddata', onLoaded, { once: true });
      
      // Try to load the video
      reactionVideoEl.load();
    }
  };
  
  updatePosition();
}

/**
 * Add a message to the chat display.
 * @param {string} role - 'user' or 'ai'
 * @param {string} content - Message content
 */
function addChatMessage(role, content) {
  if (!chatMessagesEl) return;
  
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${role}`;
  
  const roleSpan = document.createElement('div');
  roleSpan.className = 'message-role';
  roleSpan.textContent = role === 'user' ? 'You' : 'AI';
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  contentDiv.textContent = content;
  
  messageDiv.appendChild(roleSpan);
  messageDiv.appendChild(contentDiv);
  
  chatMessagesEl.appendChild(messageDiv);
  
  // Scroll to bottom
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

/**
 * Send a chat message to the backend and handle the response.
 * @param {string} message - User's message
 */
async function sendChatMessage(message) {
  if (!message || !message.trim() || isProcessing) {
    return;
  }

  isProcessing = true;
  chatSendBtn.disabled = true;
  chatInputEl.disabled = true;

  // Add user message to chat
  addChatMessage('user', message);
  
  // Add to conversation history
  conversationHistory.push({ role: 'user', content: message });

  // Show "AI is typing..." indicator
  const typingIndicator = document.createElement('div');
  typingIndicator.className = 'chat-message ai';
  typingIndicator.innerHTML = '<div class="message-role">AI</div><div class="message-content">Typing...</div>';
  chatMessagesEl.appendChild(typingIndicator);
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;

  // Update expression to show processing
  expressionLabelEl.textContent = 'Analyzing...';

  try {
    // Get expression labels from database ONLY - no hardcoded fallbacks
    if (expressions.length === 0 && Object.keys(EXPRESSION_SEGMENTS).length === 0) {
      throw new Error('Expressions not loaded from database yet. Please wait...');
    }
    
    const expressionLabels = expressions.length > 0 
      ? expressions.map(e => e.label)
      : Object.keys(EXPRESSION_SEGMENTS);
    
    if (expressionLabels.length === 0) {
      throw new Error('No expressions found in database. Please create expressions in the admin panel.');
    }
    
    // Get current avatar description, profile photo, and memory bank for personality context
    let avatarDescription = null;
    let avatarProfilePhotoUrl = null;
    let memoryBank = null;
    if (currentAvatarId && avatars.length > 0) {
      const currentAvatar = avatars.find(a => a.id === currentAvatarId);
      if (currentAvatar) {
        if (currentAvatar.description) {
          avatarDescription = currentAvatar.description;
        }
        if (currentAvatar.profilePhotoUrl) {
          avatarProfilePhotoUrl = currentAvatar.profilePhotoUrl;
        }
        if (currentAvatar.memoryBank && Array.isArray(currentAvatar.memoryBank)) {
          memoryBank = currentAvatar.memoryBank;
        }
      }
    }
    
    const response = await fetch(CHAT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        message: message.trim(),
        conversationHistory: conversationHistory.slice(0, -1), // Send history without current message
        expressionLabels: expressionLabels, // Send dynamic expression labels from database
        avatarDescription: avatarDescription, // Send avatar description for personality context
        avatarProfilePhotoUrl: avatarProfilePhotoUrl, // Send avatar profile photo URL for appearance context
        memoryBank: memoryBank // Send memory bank for AI context
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.details || errorData.error || 'Chat request failed');
    }

    const data = await response.json();
    
    // Remove typing indicator
    typingIndicator.remove();
    
    // Add AI response to chat
    addChatMessage('ai', data.response);
    
    // Add to conversation history
    conversationHistory.push({ role: 'ai', content: data.response });
    
    // Update expression based on classification
    console.log('Received expression label from backend:', data.label);
    console.log('Current EXPRESSION_SEGMENTS:', EXPRESSION_SEGMENTS);
    updateExpression({ label: data.label });
    
    // Update token usage display
    if (data.tokens) {
      updateTokenUsage(data.tokens);
      
      // Deduct credits based on token usage
      try {
        const creditCost = getChatCreditCost(data.tokens.total);
        if (creditCost > 0) {
          await deductCredits(creditCost, 'Chat message', { 
            tokens: data.tokens.total,
            sessionId: currentSessionId 
          });
        }
      } catch (creditError) {
        console.error('Error deducting credits for chat:', creditError);
        // Don't block chat, just log the error
        addChatMessage('system', `Warning: ${creditError.message}. Please buy more credits to continue chatting.`);
      }
    }
    
    // Save to Firestore if user is authenticated
    if (currentUser && db) {
      // Ensure we have a session ID - create one if we don't
      if (!currentSessionId) {
        console.log('No session ID found, creating new session...');
        const newSessionId = await createNewSession();
        if (!newSessionId) {
          console.error('Failed to create session, message will not be saved');
        }
      }
      
      if (currentSessionId) {
        console.log('Attempting to save message to session:', currentSessionId);
        try {
          await saveMessageToFirestore(message, data.response, data.label);
        } catch (saveError) {
          console.error('Failed to save message to Firestore:', saveError);
          // Don't break the chat flow, but log the error
        }
      } else {
        console.warn('No session ID available, message will not be saved');
      }
    } else {
      console.warn('Cannot save message: currentUser =', !!currentUser, 'db =', !!db);
    }
  } catch (error) {
    console.error('Error sending chat message:', error);
    
    // Remove typing indicator
    typingIndicator.remove();
    
    // Show error message
    addChatMessage('ai', `Error: ${error.message}`);
    expressionLabelEl.textContent = 'Error';
  } finally {
    isProcessing = false;
    chatSendBtn.disabled = false;
    chatInputEl.disabled = false;
    chatInputEl.focus();
  }
}

/**
 * Authentication Functions
 */
async function handleAuth() {
  if (!auth || !db) {
    showAuthError('Firebase not initialized. Please wait a moment and try again, or check your server configuration.');
    return;
  }
  
  const email = authEmail.value.trim();
  const password = authPassword.value.trim();
  
  if (!email || !password) {
    showAuthError('Please enter both email and password');
    return;
  }
  
  authSubmitBtn.disabled = true;
  authSubmitBtn.textContent = isSignUpMode ? 'Creating Account...' : 'Signing In...';
  
  try {
    if (isSignUpMode) {
      await auth.createUserWithEmailAndPassword(email, password);
    } else {
      await auth.signInWithEmailAndPassword(email, password);
    }
    // Auth state change will handle UI update
  } catch (error) {
    showAuthError(error.message);
    authSubmitBtn.disabled = false;
    authSubmitBtn.textContent = isSignUpMode ? 'Sign Up' : 'Sign In';
  }
}

function showAuthError(message) {
  authError.textContent = message;
  authError.classList.add('show');
  setTimeout(() => {
    authError.classList.remove('show');
  }, 5000);
}

function toggleAuthMode() {
  isSignUpMode = !isSignUpMode;
  authTitle.textContent = isSignUpMode ? 'Sign Up' : 'Sign In';
  authSubmitBtn.textContent = isSignUpMode ? 'Sign Up' : 'Sign In';
  authToggleText.textContent = isSignUpMode ? 'Already have an account? ' : "Don't have an account? ";
  authToggleLink.textContent = isSignUpMode ? 'Sign in' : 'Sign up';
  authError.classList.remove('show');
}

async function handleGoogleSignIn() {
  if (!auth) {
    showAuthError('Firebase not initialized. Please wait a moment and try again, or check your server configuration.');
    return;
  }
  
  const provider = new firebase.auth.GoogleAuthProvider();
  
  googleSignInBtn.disabled = true;
  googleSignInBtn.textContent = 'Signing in...';
  
  try {
    await auth.signInWithPopup(provider);
    // Auth state change will handle UI update
  } catch (error) {
    console.error('Error signing in with Google:', error);
    showAuthError(error.message);
    googleSignInBtn.disabled = false;
    googleSignInBtn.innerHTML = '<i class="fab fa-google"></i> Sign in with Google';
  }
}

async function handleLogout() {
  try {
    await auth.signOut();
    // Auth state change will handle UI update
  } catch (error) {
    console.error('Error signing out:', error);
  }
}

/**
 * Firestore Functions
 */
async function createNewSession() {
  if (!currentUser || !db) return null;
  
  try {
    // Load avatars if not loaded
    if (avatars.length === 0) {
      await loadAvatars();
    }
    
    const sessionData = {
      userId: currentUser.uid,
      avatarId: currentAvatarId || null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      messages: []
    };
    
    const docRef = await db.collection('chatSessions').add(sessionData);
    currentSessionId = docRef.id;
    await loadSessions();
    
    // Load avatar video if avatar is selected
    if (currentAvatarId) {
      await loadAvatarVideo(currentAvatarId);
    } else {
      // Reset to default video if no avatar
      if (reactionVideoEl) {
        reactionVideoEl.src = './video/reaction-video.mp4';
        reactionVideoEl.load();
      }
    }
    
    return docRef.id;
  } catch (error) {
    console.error('Error creating session:', error);
    return null;
  }
}

async function saveMessageToFirestore(userMessage, aiResponse, expression) {
  if (!currentUser) {
    console.warn('Cannot save message: No current user');
    return;
  }
  
  if (!db) {
    console.warn('Cannot save message: No database connection');
    return;
  }
  
  if (!currentSessionId) {
    console.warn('Cannot save message: No current session ID');
    return;
  }
  
  try {
    console.log('Saving message to Firestore:', {
      sessionId: currentSessionId,
      userId: currentUser.uid,
      userMessage: userMessage.substring(0, 50) + '...',
      hasAiResponse: !!aiResponse,
      expression
    });
    
    const sessionRef = db.collection('chatSessions').doc(currentSessionId);
    const sessionDoc = await sessionRef.get();
    
    if (!sessionDoc.exists) {
      console.error('Session document does not exist:', currentSessionId);
      // Try to create the session if it doesn't exist
      console.log('Attempting to create missing session...');
      const newSessionId = await createNewSession();
      if (newSessionId) {
        currentSessionId = newSessionId;
        // Retry saving with the new session
        return await saveMessageToFirestore(userMessage, aiResponse, expression);
      } else {
        throw new Error('Failed to create session');
      }
    }
    
    const sessionData = sessionDoc.data();
    
    // Verify the user owns this session
    if (sessionData.userId !== currentUser.uid) {
      console.error('User does not own this session. User ID:', currentUser.uid, 'Session User ID:', sessionData.userId);
      throw new Error('User does not own this session');
    }
    
    const messages = sessionData.messages || [];
    const newMessage = {
      userMessage,
      aiResponse,
      expression,
      timestamp: firebase.firestore.Timestamp.now() // Use Timestamp.now() instead of serverTimestamp() for array items
    };
    
    messages.push(newMessage);
    
    console.log('Updating session with', messages.length, 'messages');
    console.log('Message data:', {
      userMessage: userMessage.substring(0, 30),
      aiResponse: aiResponse ? aiResponse.substring(0, 30) : 'null',
      expression
    });
    
    const updateData = {
      messages: messages,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    console.log('Calling update with data:', {
      messagesCount: updateData.messages.length,
      hasUpdatedAt: !!updateData.updatedAt
    });
    
    const updateResult = await sessionRef.update(updateData);
    
    console.log('Update call completed. Result:', updateResult);
    console.log('Message saved successfully. Total messages:', messages.length);
    
    // Verify the update by reading the document back
    const verifyDoc = await sessionRef.get();
    if (verifyDoc.exists) {
      const verifyData = verifyDoc.data();
      console.log('Verification: Document now has', verifyData.messages?.length || 0, 'messages');
    }
  } catch (error) {
    console.error('Error saving message to Firestore:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack,
      sessionId: currentSessionId,
      userId: currentUser?.uid
    });
    // Don't throw - we don't want to break the chat flow if saving fails
  }
}

async function loadSessions() {
  if (!currentUser || !db) return;
  
  // If sessionsList was removed from UI, skip loading
  if (!sessionsList) return;
  
  try {
    // Load avatars first if not already loaded
    if (avatars.length === 0) {
      await loadAvatars();
    }
    
    const querySnapshot = await db.collection('chatSessions')
      .where('userId', '==', currentUser.uid)
      .orderBy('updatedAt', 'desc')
      .get();
    
    sessionsList.innerHTML = '';
    
    if (querySnapshot.empty) {
      sessionsList.innerHTML = '<div style="padding: 12px; color: var(--text-secondary); text-align: center;">No previous sessions</div>';
      return;
    }
    
    querySnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      const sessionItem = document.createElement('div');
      sessionItem.className = 'session-item';
      
      const messageCount = data.messages ? data.messages.length : 0;
      const date = data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date();
      const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      // Find avatar name if avatarId exists
      const avatar = data.avatarId ? avatars.find(a => a.id === data.avatarId) : null;
      const avatarName = avatar ? avatar.name : 'No avatar';
      
      sessionItem.innerHTML = `
        <div>
          <div style="font-weight: 500;">Session (${messageCount} messages)</div>
          <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Avatar: ${avatarName}</div>
          <div class="session-date">${dateStr}</div>
        </div>
      `;
      
      sessionItem.addEventListener('click', async () => {
        await loadSession(docSnapshot.id);
      });
      
      sessionsList.appendChild(sessionItem);
    });
  } catch (error) {
    console.error('Error loading sessions:', error);
  }
}

async function loadSession(sessionId) {
  if (!currentUser || !db) return;
  
  try {
    const sessionDoc = await db.collection('chatSessions').doc(sessionId).get();
    
    if (sessionDoc.exists) {
      const data = sessionDoc.data();
      currentSessionId = sessionId;
      currentAvatarId = data.avatarId || null;
      
      // Load avatar video if avatar is set
      if (currentAvatarId) {
        await loadAvatarVideo(currentAvatarId);
      } else {
        // Reset to default video if no avatar
        if (reactionVideoEl) {
          reactionVideoEl.src = './video/reaction-video.mp4';
          reactionVideoEl.load();
        }
      }
      
      // Clear current chat and conversation history
      if (chatMessagesEl) {
        chatMessagesEl.innerHTML = '';
      }
      conversationHistory = [];
      
      // Load and display chat history from Firestore
      if (data.messages && data.messages.length > 0) {
        // Sort messages by timestamp to ensure correct order
        const sortedMessages = [...data.messages].sort((a, b) => {
          const aTime = a.timestamp?.toMillis?.() || a.timestamp?.seconds * 1000 || 0;
          const bTime = b.timestamp?.toMillis?.() || b.timestamp?.seconds * 1000 || 0;
          return aTime - bTime; // Ascending order (oldest first)
        });
        
        // Display each message in the chat window
        sortedMessages.forEach((msg) => {
          if (msg.userMessage) {
            addChatMessage('user', msg.userMessage);
            conversationHistory.push({ role: 'user', content: msg.userMessage });
          }
          if (msg.aiResponse) {
            addChatMessage('ai', msg.aiResponse);
            conversationHistory.push({ role: 'ai', content: msg.aiResponse });
          }
        });
        
        // Scroll to bottom to show latest messages
        if (chatMessagesEl) {
          setTimeout(() => {
            chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
          }, 100);
        }
      }
      
      // Switch to chat page
      switchPage('chat');
      
      // Focus on chat input
      if (chatInputEl) {
        setTimeout(() => chatInputEl.focus(), 200);
      }
    } else {
      console.warn('Session not found:', sessionId);
    }
  } catch (error) {
    console.error('Error loading session:', error);
    alert('Error loading chat history: ' + error.message);
  }
}

/**
 * Avatar Management Functions
 */
async function loadAvatars() {
  if (!currentUser || !db) return;
  
  try {
    // Load all avatars - Firestore rules will filter based on public/private
    // We need to fetch all and filter client-side since Firestore rules don't support
    // filtering in list queries based on document fields
    const querySnapshot = await db.collection('avatars').get();
    
    avatars = [];
    avatarsList.innerHTML = '';
    
    if (querySnapshot.empty) {
      avatarsList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-user-circle"></i>
          <div>No avatars yet. Create your first avatar!</div>
        </div>
      `;
      return;
    }
    
    // Filter avatars: show public ones or ones created by current user
    const filteredAvatars = [];
    querySnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      const isOwner = data.createdBy === currentUser.uid || data.userId === currentUser.uid;
      const isPublic = data.isPublic === true;
      
      // Show if public or owned by current user
      if (isPublic || isOwner) {
        filteredAvatars.push({ id: docSnapshot.id, ...data, createdAt: data.createdAt });
      }
    });
    
    // Sort by createdAt descending (newest first)
    filteredAvatars.sort((a, b) => {
      const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt || 0);
      const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt || 0);
      return bTime - aTime;
    });
    
    if (filteredAvatars.length === 0) {
      avatarsList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-user-circle"></i>
          <div>No avatars available. Create your first avatar!</div>
        </div>
      `;
      return;
    }
    
    filteredAvatars.forEach((avatarData) => {
      avatars.push(avatarData);
      
      const avatarCard = document.createElement('div');
      avatarCard.className = 'avatar-card';
      
      // Check if current user created this avatar
      const isOwner = avatarData.createdBy === currentUser.uid || avatarData.userId === currentUser.uid;
      
      // Check generation status
      const generationStatus = avatarData.generationStatus;
      const isGenerating = generationStatus && ['QUEUED', 'PROCESSING'].includes(generationStatus);
      const isFailed = generationStatus === 'FAILED' || generationStatus === 'ERROR' || generationStatus === 'TIMEOUT';
      const hasVideo = avatarData.videoUrl && !isGenerating;
      
      avatarCard.innerHTML = `
        <div class="avatar-card-header">
          <div>
            <div class="avatar-name">${avatarData.name}</div>
            <div class="avatar-description">${avatarData.description || 'No description'}</div>
            ${isGenerating ? `
              <div style="margin-top: 8px; padding: 8px; background: var(--accent-primary)15; border: 1px solid var(--accent-primary); border-radius: 6px; font-size: 12px; color: var(--accent-primary);">
                <i class="fas fa-spinner fa-spin"></i> Generating video... (${generationStatus})
              </div>
            ` : ''}
            ${isFailed ? `
              <div style="margin-top: 8px; padding: 8px; background: var(--error)15; border: 1px solid var(--error); border-radius: 6px; font-size: 12px; color: var(--error); display: flex; align-items: center; justify-content: space-between; gap: 12px;">
                <span>
                  <i class="fas fa-exclamation-triangle"></i> Generation ${generationStatus === 'TIMEOUT' ? 'timed out' : 'failed'}
                </span>
                ${generationStatus === 'TIMEOUT' && avatarData.generationRequestId ? `
                  <button class="retry-generation-btn" data-avatar-id="${avatarData.id}" data-request-id="${avatarData.generationRequestId}" style="padding: 4px 12px; font-size: 11px; background: var(--accent-primary); color: white; border: none; border-radius: 4px; cursor: pointer; transition: all 0.2s ease; font-weight: 500;" onmouseover="this.style.opacity='0.9'; this.style.transform='scale(1.05)'" onmouseout="this.style.opacity='1'; this.style.transform='scale(1)'">
                    <i class="fas fa-redo"></i> Retry
                  </button>
                ` : ''}
              </div>
            ` : ''}
          </div>
        </div>
        ${hasVideo ? `
          <video class="avatar-video-preview" muted>
            <source src="${avatarData.videoUrl}" type="video/mp4" />
          </video>
        ` : isGenerating ? `
          <div style="aspect-ratio: 16/9; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--text-secondary);">
            <div style="text-align: center;">
              <i class="fas fa-spinner fa-spin" style="font-size: 32px; margin-bottom: 12px; display: block;"></i>
              <div>Generating video...</div>
            </div>
          </div>
        ` : `
          <div style="aspect-ratio: 16/9; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--text-secondary);">
            <i class="fas fa-video" style="font-size: 32px;"></i>
          </div>
        `}
        <div class="avatar-actions">
          ${isOwner ? `
            <button class="avatar-btn" data-action="edit" data-id="${avatarData.id}">
              <i class="fas fa-edit"></i> Edit
            </button>
            <button class="avatar-btn delete" data-action="delete" data-id="${avatarData.id}">
              <i class="fas fa-trash"></i> Delete
            </button>
          ` : ''}
          <button class="avatar-btn" data-action="use" data-id="${avatarData.id}" style="flex: ${isOwner ? '1' : '1 1 100%'};" ${!hasVideo ? 'disabled' : ''}>
            <i class="fas fa-check"></i> ${hasVideo ? 'Use' : 'Generating...'}
          </button>
        </div>
      `;
      
      // Add event listeners
      const editBtn = avatarCard.querySelector('[data-action="edit"]');
      if (editBtn) {
        editBtn.addEventListener('click', () => {
          editAvatar(avatarData.id);
        });
      }
      
      avatarCard.querySelector('[data-action="use"]').addEventListener('click', async () => {
        await useAvatar(avatarData.id);
      });
      
      const deleteBtn = avatarCard.querySelector('[data-action="delete"]');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
          deleteAvatar(avatarData.id);
        });
      }
      
      // Add retry button listener for TIMEOUT status
      const retryBtn = avatarCard.querySelector('.retry-generation-btn');
      if (retryBtn) {
        retryBtn.addEventListener('click', async () => {
          const avatarId = retryBtn.getAttribute('data-avatar-id');
          const requestId = retryBtn.getAttribute('data-request-id');
          await retryAvatarGeneration(avatarId, requestId);
        });
      }
      
      avatarsList.appendChild(avatarCard);
    });
  } catch (error) {
    console.error('Error loading avatars:', error);
  }
}

async function openAvatarForm(avatarId = null) {
  editingAvatarId = avatarId;
  
  // Reset recording state
  cleanupRecording();
  
  // Load categories for dropdown
  await loadCategoriesForDropdown();
  
  if (avatarId) {
    const avatar = avatars.find(a => a.id === avatarId);
    if (avatar) {
      avatarFormTitle.textContent = 'Edit Avatar';
      avatarName.value = avatar.name;
      avatarVideoUrl.value = avatar.videoUrl;
      avatarDescription.value = avatar.description || '';
      if (avatarCategory) avatarCategory.value = avatar.categoryId || '';
      if (avatarIsPublic) avatarIsPublic.checked = avatar.isPublic !== false; // Default to true
      // Show preview if video URL exists
      if (avatar.videoUrl) {
        updateVideoPreview(avatar.videoUrl);
      }
      // Show URL input by default for editing
      if (videoUrlInputGroup) videoUrlInputGroup.style.display = 'block';
      if (videoRecordingGroup) videoRecordingGroup.style.display = 'none';
      if (avatarVideoUrl) avatarVideoUrl.setAttribute('required', 'required');
    }
  } else {
    avatarFormTitle.textContent = 'Create Avatar';
    avatarName.value = '';
    avatarVideoUrl.value = '';
    avatarDescription.value = '';
    if (avatarCategory) avatarCategory.value = '';
    if (avatarIsPublic) avatarIsPublic.checked = true; // Default to public
    hideVideoPreview();
    // Hide both inputs initially - user will choose
    if (videoUrlInputGroup) videoUrlInputGroup.style.display = 'none';
    if (videoRecordingGroup) videoRecordingGroup.style.display = 'none';
    if (avatarVideoUrl) avatarVideoUrl.removeAttribute('required');
  }
  
  avatarFormModal.classList.add('active');
  // Focus on name input
  setTimeout(() => avatarName.focus(), 100);
}

function updateVideoPreview(videoUrl) {
  if (!videoUrl || !videoUrl.trim()) {
    hideVideoPreview();
    return;
  }
  
  videoPreviewError.style.display = 'none';
  videoPreviewGroup.style.display = 'block';
  
  // Set video source
  avatarVideoPreviewSource.src = videoUrl;
  avatarVideoPreview.load();
  
  // Handle video load errors
  avatarVideoPreview.addEventListener('error', () => {
    videoPreviewError.style.display = 'flex';
    avatarVideoPreview.style.display = 'none';
  }, { once: true });
  
  // Handle successful load
  avatarVideoPreview.addEventListener('loadeddata', () => {
    videoPreviewError.style.display = 'none';
    avatarVideoPreview.style.display = 'block';
  }, { once: true });
}

function hideVideoPreview() {
  videoPreviewGroup.style.display = 'none';
  avatarVideoPreview.pause();
  avatarVideoPreviewSource.src = '';
  avatarVideoPreview.load();
}

function closeAvatarForm() {
  // Stop any active recording
  stopRecording();
  cleanupRecording();
  
  // Reset recording flag
  isRecordedVideo = false;
  
  avatarFormModal.classList.remove('active');
  editingAvatarId = null;
  avatarForm.reset();
  hideVideoPreview();
  
  // Clear profile photo preview
  const avatarProfilePhoto = document.getElementById('avatarProfilePhoto');
  const profilePhotoPreview = document.getElementById('profilePhotoPreview');
  if (avatarProfilePhoto) avatarProfilePhoto.value = '';
  if (profilePhotoPreview) profilePhotoPreview.style.display = 'none';
  
  // Clear memory bank files
  const avatarMemoryBank = document.getElementById('avatarMemoryBank');
  const memoryBankFilesList = document.getElementById('memoryBankFilesList');
  const memoryBankFilesListContent = document.getElementById('memoryBankFilesListContent');
  if (avatarMemoryBank) avatarMemoryBank.value = '';
  if (memoryBankFilesList) memoryBankFilesList.style.display = 'none';
  if (memoryBankFilesListContent) memoryBankFilesListContent.innerHTML = '';
  
  // Reset video source selection
  if (videoUrlInputGroup) videoUrlInputGroup.style.display = 'none';
  if (videoRecordingGroup) videoRecordingGroup.style.display = 'none';
  if (avatarVideoUrl) avatarVideoUrl.removeAttribute('required');
}

async function saveAvatar() {
  if (!currentUser || !db || !storage) return;
  
  const name = avatarName.value.trim();
  const videoUrl = avatarVideoUrl ? avatarVideoUrl.value.trim() : '';
  const description = avatarDescription.value.trim();
  const profilePhotoFile = document.getElementById('avatarProfilePhoto')?.files[0];
  
  // Validation
  if (!name) {
    alert('Please enter an avatar name');
    avatarName.focus();
    return;
  }
  
  if (name.length > 50) {
    alert('Avatar name must be 50 characters or less');
    avatarName.focus();
    return;
  }
  
  // Check if profile photo is provided for AI generation
  if (profilePhotoFile && !videoUrl) {
    // Check if we're editing and if photo is being replaced
    let isNewPhoto = true;
    if (editingAvatarId) {
      const existingAvatar = avatars.find(a => a.id === editingAvatarId);
      // If editing and avatar already has a profilePhotoUrl, we'll check if it's different
      // For now, if a new photo file is uploaded, we consider it a replacement
      // (We can't easily compare file contents, so any new upload = replacement)
      // Credits will be deducted after successful generation completion
    }
    
    // AI generation path - upload profile photo first, then start generation
    saveAvatarBtn.disabled = true;
    const originalText = saveAvatarBtn.innerHTML;
    saveAvatarBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading profile photo...';
    
    try {
      // Upload profile photo to Firebase Storage
      const timestamp = Date.now();
      const photoFilename = `avatars/${currentUser.uid}/${timestamp}-profile-photo.${profilePhotoFile.name.split('.').pop()}`;
      const photoStorageRef = storage.ref(photoFilename);
      
      const photoMetadata = {
        contentType: profilePhotoFile.type,
        customMetadata: {
          uploadedBy: currentUser.uid,
          uploadedAt: new Date().toISOString()
        }
      };
      
      const photoUploadTask = photoStorageRef.put(profilePhotoFile, photoMetadata);
      
      // Wait for photo upload
      const photoDownloadURL = await new Promise((resolve, reject) => {
        photoUploadTask.on('state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            saveAvatarBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Uploading profile photo... ${Math.round(progress)}%`;
          },
          reject,
          async () => {
            try {
              const url = await photoUploadTask.snapshot.ref.getDownloadURL();
              resolve(url);
            } catch (error) {
              reject(error);
            }
          }
        );
      });
      
      // Only check payment for new avatars or when replacing photo/video
      // For editing existing avatars with new photo, credits will be deducted after generation
      if (!editingAvatarId) {
        // New avatar - check payment
        const avatarPrice = await getAvatarCreationPrice();
        if (avatarPrice > 0) {
          // Check if user has already paid for this avatar or has active subscription
          const hasActiveSubscription = await checkActiveSubscription();
          const hasPaidForAvatar = await checkAvatarPayment('new');
          
          if (!hasActiveSubscription && !hasPaidForAvatar) {
            // Show payment modal
            const proceed = await showAvatarPaymentModal(avatarPrice, null);
            if (!proceed) {
              saveAvatarBtn.disabled = false;
              saveAvatarBtn.innerHTML = originalText;
              return;
            }
          }
        }
      }
      // For editing: Credits will be deducted after successful generation (in pollGenerationStatus)
      
      // Get active training video URL
      const trainingVideoUrl = await getActiveTrainingVideoUrl();
      if (!trainingVideoUrl) {
        alert('No active training video found. Please activate a training video in the admin panel.');
        saveAvatarBtn.disabled = false;
        saveAvatarBtn.innerHTML = originalText;
        return;
      }
      
      // Validate the URL format
      try {
        new URL(trainingVideoUrl);
      } catch (urlError) {
        alert('Invalid training video URL format. Please check the training video in the admin panel.');
        console.error('Invalid training video URL:', trainingVideoUrl);
        saveAvatarBtn.disabled = false;
        saveAvatarBtn.innerHTML = originalText;
        return;
      }
      
      console.log('Using training video URL:', trainingVideoUrl);
      
      // Validate expression timings against training video duration
      const validationResult = await validateExpressionTimings(trainingVideoUrl);
      
      let warningMessage = '';
      if (!validationResult.valid) {
        warningMessage = `⚠️ Warning: Expression timing mismatch!\n\n${validationResult.message}\n\n` +
              `The generated video will be ${validationResult.videoDuration.toFixed(1)} seconds, ` +
              `but your expressions reference up to ${validationResult.maxExpressionTime.toFixed(1)} seconds.\n\n` +
              `Please either:\n` +
              `1. Upload a training video that's at least ${Math.ceil(validationResult.maxExpressionTime)} seconds long, OR\n` +
              `2. Update your expression timings to fit within ${validationResult.videoDuration.toFixed(0)} seconds.\n\n` +
              `Generation will continue, but expressions beyond ${validationResult.videoDuration.toFixed(0)} seconds won't work.`;
      } else if (validationResult.totalExpressionDuration && validationResult.durationMatch === false) {
        // Show info about duration mismatch (not blocking, just informational)
        const diff = Math.abs(validationResult.totalExpressionDuration - validationResult.videoDuration);
        warningMessage = `ℹ️ Note: Total expression duration (${validationResult.totalExpressionDuration.toFixed(1)}s) ` +
              `differs from training video duration (${validationResult.videoDuration.toFixed(1)}s) by ${diff.toFixed(1)}s.\n\n` +
              `The generated video will be ${validationResult.videoDuration.toFixed(1)} seconds. ` +
              `If you recorded expression blobs, their total duration should match the training video duration.`;
      }
      
      if (warningMessage) {
        console.warn('Expression timing validation:', validationResult);
        alert(warningMessage);
      }
      
      // Create avatar document with generation status
      saveAvatarBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Starting generation...';
      
      const categoryId = avatarCategory ? avatarCategory.value.trim() : '';
      const isPublic = avatarIsPublic ? avatarIsPublic.checked : true;
      
      // Process memory bank files if provided (premium feature)
      let memoryBank = null;
      const memoryBankFiles = document.getElementById('avatarMemoryBank')?.files;
      if (memoryBankFiles && memoryBankFiles.length > 0) {
        // Check premium status
        const hasActiveSubscription = await checkActiveSubscription();
        if (!hasActiveSubscription) {
          alert('Memory Bank is a premium feature. Please subscribe to use this feature.');
          saveAvatarBtn.disabled = false;
          saveAvatarBtn.innerHTML = originalText;
          return;
        }
        
        // Process memory bank files
        saveAvatarBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing memory bank files...';
        const formData = new FormData();
        for (let i = 0; i < memoryBankFiles.length; i++) {
          formData.append('files', memoryBankFiles[i]);
        }
        
        try {
          const memoryBankResponse = await fetch('/api/process-memory-bank', {
            method: 'POST',
            body: formData
          });
          
          if (!memoryBankResponse.ok) {
            const errorData = await memoryBankResponse.json();
            throw new Error(errorData.error || 'Failed to process memory bank files');
          }
          
          const memoryBankData = await memoryBankResponse.json();
          memoryBank = memoryBankData.files;
        } catch (memoryBankError) {
          console.error('Error processing memory bank:', memoryBankError);
          alert(`Error processing memory bank files: ${memoryBankError.message}`);
          saveAvatarBtn.disabled = false;
          saveAvatarBtn.innerHTML = originalText;
          return;
        }
      }
      
      // If we're in the AI generation path, it means a new photo was uploaded
      // Store flag indicating if this is editing (for credit deduction logic)
      const avatarData = {
        createdBy: currentUser.uid,
        name,
        description: description || '',
        profilePhotoUrl: photoDownloadURL,
        generationStatus: 'QUEUED',
        generationRequestId: null,
        videoUrl: null, // Will be set when generation completes
        isPublic: isPublic,
        categoryId: categoryId || null,
        memoryBank: memoryBank, // Store processed memory bank
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      
      // Store flag indicating if this is editing (for credit deduction)
      // If editing, we'll check if avatar already has a videoUrl (meaning it was previously generated)
      // If it does, we're replacing/regenerating, so deduct credits
      // If it doesn't, it's a new generation, so deduct credits
      // For new avatars, always deduct credits
      if (editingAvatarId) {
        const existingAvatar = avatars.find(a => a.id === editingAvatarId);
        // If existing avatar has a videoUrl, we're replacing/regenerating
        // If it doesn't, this is the first generation
        // Either way, since we're uploading a new photo, we should deduct credits
        avatarData._isEditing = true;
      }
      
      let avatarDocRef;
      if (editingAvatarId) {
        // Update existing avatar
        const avatar = avatars.find(a => a.id === editingAvatarId);
        const isOwner = avatar && (avatar.createdBy === currentUser.uid || avatar.userId === currentUser.uid);
        if (!isOwner) {
          alert('You can only edit avatars you created');
          saveAvatarBtn.disabled = false;
          saveAvatarBtn.innerHTML = originalText;
          return;
        }
        avatarDocRef = db.collection('avatars').doc(editingAvatarId);
        await avatarDocRef.update(avatarData);
      } else {
        // Create new avatar
        avatarData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        avatarDocRef = await db.collection('avatars').add(avatarData);
      }
      
      const avatarId = editingAvatarId || avatarDocRef.id;
      
      // Start generation (credits will be deducted after successful completion)
      saveAvatarBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Starting AI generation...';
      
      const generationResponse = await fetch('/api/generate-avatar-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profilePhotoUrl: photoDownloadURL,
          trainingVideoUrl: trainingVideoUrl,
          avatarId: avatarId
        })
      });
      
      // Check if response is actually JSON
      const contentType = generationResponse.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await generationResponse.text();
        console.error('Non-JSON response from server:', text.substring(0, 200));
        throw new Error(`Server returned ${generationResponse.status}: ${generationResponse.statusText}. Please check if the server is running and the endpoint exists.`);
      }
      
      if (!generationResponse.ok) {
        const errorData = await generationResponse.json();
        throw new Error(errorData.error || errorData.message || 'Failed to start generation');
      }
      
      const generationResult = await generationResponse.json();
      
      // Update avatar with request ID
      await db.collection('avatars').doc(avatarId).update({
        generationRequestId: generationResult.requestId,
        generationStatus: 'PROCESSING',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      // Close form and start polling
      closeAvatarForm();
      await loadAvatars();
      
      // Store generation state in localStorage for persistence
      const generationState = {
        avatarId,
        requestId: generationResult.requestId,
        startedAt: Date.now(),
        status: 'PROCESSING'
      };
      localStorage.setItem('activeGeneration', JSON.stringify(generationState));
      
      // Show progress modal and start polling
      showGenerationProgress(avatarId, generationResult.requestId);
      startPollingGenerationStatus(avatarId, generationResult.requestId);
      
    } catch (error) {
      console.error('Error saving avatar with AI generation:', error);
      let errorMessage = error.message;
      
      // Provide more helpful error messages
      if (errorMessage.includes('<!DOCTYPE') || errorMessage.includes('Unexpected token')) {
        errorMessage = 'Server error: The API endpoint returned an unexpected response. Please check if the server is running and try again.';
      } else if (errorMessage.includes('fal.ai not configured') || errorMessage.includes('FAL_KEY')) {
        errorMessage = 'fal.ai API key is not configured. Please set FAL_KEY in the server .env file.';
      }
      
      alert('Error starting avatar generation: ' + errorMessage);
      saveAvatarBtn.disabled = false;
      saveAvatarBtn.innerHTML = originalText;
    }
    return;
  }
  
  // Traditional path - video URL provided
  if (!videoUrl) {
    alert('Please provide a video. Either record one, enter a video URL, or upload a profile photo for AI generation.');
    return;
  }
  
  if (description.length > 500) {
    alert('Description must be 500 characters or less');
    avatarDescription.focus();
    return;
  }
  
  // Check if we're editing and if video is being replaced
  let isNewVideo = true;
  if (editingAvatarId) {
    const existingAvatar = avatars.find(a => a.id === editingAvatarId);
    if (existingAvatar && existingAvatar.videoUrl === videoUrl) {
      // Same video URL - not replacing, so no credits needed
      isNewVideo = false;
    }
  }
  
  // Only deduct credits if it's a new avatar or if video is being replaced
  if (isNewVideo) {
    try {
      const method = isRecordedVideo ? 'recording' : 'url';
      const creditCost = getAvatarCreationCreditCost(method);
      if (creditCost > 0) {
        await deductCredits(creditCost, `Avatar creation (${method})`, { method: method });
      }
      // Reset flag after deduction
      isRecordedVideo = false;
    } catch (creditError) {
      alert(creditError.message);
      return;
    }
  } else {
    // Just editing metadata, reset flag without deducting credits
    isRecordedVideo = false;
  }
  
  saveAvatarBtn.disabled = true;
  const originalText = saveAvatarBtn.innerHTML;
  saveAvatarBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
  
  try {
    const categoryId = avatarCategory ? avatarCategory.value.trim() : '';
    const isPublic = avatarIsPublic ? avatarIsPublic.checked : true;
    
    // Process memory bank files if provided (premium feature)
    let memoryBank = null;
    const memoryBankFiles = document.getElementById('avatarMemoryBank')?.files;
    if (memoryBankFiles && memoryBankFiles.length > 0) {
      // Check premium status
      const hasActiveSubscription = await checkActiveSubscription();
      if (!hasActiveSubscription) {
        alert('Memory Bank is a premium feature. Please subscribe to use this feature.');
        saveAvatarBtn.disabled = false;
        saveAvatarBtn.innerHTML = originalText;
        return;
      }
      
      // Process memory bank files
      saveAvatarBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing memory bank files...';
      const formData = new FormData();
      for (let i = 0; i < memoryBankFiles.length; i++) {
        formData.append('files', memoryBankFiles[i]);
      }
      
      try {
        const memoryBankResponse = await fetch('/api/process-memory-bank', {
          method: 'POST',
          body: formData
        });
        
        if (!memoryBankResponse.ok) {
          const errorData = await memoryBankResponse.json();
          throw new Error(errorData.error || 'Failed to process memory bank files');
        }
        
        const memoryBankData = await memoryBankResponse.json();
        memoryBank = memoryBankData.files;
      } catch (memoryBankError) {
        console.error('Error processing memory bank:', memoryBankError);
        alert(`Error processing memory bank files: ${memoryBankError.message}`);
        saveAvatarBtn.disabled = false;
        saveAvatarBtn.innerHTML = originalText;
        return;
      }
    }
    
    const avatarData = {
      createdBy: currentUser.uid,
      name,
      videoUrl,
      description: description || '',
      isPublic: isPublic,
      categoryId: categoryId || null,
      memoryBank: memoryBank, // Store processed memory bank
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    if (editingAvatarId) {
      const avatar = avatars.find(a => a.id === editingAvatarId);
      const isOwner = avatar && (avatar.createdBy === currentUser.uid || avatar.userId === currentUser.uid);
      if (isOwner) {
        await db.collection('avatars').doc(editingAvatarId).update(avatarData);
      } else {
        alert('You can only edit avatars you created');
        return;
      }
    } else {
      avatarData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('avatars').add(avatarData);
    }
    
    await loadAvatars();
    closeAvatarForm();
  } catch (error) {
    console.error('Error saving avatar:', error);
    alert('Error saving avatar: ' + error.message);
  } finally {
    saveAvatarBtn.disabled = false;
    saveAvatarBtn.innerHTML = originalText;
  }
}

// Show generation progress modal
function showGenerationProgress(avatarId, requestId) {
  if (!generationProgressModal) return;
  
  // Reset progress
  updateProgress(10, 'Starting avatar generation...', 'queued');
  generationProgressModal.classList.add('active');
  generationProgressCloseBtn.style.display = 'none'; // Hide close button during generation
  
  // Prevent page refresh during generation
  window.addEventListener('beforeunload', handleBeforeUnload);
}

// Hide generation progress modal
function hideGenerationProgress() {
  if (!generationProgressModal) return;
  
  generationProgressModal.classList.remove('active');
  window.removeEventListener('beforeunload', handleBeforeUnload);
  
  // Clear localStorage
  localStorage.removeItem('activeGeneration');
}

// Handle beforeunload to warn user
function handleBeforeUnload(e) {
  e.preventDefault();
  e.returnValue = 'Avatar generation is in progress. Are you sure you want to leave?';
  return e.returnValue;
}

// Update progress indicator
function updateProgress(percentage, message, step) {
  if (progressBarFill) {
    progressBarFill.style.width = `${percentage}%`;
  }
  if (progressPercentage) {
    progressPercentage.textContent = `${Math.round(percentage)}%`;
  }
  if (progressMessage) {
    progressMessage.textContent = message || 'Processing...';
  }
  
  // Update step indicators
  const steps = [
    { el: progressStep1, name: 'queued' },
    { el: progressStep2, name: 'processing' },
    { el: progressStep3, name: 'uploading' },
    { el: progressStep4, name: 'finalizing' }
  ];
  
  steps.forEach((s, index) => {
    if (!s.el) return;
    s.el.classList.remove('active', 'completed');
    
    const stepIndex = steps.findIndex(st => st.name === step);
    if (stepIndex === -1) {
      // Step name not found, default to processing
      if (index === 1) {
        s.el.classList.add('active');
        const icon = s.el.querySelector('i');
        if (icon) icon.className = 'fas fa-circle';
      }
    } else if (index < stepIndex) {
      s.el.classList.add('completed');
      const icon = s.el.querySelector('i');
      if (icon) icon.className = 'fas fa-check-circle';
    } else if (index === stepIndex) {
      s.el.classList.add('active');
      const icon = s.el.querySelector('i');
      if (icon) icon.className = 'fas fa-circle';
    } else {
      const icon = s.el.querySelector('i');
      if (icon) icon.className = 'fas fa-circle';
    }
  });
}

// Poll generation status and handle completion
async function startPollingGenerationStatus(avatarId, requestId) {
  const maxPolls = 300; // 5 minutes max (1 poll per second)
  let pollCount = 0;
  
  // Show progress modal if not already shown
  if (generationProgressModal && !generationProgressModal.classList.contains('active')) {
    showGenerationProgress(avatarId, requestId);
  }
  
  const pollInterval = setInterval(async () => {
    pollCount++;
    
    // Update progress based on poll count (estimated)
    const estimatedProgress = Math.min(10 + (pollCount / maxPolls) * 80, 90); // 10-90% during processing
    updateProgress(estimatedProgress, 'AI is processing your avatar video...', 'processing');
    
    try {
      // Validate requestId before making request
      if (!requestId) {
        console.error('Invalid requestId for polling:', requestId);
        clearInterval(pollInterval);
        await db.collection('avatars').doc(avatarId).update({
          generationStatus: 'FAILED',
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert('Invalid generation request ID. Please try again.');
        return;
      }
      
      console.log(`Polling generation status (attempt ${pollCount}/${maxPolls}) for requestId: ${requestId}`);
      
      let statusResponse;
      try {
        statusResponse = await fetch(`/api/check-generation-status?requestId=${encodeURIComponent(requestId)}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
      } catch (fetchError) {
        // Network error - server likely not running
        if (fetchError.name === 'TypeError' && fetchError.message.includes('Failed to fetch')) {
          throw new Error('Server is not running. Please start the server with "npm start" on port 3001.');
        }
        throw fetchError;
      }
      
      // Check if fetch failed (network error)
      if (!statusResponse) {
        throw new Error('Network error: Unable to reach server. Is the server running?');
      }
      
      // Check response status
      if (!statusResponse.ok) {
        const errorText = await statusResponse.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { error: errorText || `HTTP ${statusResponse.status}: ${statusResponse.statusText}` };
        }
        throw new Error(errorData.error || `Server returned ${statusResponse.status}: ${statusResponse.statusText}`);
      }
      
      // Check if response is JSON
      const contentType = statusResponse.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await statusResponse.text();
        throw new Error(`Server returned non-JSON response: ${text.substring(0, 200)}`);
      }
      
      const statusData = await statusResponse.json();
      
      // Update status in Firestore (use set with merge to handle cases where document might not exist)
      try {
        await db.collection('avatars').doc(avatarId).set({
          generationStatus: statusData.status,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      } catch (firestoreError) {
        console.error('Error updating Firestore document:', firestoreError);
        // Continue polling even if Firestore update fails - don't break the polling loop
        // The document might have been deleted, but we still want to check the generation status
      }
      
      if (statusData.status === 'COMPLETED') {
        clearInterval(pollInterval);
        
        // Update progress to uploading
        updateProgress(90, 'Generation complete! Uploading video...', 'uploading');
        
        // Get the completed video URL
        const completeResponse = await fetch('/api/complete-avatar-generation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestId, avatarId })
        });
        
        if (!completeResponse.ok) {
          const errorData = await completeResponse.json();
          throw new Error(errorData.error || 'Failed to get completed video');
        }
        
        const completeData = await completeResponse.json();
        
        if (!completeData.videoUrl) {
          throw new Error('No video URL returned from server');
        }
        
        // Download video from fal.ai and upload to Firebase Storage
        console.log('Downloading video from fal.ai:', completeData.videoUrl);
        const videoResponse = await fetch(completeData.videoUrl);
        if (!videoResponse.ok) {
          throw new Error(`Failed to download video: ${videoResponse.statusText}`);
        }
        
        const videoBlob = await videoResponse.blob();
        console.log(`Downloaded video size: ${(videoBlob.size / 1024 / 1024).toFixed(2)} MB`);
        
        // Update progress
        updateProgress(95, 'Uploading video to storage...', 'uploading');
        
        // Upload to Firebase Storage
        const timestamp = Date.now();
        const videoFilename = `avatars/${currentUser.uid}/${timestamp}-avatar-video.mp4`;
        const videoStorageRef = storage.ref(videoFilename);
        
        const videoMetadata = {
          contentType: 'video/mp4',
          customMetadata: {
            uploadedBy: currentUser.uid,
            uploadedAt: new Date().toISOString(),
            generatedBy: 'fal.ai'
          }
        };
        
        const videoUploadTask = videoStorageRef.put(videoBlob, videoMetadata);
        
        await new Promise((resolve, reject) => {
          videoUploadTask.on('state_changed',
            null,
            reject,
            async () => {
              try {
                const downloadURL = await videoUploadTask.snapshot.ref.getDownloadURL();
                
                // Update avatar with final video URL
                await db.collection('avatars').doc(avatarId).set({
                  videoUrl: downloadURL,
                  generationStatus: 'COMPLETED',
                  updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                
                // Deduct credits after successful AI generation and upload
                // If we're in the AI generation path, it means a new photo was uploaded
                // So we should always deduct credits (either new avatar or replacing photo)
                try {
                  const creditCost = getAvatarCreationCreditCost('ai');
                  if (creditCost > 0) {
                    await deductCredits(creditCost, 'Avatar creation (AI generation)', { avatarId, method: 'ai' });
                  }
                } catch (creditError) {
                  console.error('Error deducting credits for AI generation:', creditError);
                  // Don't fail the generation, just log the error
                  // User will be notified but avatar is still created
                  alert(`Avatar created successfully, but there was an error deducting credits: ${creditError.message}. Please contact support.`);
                }
                
                // Update progress to completed
                updateProgress(100, 'Avatar generation completed!', 'finalizing');
                
                // Reload avatars to show updated status
                await loadAvatars();
                
                // Hide progress modal after a short delay
                setTimeout(() => {
                  hideGenerationProgress();
                  // Show close button briefly before hiding
                  if (generationProgressCloseBtn) {
                    generationProgressCloseBtn.style.display = 'block';
                  }
                }, 2000);
                
                resolve();
              } catch (error) {
                reject(error);
              }
            }
          );
        });
        
        console.log('Avatar generation completed and video uploaded!');
        
      } else if (statusData.status === 'FAILED' || statusData.status === 'ERROR') {
        clearInterval(pollInterval);
        hideGenerationProgress();
        try {
          await db.collection('avatars').doc(avatarId).set({
            generationStatus: 'FAILED',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        } catch (firestoreError) {
          console.error('Error updating Firestore with FAILED status:', firestoreError);
        }
        await loadAvatars();
        alert('Avatar generation failed. Please try again.');
      } else if (pollCount >= maxPolls) {
        clearInterval(pollInterval);
        hideGenerationProgress();
        try {
          await db.collection('avatars').doc(avatarId).set({
            generationStatus: 'TIMEOUT',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        } catch (firestoreError) {
          console.error('Error updating Firestore with TIMEOUT status:', firestoreError);
        }
        await loadAvatars();
        alert('Generation is taking longer than expected. Please check back later.');
      }
    } catch (error) {
      console.error('Error polling generation status:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        pollCount,
        requestId,
        avatarId
      });
      
      // If it's a network error and we've tried a few times, stop polling
      if (error.message.includes('Failed to fetch') || error.message.includes('Network error')) {
        if (pollCount >= 5) {
          clearInterval(pollInterval);
          hideGenerationProgress();
          try {
            await db.collection('avatars').doc(avatarId).set({
              generationStatus: 'FAILED',
              updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
          } catch (firestoreError) {
            console.error('Error updating Firestore with network error status:', firestoreError);
          }
          alert('Unable to connect to server. Please ensure the server is running and try again.');
          return;
        }
        // Continue polling for network errors (might be temporary)
        return;
      }
      
      // Handle Firebase errors (document doesn't exist)
      if (error.name === 'FirebaseError' && error.message.includes('No document to update')) {
        console.warn(`Avatar document ${avatarId} does not exist. Stopping polling.`);
        clearInterval(pollInterval);
        return; // Don't show alert - document was likely deleted
      }
      
      // For other errors, stop after max polls
      if (pollCount >= maxPolls) {
        clearInterval(pollInterval);
        hideGenerationProgress();
        try {
          await db.collection('avatars').doc(avatarId).set({
            generationStatus: 'FAILED',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        } catch (firestoreError) {
          console.error('Error updating Firestore with error status:', firestoreError);
        }
        alert('Generation status check failed: ' + error.message);
      }
    }
  }, 1000); // Poll every second
}

// Retry avatar generation - resumes polling for existing requestId
async function retryAvatarGeneration(avatarId, requestId) {
  if (!currentUser || !db || !avatarId || !requestId) {
    console.error('Invalid parameters for retry:', { avatarId, requestId });
    return;
  }
  
  try {
    // Update status back to PROCESSING
    await db.collection('avatars').doc(avatarId).set({
      generationStatus: 'PROCESSING',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    // Reload avatars to show updated status
    await loadAvatars();
    
    // Resume polling with the existing requestId
    console.log(`Retrying avatar generation for avatar ${avatarId} with requestId: ${requestId}`);
    startPollingGenerationStatus(avatarId, requestId);
  } catch (error) {
    console.error('Error retrying avatar generation:', error);
    alert('Error retrying generation: ' + error.message);
  }
}

// Check for avatars with pending generation on page load
async function checkPendingGenerations() {
  if (!currentUser || !db) return;
  
  try {
    // Get all avatars created by user and filter for pending ones
    const userAvatars = await db.collection('avatars')
      .where('createdBy', '==', currentUser.uid)
      .get();
    
    userAvatars.forEach((doc) => {
      const data = doc.data();
      const status = data.generationStatus;
      
      // Check if generation is in progress
      if (status && ['QUEUED', 'PROCESSING'].includes(status) && data.generationRequestId) {
        console.log(`Resuming polling for avatar ${doc.id} (status: ${status})`);
        startPollingGenerationStatus(doc.id, data.generationRequestId);
      }
    });
  } catch (error) {
    console.error('Error checking pending generations:', error);
  }
}

async function editAvatar(avatarId) {
  await openAvatarForm(avatarId);
}

/**
 * Video Recording Functions
 */

// Format seconds to MM:SS
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Get training video dimensions for matching resolution
async function getTrainingVideoDimensions() {
  try {
    const trainingVideoUrl = await getActiveTrainingVideoUrl();
    if (!trainingVideoUrl) {
      console.warn('No training video found, using default resolution');
      return null;
    }
    
    // Create video element to get dimensions
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = trainingVideoUrl;
    
    return new Promise((resolve, reject) => {
      video.addEventListener('loadedmetadata', () => {
        resolve({
          width: video.videoWidth,
          height: video.videoHeight
        });
      });
      video.addEventListener('error', () => {
        console.warn('Could not load training video metadata');
        resolve(null);
      });
      // Timeout after 10 seconds
      setTimeout(() => {
        console.warn('Training video metadata load timeout');
        resolve(null);
      }, 10000);
    });
  } catch (error) {
    console.warn('Error getting training video dimensions:', error);
    return null;
  }
}

// Initialize camera for recording
async function initializeCamera() {
  try {
    // Get training video dimensions to match resolution
    const trainingDimensions = await getTrainingVideoDimensions();
    
    let videoConstraints = {
      frameRate: { ideal: 30, max: 30 },
      facingMode: 'user'
    };
    
    if (trainingDimensions) {
      // Match training video resolution
      videoConstraints.width = { ideal: trainingDimensions.width, max: trainingDimensions.width };
      videoConstraints.height = { ideal: trainingDimensions.height, max: trainingDimensions.height };
      console.log(`Setting camera resolution to match training video: ${trainingDimensions.width}x${trainingDimensions.height}`);
    } else {
      // Fallback to default resolution
      videoConstraints.width = { ideal: 1280, max: 1920 };
      videoConstraints.height = { ideal: 720, max: 1080 };
      console.log('Using default camera resolution: 1280x720');
    }
    
    recordingStream = await navigator.mediaDevices.getUserMedia({
      video: videoConstraints,
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 48000 // Higher quality audio to match video quality
      }
    });
    
    if (recordingPreview) {
      recordingPreview.srcObject = recordingStream;
    }
    
    // Log actual resolution obtained
    const videoTrack = recordingStream.getVideoTracks()[0];
    const settings = videoTrack.getSettings();
    console.log(`Camera initialized with resolution: ${settings.width}x${settings.height}`);
    
    return true;
  } catch (error) {
    console.error('Error accessing camera:', error);
    alert('Unable to access camera. Please ensure you have granted camera permissions.');
    return false;
  }
}

// Stop camera stream
function stopCamera() {
  if (recordingStream) {
    recordingStream.getTracks().forEach(track => track.stop());
    recordingStream = null;
  }
  if (recordingPreview) {
    recordingPreview.srcObject = null;
  }
}

// Initialize recording session
async function initializeRecording() {
  if (expressions.length === 0) {
    alert('No expressions found. Please create expressions in the admin panel first.');
    return false;
  }
  
  // Sort expressions by start time to record in order
  recordingExpressions = [...expressions].sort((a, b) => {
    const aStart = timeToSeconds(a.startTime);
    const bStart = timeToSeconds(b.startTime);
    return aStart - bStart;
  });
  
  currentExpressionIndex = 0;
  recordedChunks = [];
  recordedSegments = [];
  
  // Initialize camera
  const cameraReady = await initializeCamera();
  if (!cameraReady) {
    return false;
  }
  
  // Show recording interface
  if (videoRecordingGroup) {
    videoRecordingGroup.style.display = 'block';
  }
  if (videoUrlInputGroup) {
    videoUrlInputGroup.style.display = 'none';
  }
  if (avatarVideoUrl) {
    avatarVideoUrl.removeAttribute('required');
  }
  
  // Show first expression prompt
  showExpressionPrompt();
  
  return true;
}

// Show prompt for current expression
function showExpressionPrompt() {
  if (currentExpressionIndex >= recordingExpressions.length) {
    recordingPrompt.textContent = 'All expressions recorded!';
    return;
  }
  
  const currentExpr = recordingExpressions[currentExpressionIndex];
  const duration = timeToSeconds(currentExpr.endTime) - timeToSeconds(currentExpr.startTime);
  
  // Use instruction if available, otherwise use default format
  if (currentExpr.instruction && currentExpr.instruction.trim()) {
    recordingPrompt.textContent = currentExpr.instruction.trim();
  } else {
    recordingPrompt.textContent = `Record: ${currentExpr.label} (${duration}s)`;
  }
  recordingPrompt.style.borderColor = currentExpr.color || '#999999';
  recordingPrompt.style.display = 'block';
  
  // Update progress
  const progress = ((currentExpressionIndex + 1) / recordingExpressions.length) * 100;
  if (progressFill) {
    progressFill.style.width = `${progress}%`;
  }
  if (progressText) {
    progressText.textContent = `${currentExpressionIndex + 1} / ${recordingExpressions.length} expressions`;
  }
  
  // Reset UI
  if (startRecordingBtn) startRecordingBtn.style.display = 'inline-flex';
  if (pauseRecordingBtn) pauseRecordingBtn.style.display = 'none';
  if (resumeRecordingBtn) resumeRecordingBtn.style.display = 'none';
  if (retryRecordingBtn) retryRecordingBtn.style.display = 'none';
  if (nextExpressionBtn) nextExpressionBtn.style.display = 'none';
  if (finishRecordingBtn) finishRecordingBtn.style.display = 'none';
  if (recordingIndicator) recordingIndicator.style.display = 'none';
  if (recordingTimer) recordingTimer.style.display = 'none';
  
  // Reset recording state for this expression (but keep recordedSegments)
  currentRecordingBlob = null;
  recordedChunks = []; // Only reset current expression's chunks
  isRecording = false;
  isPaused = false;
  if (recordingTimer) recordingTimer.textContent = '00:00';
  if (recordingTimerInterval) {
    clearInterval(recordingTimerInterval);
    recordingTimerInterval = null;
  }
}

// Start recording current expression
function startRecordingExpression() {
  if (!recordingStream) {
    alert('Camera not initialized. Please try again.');
    return;
  }
  
  const currentExpr = recordingExpressions[currentExpressionIndex];
  const duration = timeToSeconds(currentExpr.endTime) - timeToSeconds(currentExpr.startTime);
  
  recordedChunks = [];
  
  try {
    // Get actual video track settings to determine resolution
    const videoTrack = recordingStream.getVideoTracks()[0];
    const settings = videoTrack.getSettings();
    const width = settings.width || 1280;
    const height = settings.height || 720;
    
    // Calculate appropriate bitrate based on resolution
    // Higher resolution needs higher bitrate for quality
    let bitrate = 2000000; // Default 2 Mbps
    if (width >= 1920 && height >= 1080) {
      bitrate = 5000000; // 5 Mbps for 1080p
    } else if (width >= 1280 && height >= 720) {
      bitrate = 3000000; // 3 Mbps for 720p
    } else if (width >= 854 && height >= 480) {
      bitrate = 2000000; // 2 Mbps for 480p
    }
    
    console.log(`Recording with resolution: ${width}x${height}, bitrate: ${(bitrate / 1000000).toFixed(1)} Mbps`);
    
    // Try to find the best supported codec with quality settings
    let options = {
      mimeType: 'video/webm;codecs=vp9,opus',
      videoBitsPerSecond: bitrate
    };
    
    // Check if the browser supports VP9 (better quality)
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      // Fallback to VP8
      options = {
        mimeType: 'video/webm;codecs=vp8,opus',
        videoBitsPerSecond: bitrate
      };
    }
    
    // Final fallback to default
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = {
        mimeType: 'video/webm',
        videoBitsPerSecond: bitrate
      };
    }
    
    console.log(`Using MediaRecorder options:`, options);
    mediaRecorder = new MediaRecorder(recordingStream, options);
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };
    
    mediaRecorder.onstop = () => {
      if (recordedChunks.length > 0) {
        currentRecordingBlob = new Blob(recordedChunks, { type: 'video/webm' });
        console.log(`Recording stopped. Blob created: ${(currentRecordingBlob.size / 1024).toFixed(2)} KB`);
      } else {
        console.warn('Recording stopped but no chunks recorded');
        currentRecordingBlob = null;
      }
    };
    
    mediaRecorder.start();
    isRecording = true;
    isPaused = false;
    recordingStartTime = Date.now();
    
    // Update UI
    if (startRecordingBtn) startRecordingBtn.style.display = 'none';
    if (pauseRecordingBtn) pauseRecordingBtn.style.display = 'inline-flex';
    if (retryRecordingBtn) retryRecordingBtn.style.display = 'inline-flex';
    if (recordingIndicator) recordingIndicator.style.display = 'flex';
    if (recordingTimer) recordingTimer.style.display = 'block';
    if (recordingPrompt) recordingPrompt.style.display = 'block';
    
    // Start timer
    if (recordingTimerInterval) {
      clearInterval(recordingTimerInterval);
    }
    recordingTimerInterval = setInterval(() => {
      if (recordingTimer && isRecording && !isPaused) {
        const elapsed = (Date.now() - recordingStartTime) / 1000;
        recordingTimer.textContent = formatTime(elapsed);
      }
    }, 100);
    
    // Auto-stop after duration (with 2 second buffer)
    setTimeout(() => {
      if (isRecording && !isPaused) {
        stopRecordingExpression();
      }
    }, (duration + 2) * 1000);
    
  } catch (error) {
    console.error('Error starting recording:', error);
    alert('Error starting recording: ' + error.message);
  }
}

// Pause recording
function pauseRecordingExpression() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.pause();
    isPaused = true;
    
    if (pauseRecordingBtn) pauseRecordingBtn.style.display = 'none';
    if (resumeRecordingBtn) resumeRecordingBtn.style.display = 'inline-flex';
    if (recordingIndicator) recordingIndicator.style.display = 'none';
    if (recordingTimer) recordingTimer.style.display = 'block';
  }
}

// Resume recording
function resumeRecordingExpression() {
  if (mediaRecorder && mediaRecorder.state === 'paused') {
    mediaRecorder.resume();
    isPaused = false;
    recordingStartTime = Date.now() - (parseFloat(recordingTimer.textContent.split(':')[0]) * 60 + parseFloat(recordingTimer.textContent.split(':')[1])) * 1000;
    
    if (pauseRecordingBtn) pauseRecordingBtn.style.display = 'inline-flex';
    if (resumeRecordingBtn) resumeRecordingBtn.style.display = 'none';
    if (recordingIndicator) recordingIndicator.style.display = 'flex';
    if (recordingTimer) recordingTimer.style.display = 'block';
  }
}

// Stop recording current expression
function stopRecordingExpression() {
  if (mediaRecorder && (mediaRecorder.state === 'recording' || mediaRecorder.state === 'paused')) {
    mediaRecorder.stop();
    isRecording = false;
    isPaused = false;
    
    if (recordingTimerInterval) {
      clearInterval(recordingTimerInterval);
      recordingTimerInterval = null;
    }
    
    if (pauseRecordingBtn) pauseRecordingBtn.style.display = 'none';
    if (resumeRecordingBtn) resumeRecordingBtn.style.display = 'none';
    if (recordingIndicator) recordingIndicator.style.display = 'none';
    if (recordingTimer) recordingTimer.style.display = 'none';
    
    // Show next/retry buttons
    if (nextExpressionBtn) nextExpressionBtn.style.display = 'inline-flex';
    if (retryRecordingBtn) retryRecordingBtn.style.display = 'inline-flex';
    if (recordingPrompt) recordingPrompt.style.display = 'block';
  }
}

// Retry current expression
function retryCurrentExpression() {
  stopRecordingExpression();
  showExpressionPrompt();
}

// FFmpeg instance (lazy loaded)
let ffmpegInstance = null;
let ffmpegLoading = false;

// Initialize FFmpeg.wasm
async function initFFmpeg() {
  if (ffmpegInstance) {
    return ffmpegInstance;
  }
  
  if (ffmpegLoading) {
    // Wait for existing load
    while (ffmpegLoading) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return ffmpegInstance;
  }
  
  ffmpegLoading = true;
  
  try {
    // Dynamically import FFmpeg.wasm
    const { FFmpeg } = await import('https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js');
    
    ffmpegInstance = new FFmpeg();
    
    // Set up logging
    ffmpegInstance.on('log', ({ message }) => {
      console.log('FFmpeg:', message);
    });
    
    // Load FFmpeg core
    await ffmpegInstance.load({
      coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js',
    });
    
    console.log('FFmpeg.wasm loaded successfully');
    ffmpegLoading = false;
    return ffmpegInstance;
  } catch (error) {
    console.error('Error loading FFmpeg.wasm:', error);
    console.warn('Falling back to canvas method');
    ffmpegLoading = false;
    return null;
  }
}

// Merge multiple WebM video segments using Transloadit API (fastest and best quality)
// Falls back to FFmpeg.wasm, then canvas method if Transloadit is not available
async function mergeWebMSegments(blobs) {
  return new Promise(async (resolve, reject) => {
    if (!blobs || blobs.length === 0) {
      reject(new Error('No video segments to merge'));
      return;
    }
    
    if (blobs.length === 1) {
      // If only one segment, return it directly
      resolve(blobs[0]);
      return;
    }
    
    console.log(`Starting merge of ${blobs.length} segments...`);
    
    // Try server-side FFmpeg first (fastest and best quality)
    try {
      console.log('Attempting to merge using server-side FFmpeg...');
      
      // Use FormData to send files directly (much faster than base64)
      const formData = new FormData();
      blobs.forEach((blob, index) => {
        formData.append('videos', blob, `segment_${index}.webm`);
      });

      // Call backend API to merge videos using FFmpeg
      console.log('Sending request to /api/merge-videos with', blobs.length, 'video segments');
      const response = await fetch('/api/merge-videos', {
        method: 'POST',
        body: formData
        // Don't set Content-Type header - browser will set it with boundary
      });

      console.log('Response status:', response.status, response.statusText);
      
      if (response.ok) {
        const result = await response.json();
        console.log('FFmpeg merge API response:', result);
        if (result.success && result.videoUrl) {
          console.log('FFmpeg merge successful!');
          
          // Handle base64 data URL response
          if (result.videoUrl.startsWith('data:video/')) {
            // Convert data URL to blob
            const response = await fetch(result.videoUrl);
            const videoBlob = await response.blob();
            console.log(`FFmpeg merged video size: ${(videoBlob.size / 1024 / 1024).toFixed(2)} MB`);
            resolve(videoBlob);
            return;
          } else {
            // Fallback: download from URL if provided
            const videoResponse = await fetch(result.videoUrl);
            if (!videoResponse.ok) {
              throw new Error(`Failed to download merged video: ${videoResponse.statusText}`);
            }
            const videoBlob = await videoResponse.blob();
            console.log(`FFmpeg merged video size: ${(videoBlob.size / 1024 / 1024).toFixed(2)} MB`);
            resolve(videoBlob);
            return;
          }
        } else {
          throw new Error('FFmpeg merge response missing success or videoUrl');
        }
      } else {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { error: errorText || `HTTP ${response.status}: ${response.statusText}` };
        }
        console.error('FFmpeg merge API error response:', errorData);
        throw new Error(errorData.error || errorData.details || 'FFmpeg merge API request failed');
      }
    } catch (ffmpegError) {
      console.error('Server-side FFmpeg merge failed:', ffmpegError);
      console.error('Error details:', {
        name: ffmpegError.name,
        message: ffmpegError.message,
        stack: ffmpegError.stack
      });
      console.warn('Falling back to FFmpeg.wasm...');
    }
    
    // Fallback to FFmpeg.wasm
    try {
      const ffmpeg = await initFFmpeg();
      
      if (ffmpeg) {
        // Use FFmpeg.wasm for professional-quality merging
        const { fetchFile } = await import('https://unpkg.com/@ffmpeg/util@0.12.1/dist/esm/index.js');
        
        // Write input files
        for (let i = 0; i < blobs.length; i++) {
          const arrayBuffer = await blobs[i].arrayBuffer();
          await ffmpeg.writeFile(`input${i}.webm`, new Uint8Array(arrayBuffer));
        }
        
        // Create concat file for FFmpeg
        const concatContent = blobs.map((_, i) => `file 'input${i}.webm'`).join('\n');
        await ffmpeg.writeFile('concat.txt', concatContent);
        
        // Merge videos using concat demuxer (fastest method, no re-encoding)
        await ffmpeg.exec([
          '-f', 'concat',
          '-safe', '0',
          '-i', 'concat.txt',
          '-c', 'copy',  // Copy streams without re-encoding (fast!)
          'output.webm'
        ]);
        
        // Read the output
        const data = await ffmpeg.readFile('output.webm');
        
        // Clean up
        for (let i = 0; i < blobs.length; i++) {
          await ffmpeg.deleteFile(`input${i}.webm`);
        }
        await ffmpeg.deleteFile('concat.txt');
        await ffmpeg.deleteFile('output.webm');
        
        const mergedBlob = new Blob([data.buffer], { type: 'video/webm' });
        console.log(`FFmpeg merge complete! Size: ${(mergedBlob.size / 1024 / 1024).toFixed(2)} MB`);
        resolve(mergedBlob);
        return;
      }
    } catch (ffmpegError) {
      console.warn('FFmpeg.wasm failed, falling back to canvas method:', ffmpegError);
    }
    
    // Fallback to canvas method if FFmpeg is not available or fails
    console.log('Using canvas fallback method...');
    
    try {
      // Create video element to play segments
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      
      // Get training video dimensions for canvas size
      const trainingDimensions = await getTrainingVideoDimensions();
      let canvasWidth = 1280;
      let canvasHeight = 720;
      
      if (trainingDimensions) {
        canvasWidth = trainingDimensions.width;
        canvasHeight = trainingDimensions.height;
        console.log(`Using training video dimensions for canvas: ${canvasWidth}x${canvasHeight}`);
      }
      
      // Create canvas to capture video frames
      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext('2d');
      
      // Calculate bitrate based on resolution
      let bitrate = 2000000; // Default 2 Mbps
      if (canvasWidth >= 1920 && canvasHeight >= 1080) {
        bitrate = 5000000; // 5 Mbps for 1080p
      } else if (canvasWidth >= 1280 && canvasHeight >= 720) {
        bitrate = 3000000; // 3 Mbps for 720p
      }
      
      // Create MediaRecorder to record the merged video
      const stream = canvas.captureStream(30); // 30 fps
      let recorderOptions = {
        mimeType: 'video/webm;codecs=vp9,opus',
        videoBitsPerSecond: bitrate
      };
      
      if (!MediaRecorder.isTypeSupported(recorderOptions.mimeType)) {
        recorderOptions = {
          mimeType: 'video/webm;codecs=vp8,opus',
          videoBitsPerSecond: bitrate
        };
      }
      
      if (!MediaRecorder.isTypeSupported(recorderOptions.mimeType)) {
        recorderOptions = {
          mimeType: 'video/webm',
          videoBitsPerSecond: bitrate
        };
      }
      
      console.log(`Canvas fallback using: ${canvasWidth}x${canvasHeight}, bitrate: ${(bitrate / 1000000).toFixed(1)} Mbps`);
      const mergedRecorder = new MediaRecorder(stream, recorderOptions);
      
      const mergedChunks = [];
      
      mergedRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          mergedChunks.push(e.data);
          console.log(`Received chunk: ${(e.data.size / 1024).toFixed(2)} KB`);
        }
      };
      
      let currentSegmentIndex = 0;
      let isRecording = false;
      let allSegmentsProcessed = false;
      let animationFrameId = null;
      
      // Function to play next segment
      const playNextSegment = () => {
        if (currentSegmentIndex >= blobs.length) {
          // All segments played, wait a bit then stop recording
          console.log('All segments processed, stopping recording...');
          allSegmentsProcessed = true;
          // Wait a bit to ensure last frame is captured
          setTimeout(() => {
            if (isRecording) {
              console.log('Stopping MediaRecorder...');
              mergedRecorder.stop();
              isRecording = false;
            }
          }, 500);
          return;
        }
        
        const blob = blobs[currentSegmentIndex];
        console.log(`Loading segment ${currentSegmentIndex + 1}/${blobs.length} (${(blob.size / 1024).toFixed(2)} KB)...`);
        const url = URL.createObjectURL(blob);
        video.src = url;
        
        // Remove old event listeners
        const oldOnLoadedMetadata = video.onloadedmetadata;
        const oldOnEnded = video.onended;
        const oldOnError = video.onerror;
        
        video.onloadedmetadata = () => {
          console.log(`Segment ${currentSegmentIndex + 1} loaded, dimensions: ${video.videoWidth}x${video.videoHeight}`);
          // Canvas size is already set to training video dimensions, but ensure it matches
          // Scale video to fit canvas while maintaining aspect ratio
          const videoAspect = video.videoWidth / video.videoHeight;
          const canvasAspect = canvas.width / canvas.height;
          
          let drawWidth = canvas.width;
          let drawHeight = canvas.height;
          let drawX = 0;
          let drawY = 0;
          
          if (videoAspect > canvasAspect) {
            // Video is wider - fit to width
            drawHeight = canvas.width / videoAspect;
            drawY = (canvas.height - drawHeight) / 2;
          } else {
            // Video is taller - fit to height
            drawWidth = canvas.height * videoAspect;
            drawX = (canvas.width - drawWidth) / 2;
          }
          
          // Store draw dimensions for rendering
          video._drawWidth = drawWidth;
          video._drawHeight = drawHeight;
          video._drawX = drawX;
          video._drawY = drawY;
          
          // Start recording if not already started
          if (!isRecording) {
            console.log('Starting MediaRecorder...');
            mergedRecorder.start(100); // Request data every 100ms
            isRecording = true;
          }
          
          // Start playing
          video.play().then(() => {
            console.log(`Segment ${currentSegmentIndex + 1} started playing`);
          }).catch(reject);
        };
        
        video.onended = () => {
          console.log(`Segment ${currentSegmentIndex + 1} ended`);
          // Clean up this segment's URL
          URL.revokeObjectURL(url);
          
          // Move to next segment
          currentSegmentIndex++;
          // Small delay before loading next segment to ensure last frame is captured
          setTimeout(() => {
            playNextSegment();
          }, 100);
        };
        
        video.onerror = (e) => {
          console.error(`Error playing segment ${currentSegmentIndex + 1}:`, e);
          URL.revokeObjectURL(url);
          reject(new Error(`Error playing segment ${currentSegmentIndex + 1}`));
        };
        
        video.load();
      };
      
      // Draw video frames to canvas while recording
      const drawFrame = () => {
        // Continue drawing as long as we're recording or have more segments to process
        if (isRecording || !allSegmentsProcessed) {
          // Draw frame if video is ready and playing
          if (video.readyState >= 2 && !video.ended && isRecording) {
            // Canvas size is fixed to training video dimensions - don't resize
            // Use stored draw dimensions if available (from training video dimensions)
            if (video._drawWidth && video._drawHeight !== undefined) {
              // Clear canvas first
              ctx.fillStyle = '#000000';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              // Draw video with proper scaling to match training video dimensions
              ctx.drawImage(video, video._drawX || 0, video._drawY || 0, video._drawWidth, video._drawHeight);
            } else {
              // Fallback: draw video at its native size
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            }
          }
          // Continue animation loop
          animationFrameId = requestAnimationFrame(drawFrame);
        }
      };
      
      mergedRecorder.onstop = () => {
        console.log(`MediaRecorder stopped. Total chunks: ${mergedChunks.length}`);
        const mergedBlob = new Blob(mergedChunks, { type: 'video/webm' });
        console.log(`Merged video size: ${(mergedBlob.size / 1024 / 1024).toFixed(2)} MB`);
        // Clean up
        video.src = '';
        stream.getTracks().forEach(track => track.stop());
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }
        resolve(mergedBlob);
      };
      
      mergedRecorder.onerror = (e) => {
        console.error('MediaRecorder error:', e);
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }
        reject(new Error('Error recording merged video'));
      };
      
      // Start the process
      drawFrame();
      playNextSegment();
      
    } catch (error) {
      console.error('Error merging video segments:', error);
      reject(error);
    }
  });
}

// Move to next expression
async function nextExpression() {
  // Wait a bit for the onstop callback to complete and blob to be ready
  await new Promise(resolve => setTimeout(resolve, 100));
  
  if (currentRecordingBlob && currentExpressionIndex < recordingExpressions.length) {
    // Store the recorded segment in recordedSegments array
    const currentExpr = recordingExpressions[currentExpressionIndex];
    if (currentExpr) {
      recordedSegments.push({
        blob: currentRecordingBlob,
        expression: currentExpr.label,
        startTime: currentExpr.startTime,
        endTime: currentExpr.endTime
      });
      console.log(`Stored segment for ${currentExpr.label} (${(currentRecordingBlob.size / 1024).toFixed(2)} KB). Total segments: ${recordedSegments.length}`);
    }
  } else {
    console.warn(`Cannot store segment: currentRecordingBlob=${!!currentRecordingBlob}, currentExpressionIndex=${currentExpressionIndex}, recordingExpressions.length=${recordingExpressions.length}`);
  }
  
  currentExpressionIndex++;
  
  if (currentExpressionIndex >= recordingExpressions.length) {
    // All expressions recorded
    finishRecording();
  } else {
    showExpressionPrompt();
  }
}

// Finish recording and combine segments
async function finishRecording() {
  stopRecordingExpression();
  
  // Wait for the onstop callback to complete
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // If there's a current recording that hasn't been stored yet, store it
  if (currentRecordingBlob && currentExpressionIndex < recordingExpressions.length) {
    const currentExpr = recordingExpressions[currentExpressionIndex];
    if (currentExpr) {
      recordedSegments.push({
        blob: currentRecordingBlob,
        expression: currentExpr.label,
        startTime: currentExpr.startTime,
        endTime: currentExpr.endTime
      });
      console.log(`Stored final segment for ${currentExpr.label} (${(currentRecordingBlob.size / 1024).toFixed(2)} KB). Total segments: ${recordedSegments.length}`);
    }
  }
  
    console.log(`Total recorded segments: ${recordedSegments.length}`);
    
    // Calculate total duration of recorded segments
    let totalRecordedDuration = 0;
    recordedSegments.forEach((seg, idx) => {
      const duration = timeToSeconds(seg.endTime) - timeToSeconds(seg.startTime);
      totalRecordedDuration += duration;
      console.log(`  Segment ${idx + 1}: ${seg.expression} - ${(seg.blob.size / 1024).toFixed(2)} KB - ${duration.toFixed(1)}s (${seg.startTime} to ${seg.endTime})`);
    });
    
    console.log(`Total recorded duration: ${totalRecordedDuration.toFixed(1)} seconds`);
    console.log(`This should match your training video duration for AI generation.`);
  
  if (recordedSegments.length === 0) {
    alert('No recordings found. Please record at least one expression.');
    return;
  }
  
  recordingPrompt.textContent = 'Processing video...';
  if (finishRecordingBtn) finishRecordingBtn.disabled = true;
  
  try {
    console.log(`Combining ${recordedSegments.length} recorded segments into one video...`);
    
    // Try server-side FFmpeg first (fastest), then FFmpeg.wasm, then canvas fallback
    recordingPrompt.textContent = 'Merging video segments with FFmpeg...';
    const finalBlob = await mergeWebMSegments(recordedSegments.map(seg => seg.blob));
    
    if (!finalBlob) {
      alert('Failed to merge video segments. Please try recording again.');
      if (finishRecordingBtn) finishRecordingBtn.disabled = false;
      return;
    }
    
    console.log(`Combined video size: ${(finalBlob.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Individual segment sizes: ${recordedSegments.map(s => (s.blob.size / 1024).toFixed(2) + ' KB').join(', ')}`);
    
    if (!finalBlob || finalBlob.size === 0) {
      alert('No video data to upload. Please record at least one expression.');
      if (finishRecordingBtn) finishRecordingBtn.disabled = false;
      return;
    }
    
    // Upload to Firebase Storage
    if (!currentUser || !storage) {
      alert('Please sign in to upload videos');
      if (finishRecordingBtn) finishRecordingBtn.disabled = false;
      return;
    }
    
    recordingPrompt.textContent = 'Uploading video to storage...';
    
    // Generate a unique filename
    const timestamp = Date.now();
    const filename = `avatars/${currentUser.uid}/${timestamp}-avatar-video.webm`;
    const storageRef = storage.ref(filename);
    
    // Upload the video with metadata
    const metadata = {
      contentType: 'video/webm',
      customMetadata: {
        uploadedBy: currentUser.uid,
        uploadedAt: new Date().toISOString()
      }
    };
    
    const uploadTask = storageRef.put(finalBlob, metadata);
    
    // Monitor upload progress
    uploadTask.on('state_changed', 
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        recordingPrompt.textContent = `Uploading video... ${Math.round(progress)}%`;
      },
      (error) => {
        console.error('Error uploading video:', error);
        alert('Error uploading video: ' + error.message);
        if (finishRecordingBtn) finishRecordingBtn.disabled = false;
      },
      async () => {
        // Upload complete - get download URL
        try {
          const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
          
          // Set the video URL in the form
          if (avatarVideoUrl) {
            avatarVideoUrl.value = downloadURL;
          }
          
          // Mark as recorded video for credit deduction
          isRecordedVideo = true;
          
          // Show preview
          updateVideoPreview(downloadURL);
          
          // Hide recording interface
          if (videoRecordingGroup) {
            videoRecordingGroup.style.display = 'none';
          }
          if (videoUrlInputGroup) {
            videoUrlInputGroup.style.display = 'block';
          }
          if (avatarVideoUrl) {
            avatarVideoUrl.setAttribute('required', 'required');
          }
          
          // Stop camera
          stopCamera();
          
          recordingPrompt.textContent = 'Recording complete!';
          alert('Video recorded and uploaded successfully! You can now save the avatar.');
          
        } catch (error) {
          console.error('Error getting download URL:', error);
          alert('Error getting video URL: ' + error.message);
        } finally {
          if (finishRecordingBtn) finishRecordingBtn.disabled = false;
        }
      }
    );
    
  } catch (error) {
    console.error('Error processing video:', error);
    alert('Error processing video: ' + error.message);
    if (finishRecordingBtn) finishRecordingBtn.disabled = false;
  }
}

// Stop all recording and cleanup
function stopRecording() {
  stopRecordingExpression();
  stopCamera();
}

// Cleanup recording state
function cleanupRecording() {
  stopRecording();
  recordingExpressions = [];
  currentExpressionIndex = 0;
  recordedChunks = [];
  recordedSegments = [];
  currentRecordingBlob = null;
  isRecording = false;
  isPaused = false;
  if (recordingTimerInterval) {
    clearInterval(recordingTimerInterval);
    recordingTimerInterval = null;
  }
}

async function useAvatar(avatarId) {
  // Set the avatar ID first
  currentAvatarId = avatarId;
  
  if (!currentUser || !db) {
    alert('Please sign in to use an avatar');
    return;
  }
  
  // Check if a session already exists for this user + avatar combination
  try {
    // First try with orderBy (requires composite index)
    let existingSessions;
    try {
      existingSessions = await db.collection('chatSessions')
        .where('userId', '==', currentUser.uid)
        .where('avatarId', '==', avatarId)
        .orderBy('updatedAt', 'desc')
        .limit(1)
        .get();
    } catch (indexError) {
      // If index doesn't exist yet, query without orderBy and sort in memory
      console.warn('Composite index not found, querying without orderBy:', indexError);
      const allSessions = await db.collection('chatSessions')
        .where('userId', '==', currentUser.uid)
        .where('avatarId', '==', avatarId)
        .get();
      
      // Sort by updatedAt in memory
      const sortedSessions = allSessions.docs.sort((a, b) => {
        const aTime = a.data().updatedAt?.toMillis?.() || 0;
        const bTime = b.data().updatedAt?.toMillis?.() || 0;
        return bTime - aTime; // Descending
      });
      
      existingSessions = {
        empty: sortedSessions.length === 0,
        docs: sortedSessions.slice(0, 1)
      };
    }
    
    if (!existingSessions.empty) {
      // Load existing session for this avatar
      const existingSession = existingSessions.docs[0];
      currentSessionId = existingSession.id;
      await loadSession(existingSession.id);
    } else {
      // Create a new session for this avatar
      await createNewSession();
      
      // Load the avatar video
      await loadAvatarVideo(avatarId);
      
      // Switch to chat page
      switchPage('chat');
    }
  } catch (error) {
    console.error('Error finding/creating session for avatar:', error);
    // Fallback: create new session
    await createNewSession();
    await loadAvatarVideo(avatarId);
    switchPage('chat');
  }
}

async function loadAvatarVideo(avatarId) {
  const avatar = avatars.find(a => a.id === avatarId);
  if (!avatar || !reactionVideoEl) {
    console.error('loadAvatarVideo: Avatar or video element not found');
    return;
  }
  
  // Update chat header with avatar name
  const chatAvatarNameEl = document.getElementById('chatAvatarName');
  if (chatAvatarNameEl) {
    chatAvatarNameEl.textContent = avatar.name || 'Unknown';
  }
  
  // Update chat container label with avatar name
  const chatLabelNameEl = document.getElementById('chatLabelName');
  if (chatLabelNameEl) {
    chatLabelNameEl.textContent = avatar.name || 'Unknown';
  }
  
  // Ensure expressions are loaded before trying to play
  if (expressions.length === 0 && Object.keys(EXPRESSION_SEGMENTS).length === 0) {
    console.log('Expressions not loaded yet, loading now...');
    await loadExpressions();
  }
  
  // Clear any existing event listeners and state before loading new video
  // Remove all timeupdate listeners by cloning the element (cleanest way)
  const oldVideo = reactionVideoEl;
  const newVideo = oldVideo.cloneNode(true);
  // Preserve important attributes
  newVideo.setAttribute('autoplay', '');
  newVideo.setAttribute('muted', '');
  newVideo.setAttribute('playsinline', '');
  oldVideo.parentNode.replaceChild(newVideo, oldVideo);
  const videoEl = document.getElementById('reactionVideo');
  
  // Update video source
  console.log('Loading avatar video from URL:', avatar.videoUrl);
  videoEl.src = avatar.videoUrl;
  
  // Clear any existing error state
  videoEl.removeAttribute('poster');
  
  // Update global reference
  reactionVideoEl = videoEl;
  
  // Add error handling
  const errorHandler = (e) => {
    console.error('Video loading error:', e);
    console.error('Video error details:', {
      code: reactionVideoEl.error?.code,
      message: reactionVideoEl.error?.message,
      src: reactionVideoEl.src
    });
    if (segmentInfoEl) {
      segmentInfoEl.textContent = `Error loading video. Please check the video URL.`;
    }
  };
  
  // Add error handler
  videoEl.addEventListener('error', errorHandler, { once: true });
  
  // Function to start playing the video
  const startVideo = () => {
    if (!videoEl || !videoEl.duration || videoEl.duration <= 0) {
      console.warn('Video not ready yet, duration:', videoEl?.duration);
      return;
    }
    
    console.log('Video loaded successfully, duration:', videoEl.duration);
    console.log('Expressions available:', Object.keys(EXPRESSION_SEGMENTS));
    
    // Ensure expressions are loaded before trying to update
    if (Object.keys(EXPRESSION_SEGMENTS).length === 0) {
      console.warn('No expressions loaded, loading now...');
      loadExpressions().then(() => {
        console.log('Expressions loaded, now starting video with Neutral expression');
        updateExpression({ label: 'Neutral' });
      });
    } else {
      console.log('Starting video with Neutral expression');
      updateExpression({ label: 'Neutral' });
    }
    
    const playPromise = videoEl.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log('Video playback started successfully');
        })
        .catch((err) => {
          console.error('Video play error:', err);
          // If autoplay is blocked, user can manually play
          if (err.name !== 'NotAllowedError' && err.name !== 'AbortError') {
            if (segmentInfoEl) {
              segmentInfoEl.textContent = `Video play error: ${err.message}`;
            }
          }
        });
    }
  };
  
  // Wait for video to load with multiple event listeners
  const onLoaded = () => {
    if (videoEl && videoEl.duration > 0) {
      startVideo();
    }
  };
  
  // Add listeners for various load events
  videoEl.addEventListener('loadedmetadata', onLoaded, { once: true });
  videoEl.addEventListener('canplay', onLoaded, { once: true });
  videoEl.addEventListener('loadeddata', onLoaded, { once: true });
  videoEl.addEventListener('canplaythrough', onLoaded, { once: true });
  
  // Try to load the video
  videoEl.load();
  
  // Fallback: try to start after a delay if events don't fire
  setTimeout(() => {
    if (videoEl && videoEl.readyState >= 2 && videoEl.duration > 0) {
      startVideo();
    } else {
      console.warn('Video not ready after timeout. ReadyState:', videoEl?.readyState, 'Duration:', videoEl?.duration);
    }
  }, 2000);
}

async function deleteAvatar(avatarId) {
  if (!confirm('Are you sure you want to delete this avatar?')) return;
  
  if (!currentUser || !db) return;
  
  try {
    const avatar = avatars.find(a => a.id === avatarId);
    if (!avatar) return;
    
    // Allow deletion if user created the avatar OR if user is admin
    const isOwner = avatar.createdBy === currentUser.uid || avatar.userId === currentUser.uid;
    if (isOwner || isAdmin) {
      await db.collection('avatars').doc(avatarId).delete();
      await loadAvatars();
      // Also reload admin avatars if in admin view
      if (isAdmin && adminAvatarsList) {
        await loadAdminAvatars();
      }
    } else {
      alert('You can only delete avatars you created');
    }
  } catch (error) {
    console.error('Error deleting avatar:', error);
    alert('Error deleting avatar: ' + error.message);
  }
}

function switchPage(page) {
  // Update page views (no tabs anymore - chat is a page that appears when avatar is selected)
  if (page === 'admin') {
    // Hide all other pages
    if (chatPage) chatPage.style.display = 'none';
    if (avatarsPage) avatarsPage.style.display = 'none';
    if (adminPage) {
      adminPage.style.display = 'flex';
      adminPage.classList.add('active');
    }
    // Remove container padding for admin page
    if (mainContainer) mainContainer.classList.add('admin-active');
  } else if (chatPage && avatarsPage) {
    // Hide admin page
    if (adminPage) {
      adminPage.style.display = 'none';
      adminPage.classList.remove('active');
    }
    // Restore container padding when leaving admin page
    if (mainContainer) mainContainer.classList.remove('admin-active');
    
    if (page === 'chat') {
      avatarsPage.style.display = 'none';
      avatarsPage.classList.remove('active');
      chatPage.style.display = 'flex';
      chatPage.classList.add('active');
    } else {
      chatPage.style.display = 'none';
      chatPage.classList.remove('active');
      avatarsPage.style.display = 'flex';
      avatarsPage.classList.add('active');
    }
  }
}

/**
 * Admin Functions
 */
async function checkAdminStatus() {
  if (!currentUser || !db) {
    isAdmin = false;
    if (adminBtn) adminBtn.style.display = 'none';
    return false;
  }
  
  try {
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      isAdmin = userData.isAdmin === true;
      // Load user credits
      userCredits = userData.credits || 0;
      updateCreditsDisplay();
    } else {
      // User doesn't exist in users collection yet - create it
      await db.collection('users').doc(currentUser.uid).set({
        email: currentUser.email,
        isAdmin: false,
        credits: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      isAdmin = false;
      userCredits = 0;
      updateCreditsDisplay();
    }
    
    // Show/hide admin button
    if (adminBtn) {
      adminBtn.style.display = isAdmin ? 'inline-flex' : 'none';
    }
    
    return isAdmin;
  } catch (error) {
    console.error('Error checking admin status:', error);
    isAdmin = false;
    if (adminBtn) adminBtn.style.display = 'none';
    return false;
  }
}

async function loadExpressions() {
  if (!db) return;
  
  try {
    const querySnapshot = await db.collection('expressions')
      .orderBy('label', 'asc')
      .get();
    
    expressions = [];
    EXPRESSION_SEGMENTS = {};
    EXPRESSION_COLORS = {};
    
    querySnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      expressions.push({ id: docSnapshot.id, ...data });
      
      // Build expression segments and colors objects
      EXPRESSION_SEGMENTS[data.label] = {
        start: data.startTime,
        end: data.endTime
      };
      EXPRESSION_COLORS[data.label] = data.color || '#999999';
      console.log('Loaded expression:', data.label, 'from', data.startTime, 'to', data.endTime);
    });
    
    console.log('Total expressions loaded:', expressions.length);
    console.log('EXPRESSION_SEGMENTS:', EXPRESSION_SEGMENTS);
    
    // If no expressions in DB, log a warning but don't use defaults
    if (expressions.length === 0) {
      console.warn('No expressions found in database. Please create expressions in the admin panel.');
      EXPRESSION_SEGMENTS = {};
      EXPRESSION_COLORS = {};
    }
  } catch (error) {
    console.error('Error loading expressions from database:', error);
    // Don't fallback to defaults - require database expressions
    EXPRESSION_SEGMENTS = {};
    EXPRESSION_COLORS = {};
  }
}

async function loadUsers() {
  if (!isAdmin || !db) return;
  
  try {
    // Fetch all users and sort in JavaScript to avoid list query permission issues
    const querySnapshot = await db.collection('users').get();
    
    if (!usersTableBody) return;
    usersTableBody.innerHTML = '';
    
    if (querySnapshot.empty) {
      usersTableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-secondary);">
            No users found
          </td>
        </tr>
      `;
      return;
    }
    
    // Convert to array and sort by createdAt (newest first)
    const users = [];
    querySnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      users.push({
        id: docSnapshot.id,
        data: data,
        createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : (data.createdAt?.toDate ? data.createdAt.toDate().getTime() : (data.createdAt || 0))
      });
    });
    
    // Sort by createdAt descending (newest first)
    users.sort((a, b) => b.createdAt - a.createdAt);
    
    // Render sorted users
    users.forEach((user) => {
      const data = user.data;
      const row = document.createElement('tr');
      
      const date = data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt?.toMillis ? new Date(data.createdAt.toMillis()) : new Date());
      const dateStr = date.toLocaleDateString();
      
      const credits = data.credits || 0;
      
      row.innerHTML = `
        <td>${data.email || 'N/A'}</td>
        <td style="font-size: 11px; color: var(--text-secondary); font-family: monospace;">${user.id}</td>
        <td>
          <div class="admin-toggle">
            <div class="toggle-switch ${data.isAdmin ? 'active' : ''}" data-user-id="${user.id}" data-is-admin="${data.isAdmin || false}"></div>
            <span>${data.isAdmin ? 'Yes' : 'No'}</span>
          </div>
        </td>
        <td>
          <strong style="color: var(--accent-primary);">${credits.toLocaleString()}</strong>
          <i class="fas fa-coins" style="color: var(--accent-primary); margin-left: 4px;"></i>
        </td>
        <td>${dateStr}</td>
        <td>
          <button class="admin-action-btn" onclick="toggleUserAdmin('${user.id}', ${!data.isAdmin})">
            ${data.isAdmin ? 'Remove Admin' : 'Make Admin'}
          </button>
          <button class="admin-action-btn" onclick="awardCreditsToUser('${user.id}')" style="margin-left: 8px; background: var(--success);">
            <i class="fas fa-gift"></i> Award Credits
          </button>
        </td>
      `;
      
      // Add toggle switch listener
      const toggleSwitch = row.querySelector('.toggle-switch');
      if (toggleSwitch) {
        toggleSwitch.addEventListener('click', () => {
          toggleUserAdmin(user.id, !data.isAdmin);
        });
      }
      
      usersTableBody.appendChild(row);
    });
  } catch (error) {
    console.error('Error loading users:', error);
    usersTableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 40px; color: var(--error);">
          Error loading users: ${error.message}
        </td>
      </tr>
    `;
  }
}

async function toggleUserAdmin(userId, makeAdmin) {
  if (!isAdmin || !db) {
    alert('You do not have permission to perform this action');
    return;
  }
  
  if (userId === currentUser.uid && !makeAdmin) {
    if (!confirm('Are you sure you want to remove your own admin status? You will lose access to the admin panel.')) {
      return;
    }
  }
  
  try {
    await db.collection('users').doc(userId).update({
      isAdmin: makeAdmin,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    await loadUsers();
    
    // If user removed their own admin status, reload page
    if (userId === currentUser.uid && !makeAdmin) {
      window.location.reload();
    }
  } catch (error) {
    console.error('Error toggling admin status:', error);
    alert('Error updating user: ' + error.message);
  }
}

// Award credits to a user (admin function)
async function awardCreditsToUser(userId) {
  if (!isAdmin || !db) {
    alert('You do not have permission to perform this action');
    return;
  }
  
  const creditAmount = 100;
  
  if (!confirm(`Award ${creditAmount.toLocaleString()} credits to this user?`)) {
    return;
  }
  
  try {
    // Get current user data
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      alert('User not found');
      return;
    }
    
    const userData = userDoc.data();
    const currentCredits = userData.credits || 0;
    const newCredits = currentCredits + creditAmount;
    
    // Update user credits
    await db.collection('users').doc(userId).update({
      credits: newCredits,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Record transaction
    await db.collection('creditTransactions').add({
      userId: userId,
      type: 'admin_award',
      amount: creditAmount,
      reason: `Admin awarded credits`,
      balanceBefore: currentCredits,
      balanceAfter: newCredits,
      metadata: {
        awardedBy: currentUser.uid,
        awardedByEmail: currentUser.email
      },
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Refresh user list to show updated credits
    await loadUsers();
    
    alert(`Successfully awarded ${creditAmount.toLocaleString()} credits to ${userData.email || 'user'}. New balance: ${newCredits.toLocaleString()} credits.`);
  } catch (error) {
    console.error('Error awarding credits:', error);
    alert('Error awarding credits: ' + error.message);
  }
}

async function loadAdminAvatars() {
  if (!isAdmin || !db) return;
  
  try {
    const querySnapshot = await db.collection('avatars')
      .orderBy('createdAt', 'desc')
      .get();
    
    adminAvatarsList.innerHTML = '';
    
    if (querySnapshot.empty) {
      adminAvatarsList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-user-circle"></i>
          <div>No avatars found</div>
        </div>
      `;
      return;
    }
    
    querySnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      
      const avatarCard = document.createElement('div');
      avatarCard.className = 'avatar-card';
      
      avatarCard.innerHTML = `
        <div class="avatar-card-header">
          <div>
            <div class="avatar-name">${data.name}</div>
            <div class="avatar-description">${data.description || 'No description'}</div>
            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 8px;">
              Created by: ${data.createdBy || 'Unknown'}
            </div>
          </div>
        </div>
        <video class="avatar-video-preview" muted>
          <source src="${data.videoUrl}" type="video/mp4" />
        </video>
        <div class="avatar-actions">
          <button class="avatar-btn" data-action="edit" data-id="${docSnapshot.id}">
            <i class="fas fa-edit"></i> Edit
          </button>
          <button class="avatar-btn delete" data-action="delete" data-id="${docSnapshot.id}">
            <i class="fas fa-trash"></i> Delete
          </button>
        </div>
      `;
      
      // Add event listeners
      avatarCard.querySelector('[data-action="edit"]').addEventListener('click', () => {
        editAvatar(docSnapshot.id);
      });
      
      avatarCard.querySelector('[data-action="delete"]').addEventListener('click', () => {
        deleteAvatar(docSnapshot.id);
      });
      
      adminAvatarsList.appendChild(avatarCard);
    });
  } catch (error) {
    console.error('Error loading admin avatars:', error);
    adminAvatarsList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-exclamation-triangle"></i>
        <div>Error loading avatars: ${error.message}</div>
      </div>
    `;
  }
}

async function loadAdminExpressions() {
  if (!isAdmin || !db) return;
  
  try {
    await loadExpressions(); // Refresh expressions
    
    expressionsTableBody.innerHTML = '';
    
    if (expressions.length === 0) {
      expressionsTableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-secondary);">
            No expressions found. Create your first expression!
          </td>
        </tr>
      `;
      return;
    }
    
    expressions.forEach((expr) => {
      const row = document.createElement('tr');
      
      row.innerHTML = `
        <td><strong>${expr.label}</strong></td>
        <td>${expr.startTime}</td>
        <td>${expr.endTime}</td>
        <td>
          <div style="display: inline-flex; align-items: center; gap: 8px;">
            <div style="width: 24px; height: 24px; background: ${expr.color}; border-radius: 4px; border: 1px solid var(--border-color);"></div>
            <span>${expr.color}</span>
          </div>
        </td>
        <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${expr.instruction || ''}">
          ${expr.instruction || '<span style="color: var(--text-secondary); font-style: italic;">No instruction</span>'}
        </td>
        <td>
          <button class="admin-action-btn" onclick="openExpressionForm('${expr.id}')">
            <i class="fas fa-edit"></i> Edit
          </button>
          <button class="admin-action-btn danger" onclick="deleteExpression('${expr.id}')">
            <i class="fas fa-trash"></i> Delete
          </button>
        </td>
      `;
      
      expressionsTableBody.appendChild(row);
    });
  } catch (error) {
    console.error('Error loading expressions:', error);
    expressionsTableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 40px; color: var(--error);">
          Error loading expressions: ${error.message}
        </td>
      </tr>
    `;
  }
}

function openExpressionForm(expressionId = null) {
  editingExpressionId = expressionId;
  
  if (expressionId) {
    const expression = expressions.find(e => e.id === expressionId);
    if (expression) {
      expressionFormTitle.textContent = 'Edit Expression';
      expressionLabelInput.value = expression.label;
      expressionStart.value = expression.startTime;
      expressionEnd.value = expression.endTime;
      expressionColor.value = expression.color || '#999999';
      expressionInstruction.value = expression.instruction || '';
    }
  } else {
    expressionFormTitle.textContent = 'Create Expression';
    expressionLabelInput.value = '';
    expressionStart.value = '';
    expressionEnd.value = '';
    expressionColor.value = '#999999';
    expressionInstruction.value = '';
  }
  
  expressionFormModal.classList.add('active');
  setTimeout(() => expressionLabelInput.focus(), 100);
}

function closeExpressionForm() {
  expressionFormModal.classList.remove('active');
  editingExpressionId = null;
  expressionForm.reset();
}

async function saveExpression() {
  if (!isAdmin || !db) {
    alert('You do not have permission to perform this action');
    return;
  }
  
  const label = expressionLabelInput.value.trim();
  const startTime = expressionStart.value.trim();
  const endTime = expressionEnd.value.trim();
  const color = expressionColor.value;
  const instruction = expressionInstruction ? expressionInstruction.value.trim() : '';
  
  // Validation
  if (!label) {
    alert('Please enter an expression label');
    expressionLabelInput.focus();
    return;
  }
  
  if (!startTime || !endTime) {
    alert('Please enter both start and end times');
    return;
  }
  
  // Validate time format (MM:SS)
  const timePattern = /^[0-9]{1,2}:[0-5][0-9]$/;
  if (!timePattern.test(startTime) || !timePattern.test(endTime)) {
    alert('Time must be in MM:SS format (e.g., 00:12)');
    return;
  }
  
  saveExpressionBtn.disabled = true;
  const originalText = saveExpressionBtn.innerHTML;
  saveExpressionBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
  
  try {
    const expressionData = {
      label,
      startTime,
      endTime,
      color,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    // Always include instruction field (empty string if no value)
    expressionData.instruction = instruction || '';
    
    console.log('Saving expression data:', expressionData);
    
    if (editingExpressionId) {
      // Check if label is being changed and if new label already exists
      const existing = expressions.find(e => e.id === editingExpressionId);
      if (existing && existing.label !== label) {
        const labelExists = expressions.some(e => e.label === label && e.id !== editingExpressionId);
        if (labelExists) {
          alert('An expression with this label already exists');
          saveExpressionBtn.disabled = false;
          saveExpressionBtn.innerHTML = originalText;
          return;
        }
      }
      
      console.log('Updating expression:', editingExpressionId, 'with data:', expressionData);
      await db.collection('expressions').doc(editingExpressionId).update(expressionData);
      console.log('Expression updated successfully');
    } else {
      // Check if label already exists
      const labelExists = expressions.some(e => e.label === label);
      if (labelExists) {
        alert('An expression with this label already exists');
        return;
      }
      
      expressionData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('expressions').add(expressionData);
    }
    
    await loadAdminExpressions();
    await loadExpressions(); // Reload for video playback
    closeExpressionForm();
  } catch (error) {
    console.error('Error saving expression:', error);
    alert('Error saving expression: ' + error.message);
  } finally {
    saveExpressionBtn.disabled = false;
    saveExpressionBtn.innerHTML = originalText;
  }
}

async function deleteExpression(expressionId) {
  if (!isAdmin || !db) {
    alert('You do not have permission to perform this action');
    return;
  }
  
  const expression = expressions.find(e => e.id === expressionId);
  if (!expression) return;
  
  if (!confirm(`Are you sure you want to delete the expression "${expression.label}"?`)) {
    return;
  }
  
  try {
    await db.collection('expressions').doc(expressionId).delete();
    await loadAdminExpressions();
    await loadExpressions(); // Reload for video playback
  } catch (error) {
    console.error('Error deleting expression:', error);
    alert('Error deleting expression: ' + error.message);
  }
}

async function populateDefaultExpressions() {
  if (!isAdmin || !db) {
    alert('You do not have permission to perform this action');
    return;
  }
  
  const defaultExpressions = [
    { label: 'Funny', startTime: '00:00', endTime: '00:12', color: '#FF6B6B' },
    { label: 'Interested', startTime: '00:13', endTime: '00:28', color: '#4ECDC4' },
    { label: 'Agree', startTime: '00:30', endTime: '00:37', color: '#95E1D3' },
    { label: 'Disagree', startTime: '00:40', endTime: '00:48', color: '#F38181' },
    { label: 'Neutral', startTime: '00:50', endTime: '00:55', color: '#999999' },
    { label: 'Confused', startTime: '01:00', endTime: '01:08', color: '#FFD93D' },
    { label: 'Bored', startTime: '01:10', endTime: '01:20', color: '#6C757D' },
  ];
  
  if (!confirm(`This will create ${defaultExpressions.length} default expressions if they don't already exist. Continue?`)) {
    return;
  }
  
  if (populateDefaultExpressionsBtn) {
    populateDefaultExpressionsBtn.disabled = true;
    const originalText = populateDefaultExpressionsBtn.innerHTML;
    populateDefaultExpressionsBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Populating...';
    
    try {
      // Get existing expressions to check which ones to add
      const existingExpressions = await db.collection('expressions').get();
      const existingLabels = new Set();
      existingExpressions.forEach(doc => {
        existingLabels.add(doc.data().label);
      });
      
      // Filter out expressions that already exist
      const expressionsToAdd = defaultExpressions.filter(
        expr => !existingLabels.has(expr.label)
      );
      
      if (expressionsToAdd.length === 0) {
        alert('All default expressions already exist!');
        populateDefaultExpressionsBtn.disabled = false;
        populateDefaultExpressionsBtn.innerHTML = originalText;
        return;
      }
      
      // Add each expression
      let addedCount = 0;
      for (const expr of expressionsToAdd) {
        await db.collection('expressions').add({
          ...expr,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        addedCount++;
      }
      
      // Reload expressions
      await loadAdminExpressions();
      await loadExpressions(); // Reload for video playback
      
      alert(`Successfully added ${addedCount} default expression(s)!`);
    } catch (error) {
      console.error('Error populating default expressions:', error);
      alert('Error populating expressions: ' + error.message);
    } finally {
      populateDefaultExpressionsBtn.disabled = false;
      populateDefaultExpressionsBtn.innerHTML = originalText;
    }
  }
}

function switchAdminSection(section) {
  // Update nav buttons
  adminNavBtns.forEach(btn => {
    if (btn.dataset.section === section) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  // Update sections
  if (adminUsersSection) adminUsersSection.classList.toggle('active', section === 'users');
  if (adminAvatarsSection) adminAvatarsSection.classList.toggle('active', section === 'avatars');
  if (adminExpressionsSection) adminExpressionsSection.classList.toggle('active', section === 'expressions');
  if (adminTrainingVideoSection) adminTrainingVideoSection.classList.toggle('active', section === 'training-video');
  if (adminSubscriptionsSection) adminSubscriptionsSection.classList.toggle('active', section === 'subscriptions');
  if (adminPricingSection) adminPricingSection.classList.toggle('active', section === 'pricing');
  if (adminCreditsSection) adminCreditsSection.classList.toggle('active', section === 'credits');
  if (adminCategoriesSection) adminCategoriesSection.classList.toggle('active', section === 'categories');
  if (adminModerationSection) adminModerationSection.classList.toggle('active', section === 'moderation');
  
  // Load section data
  if (section === 'users') {
    loadUsers();
  } else if (section === 'avatars') {
    loadAdminAvatars();
  } else if (section === 'expressions') {
    loadAdminExpressions();
  } else if (section === 'training-video') {
    loadTrainingVideo();
  } else if (section === 'subscriptions') {
    loadSubscriptionPackages();
  } else if (section === 'pricing') {
    loadPricingConfiguration();
  } else if (section === 'credits') {
    loadCreditConfiguration();
    loadCreditPackagesForAdmin();
  } else if (section === 'categories') {
    loadCategories();
  } else if (section === 'moderation') {
    loadModerationRules();
  }
}

// Load training videos from Firestore
async function loadTrainingVideo() {
  if (!isAdmin || !db) return;
  
  try {
    const querySnapshot = await db.collection('trainingVideos')
      .orderBy('createdAt', 'desc')
      .get();
    
    trainingVideosTableBody.innerHTML = '';
    
    if (querySnapshot.empty) {
      trainingVideosTableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 40px; color: var(--text-secondary);">
            No training videos found. Upload your first training video!
          </td>
        </tr>
      `;
      return;
    }
    
    querySnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      const row = document.createElement('tr');
      
      const date = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
      const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
      
      const isActive = data.active === true;
      const videoUrl = data.videoUrl || '';
      
      row.innerHTML = `
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <strong>${data.name || 'Unnamed Video'}</strong>
            ${videoUrl ? `
              <button class="admin-action-btn" onclick="copyTrainingVideoUrl('${videoUrl.replace(/'/g, "\\'")}', this)" title="Copy URL to clipboard" style="padding: 4px 8px; min-width: auto;">
                <i class="fas fa-copy"></i>
              </button>
            ` : ''}
          </div>
        </td>
        <td>
          <div class="admin-toggle">
            <div class="toggle-switch ${isActive ? 'active' : ''}" data-video-id="${docSnapshot.id}" data-is-active="${isActive}"></div>
            <span style="color: ${isActive ? 'var(--accent-primary)' : 'var(--text-secondary)'}; font-weight: ${isActive ? '600' : '400'}">
              ${isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </td>
        <td style="font-size: 12px; color: var(--text-secondary);">${data.uploadedBy || 'Unknown'}</td>
        <td style="font-size: 12px; color: var(--text-secondary);">${dateStr}</td>
        <td>
          <button class="admin-action-btn" onclick="toggleTrainingVideoStatus('${docSnapshot.id}', ${!isActive})">
            ${isActive ? 'Deactivate' : 'Activate'}
          </button>
          <button class="admin-action-btn danger" onclick="deleteTrainingVideo('${docSnapshot.id}')">
            <i class="fas fa-trash"></i> Delete
          </button>
        </td>
      `;
      
      // Add toggle switch listener
      const toggleSwitch = row.querySelector('.toggle-switch');
      if (toggleSwitch) {
        toggleSwitch.addEventListener('click', () => {
          toggleTrainingVideoStatus(docSnapshot.id, !isActive);
        });
      }
      
      trainingVideosTableBody.appendChild(row);
    });
  } catch (error) {
    console.error('Error loading training videos:', error);
    trainingVideosTableBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 40px; color: var(--error);">
          Error loading training videos: ${error.message}
        </td>
      </tr>
    `;
  }
}

// Save training video
async function saveTrainingVideo() {
  if (!isAdmin || !db || !storage) {
    alert('You do not have permission to perform this action');
    return;
  }
  
  const name = trainingVideoName?.value.trim();
  const file = trainingVideoUpload?.files[0];
  
  if (!name) {
    alert('Please enter a name for the training video');
    if (trainingVideoName) trainingVideoName.focus();
    return;
  }
  
  if (!file) {
    alert('Please select a video file');
    return;
  }
  
  if (saveTrainingVideoBtn) {
    saveTrainingVideoBtn.disabled = true;
    const originalText = saveTrainingVideoBtn.innerHTML;
    saveTrainingVideoBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
    
    try {
      // Upload to Firebase Storage
      const timestamp = Date.now();
      const filename = `training-video/${timestamp}-${file.name}`;
      const storageRef = storage.ref(filename);
      
      const metadata = {
        contentType: file.type,
        customMetadata: {
          uploadedBy: currentUser.uid,
          uploadedAt: new Date().toISOString()
        }
      };
      
      const uploadTask = storageRef.put(file, metadata);
      
      // Wait for upload to complete
      await new Promise((resolve, reject) => {
        uploadTask.on('state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log(`Upload progress: ${Math.round(progress)}%`);
            if (saveTrainingVideoBtn) {
              saveTrainingVideoBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Uploading... ${Math.round(progress)}%`;
            }
          },
          (error) => {
            reject(error);
          },
          async () => {
            try {
              const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
              
              // Check if there are any active training videos
              const activeVideos = await db.collection('trainingVideos')
                .where('active', '==', true)
                .get();
              
              // If no active videos, make this one active by default
              const shouldBeActive = activeVideos.empty;
              
              // Save to Firestore trainingVideos collection
              await db.collection('trainingVideos').add({
                name: name,
                videoUrl: downloadURL,
                active: shouldBeActive,
                uploadedBy: currentUser.uid,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
              });
              
              alert('Training video saved successfully!');
              
              // Clear form
              if (trainingVideoName) trainingVideoName.value = '';
              if (trainingVideoUpload) trainingVideoUpload.value = '';
              if (trainingVideoPreview) trainingVideoPreview.style.display = 'none';
              if (trainingVideoUploadForm) trainingVideoUploadForm.style.display = 'none';
              
              // Reload list
              await loadTrainingVideo();
              
              resolve();
            } catch (error) {
              reject(error);
            }
          }
        );
      });
      
    } catch (error) {
      console.error('Error saving training video:', error);
      alert('Error saving training video: ' + error.message);
    } finally {
      if (saveTrainingVideoBtn) {
        saveTrainingVideoBtn.disabled = false;
        saveTrainingVideoBtn.innerHTML = originalText;
      }
    }
  }
}

// Toggle training video active status
async function toggleTrainingVideoStatus(videoId, makeActive) {
  if (!isAdmin || !db) {
    alert('You do not have permission to perform this action');
    return;
  }
  
  try {
    if (makeActive) {
      // Deactivate all other training videos first
      const activeVideos = await db.collection('trainingVideos')
        .where('active', '==', true)
        .get();
      
      const deactivatePromises = activeVideos.docs.map(doc => 
        doc.ref.update({
          active: false,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        })
      );
      
      await Promise.all(deactivatePromises);
    }
    
    // Update this video's status
    await db.collection('trainingVideos').doc(videoId).update({
      active: makeActive,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Reload list
    await loadTrainingVideo();
    
  } catch (error) {
    console.error('Error toggling training video status:', error);
    alert('Error updating training video status: ' + error.message);
  }
}

// Delete training video
async function deleteTrainingVideo(videoId) {
  if (!isAdmin || !db) {
    alert('You do not have permission to perform this action');
    return;
  }
  
  if (!confirm('Are you sure you want to delete this training video? This action cannot be undone.')) {
    return;
  }
  
  try {
    // Get video data to delete from storage
    const videoDoc = await db.collection('trainingVideos').doc(videoId).get();
    if (videoDoc.exists) {
      const data = videoDoc.data();
      
      // Delete from Firestore
      await db.collection('trainingVideos').doc(videoId).delete();
      
      // Try to delete from storage (optional - may fail if file doesn't exist)
      if (data.videoUrl && storage) {
        try {
          // Extract path from URL
          const url = new URL(data.videoUrl);
          const pathMatch = url.pathname.match(/\/o\/(.+)\?/);
          if (pathMatch) {
            const filePath = decodeURIComponent(pathMatch[1]);
            const storageRef = storage.ref(filePath);
            await storageRef.delete();
          }
        } catch (storageError) {
          console.warn('Could not delete file from storage:', storageError);
          // Continue anyway - Firestore deletion succeeded
        }
      }
    }
    
    // Reload list
    await loadTrainingVideo();
    
  } catch (error) {
    console.error('Error deleting training video:', error);
    alert('Error deleting training video: ' + error.message);
  }
}

// Calculate total duration of all expression segments
function calculateTotalExpressionDuration() {
  let totalDuration = 0;
  let maxEndTime = 0;
  
  // Calculate from loaded expressions
  Object.keys(EXPRESSION_SEGMENTS).forEach((label) => {
    const segment = EXPRESSION_SEGMENTS[label];
    const startSeconds = timeToSeconds(segment.start);
    const endSeconds = timeToSeconds(segment.end);
    const duration = endSeconds - startSeconds;
    totalDuration += duration;
    
    if (endSeconds > maxEndTime) {
      maxEndTime = endSeconds;
    }
  });
  
  return {
    totalDuration, // Sum of all segment durations
    maxEndTime,    // Latest timestamp referenced
    segmentCount: Object.keys(EXPRESSION_SEGMENTS).length
  };
}

// Validate expression timings against training video duration
async function validateExpressionTimings(trainingVideoUrl) {
  try {
    // Get video duration by loading it
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = trainingVideoUrl;
    
    const videoDuration = await new Promise((resolve, reject) => {
      video.addEventListener('loadedmetadata', () => {
        resolve(video.duration);
      });
      video.addEventListener('error', () => {
        reject(new Error('Failed to load video metadata'));
      });
      // Timeout after 10 seconds
      setTimeout(() => reject(new Error('Video metadata load timeout')), 10000);
    });
    
    // Calculate total expression duration
    const expressionInfo = calculateTotalExpressionDuration();
    
    // Find the maximum end time from expressions (from database for accuracy)
    let maxExpressionTime = 0;
    const expressions = await db.collection('expressions').get();
    
    expressions.forEach((doc) => {
      const data = doc.data();
      const endSeconds = timeToSeconds(data.endTime);
      if (endSeconds > maxExpressionTime) {
        maxExpressionTime = endSeconds;
      }
    });
    
    // Check if any expressions exceed video duration
    if (maxExpressionTime > videoDuration) {
      return {
        valid: false,
        videoDuration,
        maxExpressionTime,
        totalExpressionDuration: expressionInfo.totalDuration,
        message: `Some expressions reference timestamps beyond the video duration.`
      };
    }
    
    // Check if total expression duration matches video duration (within 2 seconds tolerance)
    const durationDiff = Math.abs(expressionInfo.totalDuration - videoDuration);
    if (durationDiff > 2) {
      console.warn(`Total expression duration (${expressionInfo.totalDuration.toFixed(1)}s) doesn't match video duration (${videoDuration.toFixed(1)}s). Difference: ${durationDiff.toFixed(1)}s`);
    }
    
    return {
      valid: true,
      videoDuration,
      maxExpressionTime,
      totalExpressionDuration: expressionInfo.totalDuration,
      durationMatch: durationDiff <= 2
    };
  } catch (error) {
    console.warn('Could not validate expression timings:', error);
    // Don't block generation if validation fails
    return {
      valid: true,
      videoDuration: null,
      maxExpressionTime: null,
      totalExpressionDuration: null,
      message: 'Could not validate video duration'
    };
  }
}

// Payment and Subscription Functions

// Show avatar payment modal
async function showAvatarPaymentModal(price, avatarId) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'avatar-form-modal active';
    modal.style.zIndex = '10001';
    
    const cancelHandler = () => {
      document.body.removeChild(modal);
      resolve(false);
    };
    
    const proceedHandler = async () => {
      const btn = modal.querySelector('#proceedToPaymentBtn');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
      }
      
      try {
        // Create checkout session
        const response = await fetch('/api/create-avatar-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser.uid,
            avatarId: avatarId || null,
            price: price,
            successUrl: `${window.location.origin}${window.location.pathname}?payment=success&avatarId=${avatarId || 'new'}`,
            cancelUrl: `${window.location.origin}${window.location.pathname}?payment=cancelled`
          })
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to create payment session');
        }
        
        const data = await response.json();
        
        // Redirect to Stripe Checkout - payment will be handled there
        // When user returns, handlePaymentCallbacks will process it
        window.location.href = data.url;
        
        // Don't resolve here - user will be redirected
        // The payment success will be handled when they return
      } catch (error) {
        console.error('Error creating payment:', error);
        alert('Error processing payment: ' + error.message);
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<i class="fas fa-credit-card"></i> Proceed to Payment';
        }
        resolve(false);
      }
    };
    
    modal.innerHTML = `
      <div class="avatar-form-container" style="max-width: 500px;">
        <div class="avatar-form-header">
          <h2><i class="fas fa-credit-card"></i> Payment Required</h2>
          <button type="button" class="avatar-form-close" id="paymentModalCloseBtn">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div style="padding: 24px;">
          <p style="margin-bottom: 20px; color: var(--text-secondary);">
            Creating an AI-generated avatar requires a one-time payment of <strong>$${price.toFixed(2)}</strong>.
          </p>
          <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <button class="auth-btn secondary" id="paymentModalCancelBtn">
              Cancel
            </button>
            <button class="auth-btn" id="proceedToPaymentBtn">
              <i class="fas fa-credit-card"></i> Proceed to Payment
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
    // Add event listeners
    const closeBtn = modal.querySelector('#paymentModalCloseBtn');
    const cancelBtn = modal.querySelector('#paymentModalCancelBtn');
    const proceedBtn = modal.querySelector('#proceedToPaymentBtn');
    
    if (closeBtn) closeBtn.addEventListener('click', cancelHandler);
    if (cancelBtn) cancelBtn.addEventListener('click', cancelHandler);
    if (proceedBtn) proceedBtn.addEventListener('click', proceedHandler);
  });
}

// Subscription Package Management Functions

let editingPackageId = null;

// Load subscription packages
async function loadSubscriptionPackages() {
  // Only admins can see the admin view, but check db anyway
  if (!isAdmin || !db) return;
  
  try {
    // Fetch all packages and sort in JavaScript to avoid index issues
    const querySnapshot = await db.collection('subscriptionPackages').get();
    
    if (!packagesTableBody) return;
    packagesTableBody.innerHTML = '';
    
    if (querySnapshot.empty) {
      packagesTableBody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 40px; color: var(--text-secondary);">
            No subscription packages found. Create your first package!
          </td>
        </tr>
      `;
      return;
    }
    
    // Convert to array and sort by createdAt (newest first)
    const packages = [];
    querySnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      packages.push({
        id: docSnapshot.id,
        data: data,
        createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : (data.createdAt || 0)
      });
    });
    
    // Sort by createdAt descending (newest first)
    packages.sort((a, b) => b.createdAt - a.createdAt);
    
    // Render sorted packages
    // First, load credit packages to get names for display
    const creditPackagesMap = new Map();
    try {
      const creditPackagesSnapshot = await db.collection('creditPackages').get();
      creditPackagesSnapshot.forEach((doc) => {
        const creditData = doc.data();
        creditPackagesMap.set(doc.id, {
          credits: creditData.credits || 0,
          price: creditData.price || 0
        });
      });
    } catch (error) {
      console.error('Error loading credit packages for display:', error);
    }
    
    for (const pkg of packages) {
      const data = pkg.data;
      let creditsDisplay = `${(data.monthlyCredits || 0).toLocaleString()} credits`;
      if (data.creditPackageId && creditPackagesMap.has(data.creditPackageId)) {
        const creditPkg = creditPackagesMap.get(data.creditPackageId);
        creditsDisplay = `${creditPkg.credits.toLocaleString()} credits ($${creditPkg.price.toFixed(2)})`;
      }
      
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><strong>${data.name || 'Unnamed'}</strong></td>
        <td>$${data.price?.toFixed(2) || '0.00'}</td>
        <td>${data.interval === 'year' ? 'Yearly' : 'Monthly'}</td>
        <td><strong>${creditsDisplay}</strong> <i class="fas fa-coins" style="color: var(--accent-primary);"></i></td>
        <td style="font-family: monospace; font-size: 11px;">${data.stripePriceId || '—'}</td>
        <td>
          <span style="color: ${data.active ? 'var(--success)' : 'var(--text-secondary)'};">
            <i class="fas fa-${data.active ? 'check-circle' : 'times-circle'}"></i>
            ${data.active ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td style="font-size: 12px; color: var(--text-secondary);">${data.description || '—'}</td>
        <td>
          <button class="admin-action-btn" onclick="editPackage('${pkg.id}')" title="Edit">
            <i class="fas fa-edit"></i>
          </button>
          <button class="admin-action-btn danger" onclick="deletePackage('${pkg.id}')" title="Delete">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      `;
      packagesTableBody.appendChild(row);
    }
  } catch (error) {
    console.error('Error loading subscription packages:', error);
    if (packagesTableBody) {
      packagesTableBody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 40px; color: var(--error);">
            Error loading packages: ${error.message}
          </td>
        </tr>
      `;
    }
  }
}

// Load credit packages for subscription package dropdown
async function loadCreditPackagesForSubscriptionDropdown() {
  if (!db) {
    console.error('Database not initialized');
    return;
  }
  
  if (!packageMonthlyCredits) {
    console.error('packageMonthlyCredits element not found');
    return;
  }
  
  try {
    // Clear existing options
    packageMonthlyCredits.innerHTML = '<option value="">Select a credit package...</option>';
    
    // Load all credit packages and filter client-side to avoid index requirement
    const querySnapshot = await db.collection('creditPackages').get();
    
    if (!querySnapshot || querySnapshot.empty) {
      packageMonthlyCredits.innerHTML += '<option value="" disabled>No credit packages available</option>';
      console.log('No credit packages found');
      return;
    }
    
    // Convert to array and filter for active packages
    const packages = [];
    querySnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      // Only include active packages (default to true if not set)
      if (data.active !== false) {
        packages.push({
          id: docSnapshot.id,
          credits: data.credits || 0,
          price: data.price || 0,
          order: data.order || 0
        });
      }
    });
    
    if (packages.length === 0) {
      packageMonthlyCredits.innerHTML += '<option value="" disabled>No active credit packages available</option>';
      console.log('No active credit packages found');
      return;
    }
    
    // Sort by order
    packages.sort((a, b) => a.order - b.order);
    
    // Add options to dropdown
    packages.forEach((pkg) => {
      const option = document.createElement('option');
      option.value = pkg.id;
      option.textContent = `${pkg.credits.toLocaleString()} credits ($${pkg.price.toFixed(2)})`;
      packageMonthlyCredits.appendChild(option);
    });
    
    console.log(`Loaded ${packages.length} credit package(s) into dropdown`);
  } catch (error) {
    console.error('Error loading credit packages for dropdown:', error);
    if (packageMonthlyCredits) {
      packageMonthlyCredits.innerHTML = '<option value="">Error loading credit packages</option>';
    }
  }
}

// Open package form
async function openPackageForm(packageId = null) {
  editingPackageId = packageId;
  
  // Load credit packages for dropdown
  await loadCreditPackagesForSubscriptionDropdown();
  
  if (packageId) {
    // Load package data
    const packageData = db.collection('subscriptionPackages').doc(packageId).get().then(doc => {
      if (doc.exists) {
        const data = doc.data();
        if (packageFormTitle) packageFormTitle.textContent = 'Edit Package';
        if (packageName) packageName.value = data.name || '';
        if (packageDescription) packageDescription.value = data.description || '';
        if (packagePrice) packagePrice.value = data.price || '';
        if (packageInterval) packageInterval.value = data.interval || 'month';
        if (packageStripePriceId) packageStripePriceId.value = data.stripePriceId || '';
        // Set the credit package ID (or monthlyCredits for backward compatibility)
        if (packageMonthlyCredits) {
          if (data.creditPackageId) {
            packageMonthlyCredits.value = data.creditPackageId;
          } else if (data.monthlyCredits) {
            // Backward compatibility: try to find matching credit package by credits amount
            // Wait for dropdown to be populated, then find matching option
            setTimeout(() => {
              const options = packageMonthlyCredits.options;
              for (let i = 0; i < options.length; i++) {
                const option = options[i];
                // Extract credits from option text (format: "X credits ($Y.YY)")
                const match = option.textContent.match(/^([\d,]+)\s+credits/);
                if (match) {
                  const optionCredits = parseInt(match[1].replace(/,/g, ''));
                  if (optionCredits === data.monthlyCredits) {
                    packageMonthlyCredits.value = option.value;
                    break;
                  }
                }
              }
            }, 100);
          }
        }
        if (packageActive) packageActive.checked = data.active !== false;
      }
    });
  } else {
    // New package
    if (packageFormTitle) packageFormTitle.textContent = 'Create Package';
    if (packageForm) packageForm.reset();
    if (packageActive) packageActive.checked = true;
    if (packageMonthlyCredits) packageMonthlyCredits.value = '';
  }
  
  if (packageFormModal) packageFormModal.classList.add('active');
  if (packageName) setTimeout(() => packageName.focus(), 100);
}

// Close package form
function closePackageForm() {
  if (packageFormModal) packageFormModal.classList.remove('active');
  editingPackageId = null;
  if (packageForm) packageForm.reset();
}

// Save package
async function savePackage() {
  if (!isAdmin || !db) {
    alert('You do not have permission to perform this action');
    return;
  }
  
  const name = packageName?.value.trim();
  const description = packageDescription?.value.trim();
  const price = parseFloat(packagePrice?.value);
  const interval = packageInterval?.value;
  const stripePriceId = packageStripePriceId?.value.trim();
  const creditPackageId = packageMonthlyCredits?.value.trim();
  const active = packageActive?.checked;
  
  if (!name || !price || price <= 0) {
    alert('Please provide a name and valid price');
    return;
  }
  
  if (!creditPackageId) {
    alert('Please select a credit package');
    return;
  }
  
  if (!['month', 'year'].includes(interval)) {
    alert('Interval must be either "month" or "year"');
    return;
  }
  
  savePackageBtn.disabled = true;
  const originalText = savePackageBtn.innerHTML;
  savePackageBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
  
  try {
    // Get the credit package to get the credits amount
    const creditPackageDoc = await db.collection('creditPackages').doc(creditPackageId).get();
    if (!creditPackageDoc.exists) {
      throw new Error('Selected credit package not found');
    }
    const creditPackageData = creditPackageDoc.data();
    const monthlyCredits = creditPackageData.credits || 0;
    
    const packageData = {
      name,
      description: description || '',
      price,
      interval,
      creditPackageId: creditPackageId,
      monthlyCredits: monthlyCredits, // Store for backward compatibility and webhook use
      active: active !== false,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    if (stripePriceId) {
      packageData.stripePriceId = stripePriceId;
    }
    
    if (editingPackageId) {
      await db.collection('subscriptionPackages').doc(editingPackageId).update(packageData);
    } else {
      packageData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('subscriptionPackages').add(packageData);
    }
    
    await loadSubscriptionPackages();
    closePackageForm();
    alert('Package saved successfully!');
  } catch (error) {
    console.error('Error saving package:', error);
    alert('Error saving package: ' + error.message);
  } finally {
    savePackageBtn.disabled = false;
    savePackageBtn.innerHTML = originalText;
  }
}

// Edit package
async function editPackage(packageId) {
  editingPackageId = packageId;
  const doc = await db.collection('subscriptionPackages').doc(packageId).get();
  if (doc.exists) {
    const data = doc.data();
    if (packageFormTitle) packageFormTitle.textContent = 'Edit Package';
    if (packageName) packageName.value = data.name || '';
    if (packageDescription) packageDescription.value = data.description || '';
    if (packagePrice) packagePrice.value = data.price || '';
    if (packageInterval) packageInterval.value = data.interval || 'month';
    if (packageStripePriceId) packageStripePriceId.value = data.stripePriceId || '';
    if (packageActive) packageActive.checked = data.active !== false;
    if (packageFormModal) packageFormModal.classList.add('active');
  }
}

// Delete package
async function deletePackage(packageId) {
  if (!isAdmin || !db) {
    alert('You do not have permission to perform this action');
    return;
  }
  
  if (!confirm('Are you sure you want to delete this package? This action cannot be undone.')) {
    return;
  }
  
  try {
    await db.collection('subscriptionPackages').doc(packageId).delete();
    await loadSubscriptionPackages();
    alert('Package deleted successfully!');
  } catch (error) {
    console.error('Error deleting package:', error);
    alert('Error deleting package: ' + error.message);
  }
}

// Load pricing configuration
// Load categories for avatar dropdown
async function loadCategoriesForDropdown() {
  if (!db || !avatarCategory) return;
  
  try {
    const querySnapshot = await db.collection('categories')
      .orderBy('name', 'asc')
      .get();
    
    // Clear existing options except "No Category"
    avatarCategory.innerHTML = '<option value="">No Category</option>';
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const option = document.createElement('option');
      option.value = doc.id;
      option.textContent = data.name;
      avatarCategory.appendChild(option);
    });
  } catch (error) {
    console.error('Error loading categories:', error);
  }
}

// Load moderation rules for admin panel
async function loadModerationRules() {
  if (!isAdmin || !db) return;
  
  try {
    // Get the moderation config document (singleton - only one document)
    const moderationDoc = await db.collection('moderationConfig').doc('settings').get();
    
    if (moderationDoc.exists) {
      const data = moderationDoc.data();
      if (moderationInstructions) {
        moderationInstructions.value = data.instructions || '';
      }
      if (blacklistedWords) {
        blacklistedWords.value = (data.blacklistedWords || []).join('\n');
      }
      if (blacklistedTopics) {
        blacklistedTopics.value = (data.blacklistedTopics || []).join('\n');
      }
    } else {
      // No moderation config yet, use defaults
      if (moderationInstructions) moderationInstructions.value = '';
      if (blacklistedWords) blacklistedWords.value = '';
      if (blacklistedTopics) blacklistedTopics.value = '';
    }
    
    // Show status message
    if (moderationStatus) {
      moderationStatus.style.display = 'none';
    }
  } catch (error) {
    console.error('Error loading moderation rules:', error);
    if (moderationStatus) {
      moderationStatus.style.display = 'block';
      moderationStatus.style.background = 'var(--error)';
      moderationStatus.style.color = 'white';
      moderationStatus.textContent = `Error loading moderation rules: ${error.message}`;
    }
  }
}

// Save moderation rules
async function saveModerationRules() {
  if (!isAdmin || !db) {
    alert('You do not have permission to perform this action');
    return;
  }
  
  if (!moderationInstructions || !blacklistedWords || !blacklistedTopics) {
    alert('Moderation form elements not found');
    return;
  }
  
  const instructions = moderationInstructions.value.trim();
  const wordsText = blacklistedWords.value.trim();
  const topicsText = blacklistedTopics.value.trim();
  
  // Parse words and topics (one per line)
  const words = wordsText.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
  
  const topics = topicsText.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
  
  if (saveModerationBtn) {
    saveModerationBtn.disabled = true;
    const originalText = saveModerationBtn.innerHTML;
    saveModerationBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    
    try {
      // Save to Firestore (singleton document)
      await db.collection('moderationConfig').doc('settings').set({
        instructions: instructions,
        blacklistedWords: words,
        blacklistedTopics: topics,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: currentUser.uid
      }, { merge: true });
      
      // Show success message
      if (moderationStatus) {
        moderationStatus.style.display = 'block';
        moderationStatus.style.background = 'var(--success)';
        moderationStatus.style.color = 'white';
        moderationStatus.textContent = 'Moderation rules saved successfully! These will apply to all chat sessions.';
      }
      
      // Hide status after 3 seconds
      setTimeout(() => {
        if (moderationStatus) {
          moderationStatus.style.display = 'none';
        }
      }, 3000);
      
    } catch (error) {
      console.error('Error saving moderation rules:', error);
      alert('Error saving moderation rules: ' + error.message);
      
      if (moderationStatus) {
        moderationStatus.style.display = 'block';
        moderationStatus.style.background = 'var(--error)';
        moderationStatus.style.color = 'white';
        moderationStatus.textContent = `Error: ${error.message}`;
      }
    } finally {
      if (saveModerationBtn) {
        saveModerationBtn.disabled = false;
        saveModerationBtn.innerHTML = originalText;
      }
    }
  }
}

// Reset moderation rules to default
function resetModerationRules() {
  if (!confirm('Are you sure you want to reset moderation rules to default? This will clear all current settings.')) {
    return;
  }
  
  if (moderationInstructions) moderationInstructions.value = '';
  if (blacklistedWords) blacklistedWords.value = '';
  if (blacklistedTopics) blacklistedTopics.value = '';
  
  if (moderationStatus) {
    moderationStatus.style.display = 'block';
    moderationStatus.style.background = 'var(--warning)';
    moderationStatus.style.color = 'white';
    moderationStatus.textContent = 'Moderation rules reset. Click "Save Moderation Rules" to apply.';
  }
}

// Load categories for admin panel
async function loadCategories() {
  if (!isAdmin || !db) return;
  
  try {
    const querySnapshot = await db.collection('categories')
      .orderBy('name', 'asc')
      .get();
    
    if (!categoriesTableBody) return;
    categoriesTableBody.innerHTML = '';
    
    if (querySnapshot.empty) {
      categoriesTableBody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; padding: 40px; color: var(--text-secondary);">
            No categories found. Create your first category!
          </td>
        </tr>
      `;
      return;
    }
    
    querySnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      const row = document.createElement('tr');
      const dateStr = data.createdAt ? new Date(data.createdAt.toMillis ? data.createdAt.toMillis() : data.createdAt).toLocaleDateString() : '—';
      row.innerHTML = `
        <td><strong>${data.name || 'Unnamed'}</strong></td>
        <td>${data.description || '—'}</td>
        <td>${dateStr}</td>
        <td>
          <button class="admin-action-btn" onclick="editCategory('${docSnapshot.id}')" title="Edit">
            <i class="fas fa-edit"></i>
          </button>
          <button class="admin-action-btn danger" onclick="deleteCategory('${docSnapshot.id}')" title="Delete">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      `;
      categoriesTableBody.appendChild(row);
    });
  } catch (error) {
    console.error('Error loading categories:', error);
    if (categoriesTableBody) {
      categoriesTableBody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; padding: 40px; color: var(--error);">
            Error loading categories: ${error.message}
          </td>
        </tr>
      `;
    }
  }
}

// Create/Edit category
let editingCategoryId = null;
async function saveCategory() {
  if (!isAdmin || !db) {
    alert('You do not have permission to perform this action');
    return;
  }
  
  const name = document.getElementById('categoryName')?.value.trim();
  const description = document.getElementById('categoryDescription')?.value.trim();
  
  if (!name) {
    alert('Please provide a category name');
    return;
  }
  
  try {
    const categoryData = {
      name,
      description: description || '',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    if (editingCategoryId) {
      await db.collection('categories').doc(editingCategoryId).update(categoryData);
    } else {
      categoryData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('categories').add(categoryData);
    }
    
    await loadCategories();
    await loadCategoriesForDropdown(); // Refresh dropdown
    closeCategoryForm();
    alert('Category saved successfully!');
  } catch (error) {
    console.error('Error saving category:', error);
    alert('Error saving category: ' + error.message);
  }
}

async function editCategory(categoryId) {
  if (!isAdmin || !db) return;
  
  editingCategoryId = categoryId;
  const doc = await db.collection('categories').doc(categoryId).get();
  if (doc.exists) {
    const data = doc.data();
    if (document.getElementById('categoryFormTitle')) {
      document.getElementById('categoryFormTitle').textContent = 'Edit Category';
    }
    if (document.getElementById('categoryName')) {
      document.getElementById('categoryName').value = data.name || '';
    }
    if (document.getElementById('categoryDescription')) {
      document.getElementById('categoryDescription').value = data.description || '';
    }
    if (document.getElementById('categoryFormModal')) {
      document.getElementById('categoryFormModal').classList.add('active');
    }
  }
}

async function deleteCategory(categoryId) {
  if (!isAdmin || !db) {
    alert('You do not have permission to perform this action');
    return;
  }
  
  if (!confirm('Are you sure you want to delete this category? Avatars using this category will have their category removed.')) {
    return;
  }
  
  try {
    // Remove category from avatars that use it
    const avatarsSnapshot = await db.collection('avatars')
      .where('categoryId', '==', categoryId)
      .get();
    
    const batch = db.batch();
    avatarsSnapshot.forEach((doc) => {
      batch.update(doc.ref, { categoryId: null });
    });
    await batch.commit();
    
    // Delete category
    await db.collection('categories').doc(categoryId).delete();
    
    await loadCategories();
    await loadCategoriesForDropdown(); // Refresh dropdown
    alert('Category deleted successfully!');
  } catch (error) {
    console.error('Error deleting category:', error);
    alert('Error deleting category: ' + error.message);
  }
}

function closeCategoryForm() {
  editingCategoryId = null;
  if (document.getElementById('categoryFormModal')) {
    document.getElementById('categoryFormModal').classList.remove('active');
  }
  if (document.getElementById('categoryForm')) {
    document.getElementById('categoryForm').reset();
  }
}

// Expose functions globally
window.editCategory = editCategory;
window.deleteCategory = deleteCategory;
window.saveModerationRules = saveModerationRules;
window.resetModerationRules = resetModerationRules;
window.saveCategory = saveCategory;
window.closeCategoryForm = closeCategoryForm;

async function loadPricingConfiguration() {
  if (!isAdmin || !db) return;
  
  try {
    const pricingDoc = await db.collection('admin').doc('pricing').get();
    if (pricingDoc.exists) {
      const data = pricingDoc.data();
      if (avatarCreationPrice) {
        avatarCreationPrice.value = data.avatarCreationPrice || '';
      }
    }
  } catch (error) {
    console.error('Error loading pricing configuration:', error);
  }
}

// Save pricing configuration
async function savePricingConfiguration() {
  if (!isAdmin || !db) {
    alert('You do not have permission to perform this action');
    return;
  }
  
  const price = parseFloat(avatarCreationPrice?.value);
  
  if (!price || price < 0) {
    alert('Please enter a valid price (0 or greater)');
    return;
  }
  
  savePricingBtn.disabled = true;
  const originalText = savePricingBtn.innerHTML;
  savePricingBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
  
  try {
    await db.collection('admin').doc('pricing').set({
      avatarCreationPrice: price,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    alert('Pricing configuration saved successfully!');
  } catch (error) {
    console.error('Error saving pricing configuration:', error);
    alert('Error saving pricing: ' + error.message);
  } finally {
    savePricingBtn.disabled = false;
    savePricingBtn.innerHTML = originalText;
  }
}

/**
 * Credit System Functions
 */

// Update credits display in header
function updateCreditsDisplay() {
  if (creditsCount) {
    creditsCount.textContent = userCredits.toLocaleString();
  }
  if (currentCreditsDisplay) {
    currentCreditsDisplay.textContent = userCredits.toLocaleString();
  }
}

// Load user credits from Firestore
async function loadUserCredits() {
  if (!currentUser || !db) return;
  
  try {
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      userCredits = userData.credits || 0;
      updateCreditsDisplay();
    }
  } catch (error) {
    console.error('Error loading user credits:', error);
  }
}

// Load credit configuration (for all users to get costs)
async function loadCreditConfiguration() {
  if (!db) return;
  
  try {
    const configDoc = await db.collection('creditConfig').doc('default').get();
    if (configDoc.exists) {
      const data = configDoc.data();
      creditConfig = {
        recording: data.recording || 10,
        ai: data.ai || 50,
        url: data.url || 5,
        per10kTokens: data.per10kTokens || 1
      };
      
    }
    
    // Update admin UI if admin
    if (isAdmin) {
      if (creditCostRecording) creditCostRecording.value = creditConfig.recording;
      if (creditCostAI) creditCostAI.value = creditConfig.ai;
      if (creditCostURL) creditCostURL.value = creditConfig.url;
      if (creditCostPer10kTokens) creditCostPer10kTokens.value = creditConfig.per10kTokens;
    }
  } catch (error) {
    console.error('Error loading credit configuration:', error);
  }
}

// Save credit configuration (admin)
async function saveCreditConfiguration() {
  if (!isAdmin || !db) {
    alert('You do not have permission to perform this action');
    return;
  }
  
  const recording = parseInt(creditCostRecording?.value) || 10;
  const ai = parseInt(creditCostAI?.value) || 50;
  const url = parseInt(creditCostURL?.value) || 5;
  const per10kTokens = parseFloat(creditCostPer10kTokens?.value) || 1;
  
  if (recording < 0 || ai < 0 || url < 0 || per10kTokens < 0) {
    alert('Credit costs must be 0 or greater');
    return;
  }
  
  saveCreditConfigBtn.disabled = true;
  const originalText = saveCreditConfigBtn.innerHTML;
  saveCreditConfigBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
  
  try {
    creditConfig = { recording, ai, url, per10kTokens };
    await db.collection('creditConfig').doc('default').set({
      recording,
      ai,
      url,
      per10kTokens,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    alert('Credit configuration saved successfully!');
  } catch (error) {
    console.error('Error saving credit configuration:', error);
    alert('Error saving credit configuration: ' + error.message);
  } finally {
    saveCreditConfigBtn.disabled = false;
    saveCreditConfigBtn.innerHTML = originalText;
  }
}

// Load credit packages for admin panel
async function loadCreditPackagesForAdmin() {
  if (!isAdmin || !db) return;
  
  try {
    const querySnapshot = await db.collection('creditPackages').get();
    
    if (!creditPackagesTableBody) return;
    creditPackagesTableBody.innerHTML = '';
    
    if (querySnapshot.empty) {
      creditPackagesTableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-secondary);">
            No credit packages found. Create your first package!
          </td>
        </tr>
      `;
      return;
    }
    
    // Convert to array and sort by order
    const packages = [];
    querySnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      packages.push({
        id: docSnapshot.id,
        credits: data.credits || 0,
        price: data.price || 0,
        popular: data.popular || false,
        active: data.active !== false, // Default to true
        order: data.order || 0
      });
    });
    
    packages.sort((a, b) => a.order - b.order);
    
    packages.forEach((pkg) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><strong>${pkg.credits.toLocaleString()}</strong></td>
        <td>$${pkg.price.toFixed(2)}</td>
        <td>
          <div class="admin-toggle">
            <div class="toggle-switch ${pkg.popular ? 'active' : ''}" data-package-id="${pkg.id}" data-is-popular="${pkg.popular}"></div>
            <span>${pkg.popular ? 'Yes' : 'No'}</span>
          </div>
        </td>
        <td>
          <div class="admin-toggle">
            <div class="toggle-switch ${pkg.active ? 'active' : ''}" data-package-id="${pkg.id}" data-is-active="${pkg.active}"></div>
            <span style="color: ${pkg.active ? 'var(--accent-primary)' : 'var(--text-secondary)'}; font-weight: ${pkg.active ? '600' : '400'}">${pkg.active ? 'Active' : 'Inactive'}</span>
          </div>
        </td>
        <td>${pkg.order}</td>
        <td>
          <button class="admin-action-btn" onclick="editCreditPackage('${pkg.id}')" title="Edit">
            <i class="fas fa-edit"></i>
          </button>
          <button class="admin-action-btn danger" onclick="deleteCreditPackage('${pkg.id}')" title="Delete">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      `;
      
      // Add toggle listeners
      const popularToggle = row.querySelector('[data-is-popular]');
      if (popularToggle) {
        popularToggle.addEventListener('click', () => {
          toggleCreditPackagePopular(pkg.id, !pkg.popular);
        });
      }
      
      const activeToggle = row.querySelector('[data-is-active]');
      if (activeToggle) {
        activeToggle.addEventListener('click', () => {
          toggleCreditPackageActive(pkg.id, !pkg.active);
        });
      }
      
      creditPackagesTableBody.appendChild(row);
    });
  } catch (error) {
    console.error('Error loading credit packages:', error);
    if (creditPackagesTableBody) {
      creditPackagesTableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 40px; color: var(--error);">
            Error loading credit packages: ${error.message}
          </td>
        </tr>
      `;
    }
  }
}

// Credit package management functions
async function saveCreditPackage() {
  if (!isAdmin || !db) {
    alert('You do not have permission to perform this action');
    return;
  }
  
  const credits = parseInt(document.getElementById('creditPackageCredits')?.value) || 0;
  const price = parseFloat(document.getElementById('creditPackagePrice')?.value) || 0;
  const popular = document.getElementById('creditPackagePopular')?.checked || false;
  const active = document.getElementById('creditPackageActive')?.checked !== false;
  const order = parseInt(document.getElementById('creditPackageOrder')?.value) || 0;
  
  if (credits <= 0 || price <= 0) {
    alert('Credits and price must be greater than 0');
    return;
  }
  
  const saveBtn = document.getElementById('saveCreditPackageBtn');
  if (saveBtn) {
    saveBtn.disabled = true;
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    
    try {
      const packageData = {
        credits,
        price,
        popular,
        active,
        order,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      
      if (editingCreditPackageId) {
        await db.collection('creditPackages').doc(editingCreditPackageId).update(packageData);
      } else {
        packageData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection('creditPackages').add(packageData);
      }
      
      await loadCreditPackagesForAdmin();
      closeCreditPackageForm();
      alert('Credit package saved successfully!');
    } catch (error) {
      console.error('Error saving credit package:', error);
      alert('Error saving credit package: ' + error.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalText;
    }
  }
}

async function editCreditPackage(packageId) {
  if (!isAdmin || !db) return;
  
  editingCreditPackageId = packageId;
  const doc = await db.collection('creditPackages').doc(packageId).get();
  if (doc.exists) {
    const data = doc.data();
    if (document.getElementById('creditPackageFormTitle')) {
      document.getElementById('creditPackageFormTitle').textContent = 'Edit Credit Package';
    }
    if (document.getElementById('creditPackageCredits')) {
      document.getElementById('creditPackageCredits').value = data.credits || 0;
    }
    if (document.getElementById('creditPackagePrice')) {
      document.getElementById('creditPackagePrice').value = data.price || 0;
    }
    if (document.getElementById('creditPackagePopular')) {
      document.getElementById('creditPackagePopular').checked = data.popular || false;
    }
    if (document.getElementById('creditPackageActive')) {
      document.getElementById('creditPackageActive').checked = data.active !== false;
    }
    if (document.getElementById('creditPackageOrder')) {
      document.getElementById('creditPackageOrder').value = data.order || 0;
    }
    if (document.getElementById('creditPackageFormModal')) {
      document.getElementById('creditPackageFormModal').classList.add('active');
    }
  }
}

async function deleteCreditPackage(packageId) {
  if (!isAdmin || !db) {
    alert('You do not have permission to perform this action');
    return;
  }
  
  if (!confirm('Are you sure you want to delete this credit package?')) {
    return;
  }
  
  try {
    await db.collection('creditPackages').doc(packageId).delete();
    await loadCreditPackagesForAdmin();
    alert('Credit package deleted successfully!');
  } catch (error) {
    console.error('Error deleting credit package:', error);
    alert('Error deleting credit package: ' + error.message);
  }
}

async function toggleCreditPackagePopular(packageId, isPopular) {
  if (!isAdmin || !db) return;
  
  try {
    await db.collection('creditPackages').doc(packageId).update({
      popular: isPopular,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await loadCreditPackagesForAdmin();
  } catch (error) {
    console.error('Error toggling package popular status:', error);
    alert('Error updating package: ' + error.message);
  }
}

async function toggleCreditPackageActive(packageId, isActive) {
  if (!isAdmin || !db) return;
  
  try {
    await db.collection('creditPackages').doc(packageId).update({
      active: isActive,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await loadCreditPackagesForAdmin();
  } catch (error) {
    console.error('Error toggling package active status:', error);
    alert('Error updating package: ' + error.message);
  }
}

function closeCreditPackageForm() {
  editingCreditPackageId = null;
  if (document.getElementById('creditPackageFormModal')) {
    document.getElementById('creditPackageFormModal').classList.remove('active');
  }
  if (document.getElementById('creditPackageForm')) {
    document.getElementById('creditPackageForm').reset();
  }
}

// Expose credit package functions globally
window.editCreditPackage = editCreditPackage;
window.deleteCreditPackage = deleteCreditPackage;
window.saveCreditPackage = saveCreditPackage;
window.closeCreditPackageForm = closeCreditPackageForm;

// Deduct credits from user account
async function deductCredits(amount, reason, metadata = {}) {
  if (!currentUser || !db) {
    throw new Error('User not authenticated');
  }
  
  if (userCredits < amount) {
    throw new Error(`Insufficient credits. You have ${userCredits} credits but need ${amount}.`);
  }
  
  try {
    const newBalance = userCredits - amount;
    
    // Update user credits
    await db.collection('users').doc(currentUser.uid).update({
      credits: newBalance,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Record transaction
    await db.collection('creditTransactions').add({
      userId: currentUser.uid,
      type: 'deduction',
      amount: -amount,
      reason: reason,
      balanceBefore: userCredits,
      balanceAfter: newBalance,
      metadata: metadata,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    userCredits = newBalance;
    updateCreditsDisplay();
    
    return newBalance;
  } catch (error) {
    console.error('Error deducting credits:', error);
    throw error;
  }
}

// Add credits to user account (after purchase)
async function addCredits(amount, purchaseId, metadata = {}) {
  if (!currentUser || !db) {
    throw new Error('User not authenticated');
  }
  
  try {
    const newBalance = userCredits + amount;
    
    // Update user credits
    await db.collection('users').doc(currentUser.uid).update({
      credits: newBalance,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Record purchase
    await db.collection('creditPurchases').add({
      userId: currentUser.uid,
      credits: amount,
      purchaseId: purchaseId,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      ...metadata
    });
    
    // Record transaction
    await db.collection('creditTransactions').add({
      userId: currentUser.uid,
      type: 'purchase',
      amount: amount,
      reason: 'Credit purchase',
      balanceBefore: userCredits,
      balanceAfter: newBalance,
      metadata: { purchaseId, ...metadata },
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    userCredits = newBalance;
    updateCreditsDisplay();
    
    return newBalance;
  } catch (error) {
    console.error('Error adding credits:', error);
    throw error;
  }
}

// Get credit cost for avatar creation method
function getAvatarCreationCreditCost(method) {
  if (creditConfig) {
    switch (method) {
      case 'recording':
        return creditConfig.recording;
      case 'ai':
        return creditConfig.ai;
      case 'url':
        return creditConfig.url;
      default:
        return 0;
    }
  }
  return { recording: 10, ai: 50, url: 5 }[method] || 0;
}

// Get credit cost for chat based on token usage
function getChatCreditCost(tokenCount) {
  if (!creditConfig) return 0;
  return Math.ceil((tokenCount / 10000) * creditConfig.per10kTokens);
}

// Buy credits - initiate Stripe checkout
async function buyCredits(credits, price) {
  if (!currentUser) {
    alert('Please sign in to buy credits');
    return;
  }
  
  try {
    const response = await fetch('/api/create-credit-purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUser.uid,
        credits: credits,
        price: price,
        successUrl: `${window.location.origin}${window.location.pathname}?credit_purchase=success&credits=${credits}`,
        cancelUrl: `${window.location.origin}${window.location.pathname}?credit_purchase=cancelled`
      })
    });
    
    const data = await response.json();
    
    if (data.success && data.url) {
      window.location.href = data.url;
    } else {
      throw new Error(data.error || 'Failed to create checkout session');
    }
  } catch (error) {
    console.error('Error initiating credit purchase:', error);
    alert('Error initiating credit purchase: ' + error.message);
  }
}

// Load credit packages for purchase modal (from Firestore)
async function loadCreditPackages() {
  if (!db) return;
  
  try {
    // Load active packages from Firestore, sorted by order
    const querySnapshot = await db.collection('creditPackages')
      .where('active', '==', true)
      .get();
    
    const packages = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      packages.push({
        id: doc.id,
        credits: data.credits || 0,
        price: data.price || 0,
        popular: data.popular || false,
        order: data.order || 0
      });
    });
    
    // Sort by order
    packages.sort((a, b) => a.order - b.order);
    
    // If no packages found, use defaults
    if (packages.length === 0) {
      packages.push(
        { credits: 100, price: 9.99, popular: false, order: 1 },
        { credits: 250, price: 19.99, popular: true, order: 2 },
        { credits: 500, price: 34.99, popular: false, order: 3 },
        { credits: 1000, price: 59.99, popular: false, order: 4 }
      );
    }
    
    if (!creditPackagesList) return;
    
    creditPackagesList.innerHTML = '';
    
    packages.forEach(pkg => {
    const packageDiv = document.createElement('div');
    packageDiv.style.cssText = 'padding: 16px; border: 2px solid ' + (pkg.popular ? 'var(--accent-primary)' : 'var(--border-color)') + '; border-radius: 12px; background: var(--bg-tertiary); cursor: pointer; transition: all 0.3s ease; margin-bottom: 12px;';
    if (pkg.popular) {
      packageDiv.style.position = 'relative';
      const popularBadge = document.createElement('div');
      popularBadge.style.cssText = 'position: absolute; top: -10px; right: 16px; background: var(--accent-primary); color: white; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: 600;';
      popularBadge.textContent = 'POPULAR';
      packageDiv.appendChild(popularBadge);
    }
    const contentDiv = document.createElement('div');
    contentDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';
    contentDiv.innerHTML = `
      <div>
        <div style="font-size: 20px; font-weight: 700; color: var(--text-primary);">${pkg.credits} Credits</div>
        <div style="font-size: 14px; color: var(--text-secondary); margin-top: 4px;">$${pkg.price.toFixed(2)}</div>
      </div>
      <button class="chat-send-btn" onclick="buyCredits(${pkg.credits}, ${pkg.price})" style="padding: 10px 20px;">
        <i class="fas fa-shopping-cart"></i> Buy
      </button>
    `;
    packageDiv.appendChild(contentDiv);
    packageDiv.addEventListener('mouseenter', () => {
      packageDiv.style.transform = 'translateY(-2px)';
      packageDiv.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    });
    packageDiv.addEventListener('mouseleave', () => {
      packageDiv.style.transform = 'translateY(0)';
      packageDiv.style.boxShadow = 'none';
    });
    creditPackagesList.appendChild(packageDiv);
  });
  } catch (error) {
    console.error('Error loading credit packages:', error);
    // If error, show default packages
    if (creditPackagesList) {
      creditPackagesList.innerHTML = '';
      const defaultPackages = [
        { credits: 100, price: 9.99, popular: false },
        { credits: 250, price: 19.99, popular: true },
        { credits: 500, price: 34.99, popular: false },
        { credits: 1000, price: 59.99, popular: false }
      ];
      
      defaultPackages.forEach(pkg => {
        const packageDiv = document.createElement('div');
        packageDiv.style.cssText = 'padding: 16px; border: 2px solid ' + (pkg.popular ? 'var(--accent-primary)' : 'var(--border-color)') + '; border-radius: 12px; background: var(--bg-tertiary); cursor: pointer; transition: all 0.3s ease; margin-bottom: 12px;';
        if (pkg.popular) {
          packageDiv.style.position = 'relative';
          const popularBadge = document.createElement('div');
          popularBadge.style.cssText = 'position: absolute; top: -10px; right: 16px; background: var(--accent-primary); color: white; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: 600;';
          popularBadge.textContent = 'POPULAR';
          packageDiv.appendChild(popularBadge);
        }
        const contentDiv = document.createElement('div');
        contentDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';
        contentDiv.innerHTML = `
          <div>
            <div style="font-size: 20px; font-weight: 700; color: var(--text-primary);">${pkg.credits} Credits</div>
            <div style="font-size: 14px; color: var(--text-secondary); margin-top: 4px;">$${pkg.price.toFixed(2)}</div>
          </div>
          <button class="chat-send-btn" onclick="buyCredits(${pkg.credits}, ${pkg.price})" style="padding: 10px 20px;">
            <i class="fas fa-shopping-cart"></i> Buy
          </button>
        `;
        packageDiv.appendChild(contentDiv);
        packageDiv.addEventListener('mouseenter', () => {
          packageDiv.style.transform = 'translateY(-2px)';
          packageDiv.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        });
        packageDiv.addEventListener('mouseleave', () => {
          packageDiv.style.transform = 'translateY(0)';
          packageDiv.style.boxShadow = 'none';
        });
        creditPackagesList.appendChild(packageDiv);
      });
    }
  }
}

// Expose buyCredits globally
window.buyCredits = buyCredits;

// Update subscription status display
async function updateSubscriptionStatus() {
  if (!currentUser || !db || !subscriptionStatusText) return;
  
  try {
    const hasSubscription = await checkActiveSubscription();
    if (hasSubscription) {
      if (subscriptionStatusText) {
        subscriptionStatusText.textContent = 'Active Subscription';
        subscriptionStatusText.style.color = 'var(--success)';
      }
      if (subscriptionStatus) {
        subscriptionStatus.innerHTML = '<i class="fas fa-check-circle" style="color: var(--success);"></i> <span style="color: var(--success);">Active Subscription</span>';
      }
    } else {
      if (subscriptionStatusText) {
        subscriptionStatusText.textContent = 'No Active Subscription';
        subscriptionStatusText.style.color = 'var(--text-secondary)';
      }
      if (subscriptionStatus) {
        subscriptionStatus.innerHTML = '<i class="fas fa-info-circle"></i> <span>No Active Subscription</span>';
      }
    }
  } catch (error) {
    console.error('Error updating subscription status:', error);
  }
}

// Check if user has active subscription
async function checkActiveSubscription() {
  if (!currentUser || !db) return false;
  
  try {
    const subscriptionsSnapshot = await db.collection('userSubscriptions')
      .where('userId', '==', currentUser.uid)
      .where('status', '==', 'active')
      .limit(1)
      .get();
    
    return !subscriptionsSnapshot.empty;
  } catch (error) {
    console.error('Error checking active subscription:', error);
    return false;
  }
}

// Handle credit purchase callback
async function handleCreditPurchaseCallback() {
  const urlParams = new URLSearchParams(window.location.search);
  const creditPurchase = urlParams.get('credit_purchase');
  const credits = urlParams.get('credits');
  
  // If no credit purchase params, nothing to process
  if (!creditPurchase) {
    return;
  }
  
  if (creditPurchase === 'success' && credits) {
    try {
      // Add credits to user account
      await addCredits(parseInt(credits), `stripe_${Date.now()}`, {
        source: 'stripe_checkout'
      });
      alert(`Successfully added ${credits} credits to your account!`);
      
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (error) {
      console.error('Error adding credits:', error);
      alert('Error adding credits. Please contact support if credits were charged.');
    }
  } else if (creditPurchase === 'cancelled') {
    // Clean up URL
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

// Handle payment callbacks from URL parameters
async function handlePaymentCallbacks() {
  const urlParams = new URLSearchParams(window.location.search);
  const paymentStatus = urlParams.get('payment');
  const subscriptionStatus = urlParams.get('subscription');
  const avatarId = urlParams.get('avatarId');
  
  // If no payment/subscription params, nothing to process
  if (!paymentStatus && !subscriptionStatus) {
    return;
  }
  
  // Clean URL immediately to prevent re-processing on auth state changes
  window.history.replaceState({}, document.title, window.location.pathname);
  
  if (paymentStatus === 'success') {
    // Payment successful - record it in Firestore
    if (currentUser && db) {
      try {
        const price = await getAvatarCreationPrice();
        await db.collection('payments').add({
          userId: currentUser.uid,
          avatarId: avatarId && avatarId !== 'new' ? avatarId : null,
          amount: price,
          status: 'completed',
          type: 'avatar_creation',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        if (avatarId && avatarId !== 'new') {
          alert('Payment successful! You can now proceed with avatar creation.');
        } else {
          alert('Payment successful! You can now create your avatar.');
        }
        await updateSubscriptionStatus();
      } catch (error) {
        console.error('Error recording payment:', error);
        alert('Payment successful, but there was an error recording it. Please contact support.');
      }
    }
  } else if (paymentStatus === 'cancelled') {
    alert('Payment was cancelled.');
  }
  
  if (subscriptionStatus === 'success') {
    // Subscription successful - update status
    // The webhook will handle creating the subscription record
    alert('Subscription activated successfully!');
    await updateSubscriptionStatus();
  } else if (subscriptionStatus === 'cancelled') {
    alert('Subscription was cancelled.');
  }
}

// Load subscription packages for user selection
async function loadSubscriptionPackagesForUser() {
  if (!db) return [];
  
  try {
    const querySnapshot = await db.collection('subscriptionPackages')
      .where('active', '==', true)
      .orderBy('price', 'asc')
      .get();
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error loading subscription packages:', error);
    return [];
  }
}

// Show subscription selection modal
async function showSubscriptionModal() {
  if (!subscriptionModal) return;
  
  subscriptionModal.classList.add('active');
  
  if (subscriptionPackagesList) {
    subscriptionPackagesList.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-secondary);"><i class="fas fa-spinner fa-spin"></i> Loading packages...</div>';
  }
  
  const packages = await loadSubscriptionPackagesForUser();
  
  if (!subscriptionPackagesList) return;
  
  if (packages.length === 0) {
    subscriptionPackagesList.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
        <i class="fas fa-info-circle"></i>
        <div style="margin-top: 12px;">No subscription packages available at this time.</div>
      </div>
    `;
    return;
  }
  
  subscriptionPackagesList.innerHTML = packages.map(pkg => `
    <div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 12px; padding: 24px; display: flex; flex-direction: column;">
      <h3 style="margin-bottom: 8px; color: var(--text-primary);">${pkg.name}</h3>
      <div style="margin-bottom: 12px; color: var(--text-secondary); font-size: 14px;">${pkg.description || ''}</div>
      <div style="margin-top: auto;">
        <div style="font-size: 32px; font-weight: 700; color: var(--accent-primary); margin-bottom: 16px;">
          $${pkg.price.toFixed(2)}
          <span style="font-size: 16px; font-weight: 400; color: var(--text-secondary);">
            /${pkg.interval === 'year' ? 'year' : 'month'}
          </span>
        </div>
        <button class="chat-send-btn" onclick="subscribeToPackage('${pkg.id}', ${pkg.price}, '${pkg.interval}', '${pkg.name.replace(/'/g, "\\'")}')" style="width: 100%;">
          <i class="fas fa-credit-card"></i> Subscribe
        </button>
      </div>
    </div>
  `).join('');
}

// Subscribe to a package
async function subscribeToPackage(packageId, price, interval, name) {
  if (!currentUser) {
    alert('Please sign in to subscribe');
    return;
  }
  
  try {
    const response = await fetch('/api/create-subscription-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        packageId,
        userId: currentUser.uid,
        price: Math.round(price * 100), // Convert to cents
        name,
        interval,
        email: currentUser.email,
        successUrl: `${window.location.origin}${window.location.pathname}?subscription=success`,
        cancelUrl: `${window.location.origin}${window.location.pathname}?subscription=cancelled`
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create subscription');
    }
    
    const data = await response.json();
    
    // Redirect to Stripe Checkout
    window.location.href = data.url;
    
  } catch (error) {
    console.error('Error creating subscription:', error);
    alert('Error processing subscription: ' + error.message);
  }
}

// Get avatar creation price
async function getAvatarCreationPrice() {
  if (!db) return 0;
  
  try {
    const pricingDoc = await db.collection('admin').doc('pricing').get();
    if (pricingDoc.exists) {
      return pricingDoc.data().avatarCreationPrice || 0;
    }
  } catch (error) {
    console.error('Error getting avatar creation price:', error);
  }
  
  return 0;
}

// Get active training video URL
async function getActiveTrainingVideoUrl() {
  if (!db) return null;
  
  try {
    const activeVideos = await db.collection('trainingVideos')
      .where('active', '==', true)
      .limit(1)
      .get();
    
    if (!activeVideos.empty) {
      return activeVideos.docs[0].data().videoUrl;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting active training video:', error);
    return null;
  }
}

// Copy training video URL to clipboard
async function copyTrainingVideoUrl(url, buttonElement) {
  try {
    await navigator.clipboard.writeText(url);
    
    // Show feedback
    const originalHTML = buttonElement.innerHTML;
    buttonElement.innerHTML = '<i class="fas fa-check"></i>';
    buttonElement.style.color = 'var(--accent-primary)';
    
    setTimeout(() => {
      buttonElement.innerHTML = originalHTML;
      buttonElement.style.color = '';
    }, 2000);
    
  } catch (error) {
    console.error('Error copying to clipboard:', error);
    // Fallback for older browsers
    try {
      const textArea = document.createElement('textarea');
      textArea.value = url;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      // Show feedback
      const originalHTML = buttonElement.innerHTML;
      buttonElement.innerHTML = '<i class="fas fa-check"></i>';
      buttonElement.style.color = 'var(--accent-primary)';
      
      setTimeout(() => {
        buttonElement.innerHTML = originalHTML;
        buttonElement.style.color = '';
      }, 2000);
    } catch (fallbackError) {
      alert('Failed to copy URL. Please copy manually: ' + url);
    }
  }
}

/**
 * Initialize Material Design Components
 */
function initMaterialComponents() {
  if (!window.mdc) return;
  
  // Initialize buttons
  const buttons = document.querySelectorAll('.mdc-button:not([data-mdc-initialized])');
  buttons.forEach(button => {
    try {
      if (window.mdc.ripple) {
        window.mdc.ripple.MDCRipple.attachTo(button);
        button.setAttribute('data-mdc-initialized', 'true');
      }
    } catch (e) {
      console.warn('Failed to initialize button:', e);
    }
  });
  
  // Initialize icon buttons
  const iconButtons = document.querySelectorAll('.mdc-icon-button:not([data-mdc-initialized])');
  iconButtons.forEach(button => {
    try {
      if (window.mdc.ripple) {
        window.mdc.ripple.MDCRipple.attachTo(button);
        button.setAttribute('data-mdc-initialized', 'true');
      }
    } catch (e) {
      console.warn('Failed to initialize icon button:', e);
    }
  });
  
  // Initialize text fields
  const textFields = document.querySelectorAll('.mdc-text-field:not([data-mdc-initialized])');
  textFields.forEach(textField => {
    try {
      if (window.mdc.textField) {
        window.mdc.textField.MDCTextField.attachTo(textField);
        textField.setAttribute('data-mdc-initialized', 'true');
      }
    } catch (e) {
      console.warn('Failed to initialize text field:', e);
    }
  });
  
  // Initialize data tables
  const dataTables = document.querySelectorAll('.mdc-data-table:not([data-mdc-initialized])');
  dataTables.forEach(table => {
    try {
      if (window.mdc.dataTable) {
        window.mdc.dataTable.MDCDataTable.attachTo(table);
        table.setAttribute('data-mdc-initialized', 'true');
      }
    } catch (e) {
      console.warn('Failed to initialize data table:', e);
    }
  });
}

/**
 * Initialize Authentication
 */
function initAuth() {
  // Wait for Firebase to be ready (it loads asynchronously from server)
  if (!window.firebaseAuth || !window.firebaseDb) {
    // Check if Firebase is still loading
    if (window.firebaseReady === undefined) {
      // Firebase is still loading, wait a bit and try again
      setTimeout(initAuth, 500);
      return;
    }
    
    // Firebase failed to load or is not configured
    const errorMsg = window.firebaseReady === false 
      ? 'Firebase failed to initialize. Please check your server configuration and ensure all Firebase environment variables are set in your .env file.'
      : 'Firebase not configured. Please set all Firebase environment variables in your .env file and restart the server.';
    
    if (authError) {
      authError.textContent = errorMsg;
      authError.classList.add('show');
    }
    // Still set up the form handlers so user can see the error
    if (authForm) {
      authForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (authError) {
          authError.textContent = errorMsg;
          authError.classList.add('show');
        }
      });
    }
    if (authToggleLink) {
      authToggleLink.addEventListener('click', toggleAuthMode);
    }
    return;
  }
  
  try {
    auth = window.firebaseAuth;
    db = window.firebaseDb;
    storage = window.firebaseStorage;
    
    // Set up auth state listener
    auth.onAuthStateChanged(async (user) => {
      if (user) {
        currentUser = user;
        if (authModal) authModal.classList.add('hidden');
        if (mainContainer) mainContainer.style.display = 'flex';
        if (userInfo) userInfo.style.display = 'flex';
        if (userEmail) userEmail.textContent = user.email;
        if (sessionsPanel) sessionsPanel.classList.add('show');
        
        // Check admin status
        await checkAdminStatus();
        
        // Load expressions from Firestore (for all users)
        await loadExpressions();
        
        // Load credit configuration
        await loadCreditConfiguration();
        
        // Load user credits
        await loadUserCredits();
        
        // Check subscription status
        await updateSubscriptionStatus();
        
        // Handle payment/subscription callbacks (only once per page load)
        // Use a flag to prevent multiple executions
        if (!window.paymentCallbacksHandled) {
          window.paymentCallbacksHandled = true;
          handlePaymentCallbacks();
          await handleCreditPurchaseCallback();
        }
        
        // Load avatars first (this is the default page)
        loadAvatars();
        
        // Check for pending avatar generations
        checkPendingGenerations();
        
        // Don't auto-create session - user will select an avatar first
        // Load existing sessions if any
        loadSessions();
      } else {
        currentUser = null;
        currentSessionId = null;
        isAdmin = false;
        conversationHistory = [];
        if (chatMessagesEl) chatMessagesEl.innerHTML = '';
        if (authModal) authModal.classList.remove('hidden');
        if (mainContainer) mainContainer.style.display = 'none';
        if (userInfo) userInfo.style.display = 'none';
        if (adminBtn) adminBtn.style.display = 'none';
        if (sessionsPanel) sessionsPanel.classList.remove('show');
      }
    });
    
    // Set up auth form
    if (authForm) {
      authForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleAuth();
      });
    }
    
    if (authToggleLink) {
      authToggleLink.addEventListener('click', toggleAuthMode);
    }
    if (googleSignInBtn) {
      googleSignInBtn.addEventListener('click', handleGoogleSignIn);
    }
    if (logoutBtn) {
      logoutBtn.addEventListener('click', handleLogout);
    }
    
    // Nav brand click handler - navigate to home page
    const navBrand = document.querySelector('header h1');
    if (navBrand) {
      navBrand.style.cursor = 'pointer';
      navBrand.addEventListener('click', () => {
        switchPage('avatars');
        // Clear current session and avatar when going home
        currentSessionId = null;
        currentAvatarId = null;
        conversationHistory = [];
        if (chatMessagesEl) chatMessagesEl.innerHTML = '';
        if (reactionVideoEl) {
          reactionVideoEl.src = './video/reaction-video.mp4';
          reactionVideoEl.load();
        }
        loadAvatars();
      });
    }
    
    // Back to home button from chat page
    const backToHomeBtn = document.getElementById('backToHomeBtn');
    if (backToHomeBtn) {
      backToHomeBtn.addEventListener('click', () => {
        switchPage('avatars');
        // Clear current session and avatar when going home
        currentSessionId = null;
        currentAvatarId = null;
        conversationHistory = [];
        if (chatMessagesEl) chatMessagesEl.innerHTML = '';
        if (reactionVideoEl) {
          reactionVideoEl.src = './video/reaction-video.mp4';
          reactionVideoEl.load();
        }
        loadAvatars();
      });
    }
    
    if (newSessionBtn) {
      newSessionBtn.addEventListener('click', async () => {
        // Clear current session and avatar, go back to avatars
        currentSessionId = null;
        currentAvatarId = null;
        conversationHistory = [];
        if (chatMessagesEl) chatMessagesEl.innerHTML = '';
        if (reactionVideoEl) {
          reactionVideoEl.src = './video/reaction-video.mp4';
          reactionVideoEl.load();
        }
        switchPage('avatars');
        await loadAvatars();
      });
    }
    
    // Avatar management
    if (createAvatarBtn) {
      createAvatarBtn.addEventListener('click', async () => {
        await openAvatarForm();
      });
    }
    
    // Generation progress modal close button
    if (generationProgressCloseBtn) {
      generationProgressCloseBtn.addEventListener('click', () => {
        hideGenerationProgress();
      });
    }
    if (avatarForm) {
      avatarForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveAvatar();
      });
    }
    if (cancelAvatarBtn) {
      cancelAvatarBtn.addEventListener('click', closeAvatarForm);
    }
    if (avatarFormCloseBtn) {
      avatarFormCloseBtn.addEventListener('click', closeAvatarForm);
    }
    
    // Memory bank file selection handler
    const avatarMemoryBank = document.getElementById('avatarMemoryBank');
    if (avatarMemoryBank) {
      avatarMemoryBank.addEventListener('change', (e) => {
        const files = e.target.files;
        const memoryBankFilesList = document.getElementById('memoryBankFilesList');
        const memoryBankFilesListContent = document.getElementById('memoryBankFilesListContent');
        
        if (files && files.length > 0) {
          if (memoryBankFilesList) memoryBankFilesList.style.display = 'block';
          if (memoryBankFilesListContent) {
            memoryBankFilesListContent.innerHTML = '';
            for (let i = 0; i < files.length; i++) {
              const file = files[i];
              const fileItem = document.createElement('div');
              fileItem.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px;';
              fileItem.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                  <i class="fas fa-${file.name.toLowerCase().endsWith('.pdf') ? 'file-pdf' : 'file-alt'}" style="color: var(--accent-primary);"></i>
                  <span style="font-size: 13px; color: var(--text-primary);">${file.name}</span>
                  <span style="font-size: 11px; color: var(--text-secondary);">(${(file.size / 1024).toFixed(1)} KB)</span>
                </div>
              `;
              memoryBankFilesListContent.appendChild(fileItem);
            }
          }
        } else {
          if (memoryBankFilesList) memoryBankFilesList.style.display = 'none';
          if (memoryBankFilesListContent) memoryBankFilesListContent.innerHTML = '';
        }
      });
    }
    
    // Video recording buttons
    if (recordVideoBtn) {
      recordVideoBtn.addEventListener('click', async () => {
        const initialized = await initializeRecording();
        if (!initialized) {
          // If initialization failed, show URL input as fallback
          if (videoUrlInputGroup) videoUrlInputGroup.style.display = 'block';
        }
      });
    }
    
    if (useVideoUrlBtn) {
      useVideoUrlBtn.addEventListener('click', () => {
        if (videoUrlInputGroup) videoUrlInputGroup.style.display = 'block';
        if (videoRecordingGroup) videoRecordingGroup.style.display = 'none';
        if (avatarVideoUrl) avatarVideoUrl.setAttribute('required', 'required');
        stopRecording();
        cleanupRecording();
      });
    }
    
    // Recording control buttons
    if (startRecordingBtn) {
      startRecordingBtn.addEventListener('click', startRecordingExpression);
    }
    
    if (pauseRecordingBtn) {
      pauseRecordingBtn.addEventListener('click', pauseRecordingExpression);
    }
    
    if (resumeRecordingBtn) {
      resumeRecordingBtn.addEventListener('click', resumeRecordingExpression);
    }
    
    if (retryRecordingBtn) {
      retryRecordingBtn.addEventListener('click', retryCurrentExpression);
    }
    
    if (nextExpressionBtn) {
      nextExpressionBtn.addEventListener('click', nextExpression);
    }
    
    if (finishRecordingBtn) {
      finishRecordingBtn.addEventListener('click', finishRecording);
    }
    
    // Video preview on URL change
    if (avatarVideoUrl) {
      let previewTimeout;
      avatarVideoUrl.addEventListener('input', (e) => {
        clearTimeout(previewTimeout);
        const url = e.target.value.trim();
        
        // Debounce preview update
        previewTimeout = setTimeout(() => {
          if (url) {
            updateVideoPreview(url);
          } else {
            hideVideoPreview();
          }
        }, 500);
      });
    }
    
    // Close modal when clicking outside
    if (avatarFormModal) {
      avatarFormModal.addEventListener('click', (e) => {
        if (e.target === avatarFormModal) {
          closeAvatarForm();
        }
      });
    }
    
    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (avatarFormModal && avatarFormModal.classList.contains('active')) {
          closeAvatarForm();
        }
        if (expressionFormModal && expressionFormModal.classList.contains('active')) {
          closeExpressionForm();
        }
      }
    });
    
    // Admin functionality
    if (adminBtn) {
      adminBtn.addEventListener('click', () => {
        if (!isAdmin) {
          alert('You do not have admin access');
          return;
        }
        switchPage('admin');
        switchAdminSection('users');
      });
    }
    
    if (backToMainBtn) {
      backToMainBtn.addEventListener('click', () => {
        switchPage('avatars');
      });
    }
    
    // Admin navigation
    if (adminNavBtns) {
      adminNavBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const section = btn.dataset.section;
          switchAdminSection(section);
        });
      });
    }
    
    // Expression management
    if (createExpressionBtn) {
      createExpressionBtn.addEventListener('click', () => openExpressionForm());
    }
    if (populateDefaultExpressionsBtn) {
      populateDefaultExpressionsBtn.addEventListener('click', populateDefaultExpressions);
    }
    if (expressionForm) {
      expressionForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveExpression();
      });
    }
    if (cancelExpressionBtn) {
      cancelExpressionBtn.addEventListener('click', closeExpressionForm);
    }
    if (expressionFormCloseBtn) {
      expressionFormCloseBtn.addEventListener('click', closeExpressionForm);
    }
    
    // Close expression modal when clicking outside
    if (expressionFormModal) {
      expressionFormModal.addEventListener('click', (e) => {
        if (e.target === expressionFormModal) {
          closeExpressionForm();
        }
      });
    }
    
    // Content moderation management
    if (saveModerationBtn) {
      saveModerationBtn.addEventListener('click', saveModerationRules);
    }
    if (resetModerationBtn) {
      resetModerationBtn.addEventListener('click', resetModerationRules);
    }
    
    // Training video management
    if (uploadTrainingVideoBtn) {
      uploadTrainingVideoBtn.addEventListener('click', () => {
        if (trainingVideoUploadForm) {
          trainingVideoUploadForm.style.display = 'block';
        }
        if (trainingVideoName) trainingVideoName.focus();
      });
    }
    
    if (cancelTrainingVideoUploadBtn) {
      cancelTrainingVideoUploadBtn.addEventListener('click', () => {
        if (trainingVideoUploadForm) trainingVideoUploadForm.style.display = 'none';
        if (trainingVideoName) trainingVideoName.value = '';
        if (trainingVideoUpload) trainingVideoUpload.value = '';
        if (trainingVideoPreview) trainingVideoPreview.style.display = 'none';
      });
    }
    
    if (trainingVideoUpload) {
      trainingVideoUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const url = URL.createObjectURL(file);
          if (trainingVideoPreviewEl) {
            trainingVideoPreviewEl.src = url;
          }
          if (trainingVideoPreview) {
            trainingVideoPreview.style.display = 'block';
          }
        }
      });
    }
    
    if (saveTrainingVideoBtn) {
      saveTrainingVideoBtn.addEventListener('click', saveTrainingVideo);
    }
    
    // Profile photo preview
    const avatarProfilePhoto = document.getElementById('avatarProfilePhoto');
    const profilePhotoPreview = document.getElementById('profilePhotoPreview');
    const profilePhotoPreviewImg = document.getElementById('profilePhotoPreviewImg');
    
    if (avatarProfilePhoto) {
      avatarProfilePhoto.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const url = URL.createObjectURL(file);
          if (profilePhotoPreviewImg) {
            profilePhotoPreviewImg.src = url;
          }
          if (profilePhotoPreview) {
            profilePhotoPreview.style.display = 'block';
          }
        } else {
          if (profilePhotoPreview) {
            profilePhotoPreview.style.display = 'none';
          }
        }
      });
    }
    
    // Make functions available globally for onclick handlers
    window.toggleUserAdmin = toggleUserAdmin;
    window.awardCreditsToUser = awardCreditsToUser;
    window.openExpressionForm = openExpressionForm;
    window.deleteExpression = deleteExpression;
    window.toggleTrainingVideoStatus = toggleTrainingVideoStatus;
    window.deleteTrainingVideo = deleteTrainingVideo;
    window.copyTrainingVideoUrl = copyTrainingVideoUrl;
    window.editPackage = editPackage;
    window.deletePackage = deletePackage;
    window.subscribeToPackage = subscribeToPackage;
    
    // Package form event listeners
    if (createPackageBtn) {
      createPackageBtn.addEventListener('click', () => openPackageForm());
    }
    if (packageForm) {
      packageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        savePackage();
      });
    }
    if (packageFormCloseBtn) {
      packageFormCloseBtn.addEventListener('click', closePackageForm);
    }
    if (cancelPackageBtn) {
      cancelPackageBtn.addEventListener('click', closePackageForm);
    }
    
    // Pricing configuration
    if (savePricingBtn) {
      savePricingBtn.addEventListener('click', savePricingConfiguration);
    }
    
    // Credit system
    if (buyCreditsBtn) {
      buyCreditsBtn.addEventListener('click', async () => {
        if (creditPurchaseModal) {
          await loadCreditPackages();
          await loadUserCredits();
          creditPurchaseModal.classList.add('active');
        }
      });
    }
    
    if (creditPurchaseCloseBtn) {
      creditPurchaseCloseBtn.addEventListener('click', () => {
        if (creditPurchaseModal) {
          creditPurchaseModal.classList.remove('active');
        }
      });
    }
    
    if (saveCreditConfigBtn) {
      saveCreditConfigBtn.addEventListener('click', saveCreditConfiguration);
    }
    
    // Credit package management
    if (createCreditPackageBtn) {
      createCreditPackageBtn.addEventListener('click', () => {
        editingCreditPackageId = null;
        if (document.getElementById('creditPackageFormTitle')) {
          document.getElementById('creditPackageFormTitle').textContent = 'Create Credit Package';
        }
        if (document.getElementById('creditPackageFormModal')) {
          document.getElementById('creditPackageFormModal').classList.add('active');
        }
        if (document.getElementById('creditPackageForm')) {
          document.getElementById('creditPackageForm').reset();
          // Set default active to true
          const activeCheckbox = document.getElementById('creditPackageActive');
          if (activeCheckbox) activeCheckbox.checked = true;
        }
      });
    }
    
    const creditPackageFormCloseBtn = document.getElementById('creditPackageFormCloseBtn');
    if (creditPackageFormCloseBtn) {
      creditPackageFormCloseBtn.addEventListener('click', closeCreditPackageForm);
    }
    
    const cancelCreditPackageBtn = document.getElementById('cancelCreditPackageBtn');
    if (cancelCreditPackageBtn) {
      cancelCreditPackageBtn.addEventListener('click', closeCreditPackageForm);
    }
    
    // Category management
    if (createCategoryBtn) {
      createCategoryBtn.addEventListener('click', () => {
        editingCategoryId = null;
        if (document.getElementById('categoryFormTitle')) {
          document.getElementById('categoryFormTitle').textContent = 'Create Category';
        }
        if (document.getElementById('categoryFormModal')) {
          document.getElementById('categoryFormModal').classList.add('active');
        }
        if (document.getElementById('categoryForm')) {
          document.getElementById('categoryForm').reset();
        }
      });
    }
    
    const categoryFormCloseBtn = document.getElementById('categoryFormCloseBtn');
    const cancelCategoryBtn = document.getElementById('cancelCategoryBtn');
    if (categoryFormCloseBtn) {
      categoryFormCloseBtn.addEventListener('click', closeCategoryForm);
    }
    if (cancelCategoryBtn) {
      cancelCategoryBtn.addEventListener('click', closeCategoryForm);
    }
    
    // Subscription modal
    if (subscriptionModalCloseBtn) {
      subscriptionModalCloseBtn.addEventListener('click', () => {
        if (subscriptionModal) subscriptionModal.classList.remove('active');
      });
    }
    
    // Subscribe button
    if (subscribeBtn) {
      subscribeBtn.addEventListener('click', () => {
        showSubscriptionModal();
      });
    }
    
    // Initialize Material Design Components
    if (window.mdc) {
      initMaterialComponents();
      // Re-initialize when admin sections are shown
      const observer = new MutationObserver(() => {
        initMaterialComponents();
      });
      if (adminPage) {
        observer.observe(adminPage, { childList: true, subtree: true });
      }
    }
  } catch (error) {
    console.error('Error initializing auth:', error);
    if (authError) {
      authError.textContent = 'Error initializing Firebase. Please check the console for details.';
      authError.classList.add('show');
    }
  }
}

// Initialize auth when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Wait for Firebase to load (it's async, so we'll retry in initAuth if needed)
    setTimeout(initAuth, 100);
    // Initialize Material Design components after a delay to ensure MDC is loaded
    setTimeout(() => {
      if (window.mdc) {
        initMaterialComponents();
        // Re-initialize when admin sections are shown
        const adminPage = document.getElementById('adminPage');
        if (adminPage) {
          const observer = new MutationObserver(() => {
            setTimeout(initMaterialComponents, 100);
          });
          observer.observe(adminPage, { childList: true, subtree: true });
        }
      }
    }, 500);
  });
} else {
  setTimeout(initAuth, 100);
  setTimeout(() => {
    if (window.mdc) {
      initMaterialComponents();
      const adminPage = document.getElementById('adminPage');
      if (adminPage) {
        const observer = new MutationObserver(() => {
          setTimeout(initMaterialComponents, 100);
        });
        observer.observe(adminPage, { childList: true, subtree: true });
      }
    }
  }, 500);
}

// Initialize: Set default expression to Neutral and start playing
function initializeVideo() {
  if (!reactionVideoEl) {
    // Fallback: just set the expression
    updateExpression({ label: 'Neutral' });
    return;
  }
  
  // Function to start Neutral segment
  const startNeutral = () => {
    updateExpression({ label: 'Neutral' });
    
    // Ensure video plays after a short delay to allow seeking
    setTimeout(() => {
      if (reactionVideoEl && !reactionVideoEl.paused === false) {
        const playPromise = reactionVideoEl.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            // Autoplay may be blocked, that's okay
            if (err.name !== 'NotAllowedError' && err.name !== 'AbortError') {
              console.error('Video play error:', err);
            }
          });
        }
      }
    }, 100);
  };
  
  // Check if video is already loaded
  if (reactionVideoEl.readyState >= 2) {
    startNeutral();
  } else {
    // Wait for video to load - try multiple events
    const tryStart = () => {
      if (reactionVideoEl.readyState >= 2 && reactionVideoEl.duration > 0) {
        startNeutral();
      }
    };
    
    // Listen for various load events
    reactionVideoEl.addEventListener('loadedmetadata', tryStart, { once: true });
    reactionVideoEl.addEventListener('loadeddata', tryStart, { once: true });
    reactionVideoEl.addEventListener('canplay', tryStart, { once: true });
    reactionVideoEl.addEventListener('canplaythrough', tryStart, { once: true });
    
    // Also try after a delay in case events don't fire
    setTimeout(() => {
      if (reactionVideoEl.readyState >= 2 && reactionVideoEl.duration > 0) {
        startNeutral();
      }
    }, 500);
  }
}

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeVideo);
} else {
  // DOM is already ready
  initializeVideo();
}

// Also try to initialize when window loads (after all resources)
window.addEventListener('load', () => {
  // If video still hasn't started, try again
  if (reactionVideoEl && reactionVideoEl.paused && currentExpression === 'Neutral') {
    setTimeout(() => {
      if (reactionVideoEl.readyState >= 2) {
        updateExpression({ label: 'Neutral' });
        reactionVideoEl.play().catch(() => {});
      }
    }, 200);
  }
});

// Bind UI events
chatSendBtn.addEventListener('click', () => {
  const message = chatInputEl.value.trim();
  if (message) {
    chatInputEl.value = '';
    sendChatMessage(message);
  }
});

chatInputEl.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const message = chatInputEl.value.trim();
    if (message) {
      chatInputEl.value = '';
      sendChatMessage(message);
    }
  }
});

// Focus input on load
window.addEventListener('load', () => {
  if (chatInputEl) {
    chatInputEl.focus();
  }
});

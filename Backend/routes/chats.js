const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Chat = require('../models/Chat');
const Request = require('../models/Request');
const authMiddleware = require('../middleware/auth');

// Debug: Log all registered routes
console.log('Chat routes registered:');
console.log('  POST /request/:requestId');
console.log('  GET /my-chats');
console.log('  POST /:chatId/message');
console.log('  DELETE /:chatId/messages/:messageId');
console.log('  DELETE /:chatId');
console.log('  GET /:chatId/messages');

// Get or create chat for a request
router.post('/request/:requestId', authMiddleware, async (req, res) => {
  try {
    const { requestId } = req.params;
    const currentUserId = req.userId;

    // Find the request with populated user
    const request = await Request.findById(requestId)
      .populate('userId', 'name email phone profileImage showContactDetails');
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    // Get request owner ID (handle both populated and non-populated cases)
    const requestOwnerId = request.userId._id 
      ? request.userId._id.toString() 
      : (request.userId.toString ? request.userId.toString() : request.userId);
    
    // Convert to ObjectId for proper comparison
    const requestOwnerObjectId = mongoose.Types.ObjectId.isValid(requestOwnerId)
      ? new mongoose.Types.ObjectId(requestOwnerId)
      : request.userId;
    
    const currentUserObjectId = mongoose.Types.ObjectId.isValid(currentUserId)
      ? new mongoose.Types.ObjectId(currentUserId)
      : currentUserId;

    // Find or create a chat between request owner and current user
    // Each pair of users should have their own chat for a request
    // Use $all to find chats that contain both users, regardless of order
    let chat = await Chat.findOne({
      requestId: requestId,
      participants: { $all: [requestOwnerObjectId, currentUserObjectId] },
      $expr: { $eq: [{ $size: '$participants' }, 2] }  // Exactly 2 participants
    });

    // If not found, try with string comparison as fallback
    if (!chat) {
      const allChatsForRequest = await Chat.find({ requestId: requestId });
      chat = allChatsForRequest.find(c => {
        const participantIds = c.participants.map(p => 
          (p._id ? p._id.toString() : p.toString())
        );
        return participantIds.includes(requestOwnerId) && 
               participantIds.includes(currentUserId.toString()) &&
               participantIds.length === 2;
      });
    }

    if (!chat) {
      // Create new chat with ONLY request owner and current user as participants
      chat = new Chat({
        requestId,
        participants: [requestOwnerObjectId, currentUserObjectId],
        messages: []
      });
      await chat.save();
      // Populate new chat
      await chat.populate('participants', 'name email phone profileImage showContactDetails');
      await chat.populate('messages.senderId', 'name email phone profileImage showContactDetails');
    } else {
      // Chat already exists between these two users, ensure it's populated
      if (!chat.participants[0] || (typeof chat.participants[0] === 'object' && !chat.participants[0].name)) {
        await chat.populate('participants', 'name email phone profileImage showContactDetails');
        await chat.populate('messages.senderId', 'name email phone profileImage showContactDetails');
      }
    }

    res.json({
      success: true,
      chat,
      requestContact: request.contact || (request.userId && request.userId.phone) || ''
    });
  } catch (error) {
    console.error('Get/create chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Get or create direct chat between two users (without request)
router.post('/user/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId: otherUserId } = req.params;
    const currentUserId = req.userId;

    if (otherUserId === currentUserId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot create chat with yourself'
      });
    }

    // Convert to ObjectId
    const otherUserObjectId = mongoose.Types.ObjectId.isValid(otherUserId)
      ? new mongoose.Types.ObjectId(otherUserId)
      : otherUserId;
    
    const currentUserObjectId = mongoose.Types.ObjectId.isValid(currentUserId)
      ? new mongoose.Types.ObjectId(currentUserId)
      : currentUserId;

    // Find existing direct chat (no requestId) between these two users
    let chat = await Chat.findOne({
      requestId: null,
      participants: { $all: [otherUserObjectId, currentUserObjectId] },
      $expr: { $eq: [{ $size: '$participants' }, 2] }
    });

    // If not found, try with string comparison
    if (!chat) {
      const allDirectChats = await Chat.find({ requestId: null });
      chat = allDirectChats.find(c => {
        const participantIds = c.participants.map(p => 
          (p._id ? p._id.toString() : p.toString())
        );
        return participantIds.includes(otherUserId) && 
               participantIds.includes(currentUserId.toString()) &&
               participantIds.length === 2;
      });
    }

    if (!chat) {
      // Create new direct chat
      chat = new Chat({
        requestId: null,
        participants: [otherUserObjectId, currentUserObjectId],
        messages: []
      });
      await chat.save();
      // Populate new chat
      await chat.populate('participants', 'name email phone profileImage showContactDetails');
      await chat.populate('messages.senderId', 'name email phone profileImage showContactDetails');
    } else {
      // Chat already exists, ensure it's populated
      if (!chat.participants[0] || (typeof chat.participants[0] === 'object' && !chat.participants[0].name)) {
        await chat.populate('participants', 'name email phone profileImage showContactDetails');
        await chat.populate('messages.senderId', 'name email phone profileImage showContactDetails');
      }
    }

    res.json({
      success: true,
      chat
    });
  } catch (error) {
    console.error('Get/create direct chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Get user's chats (must be before /:chatId routes)
router.get('/my-chats', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;

    // Convert userId to ObjectId for proper matching
    let userObjectId;
    try {
      userObjectId = new mongoose.Types.ObjectId(userId);
    } catch (e) {
      userObjectId = userId;
    }

    // Use direct match instead of $in for better performance
    // Find all chats where userId is in participants array
    // Ensure MongoDB connection
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const chats = await Promise.race([
      Chat.find({
        participants: { $in: [userObjectId] }
      })
        .populate('requestId', 'bloodGroup location urgency status')
        .populate('participants', 'name email phone profileImage showContactDetails')
        .sort({ lastMessageTime: -1 })
        .lean(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 8000))
    ]).catch(() => []);

    // Additional security check: filter out any chats where user is not actually a participant
    // This handles cases where ObjectId comparison might fail
    const filteredChats = chats.filter(chat => {
      if (!chat.participants || chat.participants.length === 0) {
        return false;
      }
      
      // Check if user is in participants array
      const isParticipant = chat.participants.some(p => {
        const participantId = p._id ? p._id.toString() : p.toString();
        return participantId === userId.toString();
      });
      
      return isParticipant;
    });

    // Remove duplicate chats (same requestId with same participants)
    const uniqueChats = [];
    const seenChats = new Set();
    
    filteredChats.forEach(chat => {
      // Create a unique key based on requestId and sorted participant IDs
      const participantIds = chat.participants
        .map(p => (p._id ? p._id.toString() : p.toString()))
        .sort()
        .join('-');
      
      // Handle null requestId for direct chats
      const requestIdKey = chat.requestId 
        ? (chat.requestId._id ? chat.requestId._id.toString() : chat.requestId.toString())
        : 'direct';
      const chatKey = `${requestIdKey}-${participantIds}`;
      
      if (!seenChats.has(chatKey)) {
        seenChats.add(chatKey);
        uniqueChats.push(chat);
      }
    });

    res.json({
      success: true,
      chats: uniqueChats
    });
  } catch (error) {
    console.error('Get my chats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Send message
router.post('/:chatId/message', authMiddleware, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { message, messageType = 'text', voiceUrl = '', voiceDuration = 0, location } = req.body;
    const senderId = req.userId;

    if (messageType === 'text' && (!message || !message.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Message cannot be empty'
      });
    }

    if (messageType === 'voice' && !voiceUrl) {
      return res.status(400).json({
        success: false,
        message: 'Voice URL is required for voice messages'
      });
    }

    if (messageType === 'location' && (!location || !location.latitude || !location.longitude)) {
      return res.status(400).json({
        success: false,
        message: 'Location data is required for location messages'
      });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    // Check if user is a participant
    // Handle both ObjectId and populated participant objects
    const isParticipant = chat.participants.some(
      p => {
        const participantId = p._id ? p._id.toString() : p.toString();
        return participantId === senderId.toString();
      }
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'You are not a participant in this chat'
      });
    }

    // Add message
    let messageContent = '';
    if (messageType === 'voice') {
      messageContent = '🎤 Voice message';
    } else if (messageType === 'location') {
      messageContent = '📍 Location';
    } else {
      messageContent = message.trim();
    }

    const newMessage = {
      senderId,
      message: messageContent,
      messageType: messageType || 'text',
      voiceUrl: voiceUrl || '',
      voiceDuration: voiceDuration || 0,
      timestamp: new Date(),
      read: false
    };

    if (messageType === 'location' && location) {
      newMessage.location = {
        latitude: location.latitude,
        longitude: location.longitude
      };
    }

    chat.messages.push(newMessage);

    // Update last message
    chat.lastMessage = messageContent;
    chat.lastMessageTime = new Date();

    await chat.save();

    // Populate sender info
    await chat.populate('messages.senderId', 'name email phone profileImage showContactDetails');
    await chat.populate('participants', 'name email phone profileImage showContactDetails');

    // Get the last message
    const lastMessage = chat.messages[chat.messages.length - 1];

    res.json({
      success: true,
      message: lastMessage,
      chat
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Delete a message (must be before /:chatId/messages route)
// IMPORTANT: This route must be defined before GET /:chatId/messages to avoid route conflicts
router.delete('/:chatId/messages/:messageId', authMiddleware, async (req, res) => {
  try {
    const { chatId, messageId } = req.params;
    const userId = req.userId;
    
    console.log('Delete message route called:', { 
      chatId, 
      messageId, 
      userId,
      method: req.method,
      path: req.path,
      originalUrl: req.originalUrl
    });

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    // Check if user is a participant
    const isParticipant = chat.participants.some(
      p => {
        const participantId = p._id ? p._id.toString() : p.toString();
        return participantId === userId.toString();
      }
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'You are not a participant in this chat'
      });
    }

    // Find and remove the message
    const messageIndex = chat.messages.findIndex(
      msg => msg._id.toString() === messageId
    );

    if (messageIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Check if user is the sender of the message
    const message = chat.messages[messageIndex];
    if (message.senderId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own messages'
      });
    }

    // Remove the message
    chat.messages.splice(messageIndex, 1);

    // Update last message if needed
    if (chat.messages.length > 0) {
      const lastMsg = chat.messages[chat.messages.length - 1];
      chat.lastMessage = lastMsg.message;
      chat.lastMessageTime = lastMsg.timestamp;
    } else {
      chat.lastMessage = '';
      chat.lastMessageTime = chat.createdAt;
    }

    await chat.save();

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Delete a chat (must be before GET /:chatId/messages route)
// IMPORTANT: This route must be defined before GET /:chatId/messages to avoid route conflicts
router.delete('/:chatId', authMiddleware, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.userId;
    
    console.log('Delete chat route called:', { 
      chatId, 
      userId, 
      method: req.method, 
      path: req.path,
      originalUrl: req.originalUrl,
      baseUrl: req.baseUrl
    });

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    // Check if user is a participant
    const isParticipant = chat.participants.some(
      p => {
        const participantId = p._id ? p._id.toString() : p.toString();
        return participantId === userId.toString();
      }
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'You are not a participant in this chat'
      });
    }

    // Delete the chat
    await Chat.findByIdAndDelete(chatId);

    res.json({
      success: true,
      message: 'Chat deleted successfully'
    });
  } catch (error) {
    console.error('Delete chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Get chat messages
router.get('/:chatId/messages', authMiddleware, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.userId;

    const chat = await Chat.findById(chatId)
      .populate('participants', 'name email phone profileImage showContactDetails')
      .populate('messages.senderId', 'name email phone profileImage showContactDetails');

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    // Check if user is a participant
    // Handle both ObjectId and populated participant objects
    const isParticipant = chat.participants.some(
      p => {
        const participantId = p._id ? p._id.toString() : p.toString();
        return participantId === userId.toString();
      }
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'You are not a participant in this chat'
      });
    }

    // Mark messages as read
    chat.messages.forEach(msg => {
      if (msg.senderId._id.toString() !== userId.toString()) {
        msg.read = true;
      }
    });
    await chat.save();

    res.json({
      success: true,
      messages: chat.messages,
      participants: chat.participants
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

module.exports = router;


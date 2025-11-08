const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');
const Request = require('../models/Request');
const authMiddleware = require('../middleware/auth');

// Get or create chat for a request
router.post('/request/:requestId', authMiddleware, async (req, res) => {
  try {
    const { requestId } = req.params;
    const currentUserId = req.userId;

    // Find the request
    const request = await Request.findById(requestId);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    // Check if chat already exists
    let chat = await Chat.findOne({ requestId });

    if (!chat) {
      // Create new chat with request owner and current user as participants
      chat = new Chat({
        requestId,
        participants: [request.userId, currentUserId],
        messages: []
      });
      await chat.save();
    } else {
      // Check if current user is a participant
      const isParticipant = chat.participants.some(
        p => p.toString() === currentUserId.toString()
      );

      if (!isParticipant) {
        // Add current user to participants
        chat.participants.push(currentUserId);
        await chat.save();
      }
    }

    // Populate participants
    await chat.populate('participants', 'name email profileImage');
    await chat.populate('messages.senderId', 'name email profileImage');

    res.json({
      success: true,
      chat
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

// Send message
router.post('/:chatId/message', authMiddleware, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { message } = req.body;
    const senderId = req.userId;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message cannot be empty'
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
    const isParticipant = chat.participants.some(
      p => p.toString() === senderId.toString()
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'You are not a participant in this chat'
      });
    }

    // Add message
    chat.messages.push({
      senderId,
      message: message.trim(),
      timestamp: new Date(),
      read: false
    });

    // Update last message
    chat.lastMessage = message.trim();
    chat.lastMessageTime = new Date();

    await chat.save();

    // Populate sender info
    await chat.populate('messages.senderId', 'name email profileImage');
    await chat.populate('participants', 'name email profileImage');

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

// Get chat messages
router.get('/:chatId/messages', authMiddleware, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.userId;

    const chat = await Chat.findById(chatId)
      .populate('participants', 'name email profileImage')
      .populate('messages.senderId', 'name email profileImage');

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    // Check if user is a participant
    const isParticipant = chat.participants.some(
      p => p._id.toString() === userId.toString()
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

// Get user's chats
router.get('/my-chats', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;

    const chats = await Chat.find({
      participants: userId
    })
      .populate('requestId', 'bloodGroup location urgency status')
      .populate('participants', 'name email profileImage')
      .sort({ lastMessageTime: -1 });

    res.json({
      success: true,
      chats
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

module.exports = router;


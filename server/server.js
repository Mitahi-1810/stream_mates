import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { MongoClient } from 'mongodb';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Middleware
app.use(cors({
  origin: "*",
  credentials: true
}));
app.use(express.json());

// MongoDB Connection
const mongoUri = process.env.MONGODB_URI;
let db;

async function connectDB() {
  if (!mongoUri) {
    console.error('❌ MONGODB_URI not set in environment variables');
    process.exit(1);
  }
  
  try {
    const client = await MongoClient.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000
    });
    db = client.db();
    console.log('✅ Connected to MongoDB');
    
    // Create indexes
    await db.collection('rooms').createIndex({ code: 1 }, { unique: true });
    await db.collection('rooms').createIndex({ createdAt: 1 }, { expireAfterSeconds: 86400 });
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
}

await connectDB();

// ==================== REST API ROUTES ====================

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Create a new room
app.post('/api/rooms', async (req, res) => {
  try {
    const { code, hostId, settings } = req.body;
    
    const room = {
      _id: crypto.randomUUID(),
      code,
      hostId: hostId || '',
      users: [],
      isActive: true,
      createdAt: new Date(),
      settings: settings || { themeColor: '#7652d6' }
    };

    await db.collection('rooms').insertOne(room);
    res.status(201).json({ success: true, room });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get room by code
app.get('/api/rooms/:code', async (req, res) => {
  try {
    const room = await db.collection('rooms').findOne({ code: req.params.code });
    
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }
    
    if (!room.isActive) {
      return res.status(410).json({ success: false, error: 'Room has been closed' });
    }

    res.json({ success: true, room });
  } catch (error) {
    console.error('Error fetching room:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Join a room (add user)
app.post('/api/rooms/:code/join', async (req, res) => {
  try {
    const { user } = req.body;
    const { code } = req.params;

    const room = await db.collection('rooms').findOne({ code });
    
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }
    
    if (!room.isActive) {
      return res.status(410).json({ success: false, error: 'Room has been closed' });
    }

    // Add user to room
    await db.collection('rooms').updateOne(
      { code },
      { 
        $push: { users: user },
        $set: { hostId: room.hostId || (user.role === 'HOST' ? user.id : room.hostId) }
      }
    );

    const updatedRoom = await db.collection('rooms').findOne({ code });
    res.json({ success: true, room: updatedRoom });
  } catch (error) {
    console.error('Error joining room:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Leave a room (remove user)
app.post('/api/rooms/:code/leave', async (req, res) => {
  try {
    const { userId } = req.body;
    const { code } = req.params;

    await db.collection('rooms').updateOne(
      { code },
      { $pull: { users: { id: userId } } }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error leaving room:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Close a room
app.post('/api/rooms/:code/close', async (req, res) => {
  try {
    const { code } = req.params;

    await db.collection('rooms').updateOne(
      { code },
      { $set: { isActive: false } }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error closing room:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== SOCKET.IO REAL-TIME COMMUNICATION ====================

// In-memory room state
const rooms = new Map(); // roomId -> { hostId, users: Set<userId>, streaming: boolean }

io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // Join a room
  socket.on('join_room', async ({ userId, roomId }) => {
    try {
      socket.join(roomId);
      socket.userId = userId;
      socket.roomId = roomId;
      
      // Initialize room state if doesn't exist
      if (!rooms.has(roomId)) {
        rooms.set(roomId, { hostId: null, users: new Set(), streaming: false, messages: [] });
      }
      
      const room = rooms.get(roomId);
      room.users.add(userId);
      
      console.log(`👤 User ${userId} joined room ${roomId}. Total: ${room.users.size}`);
      
      // Broadcast to ALL users in room (including sender)
      io.to(roomId).emit('user:joined', { userId, totalUsers: room.users.size });
      
      // Send current room state to new user
      socket.emit('room:sync', {
        hostId: room.hostId,
        streaming: room.streaming,
        users: Array.from(room.users),
        messages: room.messages
      });
      
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // Set host
  socket.on('set_host', ({ roomId, userId }) => {
    const room = rooms.get(roomId);
    if (room) {
      room.hostId = userId;
      console.log(`👑 Host set in room ${roomId}: ${userId}`);
      io.to(roomId).emit('host:set', { hostId: userId });
    }
  });

  // Start streaming
  socket.on('stream:start', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (room) {
      room.streaming = true;
      console.log(`🎥 Stream started in room ${roomId}`);
      io.to(roomId).emit('stream:started', { hostId: room.hostId });
    }
  });

  // Stop streaming
  socket.on('stream:stop', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (room) {
      room.streaming = false;
      console.log(`🛑 Stream stopped in room ${roomId}`);
      io.to(roomId).emit('stream:stopped');
    }
  });

  // Chat message
  socket.on('chat:message', ({ roomId, message }) => {
    const room = rooms.get(roomId);
    if (room) {
      room.messages.push(message);
      console.log(`💬 Chat in room ${roomId} from ${message.userName}: ${message.text}`);
      io.to(roomId).emit('chat:message', message);
    }
  });

  // WebRTC Signaling
  socket.on('signal', ({ roomId, signal, targetId }) => {
    if (targetId) {
      // Send to specific user
      const sockets = io.sockets.adapter.rooms.get(roomId);
      if (sockets) {
        for (const socketId of sockets) {
          const targetSocket = io.sockets.sockets.get(socketId);
          if (targetSocket && targetSocket.userId === targetId) {
            targetSocket.emit('signal', { signal, senderId: socket.userId });
            console.log(`📡 Signal from ${socket.userId} to ${targetId}`);
            break;
          }
        }
      }
    } else {
      // Broadcast to all except sender
      socket.to(roomId).emit('signal', { signal, senderId: socket.userId });
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`� Client disconnected: ${socket.id}`);
    
    const userId = socket.userId;
    const roomId = socket.roomId;
    
    if (roomId && userId) {
      const room = rooms.get(roomId);
      if (room) {
        room.users.delete(userId);
        console.log(`� User ${userId} left room ${roomId}. Remaining: ${room.users.size}`);
        io.to(roomId).emit('user:left', { userId, totalUsers: room.users.size });
        
        // Clean up empty rooms
        if (room.users.size === 0) {
          rooms.delete(roomId);
          console.log(`🗑️ Room ${roomId} deleted (empty)`);
        }
      }
    }
  });
});

// Start server
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🚀 StreamMates Server running on port ${PORT}`);
  console.log(`📡 WebSocket server ready`);
  console.log(`🌐 CORS enabled for: ${process.env.CORS_ORIGIN || 'http://localhost:5173'}`);
});

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { MongoClient } from 'mongodb';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Allow all origins for easier testing
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/streammates';
let db;

async function connectDB() {
  try {
    const client = await MongoClient.connect(mongoUri);
    db = client.db();
    console.log('✅ Connected to MongoDB');
    
    // Create indexes
    await db.collection('rooms').createIndex({ code: 1 }, { unique: true });
    await db.collection('rooms').createIndex({ createdAt: 1 }, { expireAfterSeconds: 86400 }); // Auto-delete after 24h
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
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

// Store connected users: userId -> { socketId, roomId }
const connectedUsers = new Map();

io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // Join a room
  socket.on('join_room', async ({ userId, roomId }) => {
    try {
      socket.join(roomId);
      connectedUsers.set(userId, { socketId: socket.id, roomId });
      
      const roomSize = io.sockets.adapter.rooms.get(roomId)?.size || 0;
      console.log(`👤 User ${userId} joined room ${roomId}. Total users: ${roomSize}`);
      
      // Notify others in the room
      socket.to(roomId).emit('user:joined', { userId });
      
      // Get current room state
      const room = await db.collection('rooms').findOne({ code: roomId });
      if (room) {
        socket.emit('room:state', { room });
      }
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // Leave a room
  socket.on('leave_room', ({ userId, roomId }) => {
    socket.leave(roomId);
    connectedUsers.delete(userId);
    
    console.log(`👋 User ${userId} left room ${roomId}`);
    socket.to(roomId).emit('user:left', { userId });
  });

  // Chat message
  socket.on('chat:message', ({ roomId, message }) => {
    console.log(`💬 Chat message in room ${roomId} from ${message.userId}`);
    // Broadcast to everyone in the room (including sender)
    io.to(roomId).emit('chat:message', message);
  });

  // Chat reaction
  socket.on('chat:reaction', ({ roomId, data }) => {
    console.log(`❤️ Reaction in room ${roomId}`);
    io.to(roomId).emit('chat:reaction', data);
  });

  // Video state sync
  socket.on('video:sync', ({ roomId, state }) => {
    console.log(`🎥 Video sync in room ${roomId}: ${state.sourceType} (Streaming: ${state.isStreaming})`);
    // Send to EVERYONE in the room (including sender for confirmation)
    io.to(roomId).emit('video:sync', state);
  });

  // Stream action (play/pause)
  socket.on('stream:action', ({ roomId, action }) => {
    console.log(`⏯️ Stream action in room ${roomId}:`, action.type);
    // Send to EVERYONE in the room
    io.to(roomId).emit('stream:action', action);
  });

  // WebRTC Signaling
  socket.on('signal', ({ roomId, message }) => {
    console.log(`📡 WebRTC signal in room ${roomId}: ${message.type}`);
    
    // If there's a specific target, send only to them
    if (message.target) {
      const targetUser = connectedUsers.get(message.target);
      if (targetUser) {
        io.to(targetUser.socketId).emit('signal', message);
      }
    } else {
      // Broadcast to all in room except sender
      socket.to(roomId).emit('signal', message);
    }
  });

  // Refresh Room State
  socket.on('room:refresh', async ({ roomId }) => {
      const room = await db.collection('rooms').findOne({ code: roomId });
      if (room) {
          socket.emit('room:state', { room });
      }
  });

  // Room closed by host
  socket.on('room:closed', async ({ roomId }) => {
    console.log(`🚪 Room ${roomId} closed by host`);
    
    // Update DB
    await db.collection('rooms').updateOne(
      { code: roomId },
      { $set: { isActive: false } }
    );
    
    // Notify all users in the room
    io.to(roomId).emit('room:closed', {});
  });

  // Handle disconnect
  socket.on('disconnect', async () => {
    console.log(`🔴 Client disconnected: ${socket.id}`);
    
    // Find which user disconnected
    for (const [userId, data] of connectedUsers.entries()) {
      if (data.socketId === socket.id) {
        const { roomId } = data;
        
        // Remove from room
        await db.collection('rooms').updateOne(
          { code: roomId },
          { $pull: { users: { id: userId } } }
        );
        
        // Notify others
        socket.to(roomId).emit('user:left', { userId });
        connectedUsers.delete(userId);
        break;
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

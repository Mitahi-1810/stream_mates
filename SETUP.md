# StreamMates - Real-Time Screen Sharing Platform

StreamMates is a real-time screen sharing application that enables hosts to broadcast their screen to multiple viewers across the internet with synchronized playback controls and live chat functionality.

## 🚀 Features

- **Real-time Screen Sharing**: Host can share their screen with viewers anywhere on the internet
- **WebRTC Technology**: Low-latency peer-to-peer video streaming
- **Live Chat**: Real-time messaging with reactions and GIF support
- **Synchronized Playback**: Host can pause/play for all viewers simultaneously
- **Room-based System**: Create or join rooms with unique codes
- **Avatar Customization**: Custom avatars and theme colors for each user
- **Multi-user Support**: Handle multiple viewers in the same room

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js** (v18 or higher)
- **MongoDB** (local installation or MongoDB Atlas account)
- **npm** or **yarn**

## 🛠️ Installation & Setup

### 1. Clone the Repository

```bash
cd /path/to/StreamMates-main
```

### 2. Backend Server Setup

#### Install Dependencies

```bash
cd server
npm install
```

#### Configure Environment Variables

Create a `.env` file in the `server/` directory:

```bash
cp .env.example .env
```

Edit the `.env` file with your configuration:

```env
# MongoDB Connection String
# Option 1: Local MongoDB
MONGODB_URI=mongodb://localhost:27017/streammates

# Option 2: MongoDB Atlas (Cloud)
# MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/streammates

# Server Port
PORT=3001

# CORS Origin (Frontend URL)
CORS_ORIGIN=http://localhost:5173

# Node Environment
NODE_ENV=development
```

#### Start MongoDB (if using local installation)

**macOS:**
```bash
brew services start mongodb-community
```

**Linux:**
```bash
sudo systemctl start mongod
```

**Windows:**
```bash
net start MongoDB
```

#### Start the Backend Server

```bash
npm start
```

Or for development with auto-restart:

```bash
npm run dev
```

You should see:
```
🚀 StreamMates Server running on port 3001
📡 WebSocket server ready
🌐 CORS enabled for: http://localhost:5173
✅ Connected to MongoDB
```

### 3. Frontend Setup

#### Install Dependencies

```bash
# From the root directory (StreamMates-main/)
npm install
```

#### Configure Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

The default configuration should work:

```env
VITE_API_URL=http://localhost:3001
VITE_SOCKET_URL=http://localhost:3001
```

#### Start the Frontend

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## 🌐 Production Deployment

### Backend Deployment (Example: Heroku/Railway/Render)

1. **Set environment variables:**
   - `MONGODB_URI`: Your MongoDB Atlas connection string
   - `PORT`: 3001 (or your hosting provider's PORT)
   - `CORS_ORIGIN`: Your frontend domain (e.g., `https://yourapp.com`)
   - `NODE_ENV`: production

2. **Deploy the `server/` directory**

### Frontend Deployment (Example: Vercel/Netlify)

1. **Build the frontend:**
   ```bash
   npm run build
   ```

2. **Set environment variables:**
   - `VITE_API_URL`: Your backend API URL (e.g., `https://api.yourapp.com`)
   - `VITE_SOCKET_URL`: Your backend WebSocket URL (same as API URL)

3. **Deploy the `dist/` folder**

### Important Notes for Production

- Use **HTTPS** for both frontend and backend
- Update CORS settings to allow your production domain
- Use a production MongoDB cluster (MongoDB Atlas recommended)
- Consider using a TURN server for WebRTC if users are behind strict NAT/firewalls

## 📖 Usage Guide

### As a Host

1. **Create a Room:**
   - Enter your display name
   - Customize your avatar and theme color
   - Click "Start Hosting"
   - You'll receive a unique room code (e.g., `ABC123`)

2. **Share the Room Code:**
   - Share the code with viewers who want to join

3. **Start Screen Sharing:**
   - Click the "Share Screen" button
   - Select which screen/window to share
   - Your screen will be broadcast to all viewers

4. **Control Playback:**
   - Use pause/play controls to sync playback for all viewers

5. **Close the Room:**
   - Click "Close Room" when finished

### As a Viewer

1. **Join a Room:**
   - Switch to "Join Room" tab
   - Enter your display name
   - Customize your avatar and theme color
   - Enter the room code provided by the host
   - Click "Join Stream"

2. **Watch the Stream:**
   - The host's screen will appear automatically when they start sharing
   - Chat with other viewers in real-time
   - React to messages with emojis

## 🏗️ Architecture

### Backend (`/server`)
- **Express.js**: REST API server
- **Socket.io**: Real-time bidirectional communication
- **MongoDB**: Persistent storage for rooms and users

### Frontend (`/`)
- **React**: UI framework
- **Vite**: Build tool and dev server
- **Socket.io-client**: Real-time client
- **WebRTC**: Peer-to-peer video streaming
- **TypeScript**: Type-safe JavaScript

### Real-time Events

- `join_room`: User joins a room
- `user:joined`: Broadcast when a user joins
- `user:left`: Broadcast when a user leaves
- `chat:message`: Send/receive chat messages
- `chat:reaction`: React to messages
- `video:sync`: Sync video state (streaming/idle)
- `stream:action`: Control playback (play/pause)
- `signal`: WebRTC signaling (offer/answer/ICE candidates)
- `room:closed`: Host closes the room

## 🐛 Troubleshooting

### Backend Issues

**MongoDB Connection Error:**
- Ensure MongoDB is running
- Check your connection string in `.env`
- For MongoDB Atlas, ensure your IP is whitelisted

**Port Already in Use:**
- Change `PORT` in `server/.env`
- Make sure to update `VITE_API_URL` and `VITE_SOCKET_URL` in frontend `.env`

### Frontend Issues

**Cannot Connect to Backend:**
- Verify backend is running on the correct port
- Check `VITE_API_URL` and `VITE_SOCKET_URL` in `.env`
- Check browser console for CORS errors

**WebRTC Not Working:**
- Ensure you're using HTTPS in production
- Check browser permissions for screen sharing
- May need a TURN server for users behind strict NAT

**Screen Share Not Visible:**
- Ensure host has started screen sharing
- Check browser console for WebRTC connection errors
- Verify both users are in the same room

## 🔒 Security Considerations

- Rooms auto-expire after 24 hours (configurable in `server/server.js`)
- Use environment variables for sensitive configuration
- Implement authentication for production use
- Use HTTPS/WSS in production
- Validate and sanitize user inputs
- Consider rate limiting for API endpoints

## 📝 API Endpoints

### REST API

- `GET /health` - Health check
- `POST /api/rooms` - Create a new room
- `GET /api/rooms/:code` - Get room details
- `POST /api/rooms/:code/join` - Join a room
- `POST /api/rooms/:code/leave` - Leave a room
- `POST /api/rooms/:code/close` - Close a room

### WebSocket Events

See "Real-time Events" section above for Socket.io events.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open source and available under the MIT License.

## 💡 Future Enhancements

- [ ] User authentication and persistent profiles
- [ ] Recording functionality
- [ ] Multi-host support
- [ ] File sharing
- [ ] Whiteboard/drawing tools
- [ ] Mobile app support
- [ ] End-to-end encryption

## 📧 Support

For issues and questions, please open an issue on the repository.

---

**Built with ❤️ using React, Node.js, WebRTC, and Socket.io**

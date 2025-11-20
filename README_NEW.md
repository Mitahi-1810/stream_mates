# 🎬 StreamMates - Real-Time Screen Sharing

> **Watch together, anywhere.** Host can broadcast their screen to anyone on the internet with real-time chat and synchronized playback.

---

## ⚡ Quick Start Guide

### Prerequisites
- **Node.js** v18 or higher
- **MongoDB** (local installation or MongoDB Atlas account)
- **npm** or yarn

### 🚀 Start in 3 Steps

#### Step 1: Start MongoDB (if using local)
```bash
# macOS
brew services start mongodb-community

# Linux
sudo systemctl start mongod

# Windows
net start MongoDB
```

#### Step 2: Start Backend Server
```bash
cd server
npm install
cp .env.example .env
npm start
```

You should see: `🚀 StreamMates Server running on port 3001`

#### Step 3: Start Frontend
```bash
# In a new terminal, from project root
npm install
cp .env.example .env
npm run dev
```

**Open:** http://localhost:5173

---

## 🎯 How to Use

### As a Host
1. Click **"New Room"**
2. Enter your display name and customize avatar
3. Click **"Start Hosting"** - you'll get a room code (e.g., `ABC123`)
4. Click **"Share Screen"** and select what to share
5. **Share the room code** with viewers

### As a Viewer
1. Click **"Join Room"**
2. Enter your display name
3. Enter the **room code** from the host
4. Click **"Join Stream"** and watch in real-time!
5. **Chat** with other viewers

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React + TypeScript + Vite |
| **Backend** | Node.js + Express + Socket.io |
| **Database** | MongoDB |
| **Streaming** | WebRTC (peer-to-peer) |
| **Real-time** | Socket.io (WebSockets) |

---

## 🚀 Features

✅ **Real-time screen sharing** - Works across the internet, not just local tabs  
✅ **Live chat** - Real-time messaging with reactions and emoji support  
✅ **Synchronized playback** - Host can pause/play for all viewers  
✅ **Room-based system** - Unique codes for privacy  
✅ **Avatar customization** - Personal avatars and theme colors  
✅ **Multi-user support** - Multiple viewers per room  
✅ **WebRTC streaming** - Low-latency peer-to-peer video  
✅ **Auto room expiry** - Rooms auto-delete after 24 hours  

---

## 📁 Project Structure

```
StreamMates-main/
├── server/                  # Backend server
│   ├── server.js           # Express + Socket.io + MongoDB
│   ├── package.json        # Backend dependencies
│   └── .env.example        # Environment template
│
├── components/             # React UI components
│   ├── Lobby.tsx          # Room creation/join screen
│   ├── VideoPlayer.tsx    # WebRTC video display
│   ├── ChatPanel.tsx      # Real-time chat
│   └── Controls.tsx       # Host controls
│
├── services/              # API & Socket services
│   ├── apiService.ts     # REST API client
│   ├── mockSocket.ts     # Socket.io client (renamed from mock)
│   └── mongo.ts          # Local storage fallback (legacy)
│
├── App.tsx               # Main application
├── types.ts              # TypeScript definitions
├── package.json          # Frontend dependencies
├── .env.example          # Frontend environment template
├── SETUP.md              # Detailed documentation
└── README.md             # This file
```

---

## 🔧 Configuration

### Backend Environment Variables (`server/.env`)
```env
# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/streammates
# For MongoDB Atlas:
# MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/streammates

# Server Configuration
PORT=3001
CORS_ORIGIN=http://localhost:5173
NODE_ENV=development
```

### Frontend Environment Variables (`.env`)
```env
VITE_API_URL=http://localhost:3001
VITE_SOCKET_URL=http://localhost:3001
```

---

## 🌐 How It Works

### Architecture Overview

```
[Host Browser] ←→ [Backend Server] ←→ [Viewer Browser]
                      ↕
                  [MongoDB]
```

1. **Room Management**: Backend stores rooms and users in MongoDB
2. **Real-time Communication**: Socket.io handles instant messaging and state sync
3. **Video Streaming**: WebRTC creates peer-to-peer connections for low-latency video
4. **Signaling**: Backend relays WebRTC connection setup (offers/answers/ICE candidates)

### Key Real-time Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `join_room` | Client → Server | User joins a room |
| `user:joined` | Server → Clients | Notify others of new user |
| `chat:message` | Both ways | Real-time chat messages |
| `video:sync` | Both ways | Sync video state (streaming/idle) |
| `signal` | Both ways | WebRTC signaling data |
| `room:closed` | Server → Clients | Host closed the room |

---

## 🐛 Troubleshooting

### Backend Issues

**❌ MongoDB Connection Error**
```
Solution: 
1. Check MongoDB is running: ps aux | grep mongo
2. Verify connection string in server/.env
3. For Atlas: Whitelist your IP address
```

**❌ Port Already in Use**
```
Solution:
1. Change PORT in server/.env
2. Update VITE_API_URL and VITE_SOCKET_URL in frontend .env
3. Restart both servers
```

### Frontend Issues

**❌ Cannot Connect to Backend**
```
Solution:
1. Verify backend is running (check terminal output)
2. Check VITE_API_URL in .env matches backend port
3. Open browser console for detailed errors
4. Check for CORS errors
```

**❌ WebRTC Not Working / Screen Share Not Visible**
```
Solution:
1. Grant browser permissions for screen sharing
2. Ensure both users are in the SAME room (check room code)
3. Use HTTPS in production (HTTP works for localhost only)
4. Check browser console for WebRTC errors
5. May need TURN server for strict NAT/firewalls
```

**❌ Chat Not Updating**
```
Solution:
1. Check WebSocket connection in browser DevTools → Network → WS
2. Verify VITE_SOCKET_URL is correct
3. Check backend logs for socket errors
```

---

## 📖 API Documentation

### REST API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Server health check |
| `POST` | `/api/rooms` | Create a new room |
| `GET` | `/api/rooms/:code` | Get room details |
| `POST` | `/api/rooms/:code/join` | Add user to room |
| `POST` | `/api/rooms/:code/leave` | Remove user from room |
| `POST` | `/api/rooms/:code/close` | Close/deactivate room |

### WebSocket Events

See "Key Real-time Events" table above for complete list.

---

## 🚀 Production Deployment

### Backend (Example: Railway, Render, Heroku)

1. **Set environment variables:**
   - `MONGODB_URI`: MongoDB Atlas connection string
   - `PORT`: 3001 (or use hosting provider's PORT)
   - `CORS_ORIGIN`: Your frontend URL (e.g., `https://streammates.vercel.app`)
   - `NODE_ENV`: production

2. **Deploy the `server/` directory**

3. **Important:** Use HTTPS (required for WebRTC in production)

### Frontend (Example: Vercel, Netlify)

1. **Build:**
   ```bash
   npm run build
   ```

2. **Set environment variables:**
   - `VITE_API_URL`: Your backend URL (e.g., `https://api.streammates.com`)
   - `VITE_SOCKET_URL`: Same as API URL

3. **Deploy `dist/` folder**

### Production Checklist

- [ ] Use HTTPS/WSS (required for WebRTC)
- [ ] Update CORS settings for production domain
- [ ] Use MongoDB Atlas (or production MongoDB)
- [ ] Consider TURN server for better connectivity
- [ ] Implement rate limiting on API
- [ ] Add authentication (optional but recommended)
- [ ] Monitor server logs and performance

---

## 🔒 Security Notes

- Rooms auto-expire after 24 hours (configurable in `server/server.js`)
- Room codes are randomly generated (6 characters)
- Use environment variables for sensitive data
- Implement authentication for production
- Validate and sanitize all user inputs
- Use HTTPS in production
- Consider adding rate limiting

---

## 💡 Future Enhancements

- [ ] User authentication & persistent profiles
- [ ] Recording functionality
- [ ] Multi-host support
- [ ] File sharing in chat
- [ ] Whiteboard/drawing tools
- [ ] Mobile app (React Native)
- [ ] End-to-end encryption
- [ ] Screen annotation tools
- [ ] Breakout rooms

---

## 📚 Learn More

- **Full Setup Guide:** [SETUP.md](./SETUP.md)
- **WebRTC Documentation:** [webrtc.org](https://webrtc.org/)
- **Socket.io Documentation:** [socket.io](https://socket.io/)
- **MongoDB Documentation:** [mongodb.com/docs](https://www.mongodb.com/docs/)

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is open source and available under the MIT License.

---

## 📧 Support

For issues, questions, or feature requests:
- Open an issue on GitHub
- Check [SETUP.md](./SETUP.md) for detailed troubleshooting

---

**Built with ❤️ using React, Node.js, WebRTC, and Socket.io**

*Making screen sharing seamless and accessible for everyone!*

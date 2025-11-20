// Real-time Socket.io client for cross-internet communication
import { io, Socket } from 'socket.io-client';

type Listener = (data: any) => void;

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Listener[]> = new Map();
  private userId: string = '';
  private roomId: string | null = null;

  constructor() {}

  connect(userId: string, roomId: string) {
    this.userId = userId;
    this.roomId = roomId;
    
    console.log(`[Socket] Connecting to ${SOCKET_URL}`);
    
    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 20000
    });

    this.socket.on('connect', () => {
      console.log(`[Socket] ✅ Connected! Socket ID: ${this.socket?.id}`);
      this.trigger('status', { connected: true });
      this.socket?.emit('join_room', { userId, roomId });
    });

    this.socket.on('disconnect', (reason) => {
      console.log(`[Socket] ❌ Disconnected:`, reason);
      this.trigger('status', { connected: false });
    });

    this.socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
      this.trigger('status', { connected: false, error: error.message });
    });

    // Forward all events to listeners
    this.socket.onAny((eventName, ...args) => {
      console.log(`[Socket] 📥 Received: ${eventName}`, args[0]);
      this.trigger(eventName, args[0]);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.roomId = null;
    this.userId = '';
    this.listeners.clear();
  }

  emit(event: string, data: any) {
    if (!this.socket || !this.roomId) {
      console.warn('[Socket] Cannot emit - not connected');
      return;
    }
    console.log(`[Socket] 📤 Sending: ${event}`, data);
    this.socket.emit(event, { roomId: this.roomId, ...data });
  }

  on(event: string, callback: Listener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);
  }

  off(event: string, callback: Listener) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      this.listeners.set(event, listeners.filter(cb => cb !== callback));
    }
  }

  private trigger(event: string, data: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(cb => cb(data));
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const socketService = new SocketService();

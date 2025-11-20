// Real-time Socket.io client for cross-internet communication
import { io, Socket } from 'socket.io-client';

type Listener = (data: any) => void;

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Listener[]> = new Map();
  private userId: string = '';
  private roomId: string | null = null;

  constructor() {
    // Socket will be initialized on connect
  }

  connect(userId: string, roomId: string) {
    this.userId = userId;
    this.roomId = roomId;
    
    // Initialize Socket.io connection
    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    console.log(`[Socket] Connecting as ${userId} to room ${roomId}...`);
    
    // Setup socket event handlers
    this.socket.on('connect', () => {
      console.log(`[Socket] Connected to server with socket ID: ${this.socket?.id}`);
      this.trigger('status', { connected: true });
      // Join the room
      this.socket?.emit('join_room', { userId, roomId });
    });

    this.socket.on('disconnect', (reason) => {
      console.log(`[Socket] Disconnected:`, reason);
      this.trigger('status', { connected: false });
    });

    this.socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error);
      this.trigger('status', { connected: false, error: error.message });
    });

    // Listen for all app events and trigger local handlers
    this.socket.on('user:joined', (data) => this.trigger('user:joined', data));
    this.socket.on('user:left', (data) => this.trigger('user:left', data));
    this.socket.on('room:closed', (data) => this.trigger('room:closed', data));
    this.socket.on('video:sync', (data) => this.trigger('video:sync', data));
    this.socket.on('stream:action', (data) => this.trigger('stream:action', data));
    this.socket.on('chat:message', (data) => this.trigger('chat:message', data));
    this.socket.on('chat:reaction', (data) => this.trigger('chat:reaction', data));
    this.socket.on('signal', (data) => this.trigger('signal', data));
    this.socket.on('room:state', (data) => this.trigger('room:state', data));
    this.socket.on('error', (data) => {
      console.error('[Socket] Server error:', data);
      this.trigger('error', data);
    });
  }

  disconnect() {
    if (this.socket && this.roomId) {
      this.socket.emit('leave_room', { userId: this.userId, roomId: this.roomId });
      this.socket.disconnect();
      this.socket = null;
    }
    this.roomId = null;
    this.userId = '';
    this.listeners.clear();
  }

  // Emit event to server (which broadcasts to room)
  emit(event: string, data: any) {
    console.log(`[Socket] Emitting ${event}`, data);
    if (!this.socket || !this.roomId) {
      console.warn('[Socket] Cannot emit - not connected or no room');
      return;
    }

    // Map event names to socket events with roomId
    switch(event) {
      case 'user:joined':
      case 'user:left':
        // These are handled server-side automatically
        break;
      case 'chat:message':
        this.socket.emit('chat:message', { roomId: this.roomId, message: data });
        break;
      case 'chat:reaction':
        this.socket.emit('chat:reaction', { roomId: this.roomId, data });
        break;
      case 'video:sync':
        this.socket.emit('video:sync', { roomId: this.roomId, state: data });
        break;
      case 'stream:action':
        this.socket.emit('stream:action', { roomId: this.roomId, action: data });
        break;
      case 'signal':
        this.socket.emit('signal', { roomId: this.roomId, message: data });
        break;
      case 'room:closed':
        this.socket.emit('room:closed', { roomId: this.roomId });
        break;
      default:
        console.warn(`[Socket] Unknown event: ${event}`);
    }
  }

  // Register listener
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

  // Trigger local listeners
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

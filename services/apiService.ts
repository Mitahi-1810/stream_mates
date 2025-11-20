// API service for backend REST calls

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface CreateRoomRequest {
  code: string;
  hostId?: string;
  settings?: {
    themeColor: string;
  };
}

export interface JoinRoomRequest {
  user: {
    id: string;
    name: string;
    role: string;
    avatar: string;
    isLocal: boolean;
    color?: string;
  };
}

class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_URL;
  }

  async createRoom(data: CreateRoomRequest) {
    const response = await fetch(`${this.baseUrl}/api/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create room');
    }

    return response.json();
  }

  async getRoom(code: string) {
    const response = await fetch(`${this.baseUrl}/api/rooms/${code}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch room');
    }

    return response.json();
  }

  async joinRoom(code: string, data: JoinRoomRequest) {
    const response = await fetch(`${this.baseUrl}/api/rooms/${code}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to join room');
    }

    return response.json();
  }

  async leaveRoom(code: string, userId: string) {
    const response = await fetch(`${this.baseUrl}/api/rooms/${code}/leave`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to leave room');
    }

    return response.json();
  }

  async closeRoom(code: string) {
    const response = await fetch(`${this.baseUrl}/api/rooms/${code}/close`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to close room');
    }

    return response.json();
  }

  async checkHealth() {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

export const apiService = new ApiService();

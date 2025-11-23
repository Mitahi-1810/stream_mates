import React, { useState, useEffect, useCallback, useRef } from 'react';
import { VideoState, VideoSourceType, ChatMessage, User, UserRole, SignalMessage, StreamAction, Reaction } from './types';
import VideoPlayer from './components/VideoPlayer';
import ChatPanel from './components/ChatPanel';
import Controls from './components/Controls';
import Lobby from './components/Lobby';
import { socketService } from './services/mockSocket';
import { apiService } from './services/apiService';

const generateUserId = () => Math.random().toString(36).substring(2, 9);

const App: React.FC = () => {
  // --- App Mode ---
  const [inRoom, setInRoom] = useState(false);
  const [roomId, setRoomId] = useState<string>('');
  
  // --- Identity ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // --- State ---
  const [users, setUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [videoState, setVideoState] = useState<VideoState>({
    sourceType: VideoSourceType.IDLE,
    isStreaming: false,
    lastUpdated: Date.now(),
    isHostPaused: false
  });
  
  // --- WebRTC State ---
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [iceServers, setIceServers] = useState<RTCIceServer[]>([
    { urls: 'stun:stun.l.google.com:19302' }
  ]);
  
  // Refs for WebRTC to avoid closure staleness
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const currentUserRef = useRef<User | null>(null);

  // NEW: Ref for videoState to access current value in event listeners
  const videoStateRef = useRef<VideoState>(videoState);

  useEffect(() => {
    videoStateRef.current = videoState;
  }, [videoState]);

  useEffect(() => {
      if(currentUser) currentUserRef.current = currentUser;
  }, [currentUser]);

  // Apply theme color dynamically
  useEffect(() => {
    if (currentUser?.color) {
      document.documentElement.style.setProperty('--theme-color', currentUser.color);
      console.log('[Theme] Applied color:', currentUser.color);
    }
  }, [currentUser?.color]);

  // Fetch TURN credentials on mount (like Zoom/Meet does)
  useEffect(() => {
    const fetchTurnCredentials = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/turn-credentials`);
        const data = await response.json();
        
        if (data.success && data.iceServers) {
          console.log('[WebRTC] Fetched ICE servers:', data.iceServers.length, 'servers');
          setIceServers(data.iceServers);
        }
      } catch (error) {
        console.error('[WebRTC] Failed to fetch TURN credentials:', error);
        // Keep default STUN server
      }
    };
    
    fetchTurnCredentials();
  }, []);

  // --- Room Logic ---

  const handleJoinRoom = async (name: string, code: string, isHost: boolean, avatar: string, color: string) => {
      const userId = generateUserId();
      const user: User = {
          id: userId,
          name: name,
          role: isHost ? UserRole.HOST : UserRole.VIEWER,
          avatar: avatar,
          isLocal: true,
          color: color
      };

      try {
        setCurrentUser(user);
        setRoomId(code);
        setInRoom(true);
        
        // Connect to socket room FIRST
        socketService.connect(userId, code, name);

        // Socket connection status
        socketService.on('status', (status: { connected: boolean, error?: string }) => {
            console.log("[App] Socket Status:", status);
            setSocketConnected(status.connected);
        });

        // Room sync (get current state when joining)
        socketService.on('room:sync', (data: { hostId: string, streaming: boolean, users: string[], messages: any[] }) => {
            console.log("[App] Room Sync:", data);
            
            // Set users count
            const userObjs = data.users.map(id => ({
                id,
                name: id === userId ? name : 'User',
                role: id === data.hostId ? UserRole.HOST : UserRole.VIEWER,
                avatar,
                isLocal: id === userId,
                color
            }));
            setUsers(userObjs);
            
            // Load existing messages
            setMessages(data.messages);
            
            // If host is streaming, request stream
            if (data.streaming && !isHost) {
                console.log("[App] Host is streaming, requesting connection...");
            }
        });

        // User joined
        socketService.on('user:joined', (data: { userId: string, userName: string, totalUsers: number }) => {
            console.log("[App] User Joined:", data);
            
            // Add new user to list if not already there
            setUsers(prev => {
                const exists = prev.find(u => u.id === data.userId);
                if (exists) return prev;
                
                return [...prev, {
                    id: data.userId,
                    name: data.userName || 'User',
                    role: UserRole.VIEWER,
                    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.userId}`,
                    isLocal: data.userId === userId,
                    color: `hsl(${Math.random() * 360}, 70%, 60%)`
                }];
            });
            
            // If I'm the host and someone joined, notify them I'm the host
            if (isHost) {
                socketService.emit('set_host', { userId });
                
                // If I'm streaming, tell them
                if (videoStateRef.current.isStreaming && localStreamRef.current) {
                    socketService.emit('stream:start', {});
                    // Initiate WebRTC offer
                    initiateConnectionToUser(data.userId);
                }
            }
        });

        // User left
        socketService.on('user:left', (data: { userId: string, totalUsers: number }) => {
            console.log("[App] User Left:", data);
            setUsers(prev => prev.filter(u => u.id !== data.userId));
            
            // Close peer connection if exists
            const pc = peerConnections.current.get(data.userId);
            if (pc) {
                pc.close();
                peerConnections.current.delete(data.userId);
            }
        });

        // Host set
        socketService.on('host:set', (data: { hostId: string }) => {
            console.log("[App] Host Set:", data.hostId);
        });

        // Stream started
        socketService.on('stream:started', (data: { hostId: string }) => {
            console.log("[App] Stream Started by:", data.hostId);
            setVideoState(prev => ({ ...prev, isStreaming: true, sourceType: VideoSourceType.SCREENSHARE }));
            
            // If I'm a viewer, request connection
            if (!isHost) {
                requestConnectionToHost(data.hostId);
            }
        });

        // Stream stopped
        socketService.on('stream:stopped', () => {
            console.log("[App] Stream Stopped");
            setVideoState(prev => ({ ...prev, isStreaming: false, sourceType: VideoSourceType.IDLE }));
            setRemoteStream(null);
            
            // Close all peer connections
            peerConnections.current.forEach(pc => pc.close());
            peerConnections.current.clear();
        });

        // Chat message
        socketService.on('chat:message', (msg: ChatMessage) => {
            console.log("[App] Chat Message:", msg);
            setMessages(prev => [...prev, msg]);
        });

        // WebRTC Signaling
        socketService.on('signal', handleSignal);

        // Room closed (host left)
        socketService.on('room:closed', (data: { reason: string, hostId: string }) => {
            console.log("[App] Room Closed:", data);
            alert(`Room closed: ${data.reason}`);
            
            // Clean up and return to lobby
            handleCloseRoom();
        });

      } catch (error) {
        console.error('Error joining room:', error);
        alert('Failed to join room. Please try again.');
      }
  };

  const handleCloseRoom = async () => {
      try {
        socketService.disconnect();
        handleStopScreenShare();
        
        setInRoom(false);
        setRoomId('');
        setUsers([]);
        setCurrentUser(null);
      } catch (error) {
        console.error('Error closing room:', error);
      }
  };

  // --- WebRTC Helper Functions ---
  
  const initiateConnectionToUser = async (targetUserId: string) => {
      if (!localStreamRef.current || !currentUserRef.current) return;
      
      console.log("[WebRTC] Initiating connection to:", targetUserId);
      const pc = createPeerConnection(targetUserId);
      
      localStreamRef.current.getTracks().forEach(track => {
          const sender = pc.addTrack(track, localStreamRef.current!);
          
          // Optimize encoding parameters for low latency and reduced lag
          if (track.kind === 'video') {
              const params = sender.getParameters();
              if (!params.encodings) {
                  params.encodings = [{}];
              }
              params.encodings[0].maxBitrate = 1000000; // 1 Mbps - good for 480p
              params.encodings[0].maxFramerate = 30;
              sender.setParameters(params).catch(e => console.log("Failed to set encoding params:", e));
          }
      });

      const offer = await pc.createOffer({
          offerToReceiveAudio: false,
          offerToReceiveVideo: false
      });
      await pc.setLocalDescription(offer);
      
      console.log("[WebRTC] Offer created and set, sending to viewer:", targetUserId);
      socketService.emit('signal', { signal: offer, targetId: targetUserId });
  };

  const requestConnectionToHost = async (hostId: string) => {
      console.log("[WebRTC] Requesting connection to host:", hostId);
      socketService.emit('signal', { signal: { type: 'request' }, targetId: hostId });
  };

  // --- WebRTC Signaling Logic ---
  
  const createPeerConnection = (targetUserId: string) => {
      console.log('[WebRTC] Creating peer connection with', iceServers.length, 'ICE servers');
      
      const pc = new RTCPeerConnection({
          iceServers: iceServers,
          iceCandidatePoolSize: 10,
          iceTransportPolicy: 'all', // Try all methods: STUN, TURN, direct
          bundlePolicy: 'max-bundle',
          rtcpMuxPolicy: 'require'
      });

      pc.onicecandidate = (event) => {
          if (event.candidate) {
              const candidate = event.candidate;
              console.log(`[WebRTC] ICE candidate type: ${candidate.type}, protocol: ${candidate.protocol}`, 
                  candidate.candidate.includes('relay') ? '🔄 TURN RELAY' : 
                  candidate.candidate.includes('srflx') ? '🌐 STUN' : 
                  '🏠 HOST');
              socketService.emit('signal', { signal: event.candidate, targetId: targetUserId });
          } else {
              console.log('[WebRTC] All ICE candidates sent');
          }
      };

      pc.ontrack = (event) => {
          console.log("[WebRTC] ✅ Received Remote Track from:", targetUserId);
          setRemoteStream(event.streams[0]);
      };

      pc.oniceconnectionstatechange = () => {
          console.log(`[WebRTC] ICE connection state: ${pc.iceConnectionState}`);
          
          if (pc.iceConnectionState === 'failed') {
              console.error('[WebRTC] ICE connection failed, restarting...');
              pc.restartIce();
          }
      };

      pc.onconnectionstatechange = () => {
          console.log(`[WebRTC] Connection state: ${pc.connectionState}`);
          
          if (pc.connectionState === 'connected') {
              console.log('🎉 [WebRTC] Peer connection established successfully!');
          }
          
          if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
              console.error("[WebRTC] Connection failed, attempting to reconnect...");
              // Clean up and try reconnecting
              setTimeout(() => {
                  if (currentUserRef.current?.role === UserRole.VIEWER) {
                      console.log('[WebRTC] Viewer requesting reconnection...');
                      requestConnectionToHost(targetUserId);
                  } else if (currentUserRef.current?.role === UserRole.HOST) {
                      console.log('[WebRTC] Host re-initiating connection...');
                      initiateConnectionToUser(targetUserId);
                  }
              }, 2000);
          }
      };

      peerConnections.current.set(targetUserId, pc);
      return pc;
  };

  const handleSignal = async (data: { signal: any, senderId: string }) => {
      try {
          const { signal, senderId } = data;
          console.log("[WebRTC] Received Signal from:", senderId, "Type:", signal.type);

          if (signal.type === 'request') {
              // Viewer is requesting stream, send offer immediately
              if (currentUserRef.current?.role === UserRole.HOST && localStreamRef.current) {
                  console.log("[WebRTC] Host sending offer to viewer:", senderId);
                  await initiateConnectionToUser(senderId);
              }
          } else if (signal.type === 'offer') {
              console.log("[WebRTC] Viewer received offer, creating answer...");
              const pc = createPeerConnection(senderId);
              await pc.setRemoteDescription(new RTCSessionDescription(signal));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              console.log("[WebRTC] Sending answer back to host");
              socketService.emit('signal', { signal: answer, targetId: senderId });
          } else if (signal.type === 'answer') {
              console.log("[WebRTC] Host received answer from viewer");
              const pc = peerConnections.current.get(senderId);
              if (pc) {
                  await pc.setRemoteDescription(new RTCSessionDescription(signal));
              }
          } else if (signal.candidate) {
              const pc = peerConnections.current.get(senderId);
              if (pc) {
                  await pc.addIceCandidate(new RTCIceCandidate(signal));
              }
          }
      } catch (err) {
          console.error("[WebRTC] Error", err);
      }
  };

  // --- Host Actions ---

  const handleStartScreenShare = async () => {
      if (!currentUser) return;
      try {
          console.log("[Host] Starting screen share...");
          const stream = await navigator.mediaDevices.getDisplayMedia({ 
              video: {
                  width: { ideal: 1280, max: 1920 },
                  height: { ideal: 720, max: 1080 },
                  frameRate: { ideal: 30, max: 30 }
              }, 
              audio: true 
          });
          setLocalStream(stream);
          localStreamRef.current = stream;

          stream.getVideoTracks()[0].onended = () => {
              handleStopScreenShare();
          };

          const newState = { sourceType: VideoSourceType.SCREENSHARE, isStreaming: true, isHostPaused: false };
          setVideoState(prev => ({ ...prev, ...newState }));
          videoStateRef.current = { ...videoStateRef.current, ...newState }; // Update ref immediately
          
          // Notify server that streaming started
          socketService.emit('stream:start', {});
          
          console.log("[Host] Screen share started, notified server");
          
          // IMPORTANT: The server will broadcast 'stream:started' to all users
          // Viewers will then send 'request' signal, and we'll respond in handleSignal

      } catch (err) {
          console.error("[Host] Error sharing screen:", err);
      }
  };

  const handleStopScreenShare = () => {
      console.log("[Host] Stopping screen share...");
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      setLocalStream(null);
      localStreamRef.current = null;
      
      peerConnections.current.forEach(pc => pc.close());
      peerConnections.current.clear();

      const newState = { sourceType: VideoSourceType.IDLE, isStreaming: false, isHostPaused: false };
      setVideoState(prev => ({ ...prev, ...newState }));
      videoStateRef.current = { ...videoStateRef.current, ...newState }; // Update ref immediately
      
      // Notify server that streaming stopped
      socketService.emit('stream:stop', {});
      
      console.log("[Host] Screen share stopped, notified server");
  };

  // Handle playback action from Host's VideoPlayer
  const handlePlaybackAction = (action: StreamAction) => {
      if (currentUser?.role === UserRole.HOST) {
          if (action.type === 'pause') {
              setVideoState(prev => ({ ...prev, isHostPaused: true }));
          } else {
              setVideoState(prev => ({ ...prev, isHostPaused: false }));
          }
          socketService.emit('stream:action', action);
      }
  };

  const handleSendMessage = useCallback((text: string, type: 'text' | 'gif' = 'text', replyToMsg?: ChatMessage) => {
    if (!currentUser) return;
    
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      userId: currentUser.id,
      userName: currentUser.name,
      userAvatar: currentUser.avatar,
      userColor: currentUser.color,
      text,
      timestamp: Date.now(),
      type,
      replyTo: replyToMsg ? {
          id: replyToMsg.id,
          userName: replyToMsg.userName,
          text: replyToMsg.type === 'gif' ? 'GIF' : replyToMsg.text
      } : undefined
    };
    
    console.log("[Chat] Sending message:", newMessage);
    socketService.emit('chat:message', { message: newMessage });
  }, [currentUser]);

  const handleReaction = useCallback((msgId: string, emoji: string) => {
      if (!currentUser) return;
      
      // Optimistic Update locally first
      setMessages(prevMessages => {
          return prevMessages.map(msg => {
              if (msg.id !== msgId) return msg;

              const reactions = msg.reactions ? { ...msg.reactions } : {};
              const currentReaction = reactions[emoji] || { emoji, count: 0, userIds: [] };
              
              let newUserIds = [...currentReaction.userIds];
              
              if (newUserIds.includes(currentUser.id)) {
                  newUserIds = newUserIds.filter(id => id !== currentUser.id);
              } else {
                  newUserIds.push(currentUser.id);
              }

              if (newUserIds.length === 0) {
                  delete reactions[emoji];
              } else {
                  reactions[emoji] = {
                      emoji,
                      count: newUserIds.length,
                      userIds: newUserIds
                  };
              }
              return { ...msg, reactions };
          });
      });

      // Then Emit to others
      socketService.emit('chat:reaction', { msgId, emoji, userId: currentUser.id });
  }, [currentUser]);

  // --- Render ---

  if (!inRoom || !currentUser) {
      return <Lobby onJoin={handleJoinRoom} />;
  }

  return (
    <div 
      className="h-[100dvh] bg-pawry-900 text-white flex flex-col font-sans bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-pawry-800 via-pawry-900 to-black overflow-hidden"
    >
      {!socketConnected && (
        <div className="bg-red-600 text-white text-xs py-1 px-4 text-center font-bold z-50 shadow-md">
          ⚠️ Disconnected from Real-time Server. Chat and Streaming will not work.
        </div>
      )}
      
      {/* Main Content Area */}
      {/* Header - Compact */}
      <header className="h-12 md:h-16 border-b border-white/5 flex items-center justify-between px-4 bg-skin-500 shadow-lg shadow-skin-600/20 z-50 shrink-0 transition-colors duration-300">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-black/20 flex items-center justify-center text-white font-black text-xs md:text-sm shadow-inner">
            SM
          </div>
          <div>
             <h1 className="text-md font-bold tracking-tight text-white leading-none">StreamMates</h1>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <button 
             onClick={() => {
                 socketService.emit('room:refresh', { roomId });
             }}
             className="text-xs bg-white/10 hover:bg-white/20 px-2 py-1 rounded text-white/70"
             title="Refresh User List"
           >
             Refresh
           </button>
           {currentUser.role === UserRole.HOST && (
               <button 
                 onClick={() => {
                     console.log("Manual Sync Triggered");
                     socketService.emit('video:sync', videoStateRef.current);
                 }}
                 className="text-xs bg-white/10 hover:bg-white/20 px-2 py-1 rounded text-white/70"
                 title="Force Sync State to Viewers"
               >
                 Force Sync
               </button>
           )}
           <div className={`flex items-center gap-2 text-[10px] md:text-xs px-2 py-1 md:px-3 md:py-1.5 rounded-full font-bold border bg-black/20 border-white/10 text-white`}>
               <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${currentUser.role === UserRole.HOST ? 'bg-yellow-400' : 'bg-blue-400'} animate-pulse`}></div>
               {currentUser.role === UserRole.HOST ? 'HOST' : 'VIEWER'}
           </div>
        </div>
      </header>

      {/* Main Layout */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden relative min-h-0">
        
        {/* Left Column: Video + Controls */}
        <div className="w-full lg:flex-1 flex flex-col shrink-0 lg:shrink lg:h-full bg-black border-b lg:border-b-0 lg:border-r border-white/10">
            
            {/* Video Player Container - Constrained Height on Mobile */}
            <div className="w-full bg-black flex items-center justify-center shrink-0 relative max-h-[35vh] lg:max-h-none lg:h-auto lg:flex-1 aspect-video">
                <div className="w-full h-full lg:w-auto lg:aspect-video lg:max-h-full mx-auto">
                    <VideoPlayer 
                        videoState={videoState} 
                        isHost={currentUser.role === UserRole.HOST} 
                        stream={currentUser.role === UserRole.HOST ? localStream : remoteStream}
                        onPlaybackAction={handlePlaybackAction}
                    />
                </div>
            </div>

            {/* Controls Bar - Slim, Compact, No Padding */}
            {currentUser.role === UserRole.HOST && (
                <div className="shrink-0 w-full">
                    <Controls 
                        roomId={roomId}
                        onCloseRoom={handleCloseRoom}
                        onScreenShareStart={handleStartScreenShare}
                        onScreenShareStop={handleStopScreenShare}
                        currentSourceType={videoState.sourceType}
                        isStreaming={videoState.isStreaming}
                    />
                </div>
            )}
        </div>

        {/* Right Column: Chat - Grows to fill space */}
        <div className="flex-1 lg:flex-none lg:w-96 shrink-0 z-20 relative min-h-0 flex flex-col bg-pawry-900/50">
          <ChatPanel 
            messages={messages} 
            currentUser={currentUser} 
            users={users}
            onSendMessage={handleSendMessage} 
            onReact={handleReaction}
          />
        </div>
      </main>
    </div>
  );
};

export default App;

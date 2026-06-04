import { io, Socket } from 'socket.io-client';

export class RTCBot {
  private socket: Socket;
  private sfuSocket: Socket;
  public userId: string;
  private roomId: string;
  private connected = false;

  constructor(
    userId: string,
    roomId: string,
    token: string,
    serverUrl = process.env.SERVER_URL || 'http://localhost:5000',
    sfuUrl   = process.env.SFU_URL    || 'http://localhost:3001',
  ) {
    this.userId = userId;
    this.roomId = roomId;
    this.socket = io(serverUrl, {
      autoConnect: false,
      reconnection: true,
      auth: { token },
      query: { userId, roomId }
    });
    this.sfuSocket = io(sfuUrl, {
      autoConnect: false,
      reconnection: true,
      auth: { token },
      query: { userId, roomId }
    });

    this.setupListeners();
  }

  private setupListeners() {
    this.socket.on('connect', () => {
      this.connected = true;
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
    });

    this.socket.on('newProducer', (data: any) => {
      // Simulate subscribing to a new producer
      this.socket.emit('consume', { producerId: data.producerId });
    });
  }

  public async join(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket.connect();
      this.sfuSocket.connect();

      let mainConnected = false;
      let sfuConnected = false;

      const checkBoth = () => {
        if (mainConnected && sfuConnected) {
          this.connected = true;
          this.socket.once('room:joined', () => {
            resolve();
          });
          this.socket.once('room:error', (error: any) => {
            reject(new Error(error?.error || error?.message || 'Room Error'));
          });
          this.socket.emit('room:join', { roomId: this.roomId });
        }
      };

      this.socket.once('connect', () => {
        mainConnected = true;
        checkBoth();
      });
      this.sfuSocket.once('connect', () => {
        sfuConnected = true;
        checkBoth();
      });

      this.socket.once('connect_error', (err: any) => reject(new Error(`Main Connect Error: ${err.message}`)));
      this.sfuSocket.once('connect_error', (err: any) => reject(new Error(`SFU Connect Error: ${err.message}`)));

      // Increased to 30 seconds to handle cloud Redis latency when 500 bots join simultaneously
      setTimeout(() => reject(new Error('Timeout connecting')), 30000);
    });
  }

  public async leave(): Promise<void> {
    this.socket.emit('leaveRoom', { roomId: this.roomId });
    this.socket.disconnect();
  }

  public async publishMedia(): Promise<void> {
    if (!this.connected) throw new Error('Not connected');
    
    // Simulate creating a WebRTC Transport on SFU
    this.sfuSocket.emit('sfu:create-transport', { forceTcp: false }, (transportData: any) => {
      if (!transportData || transportData.error) return;

      // Simulate DTLS Connect
      this.sfuSocket.emit('sfu:connect-transport', { 
        transportId: transportData.id,
        dtlsParameters: { fingerprint: 'mock-fingerprint' }
      });

      // Simulate publishing Audio and Video
      this.sfuSocket.emit('sfu:produce', {
        transportId: transportData.id,
        kind: 'audio',
        rtpParameters: { codecs: [] }
      });

      this.sfuSocket.emit('sfu:produce', {
        transportId: transportData.id,
        kind: 'video',
        rtpParameters: { codecs: [] } // In real life, mock the mediasoup RTP parameters
      });
    });
  }

  public switchSpeaker(targetUserId: string): void {
    if (!this.connected) return;
    this.socket.emit('setDominantSpeaker', { roomId: this.roomId, speakerId: targetUserId });
  }

  public simulatePacketLoss(): void {
    if (!this.connected) return;
    // Simulate the client sending a receiver report indicating heavy packet loss
    this.socket.emit('rtcpReceiverReport', {
      roomId: this.roomId,
      fractionLost: 25, // Simulate 10% packet loss (0-255 scale)
      totalLost: 100
    });
  }
}

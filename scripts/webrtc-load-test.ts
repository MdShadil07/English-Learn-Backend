/**
 * WebRTC Practice Room Load Testing Script
 * Simulates N users joining a practice room and exchanging placeholder SDP signaling.
 * 
 * Usage: 
 * 1. Ensure `socket.io-client` is installed: `npm install socket.io-client`
 * 2. Run with tsx: `npm run dev -- webrtc-load-test` or `npx tsx scripts/webrtc-load-test.ts`
 */

import { io, Socket } from 'socket.io-client';

const TARGET_USERS = 500;
const ROOM_ID = process.env.ROOM_ID || 'test-room-123';
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:5000';
// Mock tokens or disable authentication for the load test endpoint if needed.
// For realistic scale testing, you should generate valid tokens or bypass auth locally.
const MOCK_TOKEN = process.env.MOCK_TOKEN || 'valid-test-token-here'; 

const connections: Socket[] = [];
let joinedUsers = 0;

function createWorker(workerId: number) {
  const socket = io(SERVER_URL, {
    auth: { token: MOCK_TOKEN },
    transports: ['websocket'],
    reconnection: false,
  });

  socket.on('connect', () => {
    console.log(`Worker ${workerId} connected: ${socket.id}`);
    
    // Join Room
    socket.emit('room:join', { roomId: ROOM_ID });
  });

  socket.on('room:joined', () => {
    joinedUsers++;
    console.log(`Worker ${workerId} joined room. (Total: ${joinedUsers})`);
    
    // Once standard join happens, join WebRTC call
    setTimeout(() => {
      socket.emit('webrtc:join-call', { roomId: ROOM_ID });
    }, Math.random() * 2000); // jitter
  });

  // Handle incoming signaling:
  // Usually participants send offers upon user-joined-call
  socket.on('webrtc:user-joined-call', (data: any) => {
    // Send a mock offer
    socket.emit('webrtc:offer', {
      roomId: ROOM_ID,
      targetUserId: data.userId,
      offer: { type: 'offer', sdp: 'v=0\r\no=mock-sdp-offer\r\n...' }
    });
  });

  socket.on('webrtc:offer', (data: any) => {
    // Reply with a mock answer
    socket.emit('webrtc:answer', {
      roomId: ROOM_ID,
      targetUserId: data.fromUserId,
      answer: { type: 'answer', sdp: 'v=0\r\no=mock-sdp-answer\r\n...' }
    });
  });

  socket.on('webrtc:error', (error: any) => {
    if (error.error === "Authentication required" || error.error === "Invalid token") {
       console.error(`Worker ${workerId} Auth Error: Make sure MOCK_TOKEN is valid or auth is disabled.`);
       socket.disconnect();
    }
  });

  socket.on('disconnect', () => {
    console.log(`Worker ${workerId} disconnected.`);
  });

  return socket;
}

async function runLoadTest() {
  console.log(`Starting Load Test: Booting ${TARGET_USERS} socket workers to connect to ${SERVER_URL}`);
  
  for (let i = 0; i < TARGET_USERS; i++) {
    const worker = createWorker(i);
    connections.push(worker);
    
    // Spread connection requests out to avoid port exhaustion / DDoS protection
    await new Promise(resolve => setTimeout(resolve, 50)); 
  }
}

runLoadTest().catch(console.error);

process.on('SIGINT', () => {
  console.log('Shutting down connections...');
  connections.forEach(s => s.disconnect());
  process.exit();
});

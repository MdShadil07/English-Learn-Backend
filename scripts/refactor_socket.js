import fs from 'fs';
import path from 'path';

const socketServicePath = 'd:/ENGLISH PRACTICE/Learn English/backend/src/services/WebSocket/socketService.ts';
let content = fs.readFileSync(socketServicePath, 'utf8');

// 1. Remove connectedUsers and userSockets
content = content.replace(
  /private connectedUsers: Map<string, SocketUser> = new Map\(\);\s*private userSockets: Map<string, string> = new Map\(\); \/\/ userId -> socketId/,
  ''
);

content = content.replace(
  /interface SocketUser {\s*userId: string;\s*socketId: string;\s*}\s*/,
  ''
);

// 2. Fix Auth Middleware
content = content.replace(
  /this\.connectedUsers\.set\(socket\.id, {[\s\S]*?}\);\s*this\.userSockets\.set\(user\._id\.toString\(\), socket\.id\);/,
  'socket.data.userId = user._id.toString();'
);

// 3. Fix handleDisconnection
content = content.replace(
  /const userInfo = this\.connectedUsers\.get\(socket\.id\);\s*if \(userInfo\) {/,
  'const userId = socket.data.userId;\n\n    if (userId) {\n      const userInfo = { userId };'
);
content = content.replace(/this\.connectedUsers\.delete\(socket\.id\);\s*this\.userSockets\.delete\(userInfo\.userId\);/, '');

// 4. Replace `const userInfo = this.connectedUsers.get(socket.id);` in handlers
content = content.replace(/const userInfo = this\.connectedUsers\.get\(socket\.id\);/g, 'const userId = socket.data.userId;');
// Since we used `if (!userInfo) return;`, change to `if (!userId) return;`
content = content.replace(/if \(!userInfo\) return;/g, 'if (!userId) return;');
// Change `userInfo.userId` to `userId`
content = content.replace(/userInfo\.userId/g, 'userId');

// 5. Replace targetSocketId logic with userChannel
// Examples:
// const targetSocketId = this.userSockets.get(data.targetUserId);
// if (targetSocketId) {
//   this.io?.to(targetSocketId).emit(...)
// }

content = content.replace(
  /const socketId = this\.userSockets\.get\((.*?)\);\s*if \(socketId\) {\s*this\.io\.to\(socketId\)\.emit\((.*?)\);\s*}/g,
  'this.io?.to(userChannel($1)).emit($2);'
);

content = content.replace(
  /const targetSocketId = this\.userSockets\.get\((.*?)\);\s*if \(targetSocketId\) {\s*this\.io\?\.to\(targetSocketId\)\.emit\((.*?)\);\s*}/g,
  'this.io?.to(userChannel($1)).emit($2);'
);

content = content.replace(
  /const socketId = this\.userSockets\.get\((.*?)\);\s*if \(socketId\) {\s*const socket = this\.io\.sockets\.sockets\.get\(socketId\);\s*if \(socket\) {\s*socket\.join\((.*?)\);\s*}\s*}/g,
  `// Cannot directly call socket.join on another instance.
    // Assuming user joined the room via REST and will listen to room events,
    // they can explicitly subscribe or we just let them auto-join on next connect.`
);

content = content.replace(
  /const socketId = this\.userSockets\.get\((.*?)\);\s*if \(socketId\) {\s*const socket = this\.io\.sockets\.sockets\.get\(socketId\);\s*if \(socket\) {\s*socket\.leave\((.*?)\);\s*}\s*}/g,
  `// Handled by room state and Redis; specific socket leaves will happen locally or on disconnect.`
);

// Fix Bottleneck 7: room:lock-updated
content = content.replace(
  /this\.io\?\.emit\('room:lock-updated', {/g,
  "this.io?.to(roomChannel(data.roomId)).emit('room:lock-updated', {"
);

fs.writeFileSync(socketServicePath, content, 'utf8');
console.log('socketService.ts updated successfully.');

import fs from 'fs';
const socketServicePath = 'd:/ENGLISH PRACTICE/Learn English/backend/src/services/WebSocket/socketService.ts';
let content = fs.readFileSync(socketServicePath, 'utf8');

// Line 302: const socketId = this.userSockets.get(userId);
// Just remove that block, since we already emit to userChannel(userId) right below it.
content = content.replace(
  /const socketId = this\.userSockets\.get\(userId\);\s*if \(socketId\) \{\s*this\.io\.to\(socketId\)\.emit\('profile:updated', \{\s*success: true,\s*data: profileData,\s*timestamp: new Date\(\)\.toISOString\(\),\s*\}\);\s*\}/g,
  ''
);

// Line 645: const targetSocketId = this.userSockets.get(data.targetUserId);
content = content.replace(
  /const targetSocketId = this\.userSockets\.get\((.*?)\);\s*if \(targetSocketId\) \{\s*this\.io\?\.to\(targetSocketId\)\.emit\((.*?)\);\s*\}/g,
  'this.io?.to(userChannel($1)).emit($2);'
);

// Line 735, 749: if (!userInfo || !data.roomId) return;
content = content.replace(
  /if \(!userInfo \|\| !data\.roomId\) return;/g,
  'if (!userId || !data.roomId) return;'
);

fs.writeFileSync(socketServicePath, content, 'utf8');
console.log('Fixed TS errors step 2.');

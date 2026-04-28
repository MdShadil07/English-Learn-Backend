import fs from 'fs';
const socketServicePath = 'd:/ENGLISH PRACTICE/Learn English/backend/src/services/WebSocket/socketService.ts';
let content = fs.readFileSync(socketServicePath, 'utf8');

content = content.replace(
  /const targetSocketId = this\.userSockets\.get\(data\.targetUserId\);\s*if \(targetSocketId\) \{\s*this\.io\?\.to\(targetSocketId\)\.emit\('room:force-kick', \{\s*roomId: data\.roomId,\s*isBlocked: !!data\.isBlock\s*\}\);\s*\}/g,
  `this.io?.to(userChannel(data.targetUserId)).emit('room:force-kick', {\n        roomId: data.roomId,\n        isBlocked: !!data.isBlock \n      });`
);

content = content.replace(
  /const targetSocketId = this\.userSockets\.get\(data\.targetUserId\);\s*if \(targetSocketId\) \{\s*this\.io\?\.to\(targetSocketId\)\.emit\('room:force-mute', \{\s*roomId: data\.roomId,\s*mutedBy: userId\s*\}\);\s*\}/g,
  `this.io?.to(userChannel(data.targetUserId)).emit('room:force-mute', {\n        roomId: data.roomId,\n        mutedBy: userId \n      });`
);

fs.writeFileSync(socketServicePath, content, 'utf8');
console.log('Fixed TS errors step 3.');

const fs = require('fs');
const filePath = 'D:\\ENGLISH PRACTICE\\Learn English\\backend\\src\\services\\WebSocket\\socketService.ts';
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = `  private async verifyToken(token: string): Promise<any> {
    try {
      // TEMPORARY BACKDOOR FOR LOAD TESTING
      if (token === 'valid-test-token-here') {
        return { _id: 'mock-user-' + Math.random().toString(36).substring(2, 9) };
      }

      // Verify the JWT token`;

const replacementStr = `  private async verifyToken(token: string): Promise<any> {
    try {
      // Verify the JWT token`;

content = content.replace(targetStr.replace(/\n/g, '\r\n'), replacementStr);
content = content.replace(targetStr, replacementStr);

fs.writeFileSync(filePath, content);
console.log('reverted auth');

import crypto from 'crypto';
export const generateRoomId = (prefix = 'room') => {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(6).toString('hex');
    return `${prefix}_${timestamp}_${random}`;
};
export default generateRoomId;
//# sourceMappingURL=generateRoomId.js.map
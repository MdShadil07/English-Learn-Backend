import Joi from 'joi';
import { Types } from 'mongoose';
const roomIdPattern = /^room_[a-zA-Z0-9]+_[a-zA-Z0-9]+$/;
const roomJoinSchema = Joi.object({
    roomId: Joi.string().trim().min(10).max(128).required(),
});
const roomMessageSchema = Joi.object({
    roomId: Joi.string().trim().min(10).max(128).required(),
    message: Joi.any().required(),
});
export const validateRoomId = (roomId) => {
    return typeof roomId === 'string' && roomIdPattern.test(roomId.trim());
};
export const validateUserId = (userId) => {
    return Types.ObjectId.isValid(userId);
};
export const validateRoomJoinPayload = (payload) => {
    const { error, value } = roomJoinSchema.validate(payload, { abortEarly: true });
    if (error) {
        return { valid: false, error: error.details[0]?.message || 'Invalid room join payload' };
    }
    if (!validateRoomId(value.roomId)) {
        return { valid: false, error: 'Invalid roomId format' };
    }
    return { valid: true, roomId: value.roomId };
};
export const validateRoomMessagePayload = (payload) => {
    const { error, value } = roomMessageSchema.validate(payload, { abortEarly: true });
    if (error) {
        return { valid: false, error: error.details[0]?.message || 'Invalid room message payload' };
    }
    if (!validateRoomId(value.roomId)) {
        return { valid: false, error: 'Invalid roomId format' };
    }
    return { valid: true, roomId: value.roomId, message: value.message };
};
//# sourceMappingURL=validateRoom.js.map
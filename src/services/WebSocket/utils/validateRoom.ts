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

export const validateRoomId = (roomId: string): boolean => {
  return typeof roomId === 'string' && roomIdPattern.test(roomId.trim());
};

export const validateUserId = (userId: string): boolean => {
  return Types.ObjectId.isValid(userId);
};

export const validateRoomJoinPayload = (
  payload: unknown
): { valid: boolean; error?: string; roomId?: string } => {
  const { error, value } = roomJoinSchema.validate(payload, { abortEarly: true });
  if (error) {
    return { valid: false, error: error.details[0]?.message || 'Invalid room join payload' };
  }

  if (!validateRoomId(value.roomId)) {
    return { valid: false, error: 'Invalid roomId format' };
  }

  return { valid: true, roomId: value.roomId };
};

export const validateRoomMessagePayload = (
  payload: unknown
): { valid: boolean; error?: string; roomId?: string; message?: any } => {
  const { error, value } = roomMessageSchema.validate(payload, { abortEarly: true });
  if (error) {
    return { valid: false, error: error.details[0]?.message || 'Invalid room message payload' };
  }

  if (!validateRoomId(value.roomId)) {
    return { valid: false, error: 'Invalid roomId format' };
  }

  return { valid: true, roomId: value.roomId, message: value.message };
};

import { Router } from 'express';
import { roomController } from '../../controllers/Room/roomController.js';
import { authenticate } from '../../middleware/auth/auth.js';

const router = Router();

/**
 * @route GET /api/rooms/active
 * @desc Get all active non-private rooms
 * @access Public
 */
router.get('/active', roomController.getActiveRooms.bind(roomController));

// All room routes require authentication
router.use(authenticate);

/**
 * @route POST /api/rooms
 * @desc Create a new room
 * @access Private
 */
router.post('/', roomController.createRoom.bind(roomController));

/**
 * @route GET /api/rooms/:roomId
 * @desc Get room details
 * @access Private
 */
router.get('/:roomId', roomController.getRoomDetails.bind(roomController));

/**
 * @route POST /api/rooms/:roomId/join
 * @desc Join an existing room
 * @access Private
 */
router.post('/:roomId/join', roomController.joinRoom.bind(roomController));

/**
 * @route POST /api/rooms/:roomId/leave
 * @desc Leave a room
 * @access Private
 */
router.post('/:roomId/leave', roomController.leaveRoom.bind(roomController));

/**
 * @route POST /api/rooms/:roomId/close
 * @desc Close a room (host only)
 * @access Private
 */
router.post('/:roomId/close', roomController.closeRoom.bind(roomController));

/**
 * @route POST /api/rooms/:roomId/start-call
 * @desc Start WebRTC call in room
 * @access Private
 */
router.post('/:roomId/start-call', roomController.startCall.bind(roomController));

/**
 * @route POST /api/rooms/:roomId/end-call
 * @desc End WebRTC call in room
 * @access Private
 */
router.post('/:roomId/end-call', roomController.endCall.bind(roomController));

/**
 * @route GET /api/rooms/:roomId/call-participants
 * @desc Get call participants in room
 * @access Private
 */
router.get('/:roomId/call-participants', roomController.getCallParticipants.bind(roomController));

export default router;
import mongoose, { Schema } from 'mongoose';
const roomParticipantSchema = new Schema({
    roomId: {
        type: String,
        required: true,
        index: true,
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    joinedAt: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: false, // We only need joinedAt
});
// Ensure a user can only have one active participant record per room
roomParticipantSchema.index({ roomId: 1, userId: 1 }, { unique: true });
export const RoomParticipant = mongoose.model('RoomParticipant', roomParticipantSchema);
export default RoomParticipant;
//# sourceMappingURL=RoomParticipant.js.map
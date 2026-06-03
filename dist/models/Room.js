import mongoose, { Schema } from 'mongoose';
const roomSchema = new Schema({
    roomId: {
        type: String,
        required: [true, 'Room ID is required'],
        unique: true,
        trim: true,
    },
    roomCode: {
        type: String,
        trim: true,
        uppercase: true,
        sparse: true, // Only indexed when present (private rooms)
    },
    topic: {
        type: String,
        required: [true, 'Room topic is required'],
        trim: true,
        maxlength: [100, 'Topic cannot exceed 100 characters'],
    },
    description: {
        type: String,
        trim: true,
        maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    banner: {
        type: String,
        trim: true,
        default: 'from-emerald-400 to-teal-600',
    },
    bannerText: {
        type: String,
        trim: true,
        default: 'English Practice Room'
    },
    bannerFontFamily: {
        type: String,
        trim: true,
        default: 'system-ui, -apple-system, sans-serif'
    },
    bannerIsBold: {
        type: Boolean,
        default: true
    },
    bannerIsItalic: {
        type: Boolean,
        default: false
    },
    bannerFontSize: {
        type: Number,
        default: 24
    },
    mode: {
        type: String,
        enum: ['smallGroup', 'classroom', 'webinar'],
        default: 'classroom',
    },
    hostId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Host ID is required'],
    },
    maxParticipants: {
        type: Number,
        default: 500,
        min: [1, 'Maximum participants must be at least 1'],
        max: [500, 'Maximum participants cannot exceed 500'],
    },
    isPrivate: {
        type: Boolean,
        default: false,
    },
    isLocked: {
        type: Boolean,
        default: false,
    },
    blockedUsers: [{
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: [],
        }],
    moderators: [{
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: [],
        }],
    status: {
        type: String,
        enum: ['active', 'closed'],
        default: 'active',
    },
}, {
    timestamps: true,
});
// Optimized indexes for room management
roomSchema.index({ roomCode: 1 }, { unique: true, sparse: true });
roomSchema.index({ hostId: 1, status: 1, createdAt: -1 });
roomSchema.index({ status: 1, createdAt: -1 });
roomSchema.index({ isPrivate: 1, status: 1 });
roomSchema.index({ maxParticipants: 1, isPrivate: 1 });
// TTL index for inactive room cleanup
roomSchema.index({ lastActivity: 1 }, {
    expireAfterSeconds: 2592000, // 30 days
    partialFilterExpression: { status: 'closed' }
});
// Static methods
roomSchema.statics.findByRoomId = function (roomId) {
    return this.findOne({ roomId, status: 'active' });
};
roomSchema.statics.findActiveRooms = function () {
    return this.find({ status: 'active' }).sort({ createdAt: -1 });
};
roomSchema.statics.findRoomsByHost = function (hostId) {
    return this.find({ hostId, status: 'active' }).sort({ createdAt: -1 });
};
// Instance methods
roomSchema.methods.isBlocked = function (userId) {
    return this.blockedUsers.some((id) => id.equals(userId));
};
roomSchema.methods.isModerator = function (userId) {
    return this.moderators.some((id) => id.equals(userId));
};
const Room = mongoose.model('Room', roomSchema);
export default Room;
//# sourceMappingURL=Room.js.map
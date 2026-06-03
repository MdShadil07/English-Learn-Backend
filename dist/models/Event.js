import mongoose, { Schema } from 'mongoose';
const eventSchema = new Schema({
    type: {
        type: String,
        required: true,
        index: true,
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required'],
    },
    subscriptionId: {
        type: Schema.Types.ObjectId,
        ref: 'Subscription',
    },
    metadata: {
        type: Schema.Types.Mixed,
    },
}, {
    timestamps: { createdAt: true, updatedAt: false },
});
// Indexes
eventSchema.index({ userId: 1, createdAt: -1 });
const Event = mongoose.model('Event', eventSchema);
export default Event;
//# sourceMappingURL=Event.js.map
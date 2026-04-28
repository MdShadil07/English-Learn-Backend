import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IRoomParticipant extends Document {
  roomId: string;
  userId: mongoose.Types.ObjectId;
  joinedAt: Date;
}

const roomParticipantSchema = new Schema<IRoomParticipant>(
  {
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
  },
  {
    timestamps: false, // We only need joinedAt
  }
);

// Ensure a user can only have one active participant record per room
roomParticipantSchema.index({ roomId: 1, userId: 1 }, { unique: true });

export const RoomParticipant: Model<IRoomParticipant> = mongoose.model<IRoomParticipant>('RoomParticipant', roomParticipantSchema);
export default RoomParticipant;

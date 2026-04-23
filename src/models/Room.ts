import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IRoom extends Document {
  _id: mongoose.Types.ObjectId;
  roomId: string; // Unique room identifier
  topic: string; // Room topic/title
  description?: string; // Room description
  hostId: mongoose.Types.ObjectId; // User who created the room
  participants: mongoose.Types.ObjectId[]; // Array of participant user IDs
  maxParticipants: number; // Maximum number of participants (default: 500)
  isPrivate: boolean; // Whether the room is private
  status: 'active' | 'closed'; // Room status
  createdAt: Date;
  updatedAt: Date;
  isFull(): boolean;
  hasParticipant(userId: mongoose.Types.ObjectId): boolean;
  addParticipant(userId: mongoose.Types.ObjectId): boolean;
  removeParticipant(userId: mongoose.Types.ObjectId): boolean;
}

export interface IRoomModel extends Model<IRoom> {
  findByRoomId(roomId: string): Promise<IRoom | null>;
  findActiveRooms(): Promise<IRoom[]>;
  findRoomsByHost(hostId: mongoose.Types.ObjectId): Promise<IRoom[]>;
  findRoomsByParticipant(userId: mongoose.Types.ObjectId): Promise<IRoom[]>;
}

const roomSchema = new Schema<IRoom, IRoomModel>(
  {
    roomId: {
      type: String,
      required: [true, 'Room ID is required'],
      unique: true,
      trim: true,
      index: true,
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
    hostId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Host ID is required'],
      index: true,
    },
    participants: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: [],
    }],
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
    status: {
      type: String,
      enum: ['active', 'closed'],
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
roomSchema.index({ createdAt: -1 });
roomSchema.index({ hostId: 1, status: 1 });
roomSchema.index({ participants: 1 });

// Static methods
roomSchema.statics.findByRoomId = function (roomId: string) {
  return this.findOne({ roomId, status: 'active' });
};

roomSchema.statics.findActiveRooms = function () {
  return this.find({ status: 'active' }).sort({ createdAt: -1 });
};

roomSchema.statics.findRoomsByHost = function (hostId: mongoose.Types.ObjectId) {
  return this.find({ hostId, status: 'active' }).sort({ createdAt: -1 });
};

roomSchema.statics.findRoomsByParticipant = function (userId: mongoose.Types.ObjectId) {
  return this.find({
    participants: userId,
    status: 'active'
  }).sort({ createdAt: -1 });
};

// Instance methods
roomSchema.methods.isFull = function (): boolean {
  return this.participants.length >= this.maxParticipants;
};

roomSchema.methods.hasParticipant = function (userId: mongoose.Types.ObjectId): boolean {
  return this.participants.some((id: mongoose.Types.ObjectId) => id.equals(userId));
};

roomSchema.methods.addParticipant = function (userId: mongoose.Types.ObjectId): boolean {
  if (this.isFull() || this.hasParticipant(userId)) {
    return false;
  }
  this.participants.push(userId);
  return true;
};

roomSchema.methods.removeParticipant = function (userId: mongoose.Types.ObjectId): boolean {
  const index = this.participants.findIndex((id: mongoose.Types.ObjectId) => id.equals(userId));
  if (index === -1) {
    return false;
  }
  this.participants.splice(index, 1);
  return true;
};

const Room: IRoomModel = mongoose.model<IRoom, IRoomModel>('Room', roomSchema);

export default Room;
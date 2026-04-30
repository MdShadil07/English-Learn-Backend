import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IRoom extends Document {
  _id: mongoose.Types.ObjectId;
  roomId: string; // Unique room identifier
  roomCode?: string; // 6-char uppercase code for private rooms
  topic: string; // Room topic/title
  description?: string; // Room description
  banner?: string; // Room visual banner/gradient
  bannerText?: string;
  bannerFontFamily?: string;
  bannerIsBold?: boolean;
  bannerIsItalic?: boolean;
  bannerFontSize?: number;
  hostId: mongoose.Types.ObjectId; // User who created the room
  maxParticipants: number; // Maximum number of participants (default: 500)
  isPrivate: boolean; // Whether the room is private
  isLocked: boolean; // Whether the room is locked by the host
  blockedUsers: mongoose.Types.ObjectId[]; // Array of blocked user IDs
  moderators: mongoose.Types.ObjectId[]; // Array of moderator user IDs
  status: 'active' | 'closed'; // Room status
  createdAt: Date;
  updatedAt: Date;
  isBlocked(userId: mongoose.Types.ObjectId): boolean;
  isModerator(userId: mongoose.Types.ObjectId): boolean;
}

export interface IRoomModel extends Model<IRoom> {
  findByRoomId(roomId: string): Promise<IRoom | null>;
  findActiveRooms(): Promise<IRoom[]>;
  findRoomsByHost(hostId: mongoose.Types.ObjectId): Promise<IRoom[]>;
}

const roomSchema = new Schema<IRoom, IRoomModel>(
  {
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
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
roomSchema.index({ roomId: 1 });
roomSchema.index({ roomCode: 1 });
roomSchema.index({ createdAt: -1 });
roomSchema.index({ hostId: 1 });
roomSchema.index({ status: 1 });
roomSchema.index({ hostId: 1, status: 1 });
roomSchema.index({ blockedUsers: 1 });
roomSchema.index({ moderators: 1 });

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

// Instance methods
roomSchema.methods.isBlocked = function (userId: mongoose.Types.ObjectId): boolean {
  return this.blockedUsers.some((id: mongoose.Types.ObjectId) => id.equals(userId));
};

roomSchema.methods.isModerator = function (userId: mongoose.Types.ObjectId): boolean {
  return this.moderators.some((id: mongoose.Types.ObjectId) => id.equals(userId));
};

const Room: IRoomModel = mongoose.model<IRoom, IRoomModel>('Room', roomSchema);

export default Room;
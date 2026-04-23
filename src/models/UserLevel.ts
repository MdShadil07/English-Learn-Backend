import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUserLevel extends Document {
  _id: mongoose.Types.ObjectId;
  userId: string;
  userName: string;
  userEmail: string;
  level: number;
  currentXP: number;
  totalXP: number;
  xpToNextLevel: number;
  streak: number;
  longestStreak: number;
  totalSessions: number;
  lastActive: Date;
  accuracy: number;
  vocabulary: number;
  grammar: number;
  pronunciation: number;
  fluency: number;
  createdAt: Date;
  updatedAt: Date;
  addXP(xpAmount: number): { leveledUp: boolean; newLevel: number };
}

const userLevelSchema = new Schema<IUserLevel>(
  {
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      unique: true,
      index: true,
    },
    userName: {
      type: String,
      required: [true, 'User name is required'],
    },
    userEmail: {
      type: String,
      required: [true, 'User email is required'],
    },
    level: {
      type: Number,
      default: 1,
      min: [1, 'Level must be at least 1'],
    },
    currentXP: {
      type: Number,
      default: 0,
      min: [0, 'Current XP cannot be negative'],
    },
    totalXP: {
      type: Number,
      default: 0,
      min: [0, 'Total XP cannot be negative'],
    },
    xpToNextLevel: {
      type: Number,
      default: 500,
      min: [0, 'XP to next level cannot be negative'],
    },
    streak: {
      type: Number,
      default: 0,
      min: [0, 'Streak cannot be negative'],
    },
    longestStreak: {
      type: Number,
      default: 0,
      min: [0, 'Longest streak cannot be negative'],
    },
    totalSessions: {
      type: Number,
      default: 0,
      min: [0, 'Total sessions cannot be negative'],
    },
    lastActive: {
      type: Date,
      default: Date.now,
    },
    accuracy: {
      type: Number,
      default: 0,
      min: [0, 'Accuracy cannot be negative'],
      max: [100, 'Accuracy cannot exceed 100'],
    },
    vocabulary: {
      type: Number,
      default: 0,
      min: [0, 'Vocabulary cannot be negative'],
      max: [100, 'Vocabulary cannot exceed 100'],
    },
    grammar: {
      type: Number,
      default: 0,
      min: [0, 'Grammar cannot be negative'],
      max: [100, 'Grammar cannot exceed 100'],
    },
    pronunciation: {
      type: Number,
      default: 0,
      min: [0, 'Pronunciation cannot be negative'],
      max: [100, 'Pronunciation cannot exceed 100'],
    },
    fluency: {
      type: Number,
      default: 0,
      min: [0, 'Fluency cannot be negative'],
      max: [100, 'Fluency cannot exceed 100'],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better performance
userLevelSchema.index({ userId: 1 }, { unique: true });
userLevelSchema.index({ totalXP: -1 });
userLevelSchema.index({ level: -1 });

// Instance method to add XP and handle level ups
userLevelSchema.methods.addXP = function (xpAmount: number): { leveledUp: boolean; newLevel: number } {
  this.currentXP += xpAmount;
  this.totalXP += xpAmount;
  this.lastActive = new Date();

  // Simple level calculation (can be made more sophisticated)
  const newLevel = Math.floor(this.totalXP / 500) + 1;
  const leveledUp = newLevel > this.level;

  if (leveledUp) {
    this.level = newLevel;
    this.currentXP = this.totalXP - ((newLevel - 1) * 500);
    this.xpToNextLevel = 500;
  } else {
    this.xpToNextLevel = (this.level * 500) - this.currentXP;
  }

  return { leveledUp, newLevel: this.level };
};

const UserLevel: Model<IUserLevel> = mongoose.model<IUserLevel>('UserLevel', userLevelSchema);

export default UserLevel;

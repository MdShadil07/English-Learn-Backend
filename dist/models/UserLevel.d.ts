import mongoose, { Document, Model } from 'mongoose';
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
    addXP(xpAmount: number): {
        leveledUp: boolean;
        newLevel: number;
    };
}
declare const UserLevel: Model<IUserLevel>;
export default UserLevel;
//# sourceMappingURL=UserLevel.d.ts.map
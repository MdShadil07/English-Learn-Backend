import mongoose, { Document, Model } from 'mongoose';
export interface IRoom extends Document {
    _id: mongoose.Types.ObjectId;
    roomId: string;
    roomCode?: string;
    topic: string;
    description?: string;
    banner?: string;
    bannerText?: string;
    bannerFontFamily?: string;
    bannerIsBold?: boolean;
    bannerIsItalic?: boolean;
    bannerFontSize?: number;
    hostId: mongoose.Types.ObjectId;
    maxParticipants: number;
    isPrivate: boolean;
    isLocked: boolean;
    blockedUsers: mongoose.Types.ObjectId[];
    moderators: mongoose.Types.ObjectId[];
    status: 'active' | 'closed';
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
declare const Room: IRoomModel;
export default Room;
//# sourceMappingURL=Room.d.ts.map
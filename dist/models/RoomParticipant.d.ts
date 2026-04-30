import mongoose, { Document, Model } from 'mongoose';
export interface IRoomParticipant extends Document {
    roomId: string;
    userId: mongoose.Types.ObjectId;
    joinedAt: Date;
}
export declare const RoomParticipant: Model<IRoomParticipant>;
export default RoomParticipant;
//# sourceMappingURL=RoomParticipant.d.ts.map
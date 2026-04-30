import mongoose, { Document, Model } from 'mongoose';
export interface IEvent extends Document {
    _id: mongoose.Types.ObjectId;
    type: string;
    userId: mongoose.Types.ObjectId;
    subscriptionId?: mongoose.Types.ObjectId;
    metadata: any;
    createdAt: Date;
}
export interface IEventModel extends Model<IEvent> {
}
declare const Event: IEventModel;
export default Event;
//# sourceMappingURL=Event.d.ts.map
import mongoose, { Document, Model } from 'mongoose';
export interface IProfile extends Document {
    _id: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    full_name: string;
    field: 'student' | 'teacher' | 'professional';
    role: 'student' | 'teacher' | 'admin';
    createdAt: Date;
    updatedAt: Date;
}
declare const Profile: Model<IProfile>;
export default Profile;
//# sourceMappingURL=Profile.d.ts.map
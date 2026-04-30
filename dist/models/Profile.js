import mongoose, { Schema } from 'mongoose';
const profileSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required'],
        unique: true,
    },
    full_name: {
        type: String,
        required: [true, 'Full name is required'],
        trim: true,
        maxlength: [100, 'Full name cannot exceed 100 characters'],
    },
    field: {
        type: String,
        enum: ['student', 'teacher', 'professional'],
        default: 'student',
    },
    role: {
        type: String,
        enum: ['student', 'teacher', 'admin'],
        default: 'student',
    },
}, {
    timestamps: true,
});
// Legacy indexes - keeping minimal for backward compatibility
profileSchema.index({ userId: 1 }, { unique: true });
const Profile = mongoose.model('Profile', profileSchema);
export default Profile;
//# sourceMappingURL=Profile.js.map
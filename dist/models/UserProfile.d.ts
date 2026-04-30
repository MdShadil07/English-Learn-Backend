import mongoose, { Document, Model } from 'mongoose';
export type UserRole = 'student' | 'teacher' | 'professional' | 'admin' | 'content-creator';
export type UserField = 'student' | 'high-school-student' | 'college-student' | 'graduate-student' | 'professional' | 'teacher' | 'professor' | 'researcher' | 'software-engineer' | 'data-scientist' | 'writer' | 'entrepreneur' | 'freelancer' | 'admin' | 'computer-science' | 'business' | 'medicine' | 'engineering' | 'law' | 'education' | 'arts' | 'science' | 'mathematics' | 'literature' | 'psychology' | 'economics' | 'finance' | 'marketing' | 'design' | 'technology' | 'healthcare' | 'research' | 'consulting' | 'other';
export type Gender = 'male' | 'female' | 'non-binary' | 'prefer-not-to-say' | 'other';
export type LanguageProficiency = 'beginner' | 'intermediate' | 'advanced' | 'native';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type LearningStyle = 'visual' | 'auditory' | 'kinesthetic' | 'reading-writing' | 'mixed';
export type EnglishLevel = 'beginner' | 'elementary' | 'intermediate' | 'advanced' | 'proficient' | 'native';
export type ProficiencyLevel = 'beginner' | 'elementary' | 'intermediate' | 'advanced' | 'proficient';
export type EducationLevel = 'high-school' | 'associate-degree' | 'bachelors-degree' | 'masters-degree' | 'phd' | 'certificate' | 'diploma' | 'other';
interface IUserProfileModel extends Model<IUserProfile> {
    findByRole(role: UserRole, options?: {
        limit?: number;
        skip?: number;
        sort?: any;
    }): Promise<any[]>;
    findByField(field: UserField, options?: {
        limit?: number;
        skip?: number;
        sort?: any;
    }): Promise<any[]>;
    searchProfiles(searchTerm: string, options?: {
        limit?: number;
        skip?: number;
        role?: UserRole;
    }): Promise<any[]>;
    getProfileStats(): Promise<any[]>;
    createOrUpdateProfile(userId: mongoose.Types.ObjectId, profileData: Partial<IUserProfile>): Promise<IUserProfile | null>;
}
export interface IUserProfile extends Document {
    _id: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    avatar_url?: string;
    bio: string;
    isPremium: boolean;
    displayName: string;
    username: string;
    location: string;
    targetLanguage: string;
    nativeLanguage?: string;
    country?: string;
    proficiencyLevel: ProficiencyLevel;
    personalInfo: {
        dateOfBirth?: Date;
        gender: Gender;
        phone: string;
        address: {
            street: string;
            city: string;
            state: string;
            country: string;
            zipCode: string;
        };
        nationality: string;
        languages: Array<{
            language: string;
            proficiency: LanguageProficiency;
        }>;
    };
    experienceLevel: ExperienceLevel;
    field?: string;
    goals: string[];
    interests: string[];
    professionalInfo: {
        company: string;
        position: string;
        experienceYears?: number;
        industry: string;
        skills: string[];
        interests: string[];
        careerGoals: string;
        resumeUrl?: string;
    };
    education: Array<{
        institution: string;
        degree: string;
        fieldOfStudy: string;
        startYear?: number;
        endYear?: number | null;
        grade?: string;
        description?: string;
        isCurrentlyEnrolled: boolean;
        educationLevel: EducationLevel;
        _id?: mongoose.Types.ObjectId;
        createdAt?: Date;
        updatedAt?: Date;
    }>;
    certifications: Array<{
        name: string;
        issuer: string;
        issueDate: Date;
        expiryDate?: Date;
        credentialId?: string;
        credentialUrl?: string;
        description?: string;
        skills: string[];
        isVerified: boolean;
        _id?: mongoose.Types.ObjectId;
        createdAt?: Date;
        updatedAt?: Date;
    }>;
    documents?: Array<{
        name: string;
        url: string;
        type: string;
        size?: number;
        uploadedAt: Date;
        _id?: mongoose.Types.ObjectId;
    }>;
    socialLinks: {
        linkedin?: string;
        github?: string;
        twitter?: string;
        website?: string;
        instagram?: string;
        youtube?: string;
        portfolio?: string;
        other?: string;
    };
    learningPreferences: {
        preferredLearningStyle: LearningStyle;
        dailyLearningGoal: number;
        weeklyLearningGoal: number;
        targetEnglishLevel: EnglishLevel;
        focusAreas: string[];
    };
    privacySettings: {
        profileVisibility: 'public' | 'friends-only' | 'private';
        showContactInfo: boolean;
        showEducation: boolean;
        showCertifications: boolean;
        showAchievements: boolean;
        activityTracking: {
            trackLearningProgress: boolean;
            trackTimeSpent: boolean;
            trackCourseCompletions: boolean;
            trackQuizResults: boolean;
            trackLoginHistory: boolean;
            trackDeviceInfo: boolean;
            trackLocationData: boolean;
        };
        communicationPreferences: {
            emailNotifications: boolean;
            pushNotifications: boolean;
            smsNotifications: boolean;
            marketingEmails: boolean;
            weeklyReports: boolean;
            achievementAlerts: boolean;
            reminderNotifications: boolean;
        };
        security: {
            twoFactorEnabled: boolean;
            loginAlerts: boolean;
            suspiciousActivityAlerts: boolean;
            sessionTimeout: number;
        };
        dataManagement: {
            autoDeleteInactive: boolean;
            dataRetentionPeriod: number;
            downloadData: boolean;
            deleteAccount: boolean;
        };
        dataSharing: {
            shareWithPartners: boolean;
            shareAnonymousUsage: boolean;
            shareForResearch: boolean;
            allowPersonalization: boolean;
            thirdPartyIntegrations: boolean;
        };
        emergency: {
            emergencyContact: string;
            emergencyPhone: string;
            emergencyEmail: string;
            allowEmergencyAccess: boolean;
        };
    };
    createdAt: Date;
    updatedAt: Date;
    lastUpdatedBy: mongoose.Types.ObjectId;
    lastActivityAt: Date;
    searchVector: string;
    profileCompleteness: number;
}
declare const UserProfile: IUserProfileModel;
export default UserProfile;
//# sourceMappingURL=UserProfile.d.ts.map
import { IUserProfile, UserField } from '../../models/index.js';
import { UserRole } from '../../models/UserProfile.js';
interface ProfileUpdateData {
    displayName?: string;
    username?: string;
    avatar_url?: string;
    bio?: string;
    isPremium?: boolean;
    location?: string;
    phone?: string;
    address?: string;
    targetLanguage?: string;
    nativeLanguage?: string;
    country?: string;
    proficiencyLevel?: string;
    personalInfo?: any;
    experienceLevel?: string;
    field?: UserField;
    goals?: string[];
    interests?: string[];
    professionalInfo?: any;
    education?: any[];
    certifications?: any[];
    socialLinks?: any;
    learningPreferences?: any;
    privacySettings?: any;
}
export declare class ProfileService {
    /**
     * Get user profile with caching
     */
    getProfile(userId: string): Promise<IUserProfile | null>;
    /**
     * Update user profile with optimistic locking and batch operations
     */
    updateProfile(userId: string, updateData: ProfileUpdateData, updatedBy: string): Promise<IUserProfile | null>;
    /**
     * Batch update multiple profiles (for admin operations)
     */
    batchUpdateProfiles(updates: Array<{
        userId: string;
        data: ProfileUpdateData;
    }>, updatedBy: string): Promise<void>;
    /**
     * Update education records separately for better performance
     */
    private updateEducation;
    /**
     * Update certifications separately
     */
    private updateCertifications;
    /**
     * Search profiles with advanced filtering and caching
     */
    searchProfiles(searchParams: {
        query?: string;
        field?: UserField;
        experienceLevel?: string;
        location?: string;
        skills?: string[];
        targetLanguage?: string;
        limit?: number;
        skip?: number;
    }): Promise<{
        profiles: IUserProfile[];
        total: number;
        hasMore: boolean;
    }>;
    /**
     * Get profile statistics for analytics
     */
    getProfileStats(): Promise<any>;
    /**
     * Invalidate profile cache
     */
    private invalidateProfileCache;
    /**
     * Get profiles by role with pagination (cached)
     */
    getProfilesByRole(role: UserRole, options?: {
        limit?: number;
        skip?: number;
    }): Promise<IUserProfile[]>;
    /**
     * Get profiles by field/expertise (cached)
     */
    getProfilesByField(field: UserField, options?: {
        limit?: number;
        skip?: number;
    }): Promise<IUserProfile[]>;
}
export declare const profileService: ProfileService;
export {};
//# sourceMappingURL=profileService.d.ts.map
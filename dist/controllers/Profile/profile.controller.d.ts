import { Request, Response } from 'express';
interface AuthRequest extends Request {
    user?: any;
    token?: string;
}
export declare class ProfileController {
    /**
     * Get user profile
     */
    getProfile(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Update user profile with enhanced duplicate prevention and data synchronization
     */
    updateProfile(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Change user password
     */
    changePassword(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
}
export declare const profileController: ProfileController;
export {};
//# sourceMappingURL=profile.controller.d.ts.map
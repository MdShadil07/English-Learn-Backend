import { Request, Response } from 'express';
interface AuthRequest extends Request {
    user?: any;
    token?: string;
}
export declare class UserController {
    /**
     * Update user profile information (firstName, lastName, username)
     */
    updateProfile(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Get current user profile data
     */
    getProfile(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
}
export declare const userController: UserController;
export {};
//# sourceMappingURL=user.controller.d.ts.map
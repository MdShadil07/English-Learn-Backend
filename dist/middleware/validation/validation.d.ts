import { Request, Response, NextFunction } from 'express';
interface ValidationRequest extends Request {
    validationErrors?: any[];
}
export declare const handleValidationErrors: (req: ValidationRequest, res: Response, next: NextFunction) => void | Response;
export declare const validateRegistration: (((req: ValidationRequest, res: Response, next: NextFunction) => void | Response) | import("express-validator").ValidationChain)[];
export declare const validatePagination: (((req: ValidationRequest, res: Response, next: NextFunction) => void | Response) | import("express-validator").ValidationChain)[];
export declare const validateLogin: (((req: ValidationRequest, res: Response, next: NextFunction) => void | Response) | import("express-validator").ValidationChain)[];
export declare const validateRefreshToken: (((req: ValidationRequest, res: Response, next: NextFunction) => void | Response) | import("express-validator").ValidationChain)[];
export declare const validatePasswordResetRequest: (((req: ValidationRequest, res: Response, next: NextFunction) => void | Response) | import("express-validator").ValidationChain)[];
export declare const validatePasswordReset: (((req: ValidationRequest, res: Response, next: NextFunction) => void | Response) | import("express-validator").ValidationChain)[];
export declare const validateChangePassword: (((req: ValidationRequest, res: Response, next: NextFunction) => void | Response) | import("express-validator").ValidationChain)[];
export declare const validateProfileUpdate: (((req: ValidationRequest, res: Response, next: NextFunction) => void | Response) | import("express-validator").ValidationChain)[];
export declare const validateUserProfileUpdate: (((req: ValidationRequest, res: Response, next: NextFunction) => void | Response) | import("express-validator").ValidationChain)[];
export {};
//# sourceMappingURL=validation.d.ts.map
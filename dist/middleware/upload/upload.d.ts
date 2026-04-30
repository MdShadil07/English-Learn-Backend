import multer from 'multer';
import { Request } from 'express';
export declare const FILE_SIZE_LIMITS: {
    IMAGE: number;
    DOCUMENT: number;
    AVATAR: number;
    BANNER: number;
};
export declare const imageFileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => void;
export declare const documentFileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => void;
export declare const avatarFileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => void;
export declare const bannerFileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => void;
export declare const memoryStorage: multer.StorageEngine;
export declare const diskStorage: multer.StorageEngine;
export declare const createUploadMiddleware: (type?: "image" | "document" | "avatar") => multer.Multer;
export declare const avatarUpload: multer.Multer;
export declare const bannerUpload: multer.Multer;
export declare const imageUpload: multer.Multer;
export declare const documentUpload: multer.Multer;
export declare const multipleUpload: (maxCount?: number) => import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
export declare const validateFileType: (file: Express.Multer.File, allowedTypes: string[]) => boolean;
export declare const getFileExtension: (mimetype: string) => string;
export declare const sanitizeFileName: (filename: string) => string;
//# sourceMappingURL=upload.d.ts.map
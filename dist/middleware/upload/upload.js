import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
// File type validation
const ALLOWED_IMAGE_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif'
];
const ALLOWED_DOCUMENT_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
];
// File size limits (in bytes)
export const FILE_SIZE_LIMITS = {
    IMAGE: 5 * 1024 * 1024, // 5MB
    DOCUMENT: 10 * 1024 * 1024, // 10MB
    AVATAR: 2 * 1024 * 1024, // 2MB
    BANNER: 5 * 1024 * 1024, // 5MB
};
// Generate unique filename
const generateFileName = (originalName) => {
    const ext = path.extname(originalName);
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    return `${timestamp}_${randomString}${ext}`;
};
// File filter for images
export const imageFileFilter = (req, file, cb) => {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
        cb(null, true);
    }
    else {
        cb(new Error('Only image files (JPEG, PNG, WebP, GIF) are allowed'));
    }
};
// File filter for documents
export const documentFileFilter = (req, file, cb) => {
    if (ALLOWED_DOCUMENT_TYPES.includes(file.mimetype)) {
        cb(null, true);
    }
    else {
        cb(new Error('Only document files (PDF, DOC, DOCX, TXT) are allowed'));
    }
};
// File filter for avatars
export const avatarFileFilter = (req, file, cb) => {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
        // Additional check for avatar size
        if (file.size > FILE_SIZE_LIMITS.AVATAR) {
            cb(new Error('Avatar file size must be less than 2MB'));
            return;
        }
        cb(null, true);
    }
    else {
        cb(new Error('Only image files (JPEG, PNG, WebP, GIF) are allowed for avatars'));
    }
};
// File filter for banners
export const bannerFileFilter = (req, file, cb) => {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
        if (file.size > FILE_SIZE_LIMITS.BANNER) {
            cb(new Error('Banner file size must be less than 5MB'));
            return;
        }
        cb(null, true);
    }
    else {
        cb(new Error('Only image files (JPEG, PNG, WebP) are allowed for banners'));
    }
};
// Memory storage for cloud upload
export const memoryStorage = multer.memoryStorage();
// Disk storage for local development
export const diskStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, process.env.UPLOAD_PATH || './uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueName = generateFileName(file.originalname);
        cb(null, uniqueName);
    }
});
// Create multer upload configurations
export const createUploadMiddleware = (type = 'image') => {
    const filters = {
        image: imageFileFilter,
        document: documentFileFilter,
        avatar: avatarFileFilter
    };
    const limits = {
        image: { fileSize: FILE_SIZE_LIMITS.IMAGE },
        document: { fileSize: FILE_SIZE_LIMITS.DOCUMENT },
        avatar: { fileSize: FILE_SIZE_LIMITS.AVATAR }
    };
    return multer({
        storage: process.env.NODE_ENV === 'production' ? memoryStorage : diskStorage,
        fileFilter: filters[type],
        limits: limits[type]
    });
};
// Avatar upload middleware (always use memory storage for direct buffer uploads)
export const avatarUpload = multer({
    storage: memoryStorage, // Always use memory storage for avatars
    fileFilter: (req, file, cb) => {
        console.log('🔍 Multer file filter called:');
        console.log('📄 File name:', file.originalname);
        console.log('📄 File mimetype:', file.mimetype);
        console.log('📄 File size:', file.size);
        if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
            // Additional check for avatar size
            if (file.size > FILE_SIZE_LIMITS.AVATAR) {
                console.log('❌ File rejected: Size too large');
                cb(new Error('Avatar file size must be less than 2MB'));
                return;
            }
            console.log('✅ File accepted');
            cb(null, true);
        }
        else {
            console.log('❌ File rejected: Invalid mimetype');
            cb(new Error('Only image files (JPEG, PNG, WebP, GIF) are allowed for avatars'));
        }
    },
    limits: {
        fileSize: FILE_SIZE_LIMITS.AVATAR,
        files: 1
    }
});
// Banner upload middleware
export const bannerUpload = multer({
    storage: memoryStorage,
    fileFilter: bannerFileFilter,
    limits: {
        fileSize: FILE_SIZE_LIMITS.BANNER,
        files: 1
    }
});
// General image upload middleware
export const imageUpload = createUploadMiddleware('image');
// Document upload middleware
export const documentUpload = createUploadMiddleware('document');
// Multiple files upload middleware
export const multipleUpload = (maxCount = 5) => {
    return createUploadMiddleware('image').array('files', maxCount);
};
// Validate file type helper
export const validateFileType = (file, allowedTypes) => {
    return allowedTypes.includes(file.mimetype);
};
// Get file extension from mimetype
export const getFileExtension = (mimetype) => {
    const extensions = {
        'image/jpeg': '.jpg',
        'image/jpg': '.jpg',
        'image/png': '.png',
        'image/webp': '.webp',
        'image/gif': '.gif',
        'application/pdf': '.pdf',
        'application/msword': '.doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
        'text/plain': '.txt'
    };
    return extensions[mimetype] || '.bin';
};
// Sanitize filename
export const sanitizeFileName = (filename) => {
    return filename
        .replace(/[^a-zA-Z0-9.-_]/g, '_')
        .replace(/_{2,}/g, '_')
        .substring(0, 100);
};
//# sourceMappingURL=upload.js.map
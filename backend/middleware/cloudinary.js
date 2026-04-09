// ==========================================
// CLOUDINARY MEDIA STORAGE MIDDLEWARE
// CICJ-SHCOMS - Cloud Media Integration
// ==========================================

const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { Readable } = require('stream');

// Upload flow: multer keeps file in memory, then stream pushes it to Cloudinary.

// Configure Cloudinary with env credentials
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure:     true
});

// ==========================================
// ALLOWED FILE TYPES
// ==========================================

const IMAGE_MIME_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif'
];

const DOCUMENT_MIME_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
];

// ==========================================
// MULTER INSTANCES (memory storage → stream to Cloudinary)
// ==========================================

// For image-only uploads (equipment photos, progress photos, portfolio)
const imageUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    fileFilter: (req, file, cb) => {
        if (IMAGE_MIME_TYPES.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed (JPEG, PNG, WebP, GIF)'), false);
        }
    }
});

// For general file uploads (images + documents)
const fileUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
    fileFilter: (req, file, cb) => {
        const allowed = [...IMAGE_MIME_TYPES, ...DOCUMENT_MIME_TYPES];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('File type not allowed. Accepted: images, PDF, Word, Excel, PowerPoint'), false);
        }
    }
});

// ==========================================
// CLOUDINARY UPLOAD HELPER
// ==========================================

/**
 * Upload a file buffer to Cloudinary.
 * @param {Buffer} buffer - File buffer from multer memoryStorage
 * @param {Object} options - Cloudinary upload options
 * @returns {Promise<Object>} Cloudinary upload result (url, public_id, etc.)
 */
function uploadToCloudinary(buffer, options = {}) {
    // Promise wrapper keeps calling code clean with async/await.
    return new Promise((resolve, reject) => {
        const uploadOptions = {
            folder: options.folder || 'cicj-shcoms/misc',
            resource_type: options.resource_type || 'image',
            // Auto quality + format optimization
            transformation: options.transformation || [
                { quality: 'auto', fetch_format: 'auto' }
            ],
            ...options
        };

        const uploadStream = cloudinary.uploader.upload_stream(
            uploadOptions,
            (error, result) => {
                if (error) reject(error);
                else resolve(result);
            }
        );

        const readable = new Readable();
        readable.push(buffer);
        readable.push(null);
        readable.pipe(uploadStream);
    });
}

/**
 * Delete a file from Cloudinary by its public_id.
 * @param {string} publicId - Cloudinary public_id
 * @param {string} resourceType - 'image' | 'raw' | 'video'
 * @returns {Promise<Object>} Cloudinary destroy result
 */
async function deleteFromCloudinary(publicId, resourceType = 'image') {
    return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}

/**
 * Determine if a MIME type is an image (→ Cloudinary)
 * or a large document (→ LOCAL_FTP).
 */
function isImageType(mimetype) {
    return IMAGE_MIME_TYPES.includes(mimetype);
}

/**
 * Determine storage location based on file type and size.
 * Images → Cloudinary (CLOUD)
 * Documents/Blueprints → LOCAL_FTP
 */
function resolveStorageLocation(mimetype, fileSizeBytes) {
    // Rule of thumb: images can go to cloud; big docs stay on local FTP storage.
    const isImage = isImageType(mimetype);
    // Blueprints and large docs go to LOCAL_FTP
    if (!isImage) return 'LOCAL_FTP';
    // Large files (> 25 MB) also go to LOCAL FTP
    if (fileSizeBytes > 25 * 1024 * 1024) return 'LOCAL_FTP';
    return 'CLOUD';
}

module.exports = {
    cloudinary,
    imageUpload,
    fileUpload,
    uploadToCloudinary,
    deleteFromCloudinary,
    isImageType,
    resolveStorageLocation
};

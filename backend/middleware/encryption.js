/**
 * ==========================================
 * AES-256-GCM ENCRYPTION UTILITY
 * ==========================================
 * Encrypts sensitive database fields using AES-256-GCM
 * - Contact numbers
 * - MFA secrets
 * - Other PII (Personally Identifiable Information)
 * 
 * Security: Uses environment-based encryption key
 * Algorithm: AES-256-GCM (Galois/Counter Mode)
 * Authentication: Includes authentication tag to prevent tampering
 */

const crypto = require('crypto');

// Constants
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 64;

/**
 * Get encryption key from environment or generate from secret
 */
const getEncryptionKey = () => {
    // Use dedicated encryption key from environment
    const encryptionSecret = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'fallback_key_for_dev_only';
    
    // Derive a 256-bit key using PBKDF2
    const salt = process.env.ENCRYPTION_SALT || 'cicj_shcoms_salt_2026';
    return crypto.pbkdf2Sync(encryptionSecret, salt, 100000, 32, 'sha256');
};

/**
 * Encrypt sensitive data
 * @param {string} plaintext - Data to encrypt
 * @returns {string} - Encrypted data in format: iv:authTag:ciphertext (base64)
 */
const encrypt = (plaintext) => {
    try {
        if (!plaintext || plaintext === '') {
            return null;
        }

        const key = getEncryptionKey();
        const iv = crypto.randomBytes(IV_LENGTH);
        
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
        
        let encrypted = cipher.update(plaintext, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        
        const authTag = cipher.getAuthTag();
        
        // Format: iv:authTag:ciphertext (all base64)
        return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
    } catch (error) {
        console.error('❌ Encryption error:', error.message);
        throw new Error('Failed to encrypt data');
    }
};

/**
 * Decrypt sensitive data
 * @param {string} encryptedData - Encrypted data in format: iv:authTag:ciphertext
 * @returns {string} - Decrypted plaintext
 */
const decrypt = (encryptedData) => {
    try {
        if (!encryptedData || encryptedData === '') {
            return null;
        }

        // Split the encrypted data
        const parts = encryptedData.split(':');
        if (parts.length !== 3) {
            throw new Error('Invalid encrypted data format');
        }

        const [ivBase64, authTagBase64, ciphertext] = parts;
        
        const key = getEncryptionKey();
        const iv = Buffer.from(ivBase64, 'base64');
        const authTag = Buffer.from(authTagBase64, 'base64');
        
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (error) {
        console.error('❌ Decryption error:', error.message);
        throw new Error('Failed to decrypt data');
    }
};

/**
 * Hash sensitive data for searching (one-way)
 * Used for fields that need to be searched but not decrypted
 * @param {string} data - Data to hash
 * @returns {string} - SHA-256 hash (hex)
 */
const hash = (data) => {
    if (!data || data === '') {
        return null;
    }
    return crypto.createHash('sha256').update(data).digest('hex');
};

/**
 * Middleware to encrypt specific fields before saving to database
 * Use this in Prisma middleware or before prisma.create/update calls
 */
const encryptFields = (data, fieldsToEncrypt = []) => {
    const encrypted = { ...data };
    
    fieldsToEncrypt.forEach(field => {
        if (encrypted[field] && encrypted[field] !== '' && encrypted[field] !== null) {
            encrypted[field] = encrypt(encrypted[field]);
        }
    });
    
    return encrypted;
};

/**
 * Middleware to decrypt specific fields after retrieving from database
 */
const decryptFields = (data, fieldsToDecrypt = []) => {
    if (!data) return data;
    
    const decrypted = { ...data };
    
    fieldsToDecrypt.forEach(field => {
        if (decrypted[field] && decrypted[field] !== '' && decrypted[field] !== null) {
            try {
                decrypted[field] = decrypt(decrypted[field]);
            } catch (error) {
                console.warn(`⚠️  Failed to decrypt field '${field}', may be unencrypted legacy data`);
                // Keep original value if decryption fails (backward compatibility)
            }
        }
    });
    
    return decrypted;
};

/**
 * Generate a secure random encryption key for ENCRYPTION_KEY env variable
 * Run this once and save to .env
 */
const generateEncryptionKey = () => {
    return crypto.randomBytes(32).toString('hex');
};

module.exports = {
    encrypt,
    decrypt,
    hash,
    encryptFields,
    decryptFields,
    generateEncryptionKey
};

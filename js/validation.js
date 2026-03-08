/**
 * ==========================================
 * FRONTEND INPUT VALIDATION
 * ==========================================
 * Client-side validation for security and UX
 * Prevents XSS, validates formats, provides feedback
 */

/**
 * XSS Prevention - Sanitize HTML input
 */
const sanitizeHTML = (str) => {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
};

/**
 * SQL Injection Pattern Detection
 * (Backend uses Prisma which prevents SQL injection, but good to validate on frontend too)
 */
const containsSQLInjection = (str) => {
    const sqlPatterns = [
        /(\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b|\bCREATE\b|\bALTER\b)/i,
        /(--|;|\/\*|\*\/|xp_|sp_)/,
        /(\bUNION\b.*\bSELECT\b)/i,
        /(\bOR\b\s+\d+\s*=\s*\d+)/i
    ];
    
    return sqlPatterns.some(pattern => pattern.test(str));
};

/**
 * XSS Pattern Detection
 */
const containsXSS = (str) => {
    const xssPatterns = [
        /<script[^>]*>.*?<\/script>/gi,
        /<iframe[^>]*>.*?<\/iframe>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi, // onclick, onerror, etc.
        /<img[^>]*onerror/gi,
        /<svg[^>]*onload/gi
    ];
    
    return xssPatterns.some(pattern => pattern.test(str));
};

/**
 * Email Validation
 */
const validateEmail = (email) => {
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    
    if (!email || email.trim() === '') {
        return { valid: false, message: 'Email is required' };
    }
    
    if (!emailRegex.test(email)) {
        return { valid: false, message: 'Invalid email format' };
    }
    
    if (email.length > 255) {
        return { valid: false, message: 'Email is too long (max 255 characters)' };
    }
    
    if (containsXSS(email)) {
        return { valid: false, message: 'Email contains invalid characters' };
    }
    
    return { valid: true, message: 'Email is valid' };
};

/**
 * Password Validation
 */
const validatePassword = (password) => {
    if (!password || password.trim() === '') {
        return { valid: false, message: 'Password is required' };
    }
    
    if (password.length < 8) {
        return { valid: false, message: 'Password must be at least 8 characters' };
    }
    
    if (password.length > 128) {
        return { valid: false, message: 'Password is too long (max 128 characters)' };
    }
    
    // Check for uppercase
    if (!/[A-Z]/.test(password)) {
        return { valid: false, message: 'Password must contain at least one uppercase letter' };
    }
    
    // Check for lowercase
    if (!/[a-z]/.test(password)) {
        return { valid: false, message: 'Password must contain at least one lowercase letter' };
    }
    
    // Check for number
    if (!/\d/.test(password)) {
        return { valid: false, message: 'Password must contain at least one number' };
    }
    
    return { valid: true, message: 'Password is strong' };
};

/**
 * Name Validation
 */
const validateName = (name, fieldName = 'Name') => {
    if (!name || name.trim() === '') {
        return { valid: false, message: `${fieldName} is required` };
    }
    
    if (name.length < 2) {
        return { valid: false, message: `${fieldName} must be at least 2 characters` };
    }
    
    if (name.length > 100) {
        return { valid: false, message: `${fieldName} is too long (max 100 characters)` };
    }
    
    // Only allow letters, spaces, hyphens, and periods
    if (!/^[a-zA-Z\s\-\.]+$/.test(name)) {
        return { valid: false, message: `${fieldName} can only contain letters, spaces, hyphens, and periods` };
    }
    
    if (containsXSS(name)) {
        return { valid: false, message: `${fieldName} contains invalid characters` };
    }
    
    if (containsSQLInjection(name)) {
        return { valid: false, message: `${fieldName} contains invalid patterns` };
    }
    
    return { valid: true, message: `${fieldName} is valid` };
};

/**
 * Phone Number Validation
 */
const validatePhone = (phone) => {
    if (phone && phone.trim() !== '') {
        if (phone.length > 20) {
            return { valid: false, message: 'Phone number is too long (max 20 characters)' };
        }
        
        // Allow numbers, spaces, hyphens, parentheses, and plus sign
        if (!/^\+?[\d\s\-\(\)]+$/.test(phone)) {
            return { valid: false, message: 'Invalid phone number format' };
        }
        
        if (containsXSS(phone)) {
            return { valid: false, message: 'Phone number contains invalid characters' };
        }
    }
    
    return { valid: true, message: 'Phone number is valid' };
};

/**
 * Generic Text Validation
 */
const validateText = (text, fieldName = 'Text', minLength = 1, maxLength = 500) => {
    if (!text || text.trim() === '') {
        return { valid: false, message: `${fieldName} is required` };
    }
    
    if (text.length < minLength) {
        return { valid: false, message: `${fieldName} must be at least ${minLength} characters` };
    }
    
    if (text.length > maxLength) {
        return { valid: false, message: `${fieldName} is too long (max ${maxLength} characters)` };
    }
    
    if (containsXSS(text)) {
        return { valid: false, message: `${fieldName} contains invalid HTML/script tags` };
    }
    
    if (containsSQLInjection(text)) {
        return { valid: false, message: `${fieldName} contains invalid SQL patterns` };
    }
    
    return { valid: true, message: `${fieldName} is valid` };
};

/**
 * Number Validation
 */
const validateNumber = (num, fieldName = 'Number', min = 0, max = 1000000) => {
    if (num === null || num === undefined || num === '') {
        return { valid: false, message: `${fieldName} is required` };
    }
    
    const numValue = parseInt(num);
    
    if (isNaN(numValue)) {
        return { valid: false, message: `${fieldName} must be a number` };
    }
    
    if (numValue < min) {
        return { valid: false, message: `${fieldName} must be at least ${min}` };
    }
    
    if (numValue > max) {
        return { valid: false, message: `${fieldName} must be at most ${max}` };
    }
    
    return { valid: true, message: `${fieldName} is valid` };
};

/**
 * Show Validation Error
 */
const showValidationError = (fieldId, message) => {
    const field = document.getElementById(fieldId);
    if (field) {
        field.classList.add('error');
        
        // Remove existing error message
        const existingError = field.parentElement.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }
        
        // Add new error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        errorDiv.style.color = 'red';
        errorDiv.style.fontSize = '0.85em';
        errorDiv.style.marginTop = '4px';
        field.parentElement.appendChild(errorDiv);
    }
};

/**
 * Clear Validation Error
 */
const clearValidationError = (fieldId) => {
    const field = document.getElementById(fieldId);
    if (field) {
        field.classList.remove('error');
        
        const errorMessage = field.parentElement.querySelector('.error-message');
        if (errorMessage) {
            errorMessage.remove();
        }
    }
};

/**
 * Real-time Validation Listener
 */
const addValidationListeners = () => {
    // Email validation
    const emailFields = document.querySelectorAll('input[type="email"]');
    emailFields.forEach(field => {
        field.addEventListener('blur', (e) => {
            const result = validateEmail(e.target.value);
            if (!result.valid) {
                showValidationError(e.target.id, result.message);
            } else {
                clearValidationError(e.target.id);
            }
        });
    });
    
    // Password validation
    const passwordFields = document.querySelectorAll('input[type="password"]');
    passwordFields.forEach(field => {
        if (field.name === 'password' || field.id === 'password') {
            field.addEventListener('blur', (e) => {
                const result = validatePassword(e.target.value);
                if (!result.valid) {
                    showValidationError(e.target.id, result.message);
                } else {
                    clearValidationError(e.target.id);
                }
            });
        }
    });
    
    // Name validation
    const nameFields = document.querySelectorAll('input[name="full_name"], input[id="full_name"]');
    nameFields.forEach(field => {
        field.addEventListener('blur', (e) => {
            const result = validateName(e.target.value, 'Full name');
            if (!result.valid) {
                showValidationError(e.target.id, result.message);
            } else {
                clearValidationError(e.target.id);
            }
        });
    });
    
    // Phone validation
    const phoneFields = document.querySelectorAll('input[type="tel"], input[name="contact_number"]');
    phoneFields.forEach(field => {
        field.addEventListener('blur', (e) => {
            const result = validatePhone(e.target.value);
            if (!result.valid) {
                showValidationError(e.target.id, result.message);
            } else {
                clearValidationError(e.target.id);
            }
        });
    });
};

// Initialize validation listeners on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addValidationListeners);
} else {
    addValidationListeners();
}

// Export validation functions for use in other scripts
window.ValidationUtils = {
    sanitizeHTML,
    containsSQLInjection,
    containsXSS,
    validateEmail,
    validatePassword,
    validateName,
    validatePhone,
    validateText,
    validateNumber,
    showValidationError,
    clearValidationError
};

const API_BASE = window.API_BASE || API_BASE + '';
/**
 * ==========================================
 * LOGIN WITH MFA (Multi-Factor Authentication)
 * ==========================================
 * Flow:
 * 1. User submits email + password
 * 2. If credentials valid, OTP sent to email
 * 3. User enters 6-digit OTP
 * 4. If OTP valid, JWT issued and user redirected
 */

document.addEventListener('DOMContentLoaded', () => {
    // Login page bootstrap for password + OTP flow.
    // DOM Elements
    const loginForm = document.getElementById('login-form');
    const errorBox = document.getElementById('error-message');
    const otpModal = document.getElementById('otp-modal');
    const otpForm = document.getElementById('otp-form');
    const otpErrorBox = document.getElementById('otp-error-message');
    const otpSuccessBox = document.getElementById('otp-success-message');
    const otpEmailDisplay = document.getElementById('otp-email-display');
    const otpTimer = document.getElementById('otp-timer');
    const otpAttemptsInfo = document.getElementById('otp-attempts-info');
    const resendBtn = document.getElementById('resend-otp-btn');
    const cancelBtn = document.getElementById('cancel-otp-btn');
    const passwordInput = document.getElementById('password');
    const passwordToggleBtn = document.getElementById('password-toggle');
    const signInBtn = loginForm?.querySelector('button[type="submit"]');
    const signInBtnDefaultHtml = signInBtn ? signInBtn.innerHTML : '';

    // State
    let currentEmail = '';
    let timerInterval = null;
    let expiryTime = null;

    function setSignInLoading(isLoading) {
        if (!signInBtn) return;
        signInBtn.disabled = isLoading;
        signInBtn.classList.toggle('is-loading', isLoading);
        if (isLoading) {
            signInBtn.innerHTML = '<span class="btn-spinner" aria-hidden="true"></span> Signing In...';
        } else {
            signInBtn.innerHTML = signInBtnDefaultHtml;
        }
    }

    // Show/hide password toggle for login field.
    if (passwordInput && passwordToggleBtn) {
        passwordToggleBtn.addEventListener('click', () => {
            const shouldShow = passwordInput.type === 'password';
            passwordInput.type = shouldShow ? 'text' : 'password';
            passwordToggleBtn.setAttribute('aria-pressed', shouldShow ? 'true' : 'false');
            passwordToggleBtn.setAttribute('aria-label', shouldShow ? 'Hide password' : 'Show password');
            passwordToggleBtn.innerHTML = `<i class="bi ${shouldShow ? 'bi-eye-slash' : 'bi-eye'}"></i>`;
        });
    }

    /**
     * Login Form Submission (Step 1)
     */
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        errorBox.classList.add('hidden');
        setSignInLoading(true);

        try {
            const response = await fetch(API_BASE + '/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();

            if (response.ok) {
                // Check if MFA is required
                if (data.mfaRequired) {
                    // Store email for OTP verification
                    currentEmail = data.email;
                    
                    // Show OTP modal
                    showOTPModal(data);
                } else {
                    // Fallback path if MFA is disabled for this account.
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    window.location.href = hasAdminAccess(data.user) ? 'admin.html' : 'employee.html';
                }
            } else {
                errorBox.textContent = data.error || data.message || 'Login failed';
                errorBox.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Login error:', error);
            errorBox.textContent = "Network error.";
            errorBox.classList.remove('hidden');
        } finally {
            setSignInLoading(false);
        }
    });

    /**
     * Show OTP Modal
     */
    function showOTPModal(data) {
        // Display email
        otpEmailDisplay.innerHTML = `<i class="bi bi-envelope-fill"></i> ${maskEmail(data.email)}`;
        
        // Show hint if in dev mode
        if (data.devMode) {
            otpSuccessBox.innerHTML = '<i class="bi bi-code-slash"></i> <strong>DEV MODE:</strong> Check your terminal console for the OTP code';
            otpSuccessBox.classList.remove('hidden');
        }
        
        // Start countdown timer
        expiryTime = Date.now() + (data.expiresIn * 1000);
        startCountdown();
        
        // Clear OTP inputs
        clearOTPInputs();
        
        // Show modal
        otpModal.classList.remove('hidden');
        
        // Focus first OTP input
        document.getElementById('otp-1').focus();
    }

    /**
     * OTP Form Submission (Step 2)
     */
    otpForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Get OTP from all 6 inputs
        const otp = getOTPValue();
        
        if (otp.length !== 6) {
            showOTPError('Please enter all 6 digits');
            return;
        }

        otpErrorBox.classList.add('hidden');
        otpSuccessBox.classList.add('hidden');

        try {
            const response = await fetch(API_BASE + '/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: currentEmail, otp })
            });
            
            const data = await response.json();

            if (response.ok) {
                // OTP verified successfully
                otpSuccessBox.textContent = data.message;
                otpSuccessBox.classList.remove('hidden');
                
                // Stop timer
                clearInterval(timerInterval);
                
                // Store JWT token and user data
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                
                // Redirect after brief delay
                setTimeout(() => {
                    window.location.href = hasAdminAccess(data.user) ? 'admin.html' : 'employee.html';
                }, 1000);
                
            } else {
                // OTP verification failed
                showOTPError(data.error || 'Invalid verification code');
                
                // Show attempts left if available
                if (data.attemptsLeft !== undefined) {
                    otpAttemptsInfo.textContent = `WARNING: ${data.attemptsLeft} attempt(s) remaining`;
                    otpAttemptsInfo.style.color = data.attemptsLeft <= 1 ? '#f44336' : '#ff9800';
                }
                
                // Clear inputs on error
                clearOTPInputs();
                document.getElementById('otp-1').focus();
            }
        } catch (error) {
            console.error('OTP verification error:', error);
            showOTPError('Network error. Please try again.');
        }
    });

    /**
     * Resend OTP Button
     */
    resendBtn.addEventListener('click', async () => {
        resendBtn.disabled = true;
        resendBtn.textContent = 'Sending...';

        try {
            const response = await fetch(API_BASE + '/resend-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: currentEmail })
            });
            
            const data = await response.json();

            if (response.ok) {
                otpSuccessBox.textContent = data.message;
                otpSuccessBox.classList.remove('hidden');
                otpErrorBox.classList.add('hidden');
                
                // Restart timer
                expiryTime = Date.now() + (data.expiresIn * 1000);
                startCountdown();
                
                // Clear inputs
                clearOTPInputs();
                document.getElementById('otp-1').focus();
                
            } else {
                showOTPError(data.error || 'Failed to resend code');
            }
        } catch (error) {
            console.error('Resend OTP error:', error);
            showOTPError('Network error. Please try again.');
        } finally {
            resendBtn.disabled = false;
            resendBtn.textContent = 'Resend Code';
        }
    });

    /**
     * Cancel OTP Button
     */
    cancelBtn.addEventListener('click', () => {
        closeOTPModal();
    });

    /**
     * OTP Input Auto-Focus
     */
    const otpInputs = document.querySelectorAll('.otp-digit');
    otpInputs.forEach((input, index) => {
        // Auto-focus next input on digit entry
        input.addEventListener('input', (e) => {
            const value = e.target.value;
            
            // Only allow digits
            if (!/^\d$/.test(value)) {
                e.target.value = '';
                return;
            }
            
            // Move to next input
            if (value && index < otpInputs.length - 1) {
                otpInputs[index + 1].focus();
            }
        });

        // Handle backspace
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                otpInputs[index - 1].focus();
            }
        });

        // Handle paste
        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const pastedData = e.clipboardData.getData('text');
            const digits = pastedData.replace(/\D/g, '').slice(0, 6);
            
            digits.split('').forEach((digit, i) => {
                if (otpInputs[i]) {
                    otpInputs[i].value = digit;
                }
            });
            
            // Focus last filled input or submit
            const lastIndex = Math.min(digits.length - 1, 5);
            otpInputs[lastIndex].focus();
        });
    });

    /**
     * Helper: Get OTP value from all inputs
     */
    function getOTPValue() {
        return Array.from(otpInputs).map(input => input.value).join('');
    }

    /**
     * Helper: Clear OTP inputs
     */
    function clearOTPInputs() {
        otpInputs.forEach(input => {
            input.value = '';
        });
        otpAttemptsInfo.textContent = '';
    }

    /**
     * Helper: Show OTP error message
     */
    function showOTPError(message) {
        otpErrorBox.textContent = message;
        otpErrorBox.classList.remove('hidden');
        otpSuccessBox.classList.add('hidden');
    }

    /**
     * Helper: Close OTP modal
     */
    function closeOTPModal() {
        otpModal.classList.add('hidden');
        clearInterval(timerInterval);
        clearOTPInputs();
        otpErrorBox.classList.add('hidden');
        otpSuccessBox.classList.add('hidden');
        currentEmail = '';
    }

    /**
     * Helper: Mask email for privacy
     */
    function maskEmail(email) {
        const [username, domain] = email.split('@');
        const maskedUsername = username.charAt(0) + '***' + username.charAt(username.length - 1);
        return `${maskedUsername}@${domain}`;
    }

    /**
     * Countdown Timer
     */
    function startCountdown() {
        // Clear existing timer
        if (timerInterval) {
            clearInterval(timerInterval);
        }

        timerInterval = setInterval(() => {
            const remaining = Math.max(0, expiryTime - Date.now());
            const minutes = Math.floor(remaining / 60000);
            const seconds = Math.floor((remaining % 60000) / 1000);
            
            otpTimer.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            
            // Change color when time is running out
            if (remaining <= 60000) {
                otpTimer.style.color = '#f44336'; // Red
            } else if (remaining <= 120000) {
                otpTimer.style.color = '#ff9800'; // Orange
            } else {
                otpTimer.style.color = '#4caf50'; // Green
            }
            
            // Timer expired
            if (remaining <= 0) {
                clearInterval(timerInterval);
                showOTPError('Verification code expired. Please request a new code.');
                resendBtn.focus();
            }
        }, 1000);
    }

    /**
     * ==========================================
     * SSO LOGIN HANDLERS
     * ==========================================
     */

    // Google Workspace SSO
    const googleSSOBtn = document.getElementById('google-sso-btn');
    if (googleSSOBtn) {
        googleSSOBtn.addEventListener('click', () => {
            // Redirect to backend OAuth route (passport.js handles the Google redirect)
            window.location.href = '/oauth/google';
        });
    }

    // Show error if redirected back from failed OAuth
    const urlParams = new URLSearchParams(window.location.search);
    const oauthError = urlParams.get('error');
    if (oauthError === 'oauth_failed' && errorBox) {
        errorBox.textContent = 'Google login failed. No account found for this Google address. Please contact your administrator.';
        errorBox.style.display = 'block';
        window.history.replaceState({}, '', window.location.pathname);
    }
});




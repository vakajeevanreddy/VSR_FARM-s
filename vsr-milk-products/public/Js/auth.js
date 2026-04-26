// Firebase Initialization and Authentication Logic

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    sendPasswordResetEmail,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Firebase configuration (vsrmilk-products)
const firebaseConfig = {
  apiKey: "AIzaSyBaBikFn5GL0M1F0ouVPk1NWfjlzvh6r-4",
  authDomain: "vsrmilk-products.firebaseapp.com",
  projectId: "vsrmilk-products",
  storageBucket: "vsrmilk-products.firebasestorage.app",
  messagingSenderId: "291100274483",
  appId: "1:291100274483:web:c6e652df1b7ea51dd31846",
  measurementId: "G-CPGZBN7R6Z"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Use the global API_BASE_URL if it exists, otherwise fallback to dynamic
const BASE_URL = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : ((window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') && window.location.port !== '5000' ? 'http://localhost:5000' : window.location.origin);

// --- Email/Password Auth ---

/**
 * Login with Email and Password (Backend JWT)
 */
export const login = async (email, password) => {
    try {
        const response = await fetch(`${BASE_URL}/users/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            // Save user and token to localStorage
            localStorage.setItem('vsr_token', data.token);
            localStorage.setItem('vsr_user', JSON.stringify(data.user));
            localStorage.setItem('user_role', data.user.role);
            
            // For backward compatibility and cross-tab sync in script.js
            if (data.user.role === 'owner') {
                localStorage.setItem('vsr_owner_active', 'true');
            }

            return { success: true, user: data.user, token: data.token };
        } else {
            return { success: false, error: data.error || 'Invalid credentials' };
        }
    } catch (error) {
        console.error("Backend Login Error:", error);
        return { success: false, error: "Connection to server failed. Please try again." };
    }
};

/**
 * Signup with Email and Password
 */
export const signup = async (email, password, displayName) => {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        // Update display name
        if (displayName) {
            await updateProfile(user, { displayName });
        }
        
        const syncResult = await syncUser({ ...user, displayName });

        // Save user to localStorage for avatar
        localStorage.setItem('vsr_user', JSON.stringify({
            id: syncResult.id,
            email: user.email,
            displayName: displayName || 'Customer',
            uid: user.uid,
            joinedAt: new Date().toISOString(),
            loginMethod: 'email'
        }));
        return { success: true, user: { ...user, id: syncResult.id } };
    } catch (error) {
        console.error("Signup Error:", error.code, error.message);
        return { success: false, error: _friendlyError(error.code) };
    }
};

// --- Phone/OTP Auth ---

let _confirmationResult = null;

/**
 * Set up invisible reCAPTCHA and send OTP to phone number
 * @param {string} phoneNumber - Must include country code, e.g. "+919876543210"
 * @param {string} buttonId - ID of the button to attach reCAPTCHA to
 */
export const sendOTP = async (phoneNumber, containerId = 'recaptcha-container') => {
    try {
        // Clear old verifier
        if (window._recaptchaVerifier) {
            window._recaptchaVerifier.clear();
            window._recaptchaVerifier = null;
        }

        // Initialize RecaptchaVerifier as VISIBLE to ensure it works on all domains
        window._recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
            'size': 'normal', // Changed to normal/visible for reliability
            'callback': (response) => {
                console.log("reCAPTCHA solved");
            }
        });

        _confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, window._recaptchaVerifier);
        return { success: true, message: 'OTP sent successfully' };
    } catch (error) {
        console.error("Send OTP Detail:", error);
        return { success: false, error: _friendlyError(error.code) || error.message || "Failed to send OTP" };
    }
};

/**
 * Verify the OTP code entered by the user
 * @param {string} otpCode - 6-digit OTP code
 */
export const verifyOTP = async (otpCode) => {
    try {
        if (!_confirmationResult) {
            console.error("No confirmation result found in session.");
            return { success: false, error: 'Session expired or not initialized. Please click "Send OTP" again.' };
        }

        const result = await _confirmationResult.confirm(otpCode);
        const user = result.user;
        const syncResult = await syncUser(user);

        localStorage.setItem('vsr_user', JSON.stringify({
            id: syncResult ? syncResult.id : user.uid,
            email: user.email || '',
            displayName: user.displayName || user.phoneNumber || 'Customer',
            uid: user.uid,
            phone: user.phoneNumber,
            loginMethod: 'phone'
        }));

        return { success: true, user: { ...user, id: syncResult ? syncResult.id : user.uid } };
    } catch (error) {
        console.error("Verify OTP Detail:", error);
        return { success: false, error: _friendlyError(error.code) || error.message || "Invalid OTP" };
    }
};

/**
 * Sync Firebase user with custom backend (Authenticated)
 */
async function syncUser(firebaseUser) {
    const token = localStorage.getItem('vsr_token');
    try {
        const response = await fetch(`${BASE_URL}/users/sync`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                name: firebaseUser.displayName,
                email: firebaseUser.email || (firebaseUser.phoneNumber + "@phone.autogen"),
                phone_number: firebaseUser.phoneNumber
            })
        });
        const data = await response.json();
        return data.user;
    } catch (err) {
        console.error("Sync error:", err);
        return { id: firebaseUser.uid }; // Fallback to UID if sync fails
    }
}

// --- Utility Functions ---

/**
 * Logout
 */
export const logout = async () => {
    try {
        // Sign out from Firebase if used
        try { await signOut(auth); } catch(e) {}
        
        // Clear all session markers
        localStorage.removeItem('vsr_token');
        localStorage.removeItem('vsr_user');
        localStorage.removeItem('vsr_owner_active');
        localStorage.removeItem('user_role');
        
        return { success: true };
    } catch (error) {
        console.error("Logout Error:", error.message);
        return { success: false, error: error.message };
    }
};

/**
 * Password Reset
 */
export const resetPassword = async (email) => {
    if (!email) return { success: false, error: "Please enter your email address first." };
    try {
        await sendPasswordResetEmail(auth, email);
        return { success: true };
    } catch (error) {
        console.error("Reset Error:", error.code, error.message);
        return { success: false, error: _friendlyError(error.code) };
    }
};

/**
 * Listen for Auth State Changes
 */
export const onAuthChange = (callback) => {
    onAuthStateChanged(auth, callback);
};

/**
 * Convert Firebase error codes to user-friendly messages
 */
function _friendlyError(code) {
    if (!code) return 'An unknown error occurred. Please try again.';
    const errors = {
        'auth/user-not-found': 'No account found with this email.',
        'auth/wrong-password': 'Incorrect password. Try again.',
        'auth/email-already-in-use': 'This email is already registered.',
        'auth/weak-password': 'Password must be at least 6 characters.',
        'auth/invalid-email': 'Please enter a valid email address.',
        'auth/too-many-requests': 'Too many attempts. Please try again later.',
        'auth/invalid-phone-number': 'Please enter a valid phone number with country code (e.g. +91...).',
        'auth/invalid-verification-code': 'Invalid OTP code. Please try again.',
        'auth/code-expired': 'OTP has expired. Please request a new one.',
        'auth/captcha-check-failed': 'reCAPTCHA verification failed. Please check your domain authorization in Firebase.',
        'auth/quota-exceeded': 'SMS quota exceeded. If you are testing, please add your number as a "Test Number" in Firebase Console.',
        'auth/missing-phone-number': 'Phone number is required.',
        'auth/invalid-credential': 'Invalid credentials. Please check and try again.',
        'auth/network-request-failed': 'Network error. Check your internet connection.',
        'auth/billing-not-enabled': 'Firebase Billing is not enabled. SMS cannot be sent to real numbers. Please use a "Test Number" configured in Firebase Console.',
        'auth/unauthorized-domain': 'This domain is not authorized in Firebase Console. Please add localhost/your-domain to Auth -> Settings -> Authorized Domains.',
        'auth/operation-not-allowed': 'The requested sign-in provider (Email or Phone) is not enabled in your Firebase Console.',
    };
    return errors[code] || `Authentication error: ${code}`;
}

export { auth };




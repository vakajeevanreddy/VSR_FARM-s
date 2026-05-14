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
const BASE_URL = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : ((window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') ? 'http://localhost:5000' : 'https://vsr-milk-backend.onrender.com');

// --- Email/Password Auth ---

/**
 * Login with Email and Password (Firebase + Sync)
 */
export const login = async (email, password) => {
    try {
        // 1. Authenticate with Firebase
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const firebaseUser = userCredential.user;
        
        // 2. Get Firebase Token
        const token = await firebaseUser.getIdToken();
        
        // 3. Sync with MySQL Backend
        const syncResult = await syncUser(firebaseUser);
        const mysqlUser = syncResult.user;
        const backendToken = syncResult.token;

        // 4. Save to localStorage
        localStorage.setItem('vsr_token', backendToken);
        localStorage.setItem('vsr_user', JSON.stringify({
            ...mysqlUser,
            uid: firebaseUser.uid
        }));
        localStorage.setItem('user_role', mysqlUser.role || 'customer');
        
        if (mysqlUser.role === 'owner') {
            localStorage.setItem('vsr_owner_active', 'true');
        }

        return { success: true, user: mysqlUser, token: backendToken };
    } catch (error) {
        console.error("Firebase Login Error:", error);
        return { success: false, error: _friendlyError(error.code) };
    }
};

/**
 * Signup with Email and Password (Firebase + Sync)
 */
export const signup = async (email, password, displayName) => {
    try {
        // 1. Create user in Firebase
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const firebaseUser = userCredential.user;
        
        // 2. Update Profile Display Name
        if (displayName) {
            await updateProfile(firebaseUser, { displayName: displayName });
        }
        
        // 3. Sync with MySQL Backend
        const syncResult = await syncUser(firebaseUser);
        const mysqlUser = syncResult.user;
        const backendToken = syncResult.token;

        // 4. Save to localStorage
        localStorage.setItem('vsr_token', backendToken);
        localStorage.setItem('vsr_user', JSON.stringify({
            ...mysqlUser,
            uid: firebaseUser.uid
        }));
        localStorage.setItem('user_role', mysqlUser.role || 'customer');

        return { success: true, user: mysqlUser };
    } catch (error) {
        console.error("Firebase Signup Error:", error);
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
        console.log("Attempting to send OTP to:", phoneNumber);
        
        // Clear old verifier
        if (window._recaptchaVerifier) {
            window._recaptchaVerifier.clear();
            window._recaptchaVerifier = null;
        }

        // Initialize RecaptchaVerifier
        // Note: size 'invisible' is often better for UX but 'normal' is more reliable for debugging
        window._recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
            'size': 'invisible', 
            'callback': (response) => {
                console.log("reCAPTCHA solved successfully");
            },
            'expired-callback': () => {
                console.warn("reCAPTCHA expired, please try again");
            }
        });

        _confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, window._recaptchaVerifier);
        console.log("OTP sent successfully to", phoneNumber);
        return { success: true, message: 'OTP sent successfully! Please check your mobile.' };
    } catch (error) {
        console.error("Send OTP Error Details:", error);
        let errorMsg = _friendlyError(error.code);
        if (error.code === 'auth/unauthorized-domain') {
            errorMsg = "This domain is not authorized in Firebase. If you are testing locally, ensure 'localhost' is added to Authorized Domains in Firebase Console -> Auth -> Settings.";
        }
        return { success: false, error: errorMsg };
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
        const mysqlUser = syncResult.user;
        const backendToken = syncResult.token;

        localStorage.setItem('vsr_token', backendToken);
        localStorage.setItem('vsr_user', JSON.stringify({
            id: mysqlUser ? mysqlUser.id : user.uid,
            email: user.email || '',
            displayName: user.displayName || user.phoneNumber || 'Customer',
            uid: user.uid,
            phone: user.phoneNumber,
            loginMethod: 'phone',
            role: mysqlUser ? mysqlUser.role : 'customer'
        }));

        return { success: true, user: { ...user, id: mysqlUser ? mysqlUser.id : user.uid } };
    } catch (error) {
        console.error("Verify OTP Detail:", error);
        return { success: false, error: _friendlyError(error.code) || error.message || "Invalid OTP" };
    }
};

/**
 * Sync Firebase user with custom backend (Authenticated)
 */
async function syncUser(firebaseUser) {
    try {
        const response = await fetch(`${BASE_URL}/users/sync`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: firebaseUser.displayName,
                email: firebaseUser.email || (firebaseUser.phoneNumber + "@phone.autogen"),
                phone_number: firebaseUser.phoneNumber
            })
        });
        const data = await response.json();
        return data; // Returns { user, token }
    } catch (err) {
        console.error("Sync error:", err);
        return { user: { id: firebaseUser.uid }, token: null }; 
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




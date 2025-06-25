"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestion } from '@fortawesome/free-solid-svg-icons';
import InfoModal from "../components/modals/InfoModal";
import { useCSRFToken } from "../components/hooks/useCSRFToken";

export default function Login() {
  const router = useRouter();
  const { protectedFetch } = useCSRFToken();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [requires2FA, setRequires2FA] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [userType, setUserType] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  // Check session on mount
  useEffect(() => {
    async function checkSession() {
      const res = await fetch('/api/session');
      const data = await res.json();
      if (data.valid) {
        setIsLoggedIn(true);
        router.push('/frontpage');
      } else {
        setIsLoggedIn(false);
      }
    }
    checkSession();
  }, [router]);

  // Only show login form after session check
  if (isLoggedIn === null) {
    return (
      <div className="fixed inset-0 min-h-screen min-w-full bg-black text-white flex items-center justify-center z-50 p-4 text-center font-mono">
        <div className="animate-pulse">CHECKING SESSION STATUS...</div>
      </div>
    );
  }
  if (isLoggedIn) {
    // Prevent rendering anything if already logged in (router.push will handle redirect)
    return null;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setUserType(null);
    setLoading(true);
    
    try {
      const res = await protectedFetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email, 
          password,
          twoFactorCode: requires2FA ? twoFactorCode : undefined
        }),
      });
      const data = await res.json();
      if (!data.success) {
        if (data.requires2FA) {
          setRequires2FA(true);
          setLoginError(data.message || 'Two-factor authentication required');
        } else {
          setLoginError(data.message || 'Login failed');
        }
      } else {
        setUserType(data.user.is_admin ? 'Admin' : 'User');
        router.push('/frontpage');
      }
    } catch {
      setLoginError('Server error');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setUserType(null);
    setLoading(true);
    
    // Enhanced client-side validation with specific error messages
    if (!email.trim()) {
      setLoginError('Email address is required');
      setLoading(false);
      return;
    }
    
    if (!email.includes('@') || !email.includes('.')) {
      setLoginError('Please enter a valid email address');
      setLoading(false);
      return;
    }
    
    if (!username.trim()) {
      setLoginError('Username is required');
      setLoading(false);
      return;
    }
    
    if (username.trim().length < 3) {
      setLoginError('Username must be at least 3 characters long');
      setLoading(false);
      return;
    }
    
    if (username.trim().length > 20) {
      setLoginError('Username must be 20 characters or less');
      setLoading(false);
      return;
    }
    
    if (!password) {
      setLoginError('Password is required');
      setLoading(false);
      return;
    }
    
    if (password.length < 6) {
      setLoginError('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }
    
    if (!/\d/.test(password)) {
      setLoginError('Password must contain at least one number');
      setLoading(false);
      return;
    }
    
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      setLoginError('Password must contain at least one special character');
      setLoading(false);
      return;
    }
    
    if (password !== confirmPassword) {
      setLoginError('Passwords do not match');
      setLoading(false);
      return;
    }
    
    try {
      const res = await protectedFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: email.trim(), 
          username: username.trim(), 
          password, 
          confirmPassword
        }),
      });
      
      const data = await res.json();
      
      if (!data.success) {
        // Handle specific server error messages
        let errorMessage = 'Registration failed';
        
        if (data.message) {
          // Common server error messages to make more user-friendly
          const message = data.message.toLowerCase();
          
          if (message.includes('email') && message.includes('already')) {
            errorMessage = 'This email address is already registered';
          } else if (message.includes('username') && message.includes('already')) {
            errorMessage = 'This username is already taken';
          } else if (message.includes('email') && message.includes('invalid')) {
            errorMessage = 'Please enter a valid email address';
          } else if (message.includes('username') && message.includes('invalid')) {
            errorMessage = 'Username contains invalid characters';
          } else if (message.includes('password') && message.includes('weak')) {
            errorMessage = 'Password does not meet security requirements';
          } else if (message.includes('password') && message.includes('match')) {
            errorMessage = 'Passwords do not match';
          } else if (message.includes('rate limit')) {
            errorMessage = 'Too many registration attempts. Please try again later';
          } else if (message.includes('server') || message.includes('database')) {
            errorMessage = 'Server error. Please try again in a few moments';
          } else if (message.includes('validation')) {
            errorMessage = 'Please check your information and try again';
          } else {
            // Use the server message if it's descriptive enough
            errorMessage = data.message;
          }
        }
        
        setLoginError(errorMessage);
      } else {
        setUserType('User');
        // Redirect to frontpage after successful registration
        router.push('/frontpage');
      }
    } catch (error) {
      console.error('Registration error:', error);
      setLoginError('Network error. Please check your connection and try again');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await protectedFetch('/api/logout', { method: 'POST' });
      router.push('/');
    } catch (error) {
      console.error('Logout error:', error);
      // Even if logout fails, redirect to login page
      router.push('/');
    }
  };

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setUsername("");
    setTwoFactorCode("");
    setRequires2FA(false);
    setLoginError(null);
    setUserType(null);
  };

  return (
    <div className="fixed inset-0 min-h-screen bg-black text-white font-mono overflow-hidden">
      {/* Help Button - Top Left */}
      <button
        onClick={() => setShowInfoModal(true)}
        className="fixed top-2 left-2 sm:top-4 sm:left-4 z-20 p-2 sm:p-3 bg-black text-blue-400 border-2 border-blue-400 rounded-none hover:bg-blue-400 hover:text-black transition-all shadow-lg font-mono text-sm sm:text-base"
        title="Platform Information"
      >
        <FontAwesomeIcon icon={faQuestion} size="sm" className="sm:text-lg" />
      </button>
      
      {/* Animated Background Grid */}
      <div className="absolute inset-0 opacity-10">
        <div className="grid grid-cols-4 xs:grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-px h-full">
          {Array.from({ length: 120 }).map((_, i) => (
            <div 
              key={i} 
              className="border border-green-500/20 animate-pulse"
              style={{ animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>
      </div>
      
      {/* Scanline Effect */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="w-full h-px bg-gradient-to-r from-transparent via-green-400 to-transparent animate-ping opacity-30 translate-y-64 absolute" 
             style={{ animation: 'scanline 4s linear infinite' }} />
      </div>

      {/* Main Login Container - Now with scroll support */}
      <div className="relative z-10 flex flex-col items-center justify-start sm:justify-center min-h-screen p-2 xs:p-3 sm:p-4 md:p-6 lg:p-8 overflow-y-auto">
        {/* FBI Header - Smaller on mobile */}
        <div className="mb-2 xs:mb-3 sm:mb-4 md:mb-6 lg:mb-8 text-center animate-pulse mt-2 sm:mt-0">
        </div>

        {/* Login/Registration Form Container */}
        <div className="bg-black border-2 border-white rounded-none shadow-2xl w-full max-w-md mx-auto p-4">
          {/* Form Header - Simple for both login and registration */}
          <div className="mb-6">
            {isRegistering ? (
              <>
                <h1 className="text-xl font-bold text-white mb-1">Create Account</h1>
                <p className="text-gray-400 text-sm">Join the Polmatch community</p>
              </>
            ) : (
              <>
                <h1 className="text-xl font-bold text-white mb-1">Welcome Back</h1>
                <p className="text-gray-400 text-sm">Sign in to your account</p>
              </>
            )}
          </div>

          <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-4">

            {/* Username Field (Registration Only) */}
            {isRegistering && (
              <div>
                <input
                  type="text"
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full p-3 bg-black text-white border border-gray-600 rounded focus:outline-none focus:border-white transition-colors"
                  disabled={loading}
                  required
                />
              </div>
            )}

            {/* Email Field */}
            <div>
              <input
                type="text"
                placeholder="Enter email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 bg-black text-white border border-gray-600 rounded focus:outline-none focus:border-white transition-colors"
                disabled={loading}
                required
              />
            </div>

            {/* Password Field */}
            <div>
              <input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 bg-black text-white border border-gray-600 rounded focus:outline-none focus:border-white transition-colors"
                disabled={loading}
                required
              />
              {isRegistering && (
                <p className="text-xs text-gray-400 mt-1">
                  Must contain at least 6 characters, 1 number, and 1 special character
                </p>
              )}
            </div>

            {/* Confirm Password Field (Registration Only) */}
            {isRegistering && (
              <div>
                <input
                  type="password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full p-3 bg-black text-white border border-gray-600 rounded focus:outline-none focus:border-white transition-colors"
                  disabled={loading}
                  required
                />
              </div>
            )}

            {/* 2FA Code Field (Login Only, when required) */}
            {!isRegistering && requires2FA && (
              <div>
                <input
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full p-3 bg-black text-white border border-gray-600 rounded focus:outline-none focus:border-white transition-colors text-center tracking-widest"
                  disabled={loading}
                  maxLength={6}
                  required
                />
                <p className="text-xs text-gray-400 mt-1">
                  Enter the 6-digit code from your authenticator app
                </p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className={`w-full p-3 text-base font-bold rounded transition-all ${
                loading 
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
                  : 'bg-white text-black hover:bg-gray-200'
              }`}
              disabled={loading}
            >
              {loading 
                ? (isRegistering ? 'Creating Account...' : 'Signing In...') 
                : (isRegistering ? 'Create Account' : 'Sign In')
              }
            </button>

            {/* Toggle Registration/Login */}
            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setIsRegistering(!isRegistering);
                  resetForm();
                }}
                className="text-gray-400 text-sm hover:text-white transition-colors"
                disabled={loading}
              >
                {isRegistering ? '← Back to Sign In' : 'Create New Account →'}
              </button>
            </div>

            {/* Error Display */}
            {loginError && (
              <div className="bg-red-900 border-2 border-red-400 text-red-100 p-2 xs:p-3 text-center font-mono animate-pulse">
                <div className="text-xs uppercase tracking-wider mb-1">⚠ ERROR ⚠</div>
                <div className="text-xs xs:text-sm">{loginError.toUpperCase()}</div>
              </div>
            )}

            {/* Success Display */}
            {userType && (
              <div className="bg-green-900 border-2 border-green-400 text-green-100 p-2 xs:p-3 text-center font-mono animate-pulse">
                <div className="text-xs uppercase tracking-wider mb-1">✓ {isRegistering ? 'ACCOUNT CREATED' : 'LOGIN SUCCESSFUL'} ✓</div>
                <div className="text-xs xs:text-sm">{isRegistering ? 'WELCOME TO POLMATCH' : `AUTHENTICATED AS: ${userType.toUpperCase()}`}</div>
              </div>
            )}
          </form>

          {/* Security Footer - Minimal in registration mode */}
          <div className={`pt-2 sm:pt-3 md:pt-4 transition-all duration-300 ${
            isRegistering ? 'mt-2 xs:mt-3 sm:mt-4' : 'mt-4 xs:mt-5 sm:mt-6 md:mt-8'
          }`}>
            <div className="text-center">
              {/* Removed: ENCRYPTION: AES-256 | STATUS: SECURE */}
              {/* Removed: FEDERAL MONITORING ACTIVE */}
            </div>
          </div>
        </div>

        {/* Logout Button (if logged in) */}
        {isLoggedIn && (
          <button
            className="mt-3 xs:mt-4 sm:mt-6 md:mt-8 p-2 xs:p-3 sm:p-4 bg-red-900 text-red-100 border-2 border-red-500 rounded-none hover:bg-red-800 transition-colors font-mono uppercase tracking-wider text-xs xs:text-sm sm:text-base shadow-lg"
            onClick={handleLogout}
          >
            TERMINATE SESSION
          </button>
        )}

        {/* Bottom spacing for mobile */}
        <div className="h-4 sm:h-0"></div>
      </div>

      {/* Info Modal */}
      <InfoModal 
        isOpen={showInfoModal} 
        onClose={() => setShowInfoModal(false)} 
      />

      {/* Custom CSS for animations and responsive utilities */}
      <style jsx>{`
        @keyframes scanline {
          0% { transform: translateY(-100vh); }
          100% { transform: translateY(100vh); }
        }
        
        /* Ensure proper viewport handling */
        @media screen and (max-height: 700px) {
          .min-h-screen {
            min-height: 100vh;
          }
        }
        
        /* Custom breakpoint for extra small devices */
        @media (min-width: 375px) {
          .xs\\:p-4 { padding: 1rem; }
          .xs\\:p-3 { padding: 0.75rem; }
          .xs\\:p-2\\.5 { padding: 0.625rem; }
          .xs\\:text-base { font-size: 1rem; line-height: 1.5rem; }
          .xs\\:text-sm { font-size: 0.875rem; line-height: 1.25rem; }
          .xs\\:mb-4 { margin-bottom: 1rem; }
          .xs\\:mb-5 { margin-bottom: 1.25rem; }
          .xs\\:mb-6 { margin-bottom: 1.5rem; }
          .xs\\:mt-4 { margin-top: 1rem; }
          .xs\\:mt-5 { margin-top: 1.25rem; }
          .xs\\:mt-6 { margin-top: 1.5rem; }
          .xs\\:space-y-3 > :not([hidden]) ~ :not([hidden]) {
            --tw-space-y-reverse: 0;
            margin-top: calc(0.75rem * calc(1 - var(--tw-space-y-reverse)));
            margin-bottom: calc(0.75rem * var(--tw-space-y-reverse));
          }
          .xs\\:space-y-4 > :not([hidden]) ~ :not([hidden]) {
            --tw-space-y-reverse: 0;
            margin-top: calc(1rem * calc(1 - var(--tw-space-y-reverse)));
            margin-bottom: calc(1rem * var(--tw-space-y-reverse));
          }
          .xs\\:max-w-sm { max-width: 24rem; }
          .xs\\:w-2 { width: 0.5rem; }
          .xs\\:h-2 { height: 0.5rem; }
          .xs\\:mr-2 { margin-right: 0.5rem; }
          .xs\\:ml-2 { margin-left: 0.5rem; }
          .xs\\:-mx-3 { margin-left: -0.75rem; margin-right: -0.75rem; }
          .xs\\:-mx-4 { margin-left: -1rem; margin-right: -1rem; }
          .xs\\:-mt-3 { margin-top: -0.75rem; }
          .xs\\:-mt-4 { margin-top: -1rem; }
        }
        
        /* Ensure no content is cut off on very small screens */
        @media screen and (max-width: 320px) {
          .fixed.inset-0 {
            position: absolute;
          }
        }
        
        /* Handle landscape orientation on mobile */
        @media screen and (max-height: 500px) and (orientation: landscape) {
          .justify-start {
            justify-content: flex-start !important;
          }
          .min-h-screen {
            min-height: auto;
          }
        }
      `}</style>
    </div>
  );
}
"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestion } from '@fortawesome/free-solid-svg-icons';
import InfoModal from "../../components/modals/InfoModal";
import { useCSRFToken } from "../../components/hooks/useCSRFToken";
import { createDebouncedBreachChecker } from "../../lib/password-breach-client";


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
  const [passwordBreachStatus, setPasswordBreachStatus] = useState<{
    checked: boolean;
    isBreached: boolean;
    count?: number;
  }>({ checked: false, isBreached: false });

  // Create debounced breach checker
  const debouncedBreachChecker = useCallback(
    createDebouncedBreachChecker(800), // 800ms delay
    []
  );

  // Check password breach status when password changes (during registration)
  useEffect(() => {
    if (isRegistering && password.length >= 6) {
      setPasswordBreachStatus({ checked: false, isBreached: false });
      
      debouncedBreachChecker(password, (result) => {
        setPasswordBreachStatus({
          checked: true,
          isBreached: result.isBreached,
          count: result.count
        });
      });
    } else {
      setPasswordBreachStatus({ checked: false, isBreached: false });
    }
  }, [password, isRegistering, debouncedBreachChecker]);

  // Check session on mount
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch('/api/session', {
          credentials: 'include' // Ensure cookies are sent
        });
        
        if (res.ok) {
          const data = await res.json();
          if (data.valid) {
            setIsLoggedIn(true);
            
            // Check if user needs to set up forced 2FA
            if (data.user?.force_2fa_enabled && !data.user?.two_factor_enabled && !data.user?.is_admin) {
              router.push('/setup-2fa');
            } else {
              router.push('/chat');
            }
            return;
          }
        }
        
        // If we get here, either the response wasn't ok or data.valid was false
        // This is expected when not logged in, so we silently set isLoggedIn to false
        setIsLoggedIn(false);
      } catch (error) {
        // Network error or other issues - assume not logged in
        console.error('Session check failed:', error);
        setIsLoggedIn(false);
      }
    }
    checkSession();
  }, [router]);

  // Only show login form after session check
  if (isLoggedIn === null) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div>Checking session...</div>
      </div>
    );
  }
  if (isLoggedIn) {
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
        
        // Check if user needs to set up forced 2FA
        if (data.user.force_2fa_enabled && !data.user.two_factor_enabled && !data.user.is_admin) {
          router.push('/setup-2fa');
        } else {
          router.push('/chat');
        }
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
    
    if (password.length > 128) {
      setLoginError('Password is too long (maximum 128 characters)');
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
    
    // Check if password contains username or email parts
    const passwordLower = password.toLowerCase();
    if (username && username.length > 2 && passwordLower.includes(username.toLowerCase())) {
      setLoginError('Password cannot contain your username');
      setLoading(false);
      return;
    }
    
    const emailPart = email.split('@')[0];
    if (emailPart.length > 2 && passwordLower.includes(emailPart.toLowerCase())) {
      setLoginError('Password cannot contain part of your email address');
      setLoading(false);
      return;
    }
    
    // Check for common password patterns
    const commonPatterns = [
      'password', 'pass', '1234', '123456', '12345678', '123456789',
      'qwerty', 'abc123', 'password123', 'admin', 'login', 'welcome'
    ];
    
    for (const pattern of commonPatterns) {
      if (passwordLower.includes(pattern)) {
        setLoginError(`Password cannot contain common pattern "${pattern}"`);
        setLoading(false);
        return;
      }
    }
    
    // Check for repeated characters
    if (/^(.)\1{5,}$/.test(password)) {
      setLoginError('Password cannot be the same character repeated');
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
        let errorMessage = data.message || 'Registration failed';
        
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
          } // else: keep errorMessage as data.message
        }
        
        setLoginError(errorMessage);
      } else {
  setUserType('User');
  router.push('/chat');
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
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
      router.push('/login');
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
    setPasswordBreachStatus({ checked: false, isBreached: false });
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      {/* Help Button */}
      <button
        onClick={() => setShowInfoModal(true)}
        className="fixed top-4 left-4 z-20 w-12 h-12 bg-black border border-white rounded-none flex items-center justify-center hover:bg-gray-800 transition-colors"
        title="Platform Information"
      >
        <FontAwesomeIcon icon={faQuestion} />
      </button>
      
      {/* Main Login Container */}
      <div className="w-full max-w-md">
        <div className="bg-black border-2 border-white rounded-none p-6">

          <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-4">
            {/* Registration Fields */}
            {isRegistering && (
              <div>
                <input
                  type="text"
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full p-3 bg-black text-white border-2 border-white rounded-none focus:outline-none focus:border-gray-400 transition-colors"
                  disabled={loading}
                  required
                />
              </div>
            )}

            {/* Email Field */}
            <div>
              <input
                type="email"
                placeholder="Enter email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 bg-black text-white border-2 border-white rounded-none focus:outline-none focus:border-gray-400 transition-colors"
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
                className="w-full p-3 bg-black text-white border-2 border-white rounded-none focus:outline-none focus:border-gray-400 transition-colors"
                disabled={loading}
                required
              />
              {isRegistering && (
                <div className="mt-1">
                  <p className="text-xs text-gray-400">
                    Must be 6-128 characters with at least 1 number and 1 special character (!@#$%^&*()_+-=[]{};&quot;&apos;:|,.&lt;&gt;/?). Cannot contain username, email, or common patterns.
                  </p>
                  {/* Real-time breach checking feedback */}
                  {password.length >= 6 && (
                    <div className="mt-2">
                      {!passwordBreachStatus.checked ? (
                        <p className="text-xs text-yellow-400">🔍 Checking for security breaches...</p>
                      ) : passwordBreachStatus.isBreached ? (
                        <div className="text-xs text-red-400 bg-red-900/20 border border-red-500/30 p-2 rounded">
                          ⚠️ <strong>Security Warning:</strong> This password has been found in{' '}
                          {passwordBreachStatus.count && passwordBreachStatus.count > 1 
                            ? `${passwordBreachStatus.count.toLocaleString()} data breaches` 
                            : 'a data breach'
                          }. Please choose a different password.
                        </div>
                      ) : (
                        <p className="text-xs text-green-400">✅ Password not found in known breaches</p>
                      )}
                    </div>
                  )}
                </div>
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
                  className="w-full p-3 bg-black text-white border-2 border-white rounded-none focus:outline-none focus:border-gray-400 transition-colors"
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
                  className="w-full p-3 bg-black text-white border-2 border-white rounded-none focus:outline-none focus:border-gray-400 transition-colors text-center tracking-widest"
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
              className={`w-full p-3 font-medium uppercase tracking-wider border-2 rounded-none transition-all ${
                loading 
                  ? 'bg-gray-600 border-gray-400 text-gray-300 cursor-not-allowed' 
                  : 'bg-white text-black border-white hover:bg-gray-200 hover:border-gray-200'
              }`}
              disabled={loading}
            >
              {loading 
                ? (isRegistering ? 'Creating Account...' : 'Logging In...') 
                : (isRegistering ? 'Create Account' : 'Login')
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
                className="text-gray-400 hover:text-white transition-colors"
                disabled={loading}
              >
                {isRegistering ? '← Back to Login' : 'Create New Account →'}
              </button>
            </div>

            {/* Error Display */}
            {loginError && (
              <div className="bg-red-900 border-2 border-red-400 text-red-100 p-3 text-center">
                <div className="text-sm uppercase tracking-wider mb-1">Error</div>
                <div className="text-sm">{loginError}</div>
              </div>
            )}

            {/* Success Display */}
            {userType && (
              <div className="bg-green-900 border-2 border-green-400 text-green-100 p-3 text-center">
                <div className="text-sm uppercase tracking-wider mb-1">
                  {isRegistering ? 'Account Created' : 'Login Successful'}
                </div>
                <div className="text-sm">
                  {isRegistering ? 'Welcome to Polmatch' : `Authenticated as: ${userType}`}
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Logout Button (if logged in) */}
        {isLoggedIn && (
          <button
            className="mt-4 w-full p-3 bg-red-900 text-red-100 border-2 border-red-500 rounded-none hover:bg-red-800 transition-colors uppercase tracking-wider"
            onClick={handleLogout}
          >
            Logout
          </button>
        )}
      </div>

      {/* Info Modal */}
      <InfoModal 
        isOpen={showInfoModal} 
        onClose={() => setShowInfoModal(false)} 
      />
    </div>
  );
}
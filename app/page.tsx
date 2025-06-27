"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Image from "next/image";
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
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      {/* Help Button */}
      <button
        onClick={() => setShowInfoModal(true)}
        className="fixed top-4 left-4 z-20 w-12 h-12 bg-black border border-white rounded-none flex items-center justify-center hover:bg-gray-800 transition-colors"
        title="Platform Information"
      >
        <FontAwesomeIcon icon={faQuestion} />
      </button>
      
      {/* Logo - Top Right */}
      <div className="fixed top-4 right-4 z-20">
        <div className="border-2 border-white rounded-none bg-gray-900 p-3">
          <Image 
            src="/images/polstrat-dark.png" 
            alt="Polmatch" 
            width={120} 
            height={45}
            className="max-w-full h-auto"
          />
        </div>
      </div>
      
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
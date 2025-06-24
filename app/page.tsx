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
    
    // Client-side validation
    if (password !== confirmPassword) {
      setLoginError('Passwords do not match');
      setLoading(false);
      return;
    }
    
    if (!username.trim()) {
      setLoginError('Username is required');
      setLoading(false);
      return;
    }
    
    try {
      const res = await protectedFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email, 
          username: username.trim(), 
          password, 
          confirmPassword
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setLoginError(data.message || 'Registration failed');
      } else {
        setUserType('User');
        // Redirect to frontpage after successful registration
        router.push('/frontpage');
      }
    } catch {
      setLoginError('Server error');
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
        className="fixed top-4 left-4 z-20 p-3 bg-black text-blue-400 border-2 border-blue-400 rounded-none hover:bg-blue-400 hover:text-black transition-all shadow-lg font-mono"
        title="Platform Information"
      >
        <FontAwesomeIcon icon={faQuestion} size="lg" />
      </button>
      {/* Animated Background Grid */}
      <div className="absolute inset-0 opacity-10">
        <div className="grid grid-cols-6 xs:grid-cols-8 sm:grid-cols-12 gap-px h-full">
          {Array.from({ length: 144 }).map((_, i) => (
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

      {/* Main Login Container */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-4 xs:p-6 sm:p-8">
        {/* FBI Header */}
        <div className="mb-6 sm:mb-12 text-center animate-pulse">
        </div>

        {/* Login Form Container */}
        <div className="bg-black border-2 border-white rounded-none shadow-2xl p-6 sm:p-8 w-full max-w-md relative">
          {/* Form Header */}
          <div className="border-b-2 border-white bg-white text-black p-2 sm:p-3 text-center mb-6 -mx-6 sm:-mx-8 -mt-6 sm:-mt-8">
            <div className="text-base sm:text-lg font-bold tracking-widest uppercase">
              {isRegistering ? 'User Registration' : 'polmatch messenger'}
            </div>
          </div>

          {/* Pulsing Status Indicator */}
          <div className="flex items-center justify-center mb-4 sm:mb-6">
            <div className="w-2 sm:w-3 h-2 sm:h-3 bg-green-400 rounded-full animate-pulse mr-2 sm:mr-3"></div>
            <div className="text-green-400 font-mono text-xs uppercase tracking-widest">SYSTEM ONLINE</div>
            <div className="w-2 sm:w-3 h-2 sm:h-3 bg-green-400 rounded-full animate-pulse ml-2 sm:ml-3"></div>
          </div>

          <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-4 sm:space-y-6">
            {/* Logo */}
            <div className="flex justify-center mb-6 sm:mb-8">
              <div className="border-2 border-white rounded-none p-3 sm:p-4 bg-gray-900">
                <Image 
                  src="/images/polstrat-dark.png" 
                  alt="POLMATCH MESSENGER" 
                  className="max-w-full h-auto" 
                  width={160} 
                  height={60} 
                  style={{
                    width: '100%',
                    maxWidth: '200px',
                    height: 'auto',
                  }}
                />
              </div>
            </div>

            {/* Registration Fields */}
            {isRegistering && (
              <>
                <div>
                  <label className="block text-xs sm:text-sm font-mono font-medium mb-1 sm:mb-2 uppercase tracking-wider text-gray-300">
                    Username
                  </label>
                  <input
                    type="text"
                    placeholder="[ENTER USERNAME]"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full p-3 sm:p-4 bg-black text-white border-2 border-white rounded-none focus:outline-none focus:border-green-400 font-mono shadow-lg transition-colors"
                    disabled={loading}
                    required
                  />
                </div>
              </>
            )}

            {/* Email Field */}
            <div>
              <label className="block text-xs sm:text-sm font-mono font-medium mb-1 sm:mb-2 uppercase tracking-wider text-gray-300">
                Email Address
              </label>
              <input
                type="text"
                placeholder="[ENTER EMAIL]"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 sm:p-4 bg-black text-white border-2 border-white rounded-none focus:outline-none focus:border-green-400 font-mono shadow-lg transition-colors"
                disabled={loading}
                required
              />
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-xs sm:text-sm font-mono font-medium mb-1 sm:mb-2 uppercase tracking-wider text-gray-300">
                Password
              </label>
              <input
                type="password"
                placeholder="[ENTER PASSWORD]"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 sm:p-4 bg-black text-white border-2 border-white rounded-none focus:outline-none focus:border-green-400 font-mono shadow-lg transition-colors"
                disabled={loading}
                required
              />
              {isRegistering && (
                <p className="text-xs text-gray-400 font-mono mt-1">
                  Must contain at least 6 characters, 1 number, and 1 special character
                </p>
              )}
            </div>

            {/* Confirm Password Field (Registration Only) */}
            {isRegistering && (
              <div>
                <label className="block text-xs sm:text-sm font-mono font-medium mb-1 sm:mb-2 uppercase tracking-wider text-gray-300">
                  Confirm Password
                </label>
                <input
                  type="password"
                  placeholder="[CONFIRM PASSWORD]"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full p-3 sm:p-4 bg-black text-white border-2 border-white rounded-none focus:outline-none focus:border-green-400 font-mono shadow-lg transition-colors"
                  disabled={loading}
                  required
                />
              </div>
            )}

            {/* 2FA Code Field (Login Only, when required) */}
            {!isRegistering && requires2FA && (
              <div>
                <label className="block text-xs sm:text-sm font-mono font-medium mb-1 sm:mb-2 uppercase tracking-wider text-gray-300">
                  Two-Factor Code
                </label>
                <input
                  type="text"
                  placeholder="[ENTER 6-DIGIT CODE]"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full p-3 sm:p-4 bg-black text-white border-2 border-white rounded-none focus:outline-none focus:border-green-400 font-mono shadow-lg transition-colors text-center tracking-widest"
                  disabled={loading}
                  maxLength={6}
                  required
                />
                <p className="text-xs text-gray-400 font-mono mt-1">
                  Enter the 6-digit code from your authenticator app
                </p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className={`w-full p-3 sm:p-4 font-mono uppercase tracking-wider font-bold border-2 rounded-none shadow-lg transition-all text-xs sm:text-base ${
                loading 
                  ? 'bg-yellow-600 border-yellow-400 text-black animate-pulse cursor-not-allowed' 
                  : 'bg-white text-black border-white hover:bg-green-400 hover:border-green-400 hover:text-black'
              }`}
              disabled={loading}
            >
              {loading 
                ? (isRegistering ? 'CREATING ACCOUNT...' : 'LOGGING IN...') 
                : (isRegistering ? 'CREATE ACCOUNT' : 'LOGIN')
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
                className="text-green-400 font-mono text-xs sm:text-sm uppercase tracking-wider hover:text-white transition-colors underline"
                disabled={loading}
              >
                {isRegistering ? '← Back to Login' : 'Create New Account →'}
              </button>
            </div>

            {/* Error Display */}
            {loginError && (
              <div className="bg-red-900 border-2 border-red-400 text-red-100 p-2 sm:p-3 text-center font-mono animate-pulse">
                <div className="text-xs uppercase tracking-wider mb-1">⚠ ERROR ⚠</div>
                <div className="text-xs sm:text-sm">{loginError.toUpperCase()}</div>
              </div>
            )}

            {/* Success Display */}
            {userType && (
              <div className="bg-green-900 border-2 border-green-400 text-green-100 p-2 sm:p-3 text-center font-mono animate-pulse">
                <div className="text-xs uppercase tracking-wider mb-1">✓ {isRegistering ? 'ACCOUNT CREATED' : 'LOGIN SUCCESSFUL'} ✓</div>
                <div className="text-xs sm:text-sm">{isRegistering ? 'WELCOME TO POLMATCH' : `AUTHENTICATED AS: ${userType.toUpperCase()}`}</div>
              </div>
            )}
          </form>

          {/* Security Footer */}
          <div className="mt-6 sm:mt-8 pt-3 sm:pt-4 border-t border-gray-600">
            <div className="text-center">
              <div className="text-xs text-gray-500 font-mono uppercase tracking-widest mb-2">
                ENCRYPTION: AES-256 | STATUS: SECURE
              </div>
              <div className="flex flex-wrap items-center justify-center space-x-1 sm:space-x-2 text-xs text-gray-400 font-mono">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span>FEDERAL MONITORING ACTIVE</span>
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Logout Button (if logged in) */}
        {isLoggedIn && (
          <button
            className="mt-6 sm:mt-8 p-3 sm:p-4 bg-red-900 text-red-100 border-2 border-red-500 rounded-none hover:bg-red-800 transition-colors font-mono uppercase tracking-wider text-xs sm:text-base shadow-lg"
            onClick={handleLogout}
          >
            TERMINATE SESSION
          </button>
        )}

        {/* Bottom Warning */}
        <div className="mt-8 sm:mt-12 text-center max-w-md px-2">
          <div className="text-xs text-gray-500 font-mono uppercase tracking-widest">
            ⚠ UNAUTHORIZED ACCESS IS PROHIBITED ⚠
          </div>
          <div className="text-xs text-gray-600 font-mono mt-2">
            ALL ACTIVITIES ARE MONITORED AND LOGGED
          </div>
        </div>
      </div>

      {/* Info Modal */}
      <InfoModal 
        isOpen={showInfoModal} 
        onClose={() => setShowInfoModal(false)} 
      />

      {/* Custom CSS for animations */}
      <style jsx>{`
        @keyframes scanline {
          0% { transform: translateY(-100vh); }
          100% { transform: translateY(100vh); }
        }
      `}</style>
    </div>
  );
}
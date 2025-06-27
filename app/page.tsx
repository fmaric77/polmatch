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
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 relative overflow-hidden">
      {/* Epic Lightning Storm Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Main Lightning Bolts */}
        <div className="lightning-bolt lightning-1">
          <div className="lightning-branch branch-1"></div>
          <div className="lightning-branch branch-2"></div>
        </div>
        <div className="lightning-bolt lightning-2">
          <div className="lightning-branch branch-3"></div>
        </div>
        <div className="lightning-bolt lightning-3">
          <div className="lightning-branch branch-4"></div>
          <div className="lightning-branch branch-5"></div>
          <div className="lightning-branch branch-6"></div>
        </div>
        <div className="lightning-bolt lightning-4">
          <div className="lightning-branch branch-7"></div>
        </div>
        <div className="lightning-bolt lightning-5">
          <div className="lightning-branch branch-8"></div>
          <div className="lightning-branch branch-9"></div>
        </div>
        <div className="lightning-bolt lightning-6">
          <div className="lightning-branch branch-10"></div>
        </div>
        
        {/* Electric Sparks */}
        <div className="electric-sparks">
          <div className="spark spark-1"></div>
          <div className="spark spark-2"></div>
          <div className="spark spark-3"></div>
          <div className="spark spark-4"></div>
          <div className="spark spark-5"></div>
          <div className="spark spark-6"></div>
          <div className="spark spark-7"></div>
          <div className="spark spark-8"></div>
        </div>
        
        {/* Storm Clouds */}
        <div className="storm-clouds">
          <div className="cloud cloud-1"></div>
          <div className="cloud cloud-2"></div>
          <div className="cloud cloud-3"></div>
        </div>
        
        {/* Chain Lightning */}
        <div className="chain-lightning chain-1"></div>
        <div className="chain-lightning chain-2"></div>
      </div>
      
      {/* Rain Effect */}
      <div className="rain-container absolute inset-0 pointer-events-none">
        <div className="rain-drop rain-1"></div>
        <div className="rain-drop rain-2"></div>
        <div className="rain-drop rain-3"></div>
        <div className="rain-drop rain-4"></div>
        <div className="rain-drop rain-5"></div>
        <div className="rain-drop rain-6"></div>
        <div className="rain-drop rain-7"></div>
        <div className="rain-drop rain-8"></div>
        <div className="rain-drop rain-9"></div>
        <div className="rain-drop rain-10"></div>
      </div>

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
      
      {/* Epic Lightning Storm CSS */}
      <style jsx>{`
        /* Main Lightning Bolts */
        .lightning-bolt {
          position: absolute;
          opacity: 0;
          background: linear-gradient(0deg, 
            transparent 0%, 
            rgba(135,206,250,0.3) 10%, 
            rgba(255,255,255,1) 50%, 
            rgba(135,206,250,0.3) 90%, 
            transparent 100%
          );
          filter: drop-shadow(0 0 40px rgba(135,206,250,1)) 
                  drop-shadow(0 0 80px rgba(255,255,255,0.9))
                  drop-shadow(0 0 120px rgba(135,206,250,0.7));
          z-index: 1;
        }
        
        /* Lightning Branches - Realistic forking */
        .lightning-branch {
          position: absolute;
          opacity: 0;
          background: linear-gradient(45deg, 
            transparent 0%, 
            rgba(255,255,255,0.8) 50%, 
            transparent 100%
          );
          filter: drop-shadow(0 0 20px rgba(135,206,250,0.8));
        }
        
        /* Branch positioning */
        .branch-1 { top: 20%; left: -15px; width: 30px; height: 3px; transform: rotate(45deg); }
        .branch-2 { top: 60%; left: 10px; width: 25px; height: 2px; transform: rotate(-30deg); }
        .branch-3 { top: 30%; left: -20px; width: 35px; height: 4px; transform: rotate(60deg); }
        .branch-4 { top: 15%; left: 5px; width: 20px; height: 2px; transform: rotate(-45deg); }
        .branch-5 { top: 45%; left: -10px; width: 28px; height: 3px; transform: rotate(30deg); }
        .branch-6 { top: 70%; left: 8px; width: 22px; height: 2px; transform: rotate(-60deg); }
        .branch-7 { top: 35%; left: -12px; width: 26px; height: 3px; transform: rotate(50deg); }
        .branch-8 { top: 25%; left: 6px; width: 32px; height: 4px; transform: rotate(-40deg); }
        .branch-9 { top: 55%; left: -8px; width: 24px; height: 2px; transform: rotate(35deg); }
        .branch-10 { top: 40%; left: -15px; width: 30px; height: 3px; transform: rotate(55deg); }
        
        /* Electric Sparks */
        .spark {
          position: absolute;
          width: 4px;
          height: 4px;
          background: radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(135,206,250,0.8) 50%, transparent 100%);
          border-radius: 50%;
          opacity: 0;
          filter: drop-shadow(0 0 15px rgba(135,206,250,1));
        }
        
        .spark-1 { top: 10%; left: 20%; animation: spark-dance 2s infinite 0.3s; }
        .spark-2 { top: 80%; left: 45%; animation: spark-dance 1.8s infinite 1.1s; }
        .spark-3 { top: 30%; left: 70%; animation: spark-dance 2.2s infinite 0.7s; }
        .spark-4 { top: 60%; left: 15%; animation: spark-dance 1.5s infinite 1.8s; }
        .spark-5 { top: 25%; left: 85%; animation: spark-dance 2.5s infinite 0.9s; }
        .spark-6 { top: 75%; left: 30%; animation: spark-dance 1.9s infinite 1.4s; }
        .spark-7 { top: 45%; left: 60%; animation: spark-dance 2.1s infinite 0.5s; }
        .spark-8 { top: 90%; left: 80%; animation: spark-dance 1.7s infinite 1.6s; }
        
        /* Storm Clouds */
        .cloud {
          position: absolute;
          background: radial-gradient(ellipse, rgba(50,50,80,0.3) 0%, transparent 70%);
          border-radius: 50%;
          opacity: 0.6;
          animation: cloud-drift 20s linear infinite;
        }
        
        .cloud-1 { top: 5%; left: -100px; width: 200px; height: 80px; animation-delay: 0s; }
        .cloud-2 { top: 8%; left: -150px; width: 250px; height: 100px; animation-delay: -7s; }
        .cloud-3 { top: 12%; left: -120px; width: 180px; height: 70px; animation-delay: -14s; }
        
        /* Chain Lightning */
        .chain-lightning {
          position: absolute;
          opacity: 0;
          background: linear-gradient(45deg, 
            transparent 0%, 
            rgba(255,255,255,0.9) 20%, 
            transparent 40%,
            rgba(135,206,250,0.8) 60%,
            transparent 80%,
            rgba(255,255,255,0.9) 100%
          );
          filter: drop-shadow(0 0 25px rgba(135,206,250,0.9));
        }
        
        .chain-1 {
          top: 20%;
          left: 25%;
          width: 300px;
          height: 3px;
          transform: rotate(15deg);
          animation: chain-flash 4s infinite 1.5s;
        }
        
        .chain-2 {
          top: 60%;
          left: 50%;
          width: 250px;
          height: 2px;
          transform: rotate(-25deg);
          animation: chain-flash 3.5s infinite 2.8s;
        }
        
        /* Rain */
        .rain-drop {
          position: absolute;
          width: 2px;
          height: 20px;
          background: linear-gradient(to bottom, transparent, rgba(135,206,250,0.3), transparent);
          animation: rain-fall 1s linear infinite;
        }
        
        .rain-1 { left: 10%; animation-delay: 0s; }
        .rain-2 { left: 20%; animation-delay: 0.1s; }
        .rain-3 { left: 30%; animation-delay: 0.2s; }
        .rain-4 { left: 40%; animation-delay: 0.3s; }
        .rain-5 { left: 50%; animation-delay: 0.4s; }
        .rain-6 { left: 60%; animation-delay: 0.5s; }
        .rain-7 { left: 70%; animation-delay: 0.6s; }
        .rain-8 { left: 80%; animation-delay: 0.7s; }
        .rain-9 { left: 90%; animation-delay: 0.8s; }
        .rain-10 { left: 95%; animation-delay: 0.9s; }
        
        /* Lightning positioning and timing */
        .lightning-1 {
          left: 15%; top: 0; width: 10px; height: 100vh; transform: rotate(2deg);
          animation: epic-lightning-strike 3s infinite;
        }
        .lightning-2 {
          left: 35%; top: 0; width: 14px; height: 100vh; transform: rotate(-3deg);
          animation: epic-lightning-strike 2.5s infinite 1.2s;
        }
        .lightning-3 {
          left: 55%; top: 0; width: 8px; height: 100vh; transform: rotate(1deg);
          animation: epic-lightning-strike 4s infinite 2.8s;
        }
        .lightning-4 {
          left: 75%; top: 0; width: 12px; height: 100vh; transform: rotate(-2deg);
          animation: epic-lightning-strike 2.2s infinite 0.8s;
        }
        .lightning-5 {
          left: 25%; top: 0; width: 16px; height: 100vh; transform: rotate(4deg);
          animation: epic-lightning-strike 5s infinite 4.1s;
        }
        .lightning-6 {
          left: 85%; top: 0; width: 10px; height: 100vh; transform: rotate(-1deg);
          animation: epic-lightning-strike 3.5s infinite 1.9s;
        }
        
        /* EPIC ANIMATIONS */
        @keyframes epic-lightning-strike {
          0%, 88% { opacity: 0; }
          90% { opacity: 0.6; }
          91% { opacity: 1; }
          92% { opacity: 0.3; }
          93% { opacity: 0.9; }
          94% { opacity: 0.1; }
          95% { opacity: 1; }
          96% { opacity: 0.2; }
          97% { opacity: 0.8; }
          98% { opacity: 0; }
          100% { opacity: 0; }
        }
        
        @keyframes spark-dance {
          0%, 85% { opacity: 0; transform: scale(0) rotate(0deg); }
          90% { opacity: 1; transform: scale(1.5) rotate(180deg); }
          95% { opacity: 0.3; transform: scale(0.8) rotate(360deg); }
          100% { opacity: 0; transform: scale(0) rotate(540deg); }
        }
        
        @keyframes cloud-drift {
          0% { transform: translateX(0); }
          100% { transform: translateX(100vw); }
        }
        
        @keyframes chain-flash {
          0%, 90% { opacity: 0; transform: scaleX(0); }
          92% { opacity: 1; transform: scaleX(1); }
          94% { opacity: 0.4; transform: scaleX(0.8); }
          96% { opacity: 1; transform: scaleX(1); }
          98% { opacity: 0; transform: scaleX(0); }
        }
        
        @keyframes rain-fall {
          0% { top: -20px; opacity: 0; }
          10% { opacity: 0.5; }
          90% { opacity: 0.3; }
          100% { top: 100vh; opacity: 0; }
        }
        
        /* UI Electromagnetic Interference Effects */
        .lightning-1:before {
          content: '';
          position: fixed;
          top: 0; left: 0;
          width: 100vw; height: 100vh;
          background: radial-gradient(circle at 20% 40%, rgba(135,206,250,0.1) 0%, transparent 50%);
          opacity: 0;
          pointer-events: none;
          animation: electromagnetic-pulse 3s infinite;
          z-index: 0;
        }
        
        .lightning-3:before {
          content: '';
          position: fixed;
          top: 0; left: 0;
          width: 100vw; height: 100vh;
          background: radial-gradient(circle at 60% 30%, rgba(255,255,255,0.08) 0%, transparent 60%);
          opacity: 0;
          pointer-events: none;
          animation: electromagnetic-pulse 4s infinite 2.8s;
          z-index: 0;
        }
        
        @keyframes electromagnetic-pulse {
          0%, 90% { opacity: 0; }
          91% { opacity: 1; }
          92% { opacity: 0.3; }
          93% { opacity: 0.8; }
          94% { opacity: 0.1; }
          95% { opacity: 0.6; }
          96% { opacity: 0; }
        }
        
        /* Lightning branches inherit parent timing */
        .lightning-bolt .lightning-branch {
          animation: branch-flash 3s infinite;
        }
        .lightning-2 .lightning-branch { animation-delay: 1.2s; }
        .lightning-3 .lightning-branch { animation-delay: 2.8s; }
        .lightning-4 .lightning-branch { animation-delay: 0.8s; }
        .lightning-5 .lightning-branch { animation-delay: 4.1s; }
        .lightning-6 .lightning-branch { animation-delay: 1.9s; }
        
        @keyframes branch-flash {
          0%, 90% { opacity: 0; }
          91% { opacity: 0.8; }
          92% { opacity: 0.2; }
          93% { opacity: 0.9; }
          94% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
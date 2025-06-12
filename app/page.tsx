"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Image from "next/image";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [userType, setUserType] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

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
        <div className="animate-pulse">AUTHENTICATING SESSION STATUS...</div>
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
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!data.success) {
        setLoginError(data.message || 'Login failed');
      } else {
        if (data.user.is_superadmin) setUserType('Superadmin');
        else if (data.user.is_admin) setUserType('Admin');
        else setUserType('User');
        // Redirect to frontpage after successful login
        router.push('/frontpage');
      }
    } catch {
      setLoginError('Server error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 min-h-screen bg-black text-white font-mono overflow-hidden">
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
          <div className="text-red-500 text-xs font-mono uppercase tracking-widest mb-2 animate-pulse">CLASSIFIED ACCESS TERMINAL</div>
          <div className="w-12 sm:w-16 h-px bg-white mx-auto mb-3 sm:mb-4"></div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-widest uppercase text-white animate-pulse">POLMATCH</h1>
          <h2 className="text-xl sm:text-2xl font-bold tracking-widest uppercase text-white">MESSINGER</h2>
          <div className="w-12 sm:w-16 h-px bg-white mx-auto mt-3 sm:mt-4"></div>
          <div className="text-green-400 text-xs font-mono uppercase tracking-widest mt-2">SECURITY CLEARANCE REQUIRED</div>
        </div>

        {/* Login Form Container */}
        <div className="bg-black border-2 border-white rounded-none shadow-2xl p-6 sm:p-8 w-full max-w-md relative">
          {/* Form Header */}
          <div className="border-b-2 border-white bg-white text-black p-2 sm:p-3 text-center mb-6 -mx-6 sm:-mx-8 -mt-6 sm:-mt-8">
            <div className="font-mono text-xs font-bold tracking-widest uppercase">RESTRICTED ACCESS</div>
            <div className="text-base sm:text-lg font-bold tracking-widest uppercase">AGENT AUTHENTICATION</div>
            <div className="font-mono text-xs tracking-widest uppercase">CLEARANCE LEVEL: GAMMA</div>
          </div>

          {/* Pulsing Status Indicator */}
          <div className="flex items-center justify-center mb-4 sm:mb-6">
            <div className="w-2 sm:w-3 h-2 sm:h-3 bg-green-400 rounded-full animate-pulse mr-2 sm:mr-3"></div>
            <div className="text-green-400 font-mono text-xs uppercase tracking-widest">TERMINAL ACTIVE</div>
            <div className="w-2 sm:w-3 h-2 sm:h-3 bg-green-400 rounded-full animate-pulse ml-2 sm:ml-3"></div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 sm:space-y-6">
            {/* Logo */}
            <div className="flex justify-center mb-6 sm:mb-8">
              <div className="border-2 border-white rounded-none p-3 sm:p-4 bg-gray-900">
                <Image 
                  src="/images/polstrat-dark.png" 
                  alt="POLMATCH FEDERAL SYSTEM" 
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

            {/* Email Field */}
            <div>
              <label className="block text-xs sm:text-sm font-mono font-medium mb-1 sm:mb-2 uppercase tracking-wider text-gray-300">
                AGENT IDENTIFICATION
              </label>
              <input
                type="text"
                placeholder="[ENTER CLEARANCE EMAIL]"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 sm:p-4 bg-black text-white border-2 border-white rounded-none focus:outline-none focus:border-green-400 font-mono shadow-lg transition-colors"
                disabled={loading}
              />
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-xs sm:text-sm font-mono font-medium mb-1 sm:mb-2 uppercase tracking-wider text-gray-300">
                SECURITY PASSPHRASE
              </label>
              <input
                type="password"
                placeholder="[ENTER CLASSIFIED CODE]"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 sm:p-4 bg-black text-white border-2 border-white rounded-none focus:outline-none focus:border-green-400 font-mono shadow-lg transition-colors"
                disabled={loading}
              />
            </div>

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
              {loading ? 'AUTHENTICATING AGENT...' : 'INITIATE SECURE ACCESS'}
            </button>

            {/* Error Display */}
            {loginError && (
              <div className="bg-red-900 border-2 border-red-400 text-red-100 p-2 sm:p-3 text-center font-mono animate-pulse">
                <div className="text-xs uppercase tracking-wider mb-1">⚠ ACCESS DENIED ⚠</div>
                <div className="text-xs sm:text-sm">{loginError.toUpperCase()}</div>
              </div>
            )}

            {/* Success Display */}
            {userType && (
              <div className="bg-green-900 border-2 border-green-400 text-green-100 p-2 sm:p-3 text-center font-mono animate-pulse">
                <div className="text-xs uppercase tracking-wider mb-1">✓ CLEARANCE VERIFIED ✓</div>
                <div className="text-xs sm:text-sm">AUTHENTICATED AS: {userType.toUpperCase()}</div>
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
            onClick={async () => {
              await fetch('/api/logout', { method: 'POST' });
              setIsLoggedIn(false);
              window.location.href = '/';
            }}
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
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
      <div className="fixed inset-0 min-h-screen min-w-full bg-black text-white flex items-center justify-center z-50">
        Checking session...
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
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white">
      <form onSubmit={handleLogin} className="flex flex-col gap-4 mt-4">
        <Image src="/images/polstrat-dark.png" alt="Polstrat Dark" className="max-w-full h-auto mb-4" width={240} height={90} />
        <input
          type="text"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="p-2 bg-black text-white border border-white rounded focus:outline-none"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="p-2 bg-black text-white border border-white rounded focus:outline-none"
        />
        <button
          type="submit"
          className="p-2 bg-white text-black rounded hover:bg-gray-200 transition-colors"
          disabled={loading}
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
        {loginError && <div className="text-red-400 text-center mt-2">{loginError}</div>}
        {userType && <div className="text-green-400 text-center mt-2">Logged in as: {userType}</div>}
      </form>
      {isLoggedIn && (
        <button
          className="mt-8 p-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          onClick={async () => {
            await fetch('/api/logout', { method: 'POST' });
            setIsLoggedIn(false);
            window.location.href = '/';
          }}
        >
          Logout
        </button>
      )}
    </div>
  );
}
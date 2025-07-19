"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCSRFToken } from '../../components/hooks/useCSRFToken';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faShieldAlt, faKey, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';

interface User {
  user_id: string;
  username: string;
  email: string;
  forced_by_admin?: string | null;
}

export default function SetupTwoFactor() {
  const [user, setUser] = useState<User | null>(null);
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'setup' | 'verify'>('setup');
  const router = useRouter();
  const { protectedFetch } = useCSRFToken();

  useEffect(() => {
    checkUserSession();
  }, []);

  const checkUserSession = async (): Promise<void> => {
    try {
      const res = await fetch('/api/session');
      const data = await res.json();
      if (!data.valid) {
        router.replace('/');
        return;
      }
      setUser(data.user);
    } catch (error) {
      console.error('Error checking session:', error);
      router.replace('/');
    }
  };

  const handleSetup2FA = async (): Promise<void> => {
    setIsLoading(true);
    setError('');

    try {
      const response = await protectedFetch('/api/auth/2fa/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to setup 2FA');
      }

      const data = await response.json();
      if (data.success) {
        setQrCode(data.qrCode);
        setSecret(data.manualEntryKey);
        setStep('verify');
      } else {
        setError(data.message || 'Failed to setup 2FA');
      }
    } catch (err) {
      setError('Failed to setup 2FA. Please try again.');
      console.error('2FA setup error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify2FA = async (): Promise<void> => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setIsVerifying(true);
    setError('');

    try {
      const response = await protectedFetch('/api/auth/2fa/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          code: verificationCode,
          forced: true 
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to verify 2FA');
      }

      const data = await response.json();
      if (data.success) {
        // Redirect to home page after successful setup
        router.replace('/');
      } else {
        setError(data.message || 'Invalid verification code');
      }
    } catch (err) {
      setError('Failed to verify 2FA code. Please try again.');
      console.error('2FA verification error:', err);
    } finally {
      setIsVerifying(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-mono">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <div className="bg-black border-2 border-red-400 rounded-none p-6 shadow-2xl">
            <div className="text-center mb-6">
              <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-400 text-4xl mb-4" />
              <h1 className="text-2xl font-bold text-red-400 uppercase tracking-wider mb-2">
                2FA Required
              </h1>
              <p className="text-gray-300 text-sm uppercase tracking-wide">
                {user.forced_by_admin 
                  ? 'Administrator has enforced 2FA for you'
                  : 'Administrator has enforced 2FA for all users'
                }
              </p>
            </div>

            {step === 'setup' && (
              <div className="space-y-6">
                <div className="bg-red-600/20 border border-red-400 rounded-none p-4">
                  <div className="flex items-center space-x-3 mb-2">
                    <FontAwesomeIcon icon={faShieldAlt} className="text-red-400" />
                    <span className="text-red-400 font-bold uppercase text-sm">Security Notice</span>
                  </div>
                  <p className="text-gray-300 text-sm">
                    You must enable Two-Factor Authentication to continue using this platform. 
                    This adds an extra layer of security to your account.
                  </p>
                </div>

                <div className="text-center">
                  <p className="text-gray-400 mb-4 text-sm uppercase tracking-wide">
                    Welcome, <span className="text-white font-bold">{user.username}</span>
                  </p>
                  <p className="text-gray-300 mb-6 text-sm">
                    Click the button below to begin setting up Two-Factor Authentication.
                  </p>
                  
                  <button
                    onClick={handleSetup2FA}
                    disabled={isLoading}
                    className="w-full bg-red-600 text-white px-6 py-3 rounded-none hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors font-bold uppercase tracking-wide"
                  >
                    {isLoading ? 'Setting Up...' : 'Setup 2FA Now'}
                  </button>
                </div>
              </div>
            )}

            {step === 'verify' && (
              <div className="space-y-6">
                <div className="text-center">
                  <FontAwesomeIcon icon={faKey} className="text-blue-400 text-3xl mb-4" />
                  <h2 className="text-xl font-bold text-blue-400 uppercase tracking-wider mb-4">
                    Scan QR Code
                  </h2>
                </div>

                <div className="bg-white p-4 rounded-none text-center">
                  {qrCode && <img src={qrCode} alt="2FA QR Code" className="mx-auto" />}
                </div>

                <div className="bg-black border border-gray-500 rounded-none p-4">
                  <p className="text-gray-400 text-xs uppercase tracking-wide mb-2">Manual Entry Code:</p>
                  <code className="text-green-400 text-sm break-all">{secret}</code>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-gray-400 text-sm uppercase tracking-wide mb-2">
                      Enter 6-digit verification code:
                    </label>
                    <input
                      type="text"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      className="w-full p-3 bg-black text-white border-2 border-white rounded-none focus:outline-none focus:border-blue-400 text-center text-lg tracking-widest"
                      maxLength={6}
                    />
                  </div>

                  <button
                    onClick={handleVerify2FA}
                    disabled={isVerifying || verificationCode.length !== 6}
                    className="w-full bg-green-600 text-white px-6 py-3 rounded-none hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors font-bold uppercase tracking-wide"
                  >
                    {isVerifying ? 'Verifying...' : 'Verify & Enable 2FA'}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="mt-4 bg-red-600/20 border border-red-400 rounded-none p-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-gray-700">
              <p className="text-gray-500 text-xs text-center uppercase tracking-wide">
                You cannot access the platform until 2FA is enabled
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

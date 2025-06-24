import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faShield, faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import { useCSRFToken } from './hooks/useCSRFToken';

interface TwoFactorSettingsProps {
  currentUser: {
    user_id: string;
    username: string;
    email: string;
    two_factor_enabled?: boolean;
  } | null;
}

const TwoFactorSettings: React.FC<TwoFactorSettingsProps> = ({ currentUser }) => {
  const { protectedFetch } = useCSRFToken();
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showSetup, setShowSetup] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [manualKey, setManualKey] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [showManualKey, setShowManualKey] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);

  useEffect(() => {
    if (currentUser?.two_factor_enabled) {
      setIsEnabled(true);
    }
  }, [currentUser]);

  const handleSetup2FA = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const response = await protectedFetch('/api/auth/2fa/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        setQrCode(data.qrCode);
        setManualKey(data.manualEntryKey); // Fixed: was data.manualKey
        setShowSetup(true);
      }
    } catch {
      setError('Failed to setup 2FA. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify2FA = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      const response = await protectedFetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verificationCode })
      });

      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        setSuccess('2FA has been successfully enabled!');
        setShowSetup(false);
        setQrCode('');
        setManualKey('');
        setVerificationCode('');
        // Refresh the page to update the UI
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch {
      setError('Failed to verify code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!disablePassword) {
      setError('Password is required to disable 2FA');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      const response = await protectedFetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: disablePassword })
      });

      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        setSuccess('2FA has been successfully disabled!');
        setShowDisableConfirm(false);
        setDisablePassword('');
        // Refresh the page to update the UI
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch {
      setError('Failed to disable 2FA. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelSetup = () => {
    setShowSetup(false);
    setQrCode('');
    setManualKey('');
    setVerificationCode('');
    setError('');
    setSuccess('');
  };

  const handleCancelDisable = () => {
    setShowDisableConfirm(false);
    setDisablePassword('');
    setError('');
  };

  return (
    <div className="bg-black/40 border border-white/30 rounded-lg p-6">
      <div className="flex items-center space-x-3 mb-6">
        <FontAwesomeIcon icon={faShield} className="text-white text-xl" />
        <h2 className="text-xl font-semibold text-white">Two-Factor Authentication</h2>
      </div>

      <div className="mb-4">
        <p className="text-gray-300 text-sm mb-4">
          Add an extra layer of security to your account by requiring a code from your authenticator app when signing in.
        </p>
        
        <div className="flex items-center space-x-3 mb-4">
          <div className={`w-3 h-3 rounded-full ${isEnabled ? 'bg-green-500' : 'bg-gray-500'}`}></div>
          <span className="text-white font-medium">
            2FA is {isEnabled ? 'enabled' : 'disabled'}
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-400/50 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-900/20 border border-green-400/50 rounded-lg text-green-400 text-sm">
          {success}
        </div>
      )}

      {!isEnabled && !showSetup && (
        <div>
          <p className="text-gray-400 text-sm mb-4">
            Use an authenticator app like Google Authenticator, Microsoft Authenticator, or Authy to generate verification codes.
          </p>
          <button
            onClick={handleSetup2FA}
            disabled={isLoading}
            className="bg-white text-black px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Setting up...' : 'Enable 2FA'}
          </button>
        </div>
      )}

      {showSetup && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Setup Two-Factor Authentication</h3>
            
            <div className="space-y-4">
              <div>
                <p className="text-gray-300 text-sm mb-3">
                  1. Scan this QR code with your authenticator app:
                </p>
                {qrCode && (
                  <div className="bg-white p-4 rounded-lg inline-block">
                    <Image src={qrCode} alt="2FA QR Code" width={192} height={192} />
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-gray-300 text-sm">
                    2. Or enter this key manually:
                  </p>
                  <button
                    onClick={() => setShowManualKey(!showManualKey)}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <FontAwesomeIcon icon={showManualKey ? faEyeSlash : faEye} />
                  </button>
                </div>
                {showManualKey && (
                  <div className="bg-gray-800 p-3 rounded-lg border border-white/30">
                    <code className="text-white text-sm font-mono break-all">{manualKey}</code>
                  </div>
                )}
              </div>

              <div>
                <p className="text-gray-300 text-sm mb-2">
                  3. Enter the 6-digit code from your app to verify:
                </p>
                <div className="flex space-x-3">
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="bg-black text-white border border-white/30 rounded-lg px-3 py-2 text-center font-mono text-lg tracking-widest focus:outline-none focus:border-white/60"
                    maxLength={6}
                  />
                  <button
                    onClick={handleVerify2FA}
                    disabled={isLoading || verificationCode.length !== 6}
                    className="bg-white text-black px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Verifying...' : 'Verify & Enable'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={handleCancelSetup}
              className="bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-600 hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {isEnabled && !showDisableConfirm && (
        <div>
          <div className="bg-green-900/20 border border-green-400/50 rounded-lg p-4 mb-4">
            <div className="flex items-center space-x-2 mb-2">
              <FontAwesomeIcon icon={faShield} className="text-green-400" />
              <span className="text-green-400 font-medium">2FA is active</span>
            </div>
            <p className="text-gray-300 text-sm">
              Your account is protected with two-factor authentication. You&apos;ll need to enter a code from your authenticator app when signing in.
            </p>
          </div>
          
          <button
            onClick={() => setShowDisableConfirm(true)}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            Disable 2FA
          </button>
        </div>
      )}

      {showDisableConfirm && (
        <div className="space-y-4">
          <div className="bg-red-900/20 border border-red-400/50 rounded-lg p-4">
            <h3 className="text-red-400 font-semibold mb-2">Disable Two-Factor Authentication</h3>
            <p className="text-gray-300 text-sm mb-4">
              This will remove the extra security layer from your account. Enter your password to confirm.
            </p>
            
            <div className="space-y-3">
              <input
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full bg-black text-white border border-white/30 rounded-lg px-3 py-2 focus:outline-none focus:border-white/60"
              />
              
              <div className="flex space-x-3">
                <button
                  onClick={handleDisable2FA}
                  disabled={isLoading || !disablePassword}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Disabling...' : 'Confirm Disable'}
                </button>
                <button
                  onClick={handleCancelDisable}
                  className="bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-600 hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TwoFactorSettings; 
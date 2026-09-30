import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Lock, Shield, Fingerprint, KeyRound } from 'lucide-react';
import { PinKeypad } from '../components/common/UIComponents';
import { PinRecoveryModal } from '../components/auth/PinRecoveryModal';
import { AppLogo } from '../components/common/AppLogo';
import { useAuth } from '../context/AuthContext';

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 1000;

export const LoginPinView: React.FC<{
  onUnlock: (pin: string) => Promise<boolean>;
}> = ({ onUnlock }) => {
  const { biometricsEnrolled, unlockWithBiometrics } = useAuth();

  const [pin, setPin] = useState<string>('');
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [lockoutExpiry, setLockoutExpiry] = useState<number>(0);
  const [now, setNow] = useState<number>(Date.now());
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [isBioVerifying, setIsBioVerifying] = useState<boolean>(false);
  const [bioError, setBioError] = useState<string | null>(null);
  const [isRecoveryOpen, setIsRecoveryOpen] = useState<boolean>(false);

  const autoBioAttemptedRef = useRef<boolean>(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  const isLockedOut = lockoutExpiry > now;
  const lockoutSecondsRemaining = Math.ceil((lockoutExpiry - now) / 1000);

  // Trigger biometric unlock
  const handleBiometricUnlock = useCallback(async () => {
    if (isLockedOut || isBioVerifying || isVerifying || !biometricsEnrolled) return;
    setBioError(null);
    setIsBioVerifying(true);

    try {
      const res = await unlockWithBiometrics();
      if (!res.success) {
        if (res.error && !res.error.toLowerCase().includes('cancelled') && !res.error.toLowerCase().includes('dismissed')) {
          setBioError(`${res.error} — please enter your 6-digit PIN below.`);
        }
      }
    } catch (err: any) {
      setBioError(err.message || 'Biometric authentication failed');
    } finally {
      setIsBioVerifying(false);
    }
  }, [isLockedOut, isBioVerifying, isVerifying, biometricsEnrolled, unlockWithBiometrics]);

  // Auto-prompt biometrics once on mount if enrolled
  useEffect(() => {
    if (biometricsEnrolled && !autoBioAttemptedRef.current && !isLockedOut) {
      autoBioAttemptedRef.current = true;
      // Slight delay to ensure DOM and window context are active
      const timeout = setTimeout(() => {
        handleBiometricUnlock();
      }, 350);
      return () => clearTimeout(timeout);
    }
  }, [biometricsEnrolled, isLockedOut, handleBiometricUnlock]);

  // PIN entry validation
  useEffect(() => {
    if (pin.length === 6 && !isLockedOut && !isVerifying) {
      setIsVerifying(true);
      setBioError(null);
      onUnlock(pin).then(success => {
        if (!success) {
          const next = failedAttempts + 1;
          setFailedAttempts(next);
          setPin('');
          if (next >= MAX_ATTEMPTS) {
            setLockoutExpiry(Date.now() + LOCKOUT_DURATION_MS);
            setFailedAttempts(0);
          }
        }
        setIsVerifying(false);
      });
    }
  }, [pin, isLockedOut, isVerifying, onUnlock, failedAttempts]);

  return (
    <div className="flex-1 w-full min-h-full sm:min-h-screen flex flex-col items-center justify-center p-3 sm:p-4 bg-[#0F172A] overflow-hidden select-none">
      <div className="w-full max-w-[340px] sm:max-w-sm bg-[#1E293B] border border-slate-700/80 rounded-3xl p-4 sm:p-5 shadow-2xl flex flex-col justify-between my-auto transition-all overflow-hidden">
        {/* Header */}
        <div className="flex flex-col items-center text-center space-y-1.5 pt-0.5">
          <AppLogo size="md" />
          <h1 className="text-xl font-extrabold text-white">
            Pay<span className="text-indigo-400">Back</span>
          </h1>
          <p className="text-[11px] text-slate-400">
            {biometricsEnrolled
              ? 'Touch sensor or enter 6-digit master PIN'
              : 'Enter 6-digit master PIN to unlock'}
          </p>
        </div>

        {isLockedOut ? (
          <div className="text-center py-4 space-y-2.5">
            <div className="w-11 h-11 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
              <Lock size={20} />
            </div>
            <h3 className="text-sm font-bold text-white">Too many failed attempts</h3>
            <p className="text-xs text-slate-400">
              Please wait{' '}
              <span className="font-mono text-rose-400 font-bold">{lockoutSecondsRemaining}s</span>{' '}
              before trying again.
            </p>

            {/* Direct Recovery Trigger during Lockout */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsRecoveryOpen(true)}
                className="w-full min-h-[48px] p-3 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 hover:border-indigo-400 active:scale-98 transition flex items-center justify-center gap-2 text-xs font-bold text-indigo-300 shadow-sm"
              >
                <KeyRound size={16} />
                <span>Forgot PIN? Reset with Recovery</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {/* Quick Biometrics Action Banner if Enrolled */}
            {biometricsEnrolled && (
              <button
                type="button"
                onClick={handleBiometricUnlock}
                disabled={isBioVerifying || isVerifying}
                className="w-full min-h-[48px] py-2.5 px-3 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 hover:border-indigo-400 active:scale-98 transition flex items-center justify-center gap-2 text-xs font-bold text-indigo-300 shadow-sm m3-state-layer"
              >
                <div className={`w-6 h-6 rounded-lg bg-indigo-500/30 flex items-center justify-center ${isBioVerifying ? 'animate-pulse' : ''}`}>
                  <Fingerprint size={16} className="text-indigo-300" />
                </div>
                <span>
                  {isBioVerifying ? 'Verifying Biometrics...' : 'Unlock with Fingerprint / Face'}
                </span>
              </button>
            )}

            {bioError && (
              <p className="text-center text-[10px] text-amber-400 font-medium bg-amber-500/10 border border-amber-500/20 rounded-xl py-1 px-2">
                {bioError}
              </p>
            )}

            {/* PIN Keypad */}
            <PinKeypad
              value={pin}
              onChange={setPin}
              disabled={isVerifying || isBioVerifying}
              leftAction={
                biometricsEnrolled
                  ? {
                      icon: <Fingerprint size={18} className={isBioVerifying ? 'animate-spin' : ''} />,
                      label: 'Biometric Unlock',
                      onClick: handleBiometricUnlock,
                      disabled: isBioVerifying,
                    }
                  : undefined
              }
            />

            {failedAttempts > 0 && (
              <div className="space-y-1 text-center">
                <p className="text-[10px] text-rose-400 font-medium animate-shake">
                  Incorrect PIN — {MAX_ATTEMPTS - failedAttempts} attempt
                  {MAX_ATTEMPTS - failedAttempts === 1 ? '' : 's'} remaining
                </p>
                {failedAttempts >= 2 && (
                  <p className="text-[10px] text-indigo-300 font-medium">
                    Forgot your master PIN?{' '}
                    <button
                      type="button"
                      onClick={() => setIsRecoveryOpen(true)}
                      className="underline font-bold text-indigo-400 hover:text-indigo-200"
                    >
                      Reset it now
                    </button>
                  </p>
                )}
              </div>
            )}

            {/* Bottom Actions: Forgot PIN & Encryption Badge */}
            <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[11px]">
              <button
                type="button"
                onClick={() => setIsRecoveryOpen(true)}
                className="min-h-[48px] px-2 text-slate-400 hover:text-indigo-300 font-medium flex items-center gap-1.5 transition active:scale-95"
              >
                <KeyRound size={14} className="text-indigo-400" />
                <span>Forgot PIN?</span>
              </button>

              <div className="flex items-center gap-1 text-[10px] text-slate-500">
                <Shield size={11} className="text-indigo-400" />
                <span>AES-GCM 256</span>
              </div>
            </div>
          </div>
        )}

        {/* Pin Recovery Modal */}
        <PinRecoveryModal
          isOpen={isRecoveryOpen}
          onClose={() => setIsRecoveryOpen(false)}
          onSuccess={() => {
            setPin('');
            setFailedAttempts(0);
            setLockoutExpiry(0);
            setIsRecoveryOpen(false);
          }}
        />
      </div>
    </div>
  );
};

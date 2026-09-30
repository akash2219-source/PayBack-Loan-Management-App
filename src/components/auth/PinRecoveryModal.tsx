import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Mail,
  HelpCircle,
  KeyRound,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  X,
  Copy,
  Check,
  RefreshCw,
  Eye,
  EyeOff,
  Sparkles,
  AlertCircle,
  Lock,
} from 'lucide-react';
import { RecoveryService, maskEmail, StoredRecoveryData } from '../../utils/recovery';
import { COMMON_INPUT_CLASS, M3Button } from '../common/UIComponents';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

interface PinRecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newPin: string) => void;
}

export const PinRecoveryModal: React.FC<PinRecoveryModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { resetPinWithRecovery } = useAuth();
  const toast = useToast();

  const [recoveryData, setRecoveryData] = useState<StoredRecoveryData | null>(null);
  const [method, setMethod] = useState<'SELECT' | 'EMAIL' | 'QUESTION'>('SELECT');
  const [step, setStep] = useState<'VERIFY' | 'NEW_PIN' | 'CONFIRM_PIN' | 'DONE'>('VERIFY');

  // Email verification state
  const [emailInput, setEmailInput] = useState<string>('');
  const [emailOtpSent, setEmailOtpSent] = useState<boolean>(false);
  const [simulatedOtp, setSimulatedOtp] = useState<string>('');
  const [otpInput, setOtpInput] = useState<string>('');
  const [otpExpiry, setOtpExpiry] = useState<number>(0);
  const [copiedOtp, setCopiedOtp] = useState<boolean>(false);
  const [showSimulatedBanner, setShowSimulatedBanner] = useState<boolean>(false);

  // Security question state
  const [answerInput, setAnswerInput] = useState<string>('');
  const [showAnswer, setShowAnswer] = useState<boolean>(false);

  // New PIN state
  const [recoveredPin, setRecoveredPin] = useState<string>('');
  const [newPin, setNewPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load recovery data on open
  useEffect(() => {
    if (isOpen) {
      const data = RecoveryService.getStoredRecovery();
      setRecoveryData(data);
      setMethod('SELECT');
      setStep('VERIFY');
      setEmailInput('');
      setEmailOtpSent(false);
      setSimulatedOtp('');
      setOtpInput('');
      setAnswerInput('');
      setNewPin('');
      setConfirmPin('');
      setErrorMessage(null);
      setShowSimulatedBanner(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Generate and send a simulated OTP to the registered email
  const handleSendEmailOtp = async () => {
    setErrorMessage(null);
    if (!recoveryData) {
      setErrorMessage('No recovery email registered on this device.');
      return;
    }

    const check = await RecoveryService.verifyEmailMatch(emailInput);
    if (!check.success) {
      setErrorMessage(check.error || 'Email does not match registered address.');
      return;
    }

    // Generate random 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setSimulatedOtp(code);
    setOtpExpiry(Date.now() + 10 * 60 * 1000); // 10 minutes
    setEmailOtpSent(true);
    setShowSimulatedBanner(true);
    toast.push(`Verification code sent to ${maskEmail(recoveryData.recoveryEmail)}`, 'info');
  };

  // Verify entered OTP
  const handleVerifyOtp = async () => {
    setErrorMessage(null);
    if (!otpInput.trim()) {
      setErrorMessage('Please enter the 6-digit verification code.');
      return;
    }

    if (Date.now() > otpExpiry) {
      setErrorMessage('Verification code has expired. Please request a new code.');
      return;
    }

    if (otpInput.trim() !== simulatedOtp) {
      setErrorMessage('Incorrect verification code. Please check and try again.');
      return;
    }

    // Decrypt old PIN
    const res = await RecoveryService.decryptPinWithEmail();
    if (!res.success || !res.pin) {
      setErrorMessage(res.error || 'Failed to decrypt credentials with recovery email.');
      return;
    }

    setRecoveredPin(res.pin);
    setStep('NEW_PIN');
    toast.push('Identity confirmed via recovery email!', 'success');
  };

  // Verify Security Question
  const handleVerifyQuestion = async () => {
    setErrorMessage(null);
    if (!answerInput.trim()) {
      setErrorMessage('Please enter your security answer.');
      return;
    }

    const res = await RecoveryService.verifyQuestionAndGetPin(answerInput);
    if (!res.success || !res.pin) {
      setErrorMessage(res.error || 'Incorrect security answer.');
      return;
    }

    setRecoveredPin(res.pin);
    setStep('NEW_PIN');
    toast.push('Identity confirmed via security question!', 'success');
  };

  // Complete Reset with New PIN
  const handleApplyNewPin = async () => {
    if (newPin.length !== 6) {
      setErrorMessage('New PIN must be 6 digits.');
      return;
    }
    if (confirmPin !== newPin) {
      setErrorMessage('New PIN and confirmation PIN do not match.');
      return;
    }

    setIsResetting(true);
    setErrorMessage(null);

    try {
      const success = await resetPinWithRecovery(newPin, recoveredPin);
      if (success) {
        setStep('DONE');
        toast.push('Master PIN reset successfully! Your vault is unlocked.', 'success');
        setTimeout(() => {
          onSuccess(newPin);
          onClose();
        }, 1200);
      } else {
        setErrorMessage('Failed to re-encrypt vault with new PIN. Please try again.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error occurred while resetting PIN.');
    } finally {
      setIsResetting(false);
    }
  };

  const copySimulatedOtp = () => {
    navigator.clipboard.writeText(simulatedOtp);
    setCopiedOtp(true);
    setOtpInput(simulatedOtp);
    setTimeout(() => setCopiedOtp(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 select-none">
      <div className="bg-[#1E293B] border border-slate-700/80 rounded-3xl p-5 sm:p-6 max-w-sm w-full shadow-2xl space-y-4 animate-m3-slide-up relative overflow-hidden">
        {/* Modal Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3.5 top-3.5 w-12 h-12 min-w-[48px] min-h-[48px] rounded-full bg-slate-800/80 hover:bg-slate-700 active:scale-95 text-slate-400 hover:text-white flex items-center justify-center transition"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
            <KeyRound size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">PIN Reset & Recovery</h2>
            <p className="text-[11px] text-slate-400">Verify identity to establish a new master PIN</p>
          </div>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-start gap-2 animate-shake">
            <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-400" />
            <span className="leading-snug">{errorMessage}</span>
          </div>
        )}

        {/* STEP: SELECT RECOVERY METHOD */}
        {method === 'SELECT' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-300 leading-relaxed">
              Choose an authorized identity verification method to securely decrypt your vault and reset your PIN:
            </p>

            <div className="space-y-2.5 pt-1">
              {/* Option 1: Recovery Email */}
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setMethod('EMAIL');
                }}
                className="w-full p-3.5 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-indigo-500/50 active:scale-98 text-left transition flex items-center justify-between group shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Mail size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                      Registered Recovery Email
                    </h4>
                    <p className="text-[11px] text-slate-400 font-mono">
                      {recoveryData ? maskEmail(recoveryData.recoveryEmail) : 'akash.2219@gmail.com'}
                    </p>
                  </div>
                </div>
                <ArrowRight size={16} className="text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
              </button>

              {/* Option 2: Security Questions */}
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setMethod('QUESTION');
                }}
                className="w-full p-3.5 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-indigo-500/50 active:scale-98 text-left transition flex items-center justify-between group shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <HelpCircle size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white group-hover:text-purple-300 transition-colors">
                      Security Question
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Answer your personal security challenge
                    </p>
                  </div>
                </div>
                <ArrowRight size={16} className="text-slate-500 group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all" />
              </button>
            </div>

            <div className="pt-2 flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <ShieldAlert size={12} className="text-amber-400" />
                Zero-Knowledge AES Decryption
              </span>
              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-white transition min-h-[48px] px-3 flex items-center justify-center font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* METHOD 1: RECOVERY EMAIL FLOW */}
        {method === 'EMAIL' && step === 'VERIFY' && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setMethod('SELECT');
                  setErrorMessage(null);
                }}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold min-h-[48px] px-2"
              >
                <ArrowLeft size={16} />
                <span>Back</span>
              </button>
              <span className="text-[10px] text-slate-400 font-mono">Step 1 of 2</span>
            </div>

            {!emailOtpSent ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-300">
                  To confirm identity, type your full registered recovery email address:
                </p>

                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1 uppercase">
                    Registered Email Address
                  </label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="email"
                      className={`${COMMON_INPUT_CLASS} pl-9 text-xs font-mono`}
                      placeholder="e.g. yourname@example.com"
                      value={emailInput}
                      onChange={e => setEmailInput(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Hint: {recoveryData ? maskEmail(recoveryData.recoveryEmail) : 'Registered during setup'}
                  </p>
                </div>

                <M3Button
                  fullWidth
                  onClick={handleSendEmailOtp}
                  disabled={!emailInput.trim()}
                  icon={<Mail size={16} />}
                >
                  Send Verification Code
                </M3Button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Simulated Email Notification Card */}
                {showSimulatedBanner && (
                  <div className="p-3 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 space-y-2 animate-m3-fade-in shadow-inner">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-indigo-300">
                        <Mail size={13} />
                        <span>Security Code Sent</span>
                      </div>
                      <span className="text-[10px] text-indigo-400 font-mono">Valid 10m</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-snug">
                      A 6-digit recovery code was delivered to <span className="font-mono text-white">{maskEmail(recoveryData?.recoveryEmail || emailInput)}</span>.
                    </p>
                    <div className="flex items-center justify-between bg-slate-900/80 p-2 rounded-xl border border-indigo-500/30">
                      <span className="font-mono text-base font-black tracking-widest text-indigo-300 pl-1">
                        {simulatedOtp}
                      </span>
                      <button
                        type="button"
                        onClick={copySimulatedOtp}
                        className="px-4 py-2.5 min-h-[48px] rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 transition"
                      >
                        {copiedOtp ? <Check size={15} /> : <Copy size={15} />}
                        <span>{copiedOtp ? 'Copied' : 'Copy Code'}</span>
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1 uppercase">
                    Enter 6-Digit Code
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={otpInput}
                    onChange={e => setOtpInput(e.target.value.replace(/\D/g, ''))}
                    className={`${COMMON_INPUT_CLASS} font-mono text-center tracking-widest text-lg font-bold`}
                    placeholder="------"
                    autoFocus
                  />
                </div>

                <div className="flex gap-2">
                  <M3Button
                    variant="outlined"
                    fullWidth
                    onClick={handleSendEmailOtp}
                    icon={<RefreshCw size={14} />}
                  >
                    Resend Code
                  </M3Button>
                  <M3Button
                    fullWidth
                    onClick={handleVerifyOtp}
                    disabled={otpInput.length !== 6}
                    icon={<ArrowRight size={16} />}
                  >
                    Verify Code
                  </M3Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* METHOD 2: SECURITY QUESTIONS FLOW */}
        {method === 'QUESTION' && step === 'VERIFY' && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setMethod('SELECT');
                  setErrorMessage(null);
                }}
                className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 font-semibold min-h-[48px] px-2"
              >
                <ArrowLeft size={16} />
                <span>Back</span>
              </button>
              <span className="text-[10px] text-slate-400 font-mono">Step 1 of 2</span>
            </div>

            <div className="space-y-3">
              <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/25 space-y-1">
                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block">
                  Registered Security Question
                </span>
                <p className="text-xs font-semibold text-white leading-snug">
                  {recoveryData?.questionText || 'What was the name of your first school or college?'}
                </p>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1 uppercase">
                  Your Answer
                </label>
                <div className="relative">
                  <input
                    type={showAnswer ? 'text' : 'password'}
                    className={`${COMMON_INPUT_CLASS} pr-12 text-xs`}
                    placeholder="Type your secret answer"
                    value={answerInput}
                    onChange={e => setAnswerInput(e.target.value)}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowAnswer(!showAnswer)}
                    className="w-12 h-12 min-w-[48px] min-h-[48px] flex items-center justify-center absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition"
                    aria-label="Toggle answer visibility"
                  >
                    {showAnswer ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Answers are case-insensitive and encrypted with PBKDF2 salt.
                </p>
              </div>

              <M3Button
                fullWidth
                onClick={handleVerifyQuestion}
                disabled={!answerInput.trim()}
                icon={<ArrowRight size={16} />}
              >
                Verify Answer
              </M3Button>
            </div>
          </div>
        )}

        {/* STEP 2: CREATE NEW PIN */}
        {step === 'NEW_PIN' && (
          <div className="space-y-3.5">
            <div className="text-center space-y-1">
              <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 size={20} />
              </div>
              <h3 className="text-sm font-bold text-white">Identity Verified</h3>
              <p className="text-xs text-slate-400">Enter a new 6-digit master PIN for your vault</p>
            </div>

            <div className="space-y-2.5">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1 uppercase">
                  New 6-Digit PIN
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={newPin}
                  onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                  className={`${COMMON_INPUT_CLASS} font-mono text-center tracking-widest text-base font-bold`}
                  placeholder="******"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1 uppercase">
                  Confirm New PIN
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={confirmPin}
                  onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  className={`${COMMON_INPUT_CLASS} font-mono text-center tracking-widest text-base font-bold`}
                  placeholder="******"
                />
              </div>

              <div className="pt-2">
                <M3Button
                  fullWidth
                  onClick={handleApplyNewPin}
                  disabled={isResetting || newPin.length !== 6 || confirmPin.length !== 6}
                  icon={<Lock size={16} />}
                >
                  {isResetting ? 'Re-encrypting Vault...' : 'Save New PIN & Unlock'}
                </M3Button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: SUCCESS ANIMATION */}
        {step === 'DONE' && (
          <div className="text-center py-6 space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto animate-bounce">
              <Sparkles size={28} />
            </div>
            <h3 className="text-base font-bold text-white">Master PIN Updated!</h3>
            <p className="text-xs text-slate-400">
              Your lending ledger is now decrypted and unlocked with your new PIN.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

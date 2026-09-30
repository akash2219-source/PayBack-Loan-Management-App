import React, { useState } from 'react';
import {
  Shield,
  Globe,
  Bell,
  HardDrive,
  Lock,
  Save,
  CheckCircle2,
  ChevronRight,
  Trash2,
  Fingerprint,
  Sparkles,
  KeyRound,
  Mail,
  HelpCircle,
  Eye,
  EyeOff,
  RefreshCw,
  Users,
  Building2,
  ShieldCheck,
  CalendarClock,
  SlidersHorizontal,
  Settings,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';
import { useLanguage } from '../i18n/LanguageContext';
import { LANGUAGE_LABELS } from '../i18n/translations';
import { useToast } from '../context/ToastContext';
import { SupportedLanguage } from '../types';
import { ScreenHeader, COMMON_INPUT_CLASS, M3SegmentedButton, M3Button } from '../components/common/UIComponents';
import { PRESET_SECURITY_QUESTIONS, maskEmail } from '../utils/recovery';
import { PinRecoveryModal } from '../components/auth/PinRecoveryModal';

export const SettingsView: React.FC = () => {
  const {
    data,
    updateData,
    setPin,
    biometricsSupported,
    biometricsEnrolled,
    enrollBiometrics,
    disableBiometrics,
    unlockWithBiometrics,
    recoveryData,
    updateRecoverySettings,
  } = useAuth();
  const nav = useNavigation();
  const toast = useToast();
  const { language, setLanguage } = useLanguage();

  const [activeTab, setActiveTab] = useState<'profile' | 'language' | 'security'>('profile');

  const [businessName, setBusinessName] = useState(data.settings.businessName || '');
  const [ownerPhone, setOwnerPhone] = useState(data.settings.ownerPhone || '');
  const [address, setAddress] = useState(data.settings.address || '');
  const [upiId, setUpiId] = useState(data.settings.upiId || '');
  const [defaultPenalty, setDefaultPenalty] = useState(String(data.settings.defaultPenaltyPercent || 0));
  const [defaultGraceDays, setDefaultGraceDays] = useState(String(data.settings.defaultGracePeriodDays || 0));
  const [autoLockMins, setAutoLockMins] = useState(String(data.settings.autoLockTimeoutMinutes || 5));

  // Change PIN modal state
  const [showPinModal, setShowPinModal] = useState<boolean>(false);
  const [newPin, setNewPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');

  // Biometrics Enrollment modal state
  const [showBioModal, setShowBioModal] = useState<boolean>(false);
  const [bioPin, setBioPin] = useState<string>('');
  const [isEnrollingBio, setIsEnrollingBio] = useState<boolean>(false);
  const [isTestingBio, setIsTestingBio] = useState<boolean>(false);

  // Reset App modal state
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [resetConfirmText, setResetConfirmText] = useState<string>('');

  // Recovery settings modal state
  const [showRecoveryModal, setShowRecoveryModal] = useState<boolean>(false);
  const [showTestRecoveryModal, setShowTestRecoveryModal] = useState<boolean>(false);
  const [recoveryEmailInput, setRecoveryEmailInput] = useState<string>('');
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>('school');
  const [recoveryAnswerInput, setRecoveryAnswerInput] = useState<string>('');
  const [verifyPinInput, setVerifyPinInput] = useState<string>('');
  const [showRecoveryAnswer, setShowRecoveryAnswer] = useState<boolean>(false);
  const [isSavingRecovery, setIsSavingRecovery] = useState<boolean>(false);

  const handleOpenRecoveryModal = () => {
    setRecoveryEmailInput(recoveryData?.recoveryEmail || 'akash.2219@gmail.com');
    setSelectedQuestionId(recoveryData?.questionId || 'school');
    setRecoveryAnswerInput('');
    setVerifyPinInput('');
    setShowRecoveryAnswer(false);
    setShowRecoveryModal(true);
  };

  const handleSaveRecoverySettings = async () => {
    if (!recoveryEmailInput.trim() || !recoveryEmailInput.includes('@')) {
      toast.push('Please enter a valid recovery email address.', 'error');
      return;
    }
    if (!recoveryAnswerInput.trim()) {
      toast.push('Please provide an answer for your security question.', 'error');
      return;
    }
    if (verifyPinInput.length !== 6) {
      toast.push('Please enter your 6-digit master PIN to authorize changes.', 'error');
      return;
    }

    setIsSavingRecovery(true);
    const res = await updateRecoverySettings(
      recoveryEmailInput.trim(),
      selectedQuestionId,
      recoveryAnswerInput.trim(),
      undefined,
      verifyPinInput
    );
    setIsSavingRecovery(false);

    if (res.success) {
      toast.push('PIN recovery profile updated successfully!', 'success');
      setShowRecoveryModal(false);
    } else {
      toast.push(res.error || 'Failed to update recovery profile.', 'error');
    }
  };

  const handleSaveSettings = () => {
    updateData(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        businessName: businessName.trim(),
        ownerPhone: ownerPhone.trim(),
        address: address.trim(),
        upiId: upiId.trim(),
        defaultPenaltyPercent: Number(defaultPenalty) || 0,
        defaultGracePeriodDays: Number(defaultGraceDays) || 0,
        autoLockTimeoutMinutes: Number(autoLockMins) || 5,
      },
    }));
    toast.push('Settings saved successfully.', 'success');
  };

  const handleChangePin = async () => {
    if (newPin.length !== 6 || confirmPin.length !== 6) {
      toast.push('New PIN must be exactly 6 digits.', 'error');
      return;
    }
    if (newPin !== confirmPin) {
      toast.push('New PINs do not match.', 'error');
      return;
    }

    const success = await setPin(newPin);
    if (success) {
      toast.push('Master PIN changed successfully.', 'success');
      setShowPinModal(false);
      setNewPin('');
      setConfirmPin('');
    } else {
      toast.push('Failed to change PIN.', 'error');
    }
  };

  const handleEnrollBiometrics = async () => {
    if (bioPin.length !== 6) {
      toast.push('Please enter your 6-digit master PIN.', 'error');
      return;
    }
    setIsEnrollingBio(true);
    const res = await enrollBiometrics(bioPin);
    setIsEnrollingBio(false);

    if (res.success) {
      toast.push('Biometric authentication enabled successfully!', 'success');
      setShowBioModal(false);
      setBioPin('');
    } else {
      toast.push(res.error || 'Failed to enroll biometrics.', 'error');
    }
  };

  const handleTestBiometrics = async () => {
    setIsTestingBio(true);
    const res = await unlockWithBiometrics();
    setIsTestingBio(false);
    if (res.success) {
      toast.push('Biometric sensor verified successfully!', 'success');
    } else {
      toast.push(res.error || 'Biometric verification failed.', 'error');
    }
  };

  const handleToggleBiometrics = () => {
    if (biometricsEnrolled) {
      disableBiometrics();
      toast.push('Biometric authentication disabled.', 'info');
    } else {
      setBioPin('');
      setShowBioModal(true);
    }
  };

  const handleFullReset = () => {
    if (resetConfirmText !== 'RESET') {
      toast.push('Please type RESET in capital letters to confirm.', 'error');
      return;
    }
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
  };

  return (
    <div className="space-y-4 pb-20 animate-m3-fade-in">
      <ScreenHeader title="Settings" subtitle="Lending Preferences, Security Vault & Management Hub" />

      {/* Management & Tools Directory */}
      <div className="bg-[#1E293B]/80 border border-slate-700/80 rounded-3xl p-4 shadow-lg space-y-2.5">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-1">
          Management & Tools
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <button
            onClick={() => nav.push({ page: 'clients' })}
            className="p-3 min-h-[56px] rounded-2xl bg-[#0F172A] hover:bg-slate-800 border border-slate-700/60 flex items-center gap-2.5 text-left transition active:scale-95 group m3-state-layer min-w-0"
          >
            <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
              <Users size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white group-hover:text-indigo-300 truncate">Clients</p>
              <p className="text-[10px] text-slate-400 truncate">{(data.customers || []).length} on file</p>
            </div>
          </button>

          <button
            onClick={() => nav.push({ page: 'lenders' })}
            className="p-3 min-h-[56px] rounded-2xl bg-[#0F172A] hover:bg-slate-800 border border-slate-700/60 flex items-center gap-2.5 text-left transition active:scale-95 group m3-state-layer min-w-0"
          >
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
              <Building2 size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white group-hover:text-amber-300 truncate">Lenders</p>
              <p className="text-[10px] text-slate-400 truncate">{(data.lenders || []).length} recorded</p>
            </div>
          </button>

          <button
            onClick={() => nav.push({ page: 'collateralVault' })}
            className="p-3 min-h-[56px] rounded-2xl bg-[#0F172A] hover:bg-slate-800 border border-slate-700/60 flex items-center gap-2.5 text-left transition active:scale-95 group m3-state-layer min-w-0"
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white group-hover:text-emerald-300 truncate">Pawn Vault</p>
              <p className="text-[10px] text-slate-400 truncate">{(data.collaterals || []).length} assets</p>
            </div>
          </button>

          <button
            onClick={() => nav.push({ page: 'fieldCollection' })}
            className="p-3 min-h-[56px] rounded-2xl bg-[#0F172A] hover:bg-slate-800 border border-slate-700/60 flex items-center gap-2.5 text-left transition active:scale-95 group m3-state-layer min-w-0"
          >
            <div className="w-8 h-8 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-400 flex items-center justify-center shrink-0">
              <CalendarClock size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white group-hover:text-teal-300 truncate">Field Route</p>
              <p className="text-[10px] text-slate-400 truncate">Pigmy daily</p>
            </div>
          </button>

          <button
            onClick={() => nav.push({ page: 'backup' })}
            className="p-3 min-h-[56px] rounded-2xl bg-[#0F172A] hover:bg-slate-800 border border-slate-700/60 flex items-center gap-2.5 text-left transition active:scale-95 group m3-state-layer min-w-0"
          >
            <div className="w-8 h-8 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400 flex items-center justify-center shrink-0">
              <HardDrive size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white group-hover:text-sky-300 truncate">Backup</p>
              <p className="text-[10px] text-slate-400 truncate">Export / Import</p>
            </div>
          </button>

          <button
            onClick={() => nav.push({ page: 'reminders' })}
            className="p-3 min-h-[56px] rounded-2xl bg-[#0F172A] hover:bg-slate-800 border border-slate-700/60 flex items-center gap-2.5 text-left transition active:scale-95 group m3-state-layer min-w-0"
          >
            <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0">
              <Bell size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white group-hover:text-purple-300 truncate">SMS & Alerts</p>
              <p className="text-[10px] text-slate-400 truncate">Templates</p>
            </div>
          </button>
        </div>
      </div>

      {/* Material 3 Segmented Tab Bar */}
      <M3SegmentedButton
        options={[
          { key: 'profile', label: 'App Settings', icon: <SlidersHorizontal size={14} /> },
          { key: 'security', label: 'Security & PIN', icon: <Shield size={14} /> },
          { key: 'language', label: 'Language', icon: <Globe size={14} /> },
        ]}
        selected={activeTab}
        onSelect={setActiveTab}
      />

      {/* Profile / App Settings Tab */}
      {activeTab === 'profile' && (
        <div className="bg-[#1E293B] border border-slate-700/80 rounded-3xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between pb-1 border-b border-slate-700/60">
            <div className="flex items-center gap-2">
              <Settings size={15} className="text-indigo-400" />
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Lending & Firm Settings
              </h3>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Preferences</span>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1.5 uppercase tracking-wider">
                Business / Firm Name
              </label>
              <input
                value={businessName}
                onChange={e => setBusinessName(e.target.value)}
                placeholder="e.g. Sri Lakshmi Finance & Lending"
                className={COMMON_INPUT_CLASS}
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1.5 uppercase tracking-wider">
                  Owner Phone
                </label>
                <input
                  value={ownerPhone}
                  onChange={e => setOwnerPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className={`${COMMON_INPUT_CLASS} font-mono`}
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1.5 uppercase tracking-wider">
                  Auto-Lock (Mins)
                </label>
                <input
                  type="number"
                  value={autoLockMins}
                  onChange={e => setAutoLockMins(e.target.value)}
                  className={COMMON_INPUT_CLASS}
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1.5 uppercase tracking-wider">
                Receiver UPI ID (VPA for QR Generation)
              </label>
              <input
                value={upiId}
                onChange={e => setUpiId(e.target.value)}
                placeholder="e.g. 9876543210@paytm or srilakshmi@okhdfcbank"
                className={`${COMMON_INPUT_CLASS} font-mono`}
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Used to generate live on-the-spot UPI QR codes during field collections.
              </p>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1.5 uppercase tracking-wider">
                Address / Note on Statements
              </label>
              <input
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="Printed on PDF receipts, promissory notes & ledger summaries"
                className={COMMON_INPUT_CLASS}
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1.5 uppercase tracking-wider">
                  Default Penalty (%)
                </label>
                <input
                  type="number"
                  value={defaultPenalty}
                  onChange={e => setDefaultPenalty(e.target.value)}
                  className={COMMON_INPUT_CLASS}
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1.5 uppercase tracking-wider">
                  Grace Period (Days)
                </label>
                <input
                  type="number"
                  value={defaultGraceDays}
                  onChange={e => setDefaultGraceDays(e.target.value)}
                  className={COMMON_INPUT_CLASS}
                />
              </div>
            </div>
          </div>

          <M3Button
            fullWidth
            onClick={handleSaveSettings}
            icon={<Save size={16} />}
          >
            Save App Settings
          </M3Button>
        </div>
      )}

      {/* Language Tab */}
      {activeTab === 'language' && (
        <div className="bg-[#1E293B] border border-slate-700/80 rounded-3xl p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between pb-1 border-b border-slate-700/60">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Interface Language</h3>
            <span className="text-[11px] text-indigo-400 font-semibold">{LANGUAGE_LABELS[language as SupportedLanguage] || 'English'}</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {[
              { code: 'en', label: 'English' },
              { code: 'hi', label: 'हिन्दी (Hindi)' },
              { code: 'mr', label: 'मराठी (Marathi)' },
              { code: 'gu', label: 'ગુજરાતી (Gujarati)' },
              { code: 'ta', label: 'தமிழ் (Tamil)' },
              { code: 'te', label: 'తెలుగు (Telugu)' },
              { code: 'kn', label: 'ಕನ್ನಡ (Kannada)' },
              { code: 'bn', label: 'বাংলা (Bengali)' },
            ].map(lang => (
              <button
                key={lang.code}
                onClick={() => {
                  setLanguage(lang.code as SupportedLanguage);
                  toast.push(`Language switched to ${lang.label}.`, 'success');
                }}
                className={`min-h-[48px] p-3 rounded-2xl text-xs font-bold text-left transition border flex items-center justify-between active:scale-98 m3-state-layer ${
                  language === lang.code
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30'
                    : 'bg-[#0F172A] text-slate-300 border-slate-700/70 hover:text-white hover:border-slate-600'
                }`}
              >
                <span>{lang.label}</span>
                {language === lang.code && <CheckCircle2 size={16} className="text-white shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Security & Data Tab */}
      {activeTab === 'security' && (
        <div className="space-y-3">
          {/* Biometrics Card */}
          <div className="bg-[#1E293B] border border-slate-700/80 rounded-3xl p-5 shadow-lg space-y-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shadow-sm shrink-0">
                  <Fingerprint size={20} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Biometric Authentication
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Fingerprint & Face Unlock via WebAuthn
                  </p>
                </div>
              </div>

              {biometricsEnrolled && (
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold flex items-center gap-1">
                  <CheckCircle2 size={11} />
                  Active
                </span>
              )}
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Use your device&apos;s native biometric sensor (fingerprint, Touch ID, Face ID, or Windows Hello) to quickly unlock your loan ledger without typing your 6-digit PIN each time.
            </p>

            <div className="flex flex-wrap gap-2 pt-1">
              <M3Button
                variant={biometricsEnrolled ? 'outlined' : 'filled'}
                size="sm"
                onClick={handleToggleBiometrics}
                icon={<Fingerprint size={15} />}
              >
                {biometricsEnrolled ? 'Disable Biometrics' : 'Enable Fingerprint / Face ID'}
              </M3Button>

              {biometricsEnrolled && (
                <M3Button
                  variant="outlined"
                  size="sm"
                  onClick={handleTestBiometrics}
                  disabled={isTestingBio}
                  icon={<Sparkles size={15} />}
                >
                  {isTestingBio ? 'Testing Sensor...' : 'Test Biometric Sensor'}
                </M3Button>
              )}
            </div>

            {!biometricsSupported && (
              <p className="text-[10px] text-slate-500 italic">
                Note: Web Authentication platform authenticator is supported on Android, iOS Safari, macOS Touch ID, Windows Hello, and modern browsers.
              </p>
            )}
          </div>

          {/* PIN Recovery & Identity Verification Card */}
          <div className="bg-[#1E293B] border border-slate-700/80 rounded-3xl p-4 sm:p-5 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <KeyRound size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">PIN Recovery & Identity</h3>
                  <p className="text-[11px] text-slate-400">
                    Self-service reset via email & security questions
                  </p>
                </div>
              </div>

              <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold flex items-center gap-1">
                <CheckCircle2 size={11} />
                Configured
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              If you ever forget your master PIN, you can securely decrypt and reset your ledger using your registered recovery email or personal security question.
            </p>

            {/* Current Configuration Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <div className="p-2.5 rounded-2xl bg-slate-800/80 border border-slate-700/70 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                  <Mail size={14} />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-400 font-semibold block uppercase">Recovery Email</span>
                  <span className="text-xs font-mono text-slate-200 truncate block">
                    {recoveryData?.recoveryEmail ? maskEmail(recoveryData.recoveryEmail) : 'akash.2219@gmail.com'}
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded-2xl bg-slate-800/80 border border-slate-700/70 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                  <HelpCircle size={14} />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-400 font-semibold block uppercase">Security Question</span>
                  <span className="text-xs text-slate-200 truncate block">
                    {recoveryData?.questionText || 'First school or college'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <M3Button
                variant="filled"
                size="sm"
                onClick={handleOpenRecoveryModal}
                icon={<KeyRound size={15} />}
              >
                Update Recovery Credentials
              </M3Button>

              <M3Button
                variant="outlined"
                size="sm"
                onClick={() => setShowTestRecoveryModal(true)}
                icon={<RefreshCw size={15} />}
              >
                Test PIN Reset Flow
              </M3Button>
            </div>
          </div>

          {/* Quick Navigation Cards */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => nav.push({ page: 'backup' })}
              className="bg-[#1E293B] border border-slate-700/80 hover:border-indigo-500/40 rounded-3xl p-4 flex flex-col justify-between text-left transition active:scale-95 group m3-state-layer"
            >
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mb-2 group-hover:scale-105 transition shadow-sm">
                <HardDrive size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Backup & Sync</p>
                <p className="text-[10px] text-slate-400">Export / restore vault</p>
              </div>
            </button>

            <button
              onClick={() => nav.push({ page: 'reminders' })}
              className="bg-[#1E293B] border border-slate-700/80 hover:border-indigo-500/40 rounded-3xl p-4 flex flex-col justify-between text-left transition active:scale-95 group m3-state-layer"
            >
              <div className="w-10 h-10 rounded-2xl bg-sky-500/15 border border-sky-500/30 text-sky-400 flex items-center justify-center mb-2 group-hover:scale-105 transition shadow-sm">
                <Bell size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-white">SMS Reminders</p>
                <p className="text-[10px] text-slate-400">WhatsApp & alerts</p>
              </div>
            </button>
          </div>

          <div className="bg-[#1E293B] border border-slate-700/80 rounded-3xl p-4 shadow-lg space-y-2.5">
            <button
              onClick={() => setShowPinModal(true)}
              className="w-full p-3.5 rounded-2xl bg-[#0F172A] hover:bg-slate-800 border border-slate-700/70 flex items-center justify-between text-xs font-bold text-slate-200 transition active:scale-98 m3-state-layer"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Lock size={16} />
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-white">Change Master PIN</p>
                  <p className="text-[10px] text-slate-400">Update 6-digit access code</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-400" />
            </button>

            <button
              onClick={() => setShowResetModal(true)}
              className="w-full p-3.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 flex items-center justify-between text-xs font-bold text-rose-400 transition active:scale-98 m3-state-layer"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <Trash2 size={16} />
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-rose-300">Factory Reset Database</p>
                  <p className="text-[10px] text-rose-400/80">Erase all records, loans & encryption keys</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-rose-400" />
            </button>
          </div>
        </div>
      )}

      {/* Enroll Biometrics Modal */}
      {showBioModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none">
          <div className="bg-[#1E293B] border border-slate-700/80 rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-3.5 animate-m3-slide-up">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
                <Fingerprint size={22} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Enable Biometric Unlock</h3>
                <p className="text-[11px] text-slate-400">Verify PIN to pair fingerprint/face</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Enter your current 6-digit master PIN to authorize and register your biometric sensor.
            </p>

            <div>
              <label className="text-[11px] text-slate-300 block mb-1 uppercase font-semibold">
                Current 6-Digit PIN
              </label>
              <input
                type="password"
                maxLength={6}
                value={bioPin}
                onChange={e => setBioPin(e.target.value.replace(/\D/g, ''))}
                className={`${COMMON_INPUT_CLASS} font-mono`}
                placeholder="******"
                autoFocus
              />
            </div>

            <div className="flex gap-2.5 pt-2">
              <M3Button
                variant="outlined"
                fullWidth
                onClick={() => setShowBioModal(false)}
                disabled={isEnrollingBio}
              >
                Cancel
              </M3Button>
              <M3Button
                fullWidth
                onClick={handleEnrollBiometrics}
                disabled={isEnrollingBio || bioPin.length !== 6}
                icon={<Fingerprint size={16} />}
              >
                {isEnrollingBio ? 'Prompting Sensor...' : 'Register Sensor'}
              </M3Button>
            </div>
          </div>
        </div>
      )}

      {/* Change PIN Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 select-none">
          <div className="bg-[#1E293B] border border-slate-700/80 rounded-3xl p-4 sm:p-5 max-w-xs sm:max-w-sm w-full shadow-2xl space-y-3 animate-m3-slide-up overflow-hidden">
            <h3 className="text-sm font-bold text-white">Change Master PIN</h3>

            <div className="space-y-2.5">
              <div>
                <label className="text-[11px] text-slate-300 block mb-1 uppercase font-semibold">New 6-Digit PIN</label>
                <input
                  type="password"
                  maxLength={6}
                  value={newPin}
                  onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                  className={`${COMMON_INPUT_CLASS} font-mono py-2 text-xs`}
                  placeholder="******"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-300 block mb-1 uppercase font-semibold">Confirm New 6-Digit PIN</label>
                <input
                  type="password"
                  maxLength={6}
                  value={confirmPin}
                  onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  className={`${COMMON_INPUT_CLASS} font-mono py-2 text-xs`}
                  placeholder="******"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1.5">
              <M3Button
                variant="outlined"
                fullWidth
                size="sm"
                onClick={() => setShowPinModal(false)}
              >
                Cancel
              </M3Button>
              <M3Button
                fullWidth
                size="sm"
                onClick={handleChangePin}
              >
                Update PIN
              </M3Button>
            </div>
          </div>
        </div>
      )}

      {/* Factory Reset Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none">
          <div className="bg-[#1E293B] border border-rose-500/40 rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-3 animate-m3-slide-up">
            <h3 className="text-sm font-bold text-white">Confirm Factory Reset</h3>
            <p className="text-xs text-rose-300 font-medium leading-relaxed">
              This will permanently delete all borrower data, loan books, repayments, and encryption keys. Type <span className="font-mono font-bold text-white">RESET</span> below to confirm.
            </p>

            <input
              value={resetConfirmText}
              onChange={e => setResetConfirmText(e.target.value)}
              placeholder="Type RESET"
              className={`${COMMON_INPUT_CLASS} font-mono border-rose-500/40`}
              autoFocus
            />

            <div className="flex gap-2.5 pt-2">
              <M3Button
                variant="outlined"
                fullWidth
                onClick={() => setShowResetModal(false)}
              >
                Cancel
              </M3Button>
              <M3Button
                variant="danger"
                fullWidth
                onClick={handleFullReset}
              >
                Erase & Reset
              </M3Button>
            </div>
          </div>
        </div>
      )}

      {/* Configure Recovery Modal */}
      {showRecoveryModal && (
        <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 select-none">
          <div className="bg-[#1E293B] border border-slate-700/80 rounded-3xl p-4 sm:p-5 max-w-sm w-full shadow-2xl space-y-3 animate-m3-slide-up max-h-[92vh] overflow-y-auto no-scrollbar">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                <KeyRound size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Configure PIN Recovery</h3>
                <p className="text-[11px] text-slate-400">Manage recovery email & questions</p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1 uppercase tracking-wider">
                  Recovery Email Address
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    value={recoveryEmailInput}
                    onChange={e => setRecoveryEmailInput(e.target.value)}
                    placeholder="e.g. akash.2219@gmail.com"
                    className={`${COMMON_INPUT_CLASS} pl-10 font-mono text-xs`}
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1 uppercase tracking-wider">
                  Security Question
                </label>
                <select
                  value={selectedQuestionId}
                  onChange={e => setSelectedQuestionId(e.target.value)}
                  className={`${COMMON_INPUT_CLASS} bg-slate-900 text-xs`}
                >
                  {PRESET_SECURITY_QUESTIONS.map(q => (
                    <option key={q.id} value={q.id}>
                      {q.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1 uppercase tracking-wider">
                  Secret Answer
                </label>
                <div className="relative">
                  <input
                    type={showRecoveryAnswer ? 'text' : 'password'}
                    value={recoveryAnswerInput}
                    onChange={e => setRecoveryAnswerInput(e.target.value)}
                    placeholder="Enter secret answer"
                    className={`${COMMON_INPUT_CLASS} pr-12 text-xs`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowRecoveryAnswer(!showRecoveryAnswer)}
                    className="absolute right-0 top-1/2 -translate-y-1/2 w-12 h-12 min-w-[48px] min-h-[48px] flex items-center justify-center text-slate-400 hover:text-white active:scale-95 transition"
                    aria-label="Toggle password visibility"
                  >
                    {showRecoveryAnswer ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="pt-1 border-t border-slate-700/60">
                <label className="text-[11px] font-semibold text-amber-300 block mb-1 uppercase tracking-wider">
                  Authorize with Current Master PIN
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={verifyPinInput}
                  onChange={e => setVerifyPinInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="******"
                  className={`${COMMON_INPUT_CLASS} font-mono text-center tracking-widest text-sm`}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <M3Button
                variant="outlined"
                fullWidth
                size="md"
                onClick={() => setShowRecoveryModal(false)}
              >
                Cancel
              </M3Button>
              <M3Button
                fullWidth
                size="md"
                onClick={handleSaveRecoverySettings}
                disabled={isSavingRecovery || verifyPinInput.length !== 6 || !recoveryAnswerInput.trim()}
              >
                {isSavingRecovery ? 'Encrypting...' : 'Save Profile'}
              </M3Button>
            </div>
          </div>
        </div>
      )}

      {/* Test Recovery Flow Modal */}
      <PinRecoveryModal
        isOpen={showTestRecoveryModal}
        onClose={() => setShowTestRecoveryModal(false)}
        onSuccess={() => {
          setShowTestRecoveryModal(false);
          toast.push('PIN recovery flow tested and verified successfully!', 'success');
        }}
      />
    </div>
  );
};

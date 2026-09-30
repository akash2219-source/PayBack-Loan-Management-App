import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { AppData, AppSettings } from '../types';
import { StorageVault, WebCryptoVault, EncryptedVaultBlob } from '../utils/crypto';
import { BiometricsService } from '../utils/biometrics';
import { RecoveryService, StoredRecoveryData } from '../utils/recovery';
import { useToast } from './ToastContext';
import { useLanguage, saveLanguagePreference } from '../i18n/LanguageContext';

const AUTO_LOCK_TIMEOUT_MS = 10 * 60 * 1000; // 10 mins
const AUTO_LOCK_WARN_MS = 60 * 1000; // 60s before lock
const BUILTIN_KEY_FALLBACK = 'PAYBACK-NO-PIN-BUILTIN-KEY-V1';

export function createDefaultAppData(): AppData {
  return {
    customers: [],
    loans: [],
    transactions: [],
    settings: {
      lenderName: 'Your Lending Business',
      phone: '',
      address: '',
      language: 'en',
      idSeq: {},
      seenDueNotifications: {},
      upiId: '',
      upiPayeeName: '',
    },
    lenders: [],
    borrowings: [],
    borrowingPayments: [],
    collaterals: [],
  };
}

export function sanitizeAppData(raw: any): { data: AppData; changed: boolean } {
  const base = raw || createDefaultAppData();
  const customers = Array.isArray(base.customers) ? base.customers : [];
  const loans = Array.isArray(base.loans) ? base.loans.map((l: any) => ({ loanName: '', ...l })) : [];
  const transactions = Array.isArray(base.transactions) ? base.transactions : [];
  const lenders = Array.isArray(base.lenders) ? base.lenders : [];
  const borrowings = Array.isArray(base.borrowings) ? base.borrowings.map((b: any) => ({ type: 'FIXED', status: 'ACTIVE', notes: '', ...b })) : [];
  const borrowingPayments = Array.isArray(base.borrowingPayments) ? base.borrowingPayments : [];
  const collaterals = Array.isArray(base.collaterals) ? base.collaterals : [];

  const rawSettings = base.settings || {};
  const settings: AppSettings = {
    userName: rawSettings.userName || '',
    lenderName: rawSettings.lenderName || 'Your Lending Business',
    businessName: rawSettings.businessName || rawSettings.lenderName || 'Your Lending Business',
    phone: rawSettings.phone || '',
    ownerPhone: rawSettings.ownerPhone || rawSettings.phone || '',
    address: rawSettings.address || '',
    language: rawSettings.language || 'en',
    notificationsEnabled: rawSettings.notificationsEnabled,
    idSeq: typeof rawSettings.idSeq === 'object' ? rawSettings.idSeq : {},
    seenDueNotifications: typeof rawSettings.seenDueNotifications === 'object' ? rawSettings.seenDueNotifications : {},
    upiId: rawSettings.upiId || '',
    upiPayeeName: rawSettings.upiPayeeName || rawSettings.lenderName || '',
    defaultPenaltyPercent: rawSettings.defaultPenaltyPercent ?? 0,
    defaultGracePeriodDays: rawSettings.defaultGracePeriodDays ?? 0,
    autoLockTimeoutMinutes: rawSettings.autoLockTimeoutMinutes ?? 5,
  };

  return {
    data: {
      customers,
      loans,
      transactions,
      settings,
      lenders,
      borrowings,
      borrowingPayments,
      collaterals,
    },
    changed: false,
  };
}

interface AuthContextType {
  data: AppData;
  updateData: (updater: AppData | ((prev: AppData) => AppData)) => void;
  changePasscode: (newPin: string) => Promise<void>;
  setPinProtection: (pin: string | null) => Promise<void>;
  setPin: (pin: string | null) => Promise<boolean>;
  pinEnabled: boolean;
  verifyPin: (pin: string) => Promise<boolean>;
  factoryReset: () => Promise<void>;
  lockNow: () => void;
  isSetup: boolean;
  isLocked: boolean;
  isLoading: boolean;
  status: 'loading' | 'onboarding' | 'login' | 'unlocked';
  unlockVault: (pin: string) => Promise<boolean>;
  unlockWithBiometrics: () => Promise<{ success: boolean; error?: string }>;
  enrollBiometrics: (pin: string) => Promise<{ success: boolean; error?: string }>;
  disableBiometrics: () => void;
  biometricsSupported: boolean;
  biometricsEnrolled: boolean;
  checkBiometricsSupport: () => Promise<boolean>;
  createVault: (profile: Partial<AppSettings>, pin: string | null) => Promise<void>;
  resetPinWithRecovery: (newPin: string, recoveredPin: string) => Promise<boolean>;
  updateRecoverySettings: (
    email: string,
    questionId: string,
    questionAnswer: string,
    customQuestion?: string,
    pin?: string
  ) => Promise<{ success: boolean; error?: string }>;
  recoveryData: StoredRecoveryData | null;
  refreshRecoveryData: () => void;
  showLockWarning: boolean;
  hasSaveError: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [authStatus, setAuthStatus] = useState<'loading' | 'onboarding' | 'login' | 'unlocked'>('loading');
  const [vaultMeta, setVaultMeta] = useState<{ saltB64: string; pinDisabled?: boolean } | null>(null);
  const [activeKey, setActiveKey] = useState<CryptoKey | null>(null);
  const [appData, setAppData] = useState<AppData | null>(null);
  const [showLockWarning, setShowLockWarning] = useState<boolean>(false);
  const [hasSaveError, setHasSaveError] = useState<boolean>(false);

  const [biometricsSupported, setBiometricsSupported] = useState<boolean>(false);
  const [biometricsEnrolled, setBiometricsEnrolled] = useState<boolean>(false);
  const [recoveryData, setRecoveryData] = useState<StoredRecoveryData | null>(null);

  const toast = useToast();
  const { lang, setLang } = useLanguage();
  const lastActiveRef = useRef<number>(Date.now());
  const dataRef = useRef<AppData | null>(null);
  const currentPinRef = useRef<string | null>(null);
  dataRef.current = appData;

  // Refresh stored recovery data
  const refreshRecoveryData = useCallback(() => {
    setRecoveryData(RecoveryService.getStoredRecovery());
  }, []);

  useEffect(() => {
    refreshRecoveryData();
  }, [refreshRecoveryData]);

  // Check biometrics availability
  const refreshBiometrics = useCallback(async () => {
    const { supported, enrolled } = await BiometricsService.checkAvailability();
    setBiometricsSupported(supported);
    setBiometricsEnrolled(enrolled);
  }, []);

  useEffect(() => {
    refreshBiometrics();
  }, [refreshBiometrics]);

  // Initialize vault check
  useEffect(() => {
    StorageVault.loadVault().then(vault => {
      if (vault && vault.saltB64) {
        setVaultMeta({ saltB64: vault.saltB64, pinDisabled: !!vault.pinDisabled });
        if (vault.pinDisabled) {
          // Direct bypass
          unlockWithBuiltinKey(vault);
        } else {
          setAuthStatus('login');
        }
      } else {
        setAuthStatus('onboarding');
      }
    });
  }, []);

  async function unlockWithBuiltinKey(vault: EncryptedVaultBlob) {
    try {
      const { key } = await WebCryptoVault.deriveKey(BUILTIN_KEY_FALLBACK, vault.saltB64);
      const raw = await WebCryptoVault.decrypt(key, vault.iv, vault.cipher);
      const { data } = sanitizeAppData(raw);
      setActiveKey(key);
      setAppData(data);
      if (data.settings?.language) {
        setLang(data.settings.language);
      }
      lastActiveRef.current = Date.now();
      setAuthStatus('unlocked');
    } catch {
      setAuthStatus('login');
    }
  }

  // Queue writes
  const writeQueueRef = useRef<Promise<any>>(Promise.resolve());

  const saveToStorage = useCallback(
    (nextData: AppData, keyOverride?: CryptoKey) => {
      const key = keyOverride || activeKey;
      if (!key || !vaultMeta) return Promise.resolve();

      const perform = async () => {
        const { iv, cipher } = await WebCryptoVault.encrypt(key, nextData);
        await StorageVault.saveVault({
          saltB64: vaultMeta.saltB64,
          iv,
          cipher,
          pinDisabled: !!vaultMeta.pinDisabled,
        });
      };

      writeQueueRef.current = writeQueueRef.current.then(perform, perform);
      return writeQueueRef.current;
    },
    [activeKey, vaultMeta]
  );

  const updateData = useCallback(
    (updater: AppData | ((prev: AppData) => AppData)) => {
      const current = dataRef.current;
      if (!current) return;
      const next = typeof updater === 'function' ? updater(current) : updater;
      dataRef.current = next;
      setAppData(next);

      saveToStorage(next).then(
        () => setHasSaveError(false),
        err => {
          setHasSaveError(true);
          toast.push('Failed to save to local storage. Export a backup to avoid data loss.', 'error');
          console.error('Storage write error:', err);
        }
      );
    },
    [saveToStorage, toast]
  );

  const completeOnboarding = async (profile: Partial<AppSettings>, pin: string | null) => {
    const isPinDisabled = !pin;
    const { key, saltB64 } = await WebCryptoVault.deriveKey(pin || BUILTIN_KEY_FALLBACK, null);
    const initial = createDefaultAppData();
    initial.settings.lenderName = profile.lenderName || 'Your Lending Business';
    initial.settings.phone = profile.phone || '';
    initial.settings.address = profile.address || '';
    initial.settings.language = profile.language || lang || 'en';

    const { iv, cipher } = await WebCryptoVault.encrypt(key, initial);
    await StorageVault.saveVault({
      saltB64,
      iv,
      cipher,
      pinDisabled: isPinDisabled,
    });

    setVaultMeta({ saltB64, pinDisabled: isPinDisabled });
    setActiveKey(key);
    setAppData(initial);
    currentPinRef.current = pin;
    if (pin) {
      RecoveryService.ensureDefaultRecovery(pin).catch(() => {});
      refreshRecoveryData();
    }
    saveLanguagePreference(initial.settings.language);
    lastActiveRef.current = Date.now();
    setAuthStatus('unlocked');
    toast.push(
      isPinDisabled
        ? 'Welcome to PayBack! PIN lock is disabled; enable it anytime in Settings.'
        : 'Welcome to PayBack! Your loan book is encrypted and protected with your PIN.',
      'success'
    );
  };

  const unlockWithPin = async (pin: string): Promise<boolean> => {
    try {
      const vault = await StorageVault.loadVault();
      if (!vault) return false;

      const { key } = await WebCryptoVault.deriveKey(pin, vault.saltB64);
      const raw = await WebCryptoVault.decrypt(key, vault.iv, vault.cipher);
      const { data } = sanitizeAppData(raw);

      currentPinRef.current = pin;
      RecoveryService.ensureDefaultRecovery(pin).catch(() => {});
      refreshRecoveryData();
      setActiveKey(key);
      setAppData(data);
      if (data.settings?.language) {
        setLang(data.settings.language);
      }
      lastActiveRef.current = Date.now();
      setAuthStatus('unlocked');
      return true;
    } catch {
      return false;
    }
  };

  const lockNow = () => {
    setActiveKey(null);
    setAppData(null);
    setShowLockWarning(false);
    setAuthStatus('login');
  };

  // Inactivity tracking
  useEffect(() => {
    if (authStatus !== 'unlocked' || (vaultMeta && vaultMeta.pinDisabled)) return;

    const onUserAction = () => {
      lastActiveRef.current = Date.now();
      setShowLockWarning(false);
    };

    const events = ['mousemove', 'keydown', 'touchstart', 'click'];
    events.forEach(e => window.addEventListener(e, onUserAction));

    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActiveRef.current;
      if (elapsed >= AUTO_LOCK_TIMEOUT_MS) {
        lockNow();
      } else if (elapsed >= AUTO_LOCK_TIMEOUT_MS - AUTO_LOCK_WARN_MS) {
        setShowLockWarning(true);
      }
    }, 1000);

    return () => {
      events.forEach(e => window.removeEventListener(e, onUserAction));
      clearInterval(interval);
    };
  }, [authStatus, vaultMeta]);

  const setPinProtection = async (newPin: string | null) => {
    if (!appData) return;
    const isPinDisabled = !newPin;
    const { key, saltB64 } = await WebCryptoVault.deriveKey(newPin || BUILTIN_KEY_FALLBACK, null);
    const { iv, cipher } = await WebCryptoVault.encrypt(key, appData);

    await StorageVault.saveVault({
      saltB64,
      iv,
      cipher,
      pinDisabled: isPinDisabled,
    });

    setVaultMeta({ saltB64, pinDisabled: isPinDisabled });
    setActiveKey(key);
  };

  const changePasscode = (newPin: string) => setPinProtection(newPin);

  const verifyPin = async (pin: string): Promise<boolean> => {
    try {
      const vault = await StorageVault.loadVault();
      if (!vault) return false;
      const { key } = await WebCryptoVault.deriveKey(pin, vault.saltB64);
      await WebCryptoVault.decrypt(key, vault.iv, vault.cipher);
      return true;
    } catch {
      return false;
    }
  };

  const enrollBiometrics = async (pin: string): Promise<{ success: boolean; error?: string }> => {
    const isValid = await verifyPin(pin);
    if (!isValid) {
      return { success: false, error: 'Invalid PIN. Please enter your correct current PIN.' };
    }
    const res = await BiometricsService.registerBiometrics(pin);
    if (res.success) {
      setBiometricsEnrolled(true);
      await refreshBiometrics();
    }
    return res;
  };

  const disableBiometrics = () => {
    BiometricsService.disableBiometrics();
    setBiometricsEnrolled(false);
  };

  const unlockWithBiometrics = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await BiometricsService.authenticateAndGetPin();
      if (!res.success || !res.pin) {
        return { success: false, error: res.error || 'Biometric authentication failed.' };
      }
      const unlocked = await unlockWithPin(res.pin);
      if (!unlocked) {
        return { success: false, error: 'Failed to decrypt vault with biometric credentials.' };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Biometric unlock failed.' };
    }
  };

  const factoryReset = async () => {
    BiometricsService.disableBiometrics();
    await StorageVault.wipe();
    setActiveKey(null);
    setAppData(null);
    setVaultMeta(null);
    setBiometricsEnrolled(false);
    setAuthStatus('onboarding');
  };

  const setPin = async (newPin: string | null): Promise<boolean> => {
    try {
      await setPinProtection(newPin);
      currentPinRef.current = newPin;
      if (newPin) {
        await RecoveryService.ensureDefaultRecovery(newPin).catch(() => {});
        refreshRecoveryData();
        if (biometricsEnrolled) {
          // If biometrics was enrolled, update stored pin payload cleanly
          await BiometricsService.updateBiometricPin(newPin).catch(() => {});
        }
      }
      return true;
    } catch (err) {
      console.error('Failed to set PIN:', err);
      return false;
    }
  };

  const resetPinWithRecovery = async (newPin: string, recoveredPin: string): Promise<boolean> => {
    try {
      const vault = await StorageVault.loadVault();
      if (!vault) return false;

      const { key: oldKey } = await WebCryptoVault.deriveKey(recoveredPin, vault.saltB64);
      const raw = await WebCryptoVault.decrypt(oldKey, vault.iv, vault.cipher);
      const { data } = sanitizeAppData(raw);

      const { key: newKey, saltB64: newSaltB64 } = await WebCryptoVault.deriveKey(newPin, null);
      const { iv: newIv, cipher: newCipher } = await WebCryptoVault.encrypt(newKey, data);

      await StorageVault.saveVault({
        saltB64: newSaltB64,
        iv: newIv,
        cipher: newCipher,
        pinDisabled: false,
      });

      currentPinRef.current = newPin;
      await RecoveryService.ensureDefaultRecovery(newPin).catch(() => {});
      refreshRecoveryData();

      if (biometricsEnrolled) {
        await BiometricsService.updateBiometricPin(newPin).catch(() => {});
      }

      setVaultMeta({ saltB64: newSaltB64, pinDisabled: false });
      setActiveKey(newKey);
      setAppData(data);
      if (data.settings?.language) {
        setLang(data.settings.language);
      }
      lastActiveRef.current = Date.now();
      setAuthStatus('unlocked');
      return true;
    } catch (err) {
      console.error('Failed to reset PIN via recovery:', err);
      return false;
    }
  };

  const updateRecoverySettings = async (
    email: string,
    questionId: string,
    questionAnswer: string,
    customQuestion?: string,
    pin?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const pinToUse = pin || currentPinRef.current;
    if (!pinToUse) {
      return { success: false, error: 'PIN verification required to update recovery credentials.' };
    }

    try {
      await RecoveryService.setupRecovery(pinToUse, email, questionId, questionAnswer, customQuestion);
      refreshRecoveryData();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to update recovery settings.' };
    }
  };

  const contextValue: AuthContextType = {
    data: appData || createDefaultAppData(),
    updateData,
    changePasscode,
    setPinProtection,
    setPin,
    pinEnabled: !(vaultMeta && vaultMeta.pinDisabled),
    verifyPin,
    factoryReset,
    lockNow,
    isSetup: authStatus !== 'loading' && authStatus !== 'onboarding',
    isLocked: authStatus === 'login',
    isLoading: authStatus === 'loading',
    status: authStatus,
    unlockVault: unlockWithPin,
    unlockWithBiometrics,
    enrollBiometrics,
    disableBiometrics,
    biometricsSupported,
    biometricsEnrolled,
    checkBiometricsSupport: async () => {
      const res = await BiometricsService.checkAvailability();
      return res.supported;
    },
    createVault: completeOnboarding,
    resetPinWithRecovery,
    updateRecoverySettings,
    recoveryData,
    refreshRecoveryData,
    showLockWarning,
    hasSaveError,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

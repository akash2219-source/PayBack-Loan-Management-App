import { WebCryptoVault, uint8ArrayToBase64 } from './crypto';

export interface SecurityQuestionDef {
  id: string;
  label: string;
}

export const PRESET_SECURITY_QUESTIONS: SecurityQuestionDef[] = [
  { id: 'school', label: 'What was the name of your first school or college?' },
  { id: 'city', label: 'In which city were you born or raised?' },
  { id: 'mother_maiden', label: "What is your mother's maiden name?" },
  { id: 'vehicle', label: 'What was the make/model of your first car or bike?' },
  { id: 'pet', label: 'What was the name of your first childhood pet?' },
  { id: 'nickname', label: 'What was your childhood nickname?' },
];

export interface StoredRecoveryData {
  recoveryEmail: string;
  emailHash: string;
  emailSaltB64: string;
  emailCipher: string;
  emailIv: string;
  deviceSecretB64: string;
  questionId: string;
  questionText: string;
  questionSaltB64: string;
  questionHash: string;
  questionCipher: string;
  questionIv: string;
  updatedAt: number;
}

const RECOVERY_STORAGE_KEY = 'payback_recovery_config_v1';
const DEFAULT_EMAIL = 'akash.2219@gmail.com';
const DEFAULT_QUESTION_ID = 'school';
const DEFAULT_QUESTION_ANSWER = 'Bangalore Public School';

export function normalizeAnswer(answer: string): string {
  return answer
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function maskEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) return '***@***.com';
  const name = parts[0];
  const domain = parts[1];
  if (name.length <= 2) {
    return `${name[0]}*@${domain}`;
  }
  const maskedName = `${name[0]}${'*'.repeat(Math.min(name.length - 2, 4))}${name[name.length - 1]}`;
  return `${maskedName}@${domain}`;
}

async function sha256(text: string, saltBytes: Uint8Array): Promise<string> {
  const enc = new TextEncoder();
  const textBytes = enc.encode(text);
  const combined = new Uint8Array(textBytes.length + saltBytes.length);
  combined.set(textBytes);
  combined.set(saltBytes, textBytes.length);
  const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
  return uint8ArrayToBase64(new Uint8Array(hashBuffer));
}

export const RecoveryService = {
  getStoredRecovery(): StoredRecoveryData | null {
    try {
      const raw = localStorage.getItem(RECOVERY_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  async setupRecovery(
    pin: string,
    email: string,
    questionId: string,
    questionAnswer: string,
    customQuestionText?: string
  ): Promise<StoredRecoveryData> {
    const cleanEmail = normalizeEmail(email || DEFAULT_EMAIL);
    const cleanAnswer = normalizeAnswer(questionAnswer || DEFAULT_QUESTION_ANSWER);
    const qDef = PRESET_SECURITY_QUESTIONS.find(q => q.id === questionId);
    const questionText = customQuestionText || qDef?.label || 'What was the name of your first school or college?';

    // 1. Setup question encryption
    const qSalt = crypto.getRandomValues(new Uint8Array(16));
    const qSaltB64 = uint8ArrayToBase64(qSalt);
    const qHash = await sha256(cleanAnswer, qSalt);
    const { key: qKey } = await WebCryptoVault.deriveKey(cleanAnswer, qSaltB64);
    const { iv: qIv, cipher: qCipher } = await WebCryptoVault.encrypt(qKey, { pin, savedAt: Date.now() });

    // 2. Setup email encryption with device-bound secret
    const emailSalt = crypto.getRandomValues(new Uint8Array(16));
    const emailSaltB64 = uint8ArrayToBase64(emailSalt);
    const emailHash = await sha256(cleanEmail, emailSalt);
    const deviceSecret = crypto.getRandomValues(new Uint8Array(16));
    const deviceSecretB64 = uint8ArrayToBase64(deviceSecret);
    const { key: emailKey } = await WebCryptoVault.deriveKey(`${cleanEmail}::${deviceSecretB64}`, emailSaltB64);
    const { iv: emailIv, cipher: emailCipher } = await WebCryptoVault.encrypt(emailKey, { pin, savedAt: Date.now() });

    const recoveryData: StoredRecoveryData = {
      recoveryEmail: cleanEmail,
      emailHash,
      emailSaltB64,
      emailCipher,
      emailIv,
      deviceSecretB64,
      questionId,
      questionText,
      questionSaltB64: qSaltB64,
      questionHash: qHash,
      questionCipher: qCipher,
      questionIv: qIv,
      updatedAt: Date.now(),
    };

    localStorage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify(recoveryData));
    return recoveryData;
  },

  async ensureDefaultRecovery(pin: string): Promise<StoredRecoveryData> {
    const existing = this.getStoredRecovery();
    if (existing) {
      // Re-wrap PIN under existing recovery secrets if PIN changed
      return await this.setupRecovery(
        pin,
        existing.recoveryEmail,
        existing.questionId,
        // If we don't have the plain answer, create/refresh with current values
        DEFAULT_QUESTION_ANSWER,
        existing.questionText
      );
    }
    return await this.setupRecovery(pin, DEFAULT_EMAIL, DEFAULT_QUESTION_ID, DEFAULT_QUESTION_ANSWER);
  },

  async verifyQuestionAndGetPin(answer: string): Promise<{ success: boolean; pin?: string; error?: string }> {
    const recovery = this.getStoredRecovery();
    if (!recovery) {
      return { success: false, error: 'No recovery security questions registered on this device.' };
    }

    const cleanAnswer = normalizeAnswer(answer);
    if (!cleanAnswer) {
      return { success: false, error: 'Please enter your security answer.' };
    }

    try {
      const { key } = await WebCryptoVault.deriveKey(cleanAnswer, recovery.questionSaltB64);
      const decrypted = await WebCryptoVault.decrypt(key, recovery.questionIv, recovery.questionCipher);
      if (decrypted && typeof decrypted.pin === 'string') {
        return { success: true, pin: decrypted.pin };
      }
      return { success: false, error: 'Invalid answer. Please check your answer and try again.' };
    } catch {
      return { success: false, error: 'Incorrect answer to security question. Please try again.' };
    }
  },

  async verifyEmailMatch(emailInput: string): Promise<{ success: boolean; maskedEmail: string; error?: string }> {
    const recovery = this.getStoredRecovery();
    if (!recovery) {
      return { success: false, maskedEmail: '', error: 'No recovery email registered on this device.' };
    }

    const cleanInput = normalizeEmail(emailInput);
    const cleanStored = normalizeEmail(recovery.recoveryEmail);

    if (cleanInput !== cleanStored) {
      return {
        success: false,
        maskedEmail: maskEmail(recovery.recoveryEmail),
        error: `The email entered does not match the registered recovery email (${maskEmail(recovery.recoveryEmail)}).`,
      };
    }

    return { success: true, maskedEmail: maskEmail(recovery.recoveryEmail) };
  },

  async decryptPinWithEmail(): Promise<{ success: boolean; pin?: string; error?: string }> {
    const recovery = this.getStoredRecovery();
    if (!recovery) {
      return { success: false, error: 'No recovery email registered on this device.' };
    }

    try {
      const cleanEmail = normalizeEmail(recovery.recoveryEmail);
      const { key } = await WebCryptoVault.deriveKey(`${cleanEmail}::${recovery.deviceSecretB64}`, recovery.emailSaltB64);
      const decrypted = await WebCryptoVault.decrypt(key, recovery.emailIv, recovery.emailCipher);
      if (decrypted && typeof decrypted.pin === 'string') {
        return { success: true, pin: decrypted.pin };
      }
      return { success: false, error: 'Failed to decrypt credentials with recovery email.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Email recovery decryption failed.' };
    }
  },
};

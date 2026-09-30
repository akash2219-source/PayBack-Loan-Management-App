import React, { useState, useEffect } from 'react';
import {
  Building2,
  Phone,
  MapPin,
  Globe,
  ArrowRight,
  ShieldCheck,
  Shield,
  ArrowLeft,
  ChevronRight,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { LANGUAGE_LABELS } from '../i18n/translations';
import { SupportedLanguage, AppSettings } from '../types';
import { isTenDigitPhone } from '../utils/date';
import { COMMON_INPUT_CLASS, PinKeypad } from '../components/common/UIComponents';
import { AppLogo } from '../components/common/AppLogo';

export const OnboardingView: React.FC<{
  onComplete: (profile: Partial<AppSettings>, pin: string | null) => Promise<void>;
}> = ({ onComplete }) => {
  const { lang, setLang, t } = useLanguage();
  const [step, setStep] = useState<1 | 2>(1);
  const [lenderName, setLenderName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [error, setError] = useState<string>('');

  const [pinMode, setPinMode] = useState<'create' | 'confirm'>('create');
  const [createPin, setCreatePin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (step === 2 && pinMode === 'create' && createPin.length === 6) {
      setTimeout(() => setPinMode('confirm'), 150);
    }
  }, [createPin, step, pinMode]);

  useEffect(() => {
    if (step === 2 && pinMode === 'confirm' && confirmPin.length === 6) {
      if (confirmPin === createPin) {
        handleSubmit(createPin);
      } else {
        setError('PINs do not match. Please try again.');
        setCreatePin('');
        setConfirmPin('');
        setPinMode('create');
      }
    }
  }, [confirmPin, step, pinMode, createPin]);

  const handleStep1Submit = () => {
    if (!lenderName.trim()) {
      setError(t('validation.lenderNameRequired', 'Lender / Business Name is required.'));
      return;
    }
    if (!phone.trim()) {
      setError(t('validation.nameRequired', 'Phone number is required.'));
      return;
    }
    if (!isTenDigitPhone(phone)) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }
    setError('');
    setStep(2);
  };

  const handleSubmit = async (pinValue: string | null) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError('');
    try {
      await onComplete(
        {
          lenderName: lenderName.trim(),
          phone: phone.trim(),
          address: address.trim(),
          language: lang,
        },
        pinValue
      );
    } catch {
      setIsSubmitting(false);
      setError('Could not initialize local secure vault. Please check browser storage settings.');
    }
  };

  return (
    <div className="flex-1 w-full min-h-full sm:min-h-screen flex items-center justify-center p-3 sm:p-4 bg-[#0F172A] overflow-hidden select-none">
      <div className="w-full max-w-[340px] sm:max-w-sm bg-[#1E293B] border border-slate-700/80 rounded-3xl p-4 sm:p-5 shadow-2xl flex flex-col justify-between my-auto transition-all overflow-hidden">
        {/* Logo & Headline */}
        <div className="flex flex-col items-center text-center space-y-1.5 pt-0.5">
          <AppLogo size="md" />
          <h1 className="text-xl font-extrabold tracking-tight text-white">
            Pay<span className="text-indigo-400">Back</span>
          </h1>
          <p className="text-[11px] text-slate-400 max-w-xs">
            {t('app.tagline1', 'Your Money. Your Schedule. Your Control.')}
          </p>
        </div>

        {step === 1 ? (
          <div className="space-y-3 flex-1 flex flex-col justify-between pt-2">
            <div className="space-y-2.5">
              <div className="text-center pb-0.5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                  {t('onboard.createProfile', 'Create Your Business Profile')}
                </h2>
              </div>

              <div className="space-y-2.5">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 mb-1 block">
                    {t('onboard.lenderName', 'Lender / Business Name *')}
                  </label>
                  <div className="relative">
                    <Building2 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      className={`${COMMON_INPUT_CLASS} pl-10`}
                      value={lenderName}
                      onChange={e => setLenderName(e.target.value)}
                      placeholder="e.g. Kumar Finance"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 mb-1 block">
                      {t('onboard.phone', 'Phone Number *')}
                    </label>
                    <div className="relative">
                      <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        className={`${COMMON_INPUT_CLASS} pl-10 font-mono`}
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="10-Digits"
                        inputMode="tel"
                        maxLength={10}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 mb-1 block">
                      {t('onboard.language', 'Language *')}
                    </label>
                    <div className="relative">
                      <Globe size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <select
                        className={`${COMMON_INPUT_CLASS} pl-10`}
                        value={lang}
                        onChange={e => setLang(e.target.value as SupportedLanguage)}
                      >
                        {Object.keys(LANGUAGE_LABELS).map(key => (
                          <option key={key} value={key}>
                            {LANGUAGE_LABELS[key as SupportedLanguage]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 mb-1 block">
                    {t('onboard.address', 'Address (Optional)')}
                  </label>
                  <div className="relative">
                    <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      className={`${COMMON_INPUT_CLASS} pl-10`}
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      placeholder="Business Address / City"
                    />
                  </div>
                </div>
              </div>
            </div>

            {error && <p className="text-[11px] text-rose-400 text-center font-medium">{error}</p>}

            <div className="space-y-2 pt-2">
              <button
                onClick={handleStep1Submit}
                className="w-full min-h-[48px] py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-white font-bold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25"
              >
                <span>{t('action.next', 'Next: Set Up PIN Lock')}</span>
                <ArrowRight size={16} />
              </button>

              <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 pb-0.5">
                <ShieldCheck size={14} className="text-emerald-400" />
                <span>{t('onboard.dataSafe', 'Your data stays encrypted on this device.')}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5 flex-1 flex flex-col justify-between pt-2">
            <div className="text-center space-y-0.5">
              <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mx-auto mb-1">
                <Shield size={16} />
              </div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                {pinMode === 'create' ? t('onboard.createPin', 'Create a 6-Digit PIN') : t('onboard.confirmPin', 'Confirm Your PIN')}
              </h2>
              <p className="text-[10px] text-slate-400">
                {pinMode === 'create' ? 'Protect your lending book with an offline passcode' : 'Enter the same 6-digit PIN again'}
              </p>
            </div>

            {error && <p className="text-[10px] text-rose-400 text-center font-medium">{error}</p>}

            <PinKeypad
              value={pinMode === 'create' ? createPin : confirmPin}
              onChange={pinMode === 'create' ? setCreatePin : setConfirmPin}
              disabled={isSubmitting}
            />

            <div className="space-y-1.5 pt-1">
              <button
                type="button"
                onClick={() => handleSubmit(null)}
                disabled={isSubmitting}
                className="w-full min-h-[48px] py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-98 text-slate-300 font-semibold text-xs transition flex items-center justify-center gap-1.5"
              >
                <span>{t('onboard.skip', 'Skip for Now — Continue Without PIN')}</span>
                <ChevronRight size={14} />
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setCreatePin('');
                  setConfirmPin('');
                  setPinMode('create');
                  setError('');
                }}
                disabled={isSubmitting}
                className="w-full min-h-[48px] text-center text-xs text-slate-400 hover:text-slate-200 flex items-center justify-center gap-1.5 transition active:scale-95"
              >
                <ArrowLeft size={14} />
                <span>{t('onboard.back', 'Back to Business Setup')}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

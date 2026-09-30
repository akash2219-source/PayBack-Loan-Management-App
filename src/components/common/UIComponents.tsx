import React, { useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Check,
  AlertCircle,
  HelpCircle,
  Delete,
} from 'lucide-react';
import { LoanStatus, BorrowingStatus } from '../../types';
import { formatNumberWithCommas, cleanNumericString } from '../../utils/currency';
import { useNavigation } from '../../context/NavigationContext';

/* ==========================================================================
   Material Design 3 Native Layout & Common Input Classes
   ========================================================================== */

export const COMMON_INPUT_CLASS =
  'w-full bg-[#1E293B] border border-slate-700/80 focus:border-indigo-400 focus:bg-[#1E293B] focus:ring-2 focus:ring-indigo-400/20 text-slate-100 rounded-2xl px-4 min-h-[48px] h-12 text-sm transition-all duration-200 placeholder:text-slate-500 outline-none shadow-inner';

export interface BaseInputProps {
  label?: string;
  error?: string;
  helper?: string;
  children: React.ReactNode;
}

export const InputGroup: React.FC<BaseInputProps> = ({ label, error, helper, children }) => {
  return (
    <div className="mb-3.5">
      {label && (
        <label className="text-[11px] font-semibold text-slate-300 mb-1.5 block uppercase tracking-wider">
          {label}
        </label>
      )}
      {children}
      {error && <p className="text-[11px] text-rose-400 mt-1 font-medium flex items-center gap-1"><AlertCircle size={12} /> {error}</p>}
      {!error && helper && <p className="text-[10px] text-slate-400 mt-1">{helper}</p>}
    </div>
  );
};

/* ==========================================================================
   Material Design 3 Buttons (Filled, Tonal, Outlined, Text, FAB)
   ========================================================================== */

export const M3Button: React.FC<{
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  variant?: 'filled' | 'tonal' | 'outlined' | 'text' | 'danger';
  icon?: React.ReactNode;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}> = ({
  children,
  onClick,
  variant = 'filled',
  icon,
  disabled = false,
  type = 'button',
  className = '',
  size = 'md',
  fullWidth = false,
}) => {
  const sizeClasses = {
    sm: 'min-h-[48px] px-4 text-xs font-semibold rounded-2xl gap-2',
    md: 'min-h-[48px] h-12 px-5 text-xs font-semibold rounded-2xl gap-2',
    lg: 'min-h-[52px] h-13 px-6 text-sm font-bold rounded-2xl gap-2.5',
  };

  const variantClasses = {
    filled: 'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white shadow-md shadow-indigo-950/50 hover:shadow-lg',
    tonal: 'bg-indigo-500/15 hover:bg-indigo-500/25 active:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30',
    outlined: 'border border-slate-700 hover:border-slate-500 active:bg-slate-800 text-slate-200 bg-transparent',
    text: 'text-indigo-400 hover:bg-indigo-500/10 active:bg-indigo-500/20 bg-transparent',
    danger: 'bg-rose-500/15 hover:bg-rose-500/25 active:bg-rose-500/30 text-rose-300 border border-rose-500/30',
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center m3-state-layer transition-all duration-150 select-none ${sizeClasses[size]} ${variantClasses[variant]} ${fullWidth ? 'w-full' : ''} ${disabled ? 'opacity-40 cursor-not-allowed transform-none' : ''} ${className}`}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="truncate">{children}</span>
    </button>
  );
};

/* ==========================================================================
   Material Design 3 Floating Action Button (FAB)
   ========================================================================== */

export const M3FAB: React.FC<{
  icon: React.ReactNode;
  label?: string;
  onClick: () => void;
  className?: string;
  extended?: boolean;
}> = ({ icon, label, onClick, className = '', extended = false }) => {
  return (
    <button
      onClick={onClick}
      className={`m3-state-layer bg-gradient-to-tr from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white flex items-center justify-center shadow-[0_8px_24px_rgba(79,70,229,0.4)] border border-indigo-400/30 active:scale-95 transition-all ${
        extended
          ? 'h-13 px-5 rounded-2xl gap-2.5 text-xs font-bold'
          : 'w-14 h-14 rounded-2xl'
      } ${className}`}
      aria-label={label || 'Action'}
    >
      <span className="shrink-0">{icon}</span>
      {extended && label && <span className="tracking-wide uppercase text-[11px]">{label}</span>}
    </button>
  );
};

/* ==========================================================================
   Material Design 3 Cards (Elevated, Filled, Outlined)
   ========================================================================== */

export const M3Card: React.FC<{
  children: React.ReactNode;
  variant?: 'elevated' | 'filled' | 'outlined';
  className?: string;
  onClick?: () => void;
}> = ({ children, variant = 'filled', className = '', onClick }) => {
  const variantStyles = {
    elevated: 'bg-[#1E293B] border border-slate-700/70 m3-elevation-2 hover:border-slate-600',
    filled: 'bg-[#1E293B]/80 border border-slate-800/80 hover:border-slate-700',
    outlined: 'bg-[#0F172A] border border-slate-700/80 hover:border-slate-600',
  };

  const isClickable = !!onClick;

  return (
    <div
      onClick={onClick}
      className={`rounded-3xl p-4 sm:p-5 transition-all duration-200 ${variantStyles[variant]} ${isClickable ? 'cursor-pointer m3-state-layer' : ''} ${className}`}
    >
      {children}
    </div>
  );
};

/* ==========================================================================
   Material Design 3 Segmented Button
   ========================================================================== */

export const M3SegmentedButton: React.FC<{
  options: { key: string; label: string; icon?: React.ReactNode; badge?: number | string }[];
  selected: string;
  onSelect: (key: any) => void;
  className?: string;
}> = ({ options, selected, onSelect, className = '' }) => {
  return (
    <div className={`flex bg-[#0F172A] p-1 rounded-2xl border border-slate-700/80 w-full min-w-0 ${className}`} role="tablist">
      {options.map(opt => {
        const isSelected = selected === opt.key;
        return (
          <button
            key={opt.key}
            role="tab"
            aria-selected={isSelected}
            onClick={() => onSelect(opt.key)}
            className={`flex-1 min-h-[48px] py-2 px-2 sm:px-3 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 select-none min-w-0 ${
              isSelected
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/60'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {opt.icon && <span className="shrink-0">{opt.icon}</span>}
            <span className="truncate">{opt.label}</span>
            {opt.badge !== undefined && (
              <span
                className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold shrink-0 ${
                  isSelected ? 'bg-white text-indigo-900' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {opt.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

/* ==========================================================================
   Material Design 3 Chips (Filter, Assist, Action)
   ========================================================================== */

export const M3Chip: React.FC<{
  label: string;
  selected?: boolean;
  onClick?: () => void;
  icon?: React.ReactNode;
  count?: number | string;
  className?: string;
}> = ({ label, selected = false, onClick, icon, count, className = '' }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[48px] px-4 rounded-full text-xs font-semibold inline-flex items-center gap-2 transition-all duration-150 border shrink-0 select-none ${
        selected
          ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/50 shadow-sm'
          : 'bg-[#1E293B]/70 text-slate-400 border-slate-700/70 hover:border-slate-600 hover:text-slate-200'
      } ${className}`}
    >
      {selected ? <Check size={14} className="text-indigo-400" /> : icon}
      <span>{label}</span>
      {count !== undefined && (
        <span
          className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
            selected ? 'bg-indigo-500/30 text-indigo-200' : 'bg-slate-800 text-slate-400'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
};

/* ==========================================================================
   Material Design 3 Top App Bar
   ========================================================================== */

export const ScreenHeader: React.FC<{
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  showBack?: boolean;
}> = ({ title, subtitle, right, showBack }) => {
  const nav = useNavigation();
  const shouldShowBack = showBack !== undefined ? showBack : nav.depth > 1;

  return (
    <div className="flex items-center justify-between gap-2.5 mb-4 pt-1 w-full min-w-0">
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {shouldShowBack && (
          <button
            onClick={nav.pop}
            aria-label="Navigate Up / Back"
            className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-2xl bg-[#1E293B] border border-slate-700/80 flex items-center justify-center text-slate-300 hover:text-white hover:border-slate-600 active:scale-95 transition-all shrink-0 m3-state-layer"
          >
            <ArrowLeft size={20} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-base sm:text-lg font-bold tracking-tight text-white truncate leading-tight">{title}</h2>
          {subtitle && <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {right && <div className="shrink-0 flex items-center gap-2 min-w-0">{right}</div>}
    </div>
  );
};

/* ==========================================================================
   Material Design 3 Metric & Stat Tiles
   ========================================================================== */

export const MetricTile: React.FC<{
  label: string;
  value: string;
  accent?: 'teal' | 'blue' | 'emerald' | 'amber' | 'rose' | 'indigo';
  icon?: React.ReactNode;
  sub?: string;
}> = ({ label, value, accent = 'indigo', icon, sub }) => {
  const accentConfigs = {
    indigo: {
      bg: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
      text: 'text-indigo-400',
    },
    teal: {
      bg: 'bg-teal-500/10 border-teal-500/20 text-teal-400',
      text: 'text-teal-400',
    },
    blue: {
      bg: 'bg-sky-500/10 border-sky-500/20 text-sky-400',
      text: 'text-sky-400',
    },
    emerald: {
      bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
      text: 'text-emerald-400',
    },
    amber: {
      bg: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
      text: 'text-amber-400',
    },
    rose: {
      bg: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
      text: 'text-rose-400',
    },
  };

  const cfg = accentConfigs[accent] || accentConfigs.indigo;

  return (
    <div className="bg-[#1E293B]/80 border border-slate-700/80 rounded-3xl p-4 flex flex-col justify-between transition-all duration-200 hover:border-slate-600 m3-elevation-1 min-w-0">
      <div className="flex items-center justify-between gap-2 mb-2 min-w-0">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">{label}</span>
        {icon && <div className={`p-1.5 rounded-xl border shrink-0 ${cfg.bg}`}>{icon}</div>}
      </div>
      <div className={`text-xl font-bold font-mono tracking-tight truncate ${cfg.text}`}>{value}</div>
      {sub && <div className="text-[10px] text-slate-400 mt-1 truncate">{sub}</div>}
    </div>
  );
};

/* ==========================================================================
   Material Design 3 Empty States
   ========================================================================== */

export const EmptyState: React.FC<{
  icon?: React.ReactNode;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}> = ({ icon, title, hint, action }) => {
  return (
    <div className="bg-[#1E293B]/60 border border-slate-800/80 rounded-3xl p-8 text-center flex flex-col items-center justify-center animate-m3-fade-in">
      <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-3 shadow-inner">
        {icon || <HelpCircle size={28} />}
      </div>
      <p className="text-sm font-bold text-white">{title}</p>
      {hint && <p className="text-xs text-slate-400 mt-1 max-w-xs">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};

/* ==========================================================================
   Material Design 3 Status Pills & Badges
   ========================================================================== */

export const StatusPill: React.FC<{ status: LoanStatus | BorrowingStatus | string }> = ({ status }) => {
  const configs: Record<string, { label: string; cls: string }> = {
    ACTIVE: { label: 'Active', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    OVERDUE: { label: 'Overdue', cls: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
    PARTIALLY_SETTLED: { label: 'Partial', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    CLOSED: { label: 'Closed', cls: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30' },
    WRITTEN_OFF: { label: 'Written-off', cls: 'bg-slate-700/40 text-slate-400 border-slate-700' },
    DRAFT: { label: 'Draft', cls: 'bg-slate-800 text-slate-400 border-slate-700' },
  };

  const c = configs[status] || { label: status, cls: 'bg-slate-800 text-slate-300 border-slate-700' };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${c.cls} inline-flex items-center gap-1 shrink-0 whitespace-nowrap`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      <span>{c.label}</span>
    </span>
  );
};

/* ==========================================================================
   Material Design 3 Switch
   ========================================================================== */

export const ToggleSwitch: React.FC<{
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
  label?: string;
}> = ({ checked, onChange, disabled, label }) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="min-h-[48px] min-w-[48px] inline-flex items-center justify-center -my-2 -mx-1 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed select-none"
      aria-label={label}
    >
      <span
        className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
          checked ? 'bg-indigo-600' : 'bg-slate-800'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </span>
    </button>
  );
};

/* ==========================================================================
   Currency Input Field
   ========================================================================== */

export const CurrencyInputField: React.FC<{
  value: string | number;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}> = ({ value, onChange, placeholder = '0', className = '', autoFocus }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const cursorRef = useRef<number | null>(null);

  const clean = cleanNumericString(value);
  const formatted = formatNumberWithCommas(clean);

  useEffect(() => {
    const el = inputRef.current;
    const prevPos = cursorRef.current;
    cursorRef.current = null;

    if (!el || prevPos === null || document.activeElement !== el) return;

    let digitsSeen = 0;
    let targetPos = formatted.length;

    if (prevPos === 0) {
      targetPos = 0;
    } else {
      for (let i = 0; i < formatted.length; i++) {
        if (formatted[i] !== ',') {
          digitsSeen++;
        }
        if (digitsSeen === prevPos) {
          targetPos = i + 1;
          break;
        }
      }
    }

    try {
      el.setSelectionRange(targetPos, targetPos);
    } catch {
      // ignore
    }
  }, [formatted]);

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      autoFocus={autoFocus}
      className={`${COMMON_INPUT_CLASS} font-mono ${className}`}
      placeholder={placeholder}
      value={formatted}
      onChange={e => {
        const el = e.target;
        const sel = el.selectionStart === null ? el.value.length : el.selectionStart;
        cursorRef.current = el.value.slice(0, sel).replace(/[^0-9.]/g, '').length;
        onChange(cleanNumericString(el.value));
      }}
    />
  );
};

/* ==========================================================================
   Date Picker Field
   ========================================================================== */

export const DatePickerField: React.FC<{
  id?: string;
  value: string;
  onChange: (val: string) => void;
  className?: string;
}> = ({ id, value, onChange, className = '' }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    if (inputRef.current && typeof (inputRef.current as any).showPicker === 'function') {
      try {
        (inputRef.current as any).showPicker();
      } catch {
        inputRef.current.focus();
      }
    } else {
      inputRef.current?.focus();
    }
  };

  return (
    <div className="relative">
      <input
        id={id}
        ref={inputRef}
        type="date"
        className={`${COMMON_INPUT_CLASS} pr-12 ${className}`}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      <button
        type="button"
        onClick={openPicker}
        className="w-12 h-12 min-w-[48px] min-h-[48px] flex items-center justify-center absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-400 transition"
        tabIndex={-1}
        aria-label="Open date picker"
      >
        <CalendarIcon size={18} />
      </button>
    </div>
  );
};

/* ==========================================================================
   Material Design 3 PIN Keypad with Tactile Feedback
   ========================================================================== */

export const PinKeypad: React.FC<{
  value: string;
  onChange: (val: string) => void;
  maxLen?: number;
  disabled?: boolean;
  leftAction?: {
    icon: React.ReactNode;
    label?: string;
    onClick: () => void;
    disabled?: boolean;
  };
}> = ({ value, onChange, maxLen = 6, disabled, leftAction }) => {
  const onKey = (digit: string) => {
    if (disabled) return;
    if (digit === 'del') {
      onChange(value.slice(0, -1));
      return;
    }
    if (value.length < maxLen) {
      onChange(value + digit);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (disabled) return;
      if (/^[0-9]$/.test(e.key)) {
        onKey(e.key);
      } else if (e.key === 'Backspace') {
        onKey('del');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [value, disabled, maxLen]);

  return (
    <div className="w-full max-w-[280px] sm:max-w-xs mx-auto select-none">
      {/* PIN dot indicators */}
      <div className="flex justify-center gap-3 mb-3" role="status" aria-label={`${value.length} of ${maxLen} digits entered`}>
        {Array.from({ length: maxLen }).map((_, idx) => {
          const filled = idx < value.length;
          return (
            <div
              key={idx}
              className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-200 ${
                filled
                  ? 'bg-indigo-400 border-indigo-400 scale-110 shadow-md shadow-indigo-500/50'
                  : 'border-slate-700 bg-slate-900/50'
              }`}
            />
          );
        })}
      </div>

      {/* Numeric Keypad Matrix */}
      <div className="grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'action', '0', 'del'].map((key, i) => {
          if (key === 'action') {
            if (!leftAction) {
              return <div key={i} className="min-h-[48px]" />;
            }
            return (
              <button
                key={i}
                type="button"
                disabled={disabled || leftAction.disabled}
                onClick={leftAction.onClick}
                className="h-12 min-h-[48px] rounded-2xl bg-indigo-500/15 border border-indigo-500/30 hover:border-indigo-400 active:bg-indigo-600 active:text-white active:scale-95 text-indigo-300 flex items-center justify-center transition-all duration-150 disabled:opacity-30 shadow-sm m3-state-layer"
                aria-label={leftAction.label || 'Biometric Unlock'}
                title={leftAction.label || 'Biometric Unlock'}
              >
                {leftAction.icon}
              </button>
            );
          }

          return (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => onKey(key)}
              className="h-12 min-h-[48px] rounded-2xl bg-[#1E293B] border border-slate-700/80 hover:border-indigo-500/50 active:bg-indigo-600 active:text-white active:scale-95 text-base font-bold text-slate-100 flex items-center justify-center transition-all duration-150 disabled:opacity-30 shadow-sm m3-state-layer"
              aria-label={key === 'del' ? 'Delete digit' : `Digit ${key}`}
            >
              {key === 'del' ? <Delete size={20} className="text-slate-400" /> : key}
            </button>
          );
        })}
      </div>
    </div>
  );
};

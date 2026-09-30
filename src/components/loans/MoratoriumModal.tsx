import React, { useState } from 'react';
import { PauseCircle, X, CheckCircle2, PlayCircle } from 'lucide-react';
import { Loan, MoratoriumLog } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatDateDisplay, getTodayISO, calculateNextDueDate, parseISODate } from '../../utils/date';
import { generateNextId } from '../../utils/calculations';

interface MoratoriumModalProps {
  loan: Loan;
  onClose: () => void;
  onUpdated?: (updatedLoan: Loan) => void;
}

export const MoratoriumModal: React.FC<MoratoriumModalProps> = ({
  loan,
  onClose,
  onUpdated,
}) => {
  const { data, updateData } = useAuth();
  const toast = useToast();
  const todayISO = getTodayISO();

  const customer = data.customers.find(c => c.id === loan.customerId);
  const isCurrentlyInMoratorium = !!(
    loan.activeMoratoriumUntil &&
    parseISODate(todayISO) <= parseISODate(loan.activeMoratoriumUntil)
  );

  const [startDate, setStartDate] = useState<string>(todayISO);
  const [cycles, setCycles] = useState<number>(3);
  const [moratoriumType, setMoratoriumType] = useState<'FULL_PAYMENT' | 'PRINCIPAL_ONLY'>(
    'FULL_PAYMENT'
  );
  const [notes, setNotes] = useState<string>('');

  // Calculate resumed due date
  const resumedDate = calculateNextDueDate(startDate, cycles, loan.frequency);

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (cycles <= 0) {
      toast.push('Please select at least 1 cycle to defer', 'error');
      return;
    }
    if (!notes.trim()) {
      toast.push('Please enter a note or reason for granting the moratorium', 'error');
      return;
    }

    const logId = generateNextId('MOR', (loan.moratoriumHistory || []) as any, data);

    const logEntry: MoratoriumLog = {
      id: logId,
      appliedDate: todayISO,
      startDate,
      cyclesDeferred: cycles,
      type: moratoriumType,
      resumedDueDate: resumedDate,
      notes: notes.trim(),
    };

    const updatedLoan: Loan = {
      ...loan,
      activeMoratoriumUntil: resumedDate,
      nextDueDate: resumedDate,
      status: 'ACTIVE',
      moratoriumHistory: [...(loan.moratoriumHistory || []), logEntry],
    };

    updateData(prev => ({
      ...prev,
      loans: prev.loans.map(l => (l.id === loan.id ? updatedLoan : l)),
    }));

    toast.push(`Moratorium granted until ${formatDateDisplay(resumedDate)}`, 'success');
    if (onUpdated) onUpdated(updatedLoan);
    onClose();
  };

  const handleCancelMoratorium = () => {
    const nextDue = calculateNextDueDate(todayISO, 1, loan.frequency);
    const updatedLoan: Loan = {
      ...loan,
      activeMoratoriumUntil: undefined,
      nextDueDate: nextDue,
    };

    updateData(prev => ({
      ...prev,
      loans: prev.loans.map(l => (l.id === loan.id ? updatedLoan : l)),
    }));

    toast.push('Active moratorium revoked. Standard repayment schedule resumed.', 'info');
    if (onUpdated) onUpdated(updatedLoan);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-end justify-center select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[440px] mx-auto bg-[#1E293B] border-t border-slate-700/80 rounded-t-[28px] rounded-b-none p-4 sm:p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto no-scrollbar animate-m3-slide-up pb-8"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-full flex items-center justify-center pt-1 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-500/70" />
        </div>

        <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center">
              <PauseCircle size={18} />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Moratorium / EMI Holiday</h3>
              <p className="text-[11px] text-slate-400">
                {customer?.name} • ID: {loan.id}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-full bg-[#0F172A] border border-slate-700/60 flex items-center justify-center text-slate-400 hover:text-white active:scale-95 transition"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {isCurrentlyInMoratorium ? (
          <div className="space-y-4">
            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-2xl p-4 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-cyan-300">
                <PauseCircle size={16} />
                <span>Moratorium is currently ACTIVE</span>
              </div>
              <p className="text-slate-300">
                Repayments and late penalties are paused until{' '}
                <span className="font-bold text-white font-mono">
                  {formatDateDisplay(loan.activeMoratoriumUntil)}
                </span>
                .
              </p>
            </div>

            <button
              onClick={handleCancelMoratorium}
              className="w-full min-h-[48px] py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-sm flex items-center justify-center gap-2 transition active:scale-95"
            >
              <PlayCircle size={18} />
              <span>Resume Standard Repayments Now</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleApply} className="space-y-3.5">
            <div className="bg-[#0F172A] rounded-2xl p-3.5 border border-slate-700/70 text-xs text-slate-300 space-y-1">
              <p className="font-semibold text-white">How Moratorium Works:</p>
              <p className="text-[11px] text-slate-400">
                Grants a temporary grace holiday to the borrower. Penalties will not accrue
                and the loan will not be marked overdue during this window.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Effective From
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-3 min-h-[48px] h-12 text-sm text-white outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Cycles Deferred ({loan.frequency.toLowerCase()}s)
                </label>
                <select
                  value={cycles}
                  onChange={e => setCycles(Number(e.target.value))}
                  className="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-3 min-h-[48px] h-12 text-sm text-white outline-none focus:border-cyan-400"
                >
                  <option value={1}>1 cycle</option>
                  <option value={2}>2 cycles</option>
                  <option value={3}>3 cycles</option>
                  <option value={6}>6 cycles</option>
                  <option value={12}>12 cycles</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Moratorium Policy
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMoratoriumType('FULL_PAYMENT')}
                  className={`min-h-[48px] p-2.5 rounded-xl border text-center text-xs flex items-center justify-center transition active:scale-95 ${
                    moratoriumType === 'FULL_PAYMENT'
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-bold'
                      : 'bg-[#0F172A] border-slate-700 text-slate-400'
                  }`}
                >
                  Full Holiday (Zero Pay)
                </button>
                <button
                  type="button"
                  onClick={() => setMoratoriumType('PRINCIPAL_ONLY')}
                  className={`min-h-[48px] p-2.5 rounded-xl border text-center text-xs flex items-center justify-center transition active:scale-95 ${
                    moratoriumType === 'PRINCIPAL_ONLY'
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-bold'
                      : 'bg-[#0F172A] border-slate-700 text-slate-400'
                  }`}
                >
                  Interest Only (Defer Prin)
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Reason / Approval Notes *
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Borrower requested 2-month relief due to agricultural monsoon cycle."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full bg-[#0F172A] border border-slate-700 rounded-xl p-3 min-h-[48px] text-sm text-white placeholder:text-slate-500 outline-none focus:border-cyan-400"
                required
              />
            </div>

            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-2xl p-3 text-xs flex items-center justify-between font-mono">
              <span className="text-slate-300">Resumed Next Due Date:</span>
              <span className="font-bold text-cyan-400">{formatDateDisplay(resumedDate)}</span>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 min-h-[48px] h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 font-semibold text-sm transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 min-h-[48px] h-12 rounded-2xl bg-cyan-600 hover:bg-cyan-500 active:scale-95 text-white font-bold text-sm shadow-lg shadow-cyan-600/30 transition flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 size={16} />
                <span>Grant Moratorium</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

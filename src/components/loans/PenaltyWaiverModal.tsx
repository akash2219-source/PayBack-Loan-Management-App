import React, { useState } from 'react';
import { Tag, X, CheckCircle2 } from 'lucide-react';
import { Loan, PenaltyWaiverLog, Transaction } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatCurrency } from '../../utils/currency';
import { getTodayISO } from '../../utils/date';
import { computeAccruedPenalty, generateNextId } from '../../utils/calculations';

interface PenaltyWaiverModalProps {
  loan: Loan;
  onClose: () => void;
  onWaived?: (updatedLoan: Loan) => void;
}

export const PenaltyWaiverModal: React.FC<PenaltyWaiverModalProps> = ({
  loan,
  onClose,
  onWaived,
}) => {
  const { data, updateData } = useAuth();
  const toast = useToast();
  const todayISO = getTodayISO();

  const customer = data.customers.find(c => c.id === loan.customerId);
  const accruedPenalty = computeAccruedPenalty(loan, todayISO);

  const [waiverAmount, setWaiverAmount] = useState<string>(String(accruedPenalty));
  const [reason, setReason] = useState<string>('');

  const numWaiver = Number(waiverAmount) || 0;

  const handleSetPercent = (pct: number) => {
    const val = Math.round((accruedPenalty * pct) / 100);
    setWaiverAmount(String(val));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (numWaiver <= 0) {
      toast.push('Please enter a waiver amount greater than zero', 'error');
      return;
    }
    if (numWaiver > accruedPenalty) {
      toast.push(`Waiver cannot exceed accrued penalty amount of ${formatCurrency(accruedPenalty)}`, 'error');
      return;
    }
    if (!reason.trim()) {
      toast.push('Please provide a reason for granting this penalty waiver', 'error');
      return;
    }

    const waiverId = generateNextId('WVR', (loan.penaltyWaivers || []) as any, data);
    const waiverEntry: PenaltyWaiverLog = {
      id: waiverId,
      date: todayISO,
      amountWaived: numWaiver,
      reason: reason.trim(),
    };

    const updatedWaivedTotal = (loan.waivedPenaltyTotal || 0) + numWaiver;

    const updatedLoan: Loan = {
      ...loan,
      waivedPenaltyTotal: updatedWaivedTotal,
      penaltyWaivers: [...(loan.penaltyWaivers || []), waiverEntry],
    };

    const txnId = generateNextId('TXN', data.transactions, data);
    const auditTxn: Transaction = {
      id: txnId,
      loanId: loan.id,
      type: 'PENALTY_WAIVER',
      date: todayISO,
      amount: numWaiver,
      paymentMode: 'CASH',
      appliedToPenalty: numWaiver,
      appliedToInterest: 0,
      appliedToPrincipal: 0,
      excessAdvance: 0,
      status: 'VALID',
      notes: `Late penalty waived: ${formatCurrency(numWaiver)}. Reason: ${reason.trim()}`,
    };

    updateData(prev => ({
      ...prev,
      loans: prev.loans.map(l => (l.id === loan.id ? updatedLoan : l)),
      transactions: [auditTxn, ...prev.transactions],
    }));

    toast.push(`Penalty waiver of ${formatCurrency(numWaiver)} applied to account`, 'success');
    if (onWaived) onWaived(updatedLoan);
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
            <div className="w-9 h-9 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center">
              <Tag size={18} />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Penalty & Arrears Waiver</h3>
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

        {/* Accrued Penalty Box */}
        <div className="bg-[#0F172A] rounded-2xl p-4 border border-rose-500/30 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Currently Accrued Penalty
            </span>
            <span className="text-xl font-bold font-mono text-rose-400">
              {formatCurrency(accruedPenalty)}
            </span>
          </div>
          {loan.waivedPenaltyTotal ? (
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Previously Waived
              </span>
              <span className="text-xs font-bold font-mono text-emerald-400">
                {formatCurrency(loan.waivedPenaltyTotal)}
              </span>
            </div>
          ) : null}
        </div>

        {accruedPenalty <= 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs space-y-2">
            <CheckCircle2 size={32} className="mx-auto text-emerald-400" />
            <p className="font-semibold text-white">No Accrued Penalties</p>
            <p className="text-[11px]">This loan is either up to date or has already had all late fees settled/waived.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Quick Percentage Chips */}
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">
                Quick Selection
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[25, 50, 75, 100].map(pct => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => handleSetPercent(pct)}
                    className="min-h-[48px] py-2 px-1.5 bg-[#0F172A] hover:bg-slate-800 active:scale-95 border border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-mono font-semibold transition flex items-center justify-center text-center"
                  >
                    {pct === 100 ? '100% (Full)' : `${pct}%`}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Amount to Waive (₹) *
              </label>
              <input
                type="number"
                max={accruedPenalty}
                value={waiverAmount}
                onChange={e => setWaiverAmount(e.target.value)}
                className="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-3 min-h-[48px] h-12 text-sm text-white font-mono font-bold outline-none focus:border-rose-400"
                required
              />
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Waiver Justification / Reason *
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Borrower agreed to clear full principal in lump sum; late interest waived as settlement incentive."
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="w-full bg-[#0F172A] border border-slate-700 rounded-xl p-3 min-h-[48px] text-sm text-white placeholder:text-slate-500 outline-none focus:border-rose-400"
                required
              />
            </div>

            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3 text-xs flex items-center justify-between font-mono">
              <span className="text-slate-300">Remaining Penalty After Waiver:</span>
              <span className="font-bold text-emerald-400">
                {formatCurrency(Math.max(0, accruedPenalty - numWaiver))}
              </span>
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
                className="flex-1 min-h-[48px] h-12 rounded-2xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold text-sm shadow-lg shadow-rose-600/30 transition flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 size={16} />
                <span>Confirm Waiver</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

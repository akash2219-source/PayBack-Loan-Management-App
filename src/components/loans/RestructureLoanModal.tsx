import React, { useState, useMemo } from 'react';
import {
  RotateCcw,
  X,
  CheckCircle2,
} from 'lucide-react';
import { Loan, PaymentFrequency, RestructureLog, Transaction } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatCurrency } from '../../utils/currency';
import { getTodayISO, calculateNextDueDate } from '../../utils/date';
import {
  computeAccruedPenalty,
  computeExpectedCyclePayment,
  computeFlatLoan,
  computeReducingLoan,
  generateNextId,
  getEffectiveMonthlyRate,
} from '../../utils/calculations';

interface RestructureLoanModalProps {
  loan: Loan;
  onClose: () => void;
  onRestructured?: (updatedLoan: Loan) => void;
}

export const RestructureLoanModal: React.FC<RestructureLoanModalProps> = ({
  loan,
  onClose,
  onRestructured,
}) => {
  const { data, updateData } = useAuth();
  const toast = useToast();
  const todayISO = getTodayISO();

  const customer = data.customers.find(c => c.id === loan.customerId);
  const accruedPenalty = computeAccruedPenalty(loan, todayISO);
  const currentInstallment = computeExpectedCyclePayment(loan);

  // Restructure form state
  const [capitalizePenalty, setCapitalizePenalty] = useState<boolean>(false);
  const [additionalPrincipal, setAdditionalPrincipal] = useState<string>('0');
  const [newRate, setNewRate] = useState<string>(
    String(loan.interestRateEntered ?? loan.interestRate)
  );
  const [newTenure, setNewTenure] = useState<string>(String(loan.tenure || 12));
  const [newFrequency, setNewFrequency] = useState<PaymentFrequency>(loan.frequency);
  const [reason, setReason] = useState<string>('');

  const numAdditional = Number(additionalPrincipal) || 0;
  const numRate = Number(newRate) || loan.interestRate;
  const numTenure = Math.max(1, Number(newTenure) || 1);

  // Compute restructured new principal
  const penaltyToAdd = capitalizePenalty ? accruedPenalty : 0;
  const newPrincipal = Math.max(
    0,
    loan.currentPrincipalBalance + penaltyToAdd + numAdditional
  );

  // Compute new periodic installment preview
  const newInstallment = useMemo(() => {
    const mockLoan = {
      frequency: newFrequency,
      interestRate: numRate,
      principal: newPrincipal,
      currentPrincipalBalance: newPrincipal,
    };
    const r = getEffectiveMonthlyRate(mockLoan);
    if (loan.type === 'INTEREST_ONLY') {
      return newPrincipal * r;
    }
    if (loan.interestMethod === 'FLAT') {
      return computeFlatLoan(newPrincipal, r, numTenure).emi;
    }
    return computeReducingLoan(newPrincipal, r, numTenure).emi;
  }, [loan.type, loan.interestMethod, newFrequency, numRate, newPrincipal, numTenure]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.push('Please enter a mandatory restructuring reason for audit compliance', 'error');
      return;
    }
    if (newPrincipal <= 0) {
      toast.push('Restructured principal must be greater than zero', 'error');
      return;
    }

    const logId = generateNextId('RST', (loan.restructuringHistory || []) as any, data);
    const newDueDate = calculateNextDueDate(todayISO, 1, newFrequency);

    const logEntry: RestructureLog = {
      id: logId,
      date: todayISO,
      previousPrincipal: loan.currentPrincipalBalance,
      newPrincipal,
      previousInterestRate: loan.interestRateEntered ?? loan.interestRate,
      newInterestRate: numRate,
      previousTenure: loan.tenure,
      newTenure: numTenure,
      previousFrequency: loan.frequency,
      newFrequency,
      capitalizedInterest: 0,
      capitalizedPenalty: penaltyToAdd,
      reason: reason.trim(),
    };

    const updatedLoan: Loan = {
      ...loan,
      principal: newPrincipal,
      currentPrincipalBalance: newPrincipal,
      interestRate: numRate,
      interestRateEntered: numRate,
      frequency: newFrequency,
      tenure: numTenure,
      nextDueDate: newDueDate,
      emiAmount: loan.type === 'EMI' ? Math.round(newInstallment) : undefined,
      interestPerCycle: loan.type === 'INTEREST_ONLY' ? Math.round(newInstallment) : undefined,
      restructuringHistory: [...(loan.restructuringHistory || []), logEntry],
      status: 'ACTIVE',
      // If penalty was capitalized into principal, reset accrued penalty
      waivedPenaltyTotal: capitalizePenalty
        ? (loan.waivedPenaltyTotal || 0) + accruedPenalty
        : loan.waivedPenaltyTotal,
    };

    const txnId = generateNextId('TXN', data.transactions, data);
    const auditTxn: Transaction = {
      id: txnId,
      loanId: loan.id,
      type: 'RESTRUCTURE',
      date: todayISO,
      amount: newPrincipal,
      paymentMode: 'CASH',
      appliedToPenalty: penaltyToAdd,
      appliedToInterest: 0,
      appliedToPrincipal: 0,
      excessAdvance: 0,
      status: 'VALID',
      notes: `Loan restructured: Tenure=${numTenure} ${newFrequency.toLowerCase()}s, Rate=${numRate}%. Reason: ${reason.trim()}`,
    };

    updateData(prev => ({
      ...prev,
      loans: prev.loans.map(l => (l.id === loan.id ? updatedLoan : l)),
      transactions: [auditTxn, ...prev.transactions],
    }));

    toast.push('Loan successfully restructured with refreshed amortization plan', 'success');
    if (onRestructured) onRestructured(updatedLoan);
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
            <div className="w-9 h-9 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
              <RotateCcw size={18} />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Restructure Loan Terms</h3>
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

        {/* Current State Summary */}
        <div className="bg-[#0F172A] rounded-2xl p-3.5 border border-slate-700/70 grid grid-cols-3 gap-2 text-center text-xs">
          <div>
            <span className="text-[10px] text-slate-400 uppercase block">Current Principal</span>
            <span className="font-bold font-mono text-white">
              {formatCurrency(loan.currentPrincipalBalance)}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase block">Current Rate</span>
            <span className="font-bold font-mono text-white">
              {loan.interestRateEntered ?? loan.interestRate}%
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase block">Current Payment</span>
            <span className="font-bold font-mono text-emerald-400">
              {formatCurrency(currentInstallment)}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Penalty Capitalization Option */}
          {accruedPenalty > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-amber-300">
                  Pending Penalty: {formatCurrency(accruedPenalty)}
                </p>
                <p className="text-[11px] text-slate-400">
                  Consolidate penalty into new principal balance
                </p>
              </div>
              <label className="relative inline-flex items-center justify-center min-w-[48px] min-h-[48px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={capitalizePenalty}
                  onChange={e => setCapitalizePenalty(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[14px] after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>
          )}

          {/* Form Inputs Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Top-up / Additional Principal (₹)
              </label>
              <input
                type="number"
                placeholder="0"
                value={additionalPrincipal}
                onChange={e => setAdditionalPrincipal(e.target.value)}
                className="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-3 min-h-[48px] h-12 text-sm text-white font-mono outline-none focus:border-indigo-400"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                New Interest Rate (% p.m.) *
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="e.g. 2.0"
                value={newRate}
                onChange={e => setNewRate(e.target.value)}
                className="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-3 min-h-[48px] h-12 text-sm text-white font-mono outline-none focus:border-indigo-400"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Frequency *
              </label>
              <select
                value={newFrequency}
                onChange={e => setNewFrequency(e.target.value as PaymentFrequency)}
                className="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-3 min-h-[48px] h-12 text-sm text-white outline-none focus:border-indigo-400"
              >
                <option value="DAILY">Daily (Pigmy Field)</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                New Tenure ({newFrequency.toLowerCase()}s) *
              </label>
              <input
                type="number"
                min="1"
                placeholder="e.g. 30"
                value={newTenure}
                onChange={e => setNewTenure(e.target.value)}
                className="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-3 min-h-[48px] h-12 text-sm text-white font-mono outline-none focus:border-indigo-400"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
              Restructuring Reason (Mandatory Audit Note) *
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Borrower experienced cashflow drop; agreed to extend tenure and reduce monthly installment burden."
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full bg-[#0F172A] border border-slate-700 rounded-xl p-3 min-h-[48px] text-sm text-white placeholder:text-slate-500 outline-none focus:border-indigo-400"
              required
            />
          </div>

          {/* New Repayment Preview Banner */}
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3.5 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-emerald-300">Revised Installment Preview:</span>
              <span className="text-base font-extrabold font-mono text-emerald-400">
                {formatCurrency(newInstallment)} / {newFrequency.toLowerCase()}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span>Restructured Balance: {formatCurrency(newPrincipal)}</span>
              <span>Tenure: {numTenure} cycles</span>
            </div>
          </div>

          {/* Actions */}
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
              className="flex-1 min-h-[48px] h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 size={16} />
              <span>Apply Restructuring</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

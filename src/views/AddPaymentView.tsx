import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';
import { useToast } from '../context/ToastContext';
import { formatCurrency } from '../utils/currency';
import { getTodayISO, calculateNextDueDate } from '../utils/date';
import {
  computeExpectedCyclePayment,
  computeExpectedInterestPerCycle,
  computeAccruedPenalty,
  computeWaterfall,
  computeLoanStatus,
  generateNextId,
} from '../utils/calculations';
import { PaymentMode, Transaction } from '../types';
import {
  ScreenHeader,
  COMMON_INPUT_CLASS,
  CurrencyInputField,
  DatePickerField,
} from '../components/common/UIComponents';

export const AddPaymentView: React.FC<{ loanId?: string }> = ({ loanId: initialLoanId }) => {
  const { data, updateData } = useAuth();
  const nav = useNavigation();
  const toast = useToast();
  const todayISO = getTodayISO();

  const [selectedLoanId, setSelectedLoanId] = useState<string>(
    initialLoanId ||
      data.loans.find(
        l => l.status === 'ACTIVE' || l.status === 'OVERDUE' || l.status === 'PARTIALLY_SETTLED'
      )?.id ||
      ''
  );

  const loan = data.loans.find(l => l.id === selectedLoanId);
  const customer = loan ? data.customers.find(c => c.id === loan.customerId) : null;

  const [amount, setAmount] = useState<string>('');
  const [date, setDate] = useState<string>(todayISO);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('CASH');
  const [notes, setNotes] = useState<string>('');

  const numAmount = Number(amount) || 0;

  // Accrued penalties & expected cycle amount
  const penalty = useMemo(() => (loan ? computeAccruedPenalty(loan, date) : 0), [loan, date]);
  const expectedCycle = useMemo(
    () => (loan ? computeExpectedCyclePayment(loan) : 0),
    [loan]
  );
  const interestOnly = useMemo(
    () => (loan ? computeExpectedInterestPerCycle(loan) : 0),
    [loan]
  );

  // Live waterfall breakdown
  const waterfall = useMemo(() => {
    if (!loan || numAmount <= 0) return null;
    return computeWaterfall(loan, numAmount, date);
  }, [loan, numAmount, date]);

  const newPrincipalBalance = useMemo(() => {
    if (!loan) return 0;
    if (!waterfall) return loan.currentPrincipalBalance;
    return Math.max(0, loan.currentPrincipalBalance - waterfall.appliedToPrincipal);
  }, [loan, waterfall]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loan) {
      toast.push('Please select an active loan.', 'error');
      return;
    }
    if (numAmount <= 0) {
      toast.push('Please enter a valid payment amount.', 'error');
      return;
    }

    const wf = computeWaterfall(loan, numAmount, date);
    const txnId = generateNextId('TXN', data.transactions, data);

    const totalAvailable = numAmount + (loan.excessCreditBalance || 0);
    const expectedInstallment = Math.round(computeExpectedCyclePayment(loan));
    const penaltyDue = computeAccruedPenalty(loan, date);
    const clearsCycle = totalAvailable >= penaltyDue + expectedInstallment;
    const isPartial = numAmount > 0 && !clearsCycle;
    const shortfall = Math.max(0, penaltyDue + expectedInstallment - totalAvailable);

    // Calculate next due date if cycle is cleared
    let nextDueDate = loan.nextDueDate;
    if (clearsCycle && loan.nextDueDate && loan.nextDueDate !== 'N/A') {
      nextDueDate = calculateNextDueDate(loan.nextDueDate, 1, loan.frequency);
    }

    const updatedBalance = Math.max(0, loan.currentPrincipalBalance - wf.appliedToPrincipal);
    const isClosed = updatedBalance <= 0;

    const newTxn: Transaction = {
      id: txnId,
      loanId: loan.id,
      type: 'PAYMENT',
      date,
      amount: numAmount,
      paymentMode,
      appliedToPenalty: wf.appliedToPenalty,
      appliedToInterest: wf.appliedToInterest,
      appliedToPrincipal: wf.appliedToPrincipal,
      excessAdvance: wf.excessAdvance,
      principalBalanceBefore: loan.currentPrincipalBalance,
      isPartial,
      cycleShortfall: isPartial ? shortfall : 0,
      notes: notes.trim(),
      status: 'VALID',
    };

    updateData(prev => {
      const updatedLoans = prev.loans.map(l => {
        if (l.id !== loan.id) return l;
        const updated = {
          ...l,
          currentPrincipalBalance: updatedBalance,
          excessCreditBalance: wf.excessAdvance,
          nextDueDate: isClosed ? 'N/A' : nextDueDate,
          lastPaymentDate: date,
          status: isClosed ? ('CLOSED' as const) : computeLoanStatus({ ...l, nextDueDate }),
        };
        return updated;
      });

      return {
        ...prev,
        loans: updatedLoans,
        transactions: [...prev.transactions, newTxn],
      };
    });

    toast.push(
      isClosed ? 'Payment recorded! Loan is now fully settled.' : 'Payment successfully recorded.',
      'success'
    );
    nav.pop();
  };

  return (
    <div className="space-y-4">
      <ScreenHeader title="Record Payment" subtitle="Incoming repayment & interest" />

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Loan Selection */}
        <div className="bg-[#1E293B]/70 border border-slate-700/70 rounded-3xl p-5 shadow-xl space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Select Active Loan</label>
            <select
              value={selectedLoanId}
              onChange={e => setSelectedLoanId(e.target.value)}
              className={COMMON_INPUT_CLASS}
            >
              {data.loans
                .filter(l => l.status === 'ACTIVE' || l.status === 'OVERDUE' || l.status === 'PARTIALLY_SETTLED')
                .map(l => {
                  const cust = data.customers.find(c => c.id === l.customerId);
                  return (
                    <option key={l.id} value={l.id}>
                      {cust?.name || 'Client'} — {l.loanName || l.id} (Bal: {formatCurrency(l.currentPrincipalBalance)})
                    </option>
                  );
                })}
            </select>
          </div>

          {loan && (
            <div className="space-y-2 pt-1">
              {customer && (
                <div className="text-xs text-slate-300 flex items-center justify-between bg-[#0F172A]/40 px-3 py-1.5 rounded-xl border border-slate-700/40">
                  <span className="text-slate-400">Borrower:</span>
                  <span className="font-semibold text-white">{customer.name} ({customer.phone})</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-[#0F172A]/70 p-2.5 rounded-xl border border-slate-700/60">
                  <span className="text-slate-400 block">Current Balance</span>
                  <span className="font-bold text-emerald-400 font-mono">
                    {formatCurrency(loan.currentPrincipalBalance)}
                  </span>
                </div>
                <div className="bg-[#0F172A]/70 p-2.5 rounded-xl border border-slate-700/60">
                  <span className="text-slate-400 block">Expected Installment</span>
                  <span className="font-bold text-white font-mono">{formatCurrency(expectedCycle)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Payment Input Card */}
        <div className="bg-[#1E293B]/70 border border-slate-700/70 rounded-3xl p-5 shadow-xl space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Payment Amount (₹)</label>
            <CurrencyInputField value={amount} onChange={setAmount} autoFocus />

            {/* Quick Presets */}
            {loan && (
              <div className="flex flex-wrap gap-2 mt-2.5">
                <button
                  type="button"
                  onClick={() => setAmount(String(expectedCycle + penalty))}
                  className="min-h-[48px] px-3.5 py-2.5 rounded-xl bg-[#0F172A] border border-slate-700/60 hover:border-indigo-500/40 text-xs font-semibold text-indigo-300 transition active:scale-95 flex items-center justify-center"
                >
                  Full Installment ({formatCurrency(expectedCycle + penalty)})
                </button>
                {loan.type === 'INTEREST_ONLY' && (
                  <button
                    type="button"
                    onClick={() => setAmount(String(interestOnly + penalty))}
                    className="min-h-[48px] px-3.5 py-2.5 rounded-xl bg-[#0F172A] border border-slate-700/60 hover:border-indigo-500/40 text-xs font-semibold text-indigo-300 transition active:scale-95 flex items-center justify-center"
                  >
                    Interest Only ({formatCurrency(interestOnly + penalty)})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setAmount(String(loan.currentPrincipalBalance + interestOnly + penalty))
                  }
                  className="min-h-[48px] px-3.5 py-2.5 rounded-xl bg-[#0F172A] border border-slate-700/60 hover:border-emerald-500/40 text-xs font-semibold text-emerald-400 transition active:scale-95 flex items-center justify-center"
                >
                  Full Settlement
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Payment Date</label>
              <DatePickerField value={date} onChange={setDate} />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Payment Mode</label>
              <select
                value={paymentMode}
                onChange={e => setPaymentMode(e.target.value as PaymentMode)}
                className={COMMON_INPUT_CLASS}
              >
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Notes / Remarks (Optional)</label>
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Received by brother, UPI Txn ID"
              className={COMMON_INPUT_CLASS}
            />
          </div>
        </div>

        {/* Live Waterfall Distribution Preview */}
        {waterfall && loan && (
          <div className="bg-[#1E293B]/70 border border-indigo-500/40 rounded-3xl p-5 shadow-xl space-y-3 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-indigo-400" />
              <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                Waterfall Distribution Preview
              </h3>
            </div>

            <div className="rounded-2xl border border-slate-700/60 bg-[#0F172A]/70 divide-y divide-slate-800/80 overflow-hidden text-xs">
              <div className="flex justify-between p-3">
                <span className="text-slate-400">Late Penalty Settled</span>
                <span className="font-mono text-rose-400 font-semibold">
                  {formatCurrency(waterfall.appliedToPenalty)}
                </span>
              </div>
              <div className="flex justify-between p-3">
                <span className="text-slate-400">Interest Covered</span>
                <span className="font-mono text-indigo-300 font-semibold">
                  {formatCurrency(waterfall.appliedToInterest)}
                </span>
              </div>
              <div className="flex justify-between p-3">
                <span className="text-slate-400">Principal Reduced</span>
                <span className="font-mono text-emerald-400 font-semibold">
                  {formatCurrency(waterfall.appliedToPrincipal)}
                </span>
              </div>
              {waterfall.excessAdvance > 0 && (
                <div className="flex justify-between p-3 bg-indigo-500/10">
                  <span className="text-indigo-400 font-medium">Excess Credit (To Next Cycle)</span>
                  <span className="font-mono text-indigo-400 font-bold">
                    {formatCurrency(waterfall.excessAdvance)}
                  </span>
                </div>
              )}
              <div className="flex justify-between p-3 bg-[#1E293B]/50 font-semibold">
                <span className="text-white">Remaining Principal Balance</span>
                <span className="font-mono text-emerald-400 font-bold">
                  {formatCurrency(newPrincipalBalance)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={!loan || numAmount <= 0}
          className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 active:scale-98 transition disabled:opacity-50"
        >
          <CheckCircle2 size={18} />
          <span>Save Payment Record</span>
        </button>
      </form>
    </div>
  );
};

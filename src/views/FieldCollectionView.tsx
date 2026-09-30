import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  Phone,
  QrCode,
  Search,
  Check,
  Banknote,
  Share2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatCurrency } from '../utils/currency';
import { getTodayISO, formatDateDisplay, calculateNextDueDate } from '../utils/date';
import {
  computeExpectedCyclePayment,
  computeAccruedPenalty,
  computeWaterfall,
  computeLoanStatus,
  generateNextId,
} from '../utils/calculations';
import { Loan, Transaction, Customer, PaymentMode } from '../types';
import { ScreenHeader, EmptyState } from '../components/common/UIComponents';
import { DynamicUpiQrModal } from '../components/common/DynamicUpiQrModal';

export const FieldCollectionView: React.FC = () => {
  const { data, updateData } = useAuth();
  const toast = useToast();
  const todayISO = getTodayISO();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<'ALL_DUE' | 'DAILY_ONLY' | 'OVERDUE' | 'COLLECTED'>('ALL_DUE');
  const [selectedUpiLoan, setSelectedUpiLoan] = useState<Loan | null>(null);
  const [justCollectedId, setJustCollectedId] = useState<string | null>(null);

  // Active loans
  const activeLoans = useMemo(
    () =>
      data.loans.filter(
        l => l.status === 'ACTIVE' || l.status === 'OVERDUE' || l.status === 'PARTIALLY_SETTLED'
      ),
    [data.loans]
  );

  // Payments collected today
  const todayTransactions = useMemo(
    () =>
      data.transactions.filter(
        t => t.status === 'VALID' && t.type === 'PAYMENT' && t.date === todayISO
      ),
    [data.transactions, todayISO]
  );

  const collectedTodayTotal = useMemo(
    () => todayTransactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0),
    [todayTransactions]
  );

  const cashCollectedToday = useMemo(
    () =>
      todayTransactions
        .filter(t => t.paymentMode === 'CASH')
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0),
    [todayTransactions]
  );

  const upiCollectedToday = useMemo(
    () =>
      todayTransactions
        .filter(t => t.paymentMode === 'UPI')
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0),
    [todayTransactions]
  );

  // Daily target: sum of expected cycle payments for all daily loans + any loan due today
  const todayTarget = useMemo(() => {
    return activeLoans.reduce((sum, l) => {
      const isDaily = l.frequency === 'DAILY';
      const isDueToday = l.nextDueDate <= todayISO;
      if (isDaily || isDueToday) {
        return sum + computeExpectedCyclePayment(l);
      }
      return sum;
    }, 0);
  }, [activeLoans, todayISO]);

  const targetProgress =
    todayTarget > 0 ? Math.min(100, Math.round((collectedTodayTotal / todayTarget) * 100)) : 100;

  // Filtered Loans for the Field Sheet
  const fieldList = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return activeLoans
      .map(loan => {
        const customer = data.customers.find(c => c.id === loan.customerId);
        const expected = Math.round(computeExpectedCyclePayment(loan));
        const penalty = computeAccruedPenalty(loan, todayISO);
        const isDaily = loan.frequency === 'DAILY';
        const isOverdue = loan.status === 'OVERDUE' || loan.nextDueDate < todayISO;
        const isDueToday = loan.nextDueDate === todayISO;

        // Check if customer paid today
        const paidTodayTxn = todayTransactions.find(t => t.loanId === loan.id);

        return {
          loan,
          customer,
          expected,
          penalty,
          isDaily,
          isOverdue,
          isDueToday,
          paidTodayTxn,
        };
      })
      .filter(item => {
        if (!item.customer) return false;

        if (filterType === 'COLLECTED') {
          if (!item.paidTodayTxn) return false;
        } else if (filterType === 'DAILY_ONLY') {
          if (!item.isDaily) return false;
        } else if (filterType === 'OVERDUE') {
          if (!item.isOverdue) return false;
        } else {
          // ALL_DUE: show daily loans or anything due today or overdue
          if (!item.isDaily && !item.isDueToday && !item.isOverdue && !item.paidTodayTxn) {
            return false;
          }
        }

        if (q) {
          const matchName = item.customer.name.toLowerCase().includes(q);
          const matchPhone = item.customer.phone.includes(q);
          const matchLoan = (item.loan.loanName || '').toLowerCase().includes(q);
          const matchAddress = (item.customer.address || '').toLowerCase().includes(q);
          return matchName || matchPhone || matchLoan || matchAddress;
        }
        return true;
      })
      .sort((a, b) => {
        // Unpaid items first, then by overdue, then daily
        if (!!a.paidTodayTxn !== !!b.paidTodayTxn) return a.paidTodayTxn ? 1 : -1;
        if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
        return a.loan.nextDueDate.localeCompare(b.loan.nextDueDate);
      });
  }, [activeLoans, data.customers, todayTransactions, todayISO, filterType, searchQuery]);

  // One-Tap Quick Collect action
  const handleQuickCollect = (loan: Loan, customer: Customer, mode: PaymentMode = 'CASH') => {
    const installment = Math.round(computeExpectedCyclePayment(loan));
    if (installment <= 0) {
      toast.push('No installment due for this loan', 'info');
      return;
    }

    const wf = computeWaterfall(loan, installment, todayISO);
    const txnId = generateNextId('TXN', data.transactions, data);

    const totalAvailable = installment + (loan.excessCreditBalance || 0);
    const penaltyDue = computeAccruedPenalty(loan, todayISO);
    const clearsCycle = totalAvailable >= penaltyDue + installment;
    const isPartial = installment > 0 && !clearsCycle;
    const shortfall = Math.max(0, penaltyDue + installment - totalAvailable);

    const nextDueDate = clearsCycle
      ? calculateNextDueDate(loan.nextDueDate || todayISO, 1, loan.frequency)
      : loan.nextDueDate;

    const newPrincipal = Math.max(0, loan.currentPrincipalBalance - wf.appliedToPrincipal);

    const newTxn: Transaction = {
      id: txnId,
      loanId: loan.id,
      type: 'PAYMENT',
      date: todayISO,
      amount: installment,
      paymentMode: mode,
      appliedToPenalty: wf.appliedToPenalty,
      appliedToInterest: wf.appliedToInterest,
      appliedToPrincipal: wf.appliedToPrincipal,
      excessAdvance: wf.excessAdvance,
      principalBalanceBefore: loan.currentPrincipalBalance,
      isPartial,
      cycleShortfall: shortfall,
      status: 'VALID',
      notes: `Field collection (${mode}) recorded by agent`,
    };

    const updatedLoan: Loan = {
      ...loan,
      currentPrincipalBalance: newPrincipal,
      nextDueDate,
      lastPaymentDate: todayISO,
      excessCreditBalance: wf.excessAdvance,
      status: computeLoanStatus({
        ...loan,
        currentPrincipalBalance: newPrincipal,
        nextDueDate,
      }),
    };

    updateData(prev => ({
      ...prev,
      transactions: [newTxn, ...prev.transactions],
      loans: prev.loans.map(l => (l.id === loan.id ? updatedLoan : l)),
    }));

    setJustCollectedId(loan.id);
    toast.push(`Collected ${formatCurrency(installment)} via ${mode} from ${customer.name}!`, 'success');
  };

  const handleShareReceipt = (customer: Customer, loan: Loan, amount: number) => {
    const text = `*${data.settings.lenderName}*\nOfficial Collection Receipt\n\nDear ${customer.name},\nPayment of *${formatCurrency(amount)}* received successfully for ${loan.loanName || loan.id} on ${formatDateDisplay(todayISO)}.\nBalance Due: ${formatCurrency(loan.currentPrincipalBalance)}.\nThank you!`;
    const cleanPhone = customer.phone.replace(/[^\d+]/g, '');
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-4 pb-24 animate-m3-fade-in">
      <ScreenHeader
        title="Field & Pigmy Collection"
        subtitle="Daily door-to-door route recovery & digital UPI scan"
        right={
          <div className="flex items-center gap-1.5">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-mono">
              {formatDateDisplay(todayISO)}
            </span>
          </div>
        }
      />

      {/* Real-time Target vs Collected Header Dashboard */}
      <div className="bg-gradient-to-br from-[#1E293B] to-[#0F172A] border border-slate-700/80 rounded-3xl p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
              Today's Field Target
            </span>
            <span className="text-xl font-extrabold font-mono text-white">
              {formatCurrency(todayTarget)}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
              Collected Today
            </span>
            <span className="text-xl font-extrabold font-mono text-emerald-400">
              {formatCurrency(collectedTodayTotal)}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-slate-300">Daily Recovery Progress</span>
            <span className="text-emerald-400 font-mono">{targetProgress}%</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-emerald-500 to-teal-400 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${targetProgress}%` }}
            />
          </div>
        </div>

        {/* Cash in Hand vs UPI Breakdown */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700/60 text-xs">
          <div className="bg-[#0F172A]/70 p-2.5 rounded-xl border border-slate-700/60 flex flex-col justify-between min-w-0">
            <div className="flex items-center gap-1.5 text-slate-400 text-[11px] min-w-0">
              <Banknote size={14} className="text-amber-400 shrink-0" />
              <span className="truncate">Cash in Hand</span>
            </div>
            <span className="font-bold text-amber-300 font-mono text-sm mt-1 truncate">
              {formatCurrency(cashCollectedToday)}
            </span>
          </div>

          <div className="bg-[#0F172A]/70 p-2.5 rounded-xl border border-slate-700/60 flex flex-col justify-between min-w-0">
            <div className="flex items-center gap-1.5 text-slate-400 text-[11px] min-w-0">
              <QrCode size={14} className="text-sky-400 shrink-0" />
              <span className="truncate">UPI Digital Scans</span>
            </div>
            <span className="font-bold text-sky-300 font-mono text-sm mt-1 truncate">
              {formatCurrency(upiCollectedToday)}
            </span>
          </div>
        </div>
      </div>

      {/* Search & Filter Tabs */}
      <div className="space-y-2">
        <div className="relative">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search borrower by name, phone or route address..."
            className="w-full min-h-[48px] h-12 bg-[#1E293B] border border-slate-700/80 focus:border-indigo-400 rounded-2xl pl-10 pr-4 text-xs text-slate-100 placeholder:text-slate-500 outline-none transition"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none text-[11px]">
          {[
            { id: 'ALL_DUE', label: `Due Today (${activeLoans.filter(l => l.frequency === 'DAILY' || l.nextDueDate <= todayISO).length})` },
            { id: 'DAILY_ONLY', label: `Daily Pigmy (${activeLoans.filter(l => l.frequency === 'DAILY').length})` },
            { id: 'OVERDUE', label: `Overdue (${activeLoans.filter(l => l.status === 'OVERDUE' || l.nextDueDate < todayISO).length})` },
            { id: 'COLLECTED', label: `Collected (${todayTransactions.length})` },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterType(f.id as any)}
              className={`min-h-[48px] px-3.5 py-2.5 rounded-xl whitespace-nowrap transition font-semibold border flex items-center justify-center active:scale-95 ${
                filterType === f.id
                  ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                  : 'bg-[#0F172A] border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Borrowers Collection Cards */}
      {fieldList.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 size={32} className="text-emerald-400" />}
          title="All Collections Clear!"
          hint="There are no pending collections matching this filter for today's route."
        />
      ) : (
        <div className="space-y-3">
          {fieldList.map(({ loan, customer, expected, penalty, isDaily, isOverdue, paidTodayTxn }) => {
            if (!customer) return null;
            const isJustDone = justCollectedId === loan.id;

            return (
              <div
                key={loan.id}
                className={`border rounded-3xl p-4 shadow-xl transition space-y-3 ${
                  paidTodayTxn || isJustDone
                    ? 'bg-emerald-950/20 border-emerald-500/40'
                    : isOverdue
                    ? 'bg-[#1E293B]/70 border-rose-500/40'
                    : 'bg-[#1E293B]/70 border-slate-700/70 hover:border-indigo-500/40'
                }`}
              >
                {/* Header Row */}
                <div className="flex items-start justify-between gap-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                      <p className="text-sm font-bold text-white truncate max-w-[130px] sm:max-w-none">{customer.name}</p>
                      {isDaily && (
                        <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                          Pigmy Daily
                        </span>
                      )}
                      {paidTodayTxn && (
                        <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-0.5">
                          <Check size={10} /> Paid
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono truncate">
                      {customer.phone} {customer.address ? `• ${customer.address}` : ''}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Due Today</span>
                    <span className="text-base font-extrabold font-mono text-emerald-400">
                      {formatCurrency(expected)}
                    </span>
                    {penalty > 0 && (
                      <span className="text-[10px] text-rose-400 block font-mono">
                        +{formatCurrency(penalty)} late fee
                      </span>
                    )}
                  </div>
                </div>

                {/* Sub details: Balance & Next Due */}
                <div className="flex items-center justify-between text-xs bg-[#0F172A]/70 rounded-2xl p-2.5 border border-slate-700/60 font-mono">
                  <div>
                    <span className="text-[9px] uppercase font-sans text-slate-500 block">Balance</span>
                    <span className="font-bold text-white">{formatCurrency(loan.currentPrincipalBalance)}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-sans text-slate-500 block">Schedule</span>
                    <span className="text-slate-300">{loan.frequency}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] uppercase font-sans text-slate-500 block">Next Due</span>
                    <span className={isOverdue ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                      {formatDateDisplay(loan.nextDueDate)}
                    </span>
                  </div>
                </div>

                {/* If paid today, show receipt action */}
                {paidTodayTxn ? (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 size={16} />
                      <span>
                        {formatCurrency(paidTodayTxn.amount)} collected ({paidTodayTxn.paymentMode})
                      </span>
                    </span>
                    <button
                      onClick={() => handleShareReceipt(customer, loan, paidTodayTxn.amount)}
                      className="px-3.5 py-2.5 min-h-[48px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
                    >
                      <Share2 size={15} />
                      <span>WhatsApp Receipt</span>
                    </button>
                  </div>
                ) : (
                  /* Action Buttons for Field Agent */
                  <div className="flex items-center gap-2 pt-1">
                    {/* Quick One-Tap Cash Collect */}
                    <button
                      onClick={() => handleQuickCollect(loan, customer, 'CASH')}
                      className="flex-1 min-h-[48px] py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/25 active:scale-98 transition"
                    >
                      <Banknote size={16} />
                      <span>Collect Cash</span>
                    </button>

                    {/* Show Dynamic UPI QR Code */}
                    <button
                      onClick={() => setSelectedUpiLoan(loan)}
                      className="min-h-[48px] py-3 px-3.5 rounded-xl bg-[#0F172A] hover:bg-slate-800 border border-slate-700 text-sky-400 hover:text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
                      title="Show Dynamic UPI QR Code"
                      aria-label="Show Dynamic UPI QR Code"
                    >
                      <QrCode size={16} />
                      <span>UPI QR</span>
                    </button>

                    {/* Call Customer directly */}
                    <a
                      href={`tel:${customer.phone.replace(/[^\d+]/g, '')}`}
                      className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-xl bg-[#0F172A] hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition shrink-0 active:scale-95"
                      title="Call Borrower"
                      aria-label="Call Borrower"
                    >
                      <Phone size={16} />
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Dynamic UPI QR Modal */}
      {selectedUpiLoan && (
        <DynamicUpiQrModal
          amount={Math.round(computeExpectedCyclePayment(selectedUpiLoan))}
          borrowerName={
            data.customers.find(c => c.id === selectedUpiLoan.customerId)?.name || 'Borrower'
          }
          loanName={selectedUpiLoan.loanName}
          loanId={selectedUpiLoan.id}
          onPaymentConfirmed={() => {
            const cust = data.customers.find(c => c.id === selectedUpiLoan.customerId);
            if (cust) handleQuickCollect(selectedUpiLoan, cust, 'UPI');
            setSelectedUpiLoan(null);
          }}
          onClose={() => setSelectedUpiLoan(null)}
        />
      )}
    </div>
  );
};

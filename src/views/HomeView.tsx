import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  CalendarClock,
  ArrowUpRight,
  ArrowDownLeft,
  BellRing,
  Activity,
  MessageSquare,
  ChevronRight,
  UserPlus,
  CreditCard,
  PlusCircle,
  FileSpreadsheet,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';
import { useLanguage } from '../i18n/LanguageContext';
import { useToast } from '../context/ToastContext';
import {
  computeExpectedCyclePayment,
  computeBorrowingPayable,
  computeBorrowingNextDueDate,
  computeBorrowingStatus,
} from '../utils/calculations';
import { formatCurrency } from '../utils/currency';
import {
  getTodayISO,
  getMonthBounds,
  getPreviousMonthStart,
  formatDateDisplay,
  daysBetween,
  addDays,
} from '../utils/date';
import { generateSmsReminderBody } from '../utils/notifications';
import { Loan, Customer } from '../types';
import { EmptyState, M3SegmentedButton } from '../components/common/UIComponents';

export const HomeView: React.FC = () => {
  const { data, updateData } = useAuth();
  const nav = useNavigation();
  const toast = useToast();
  const { t } = useLanguage();
  const todayISO = getTodayISO();

  const [activeBook, setActiveBook] = useState<'lent' | 'borrowed'>('lent');
  const [activitySort, setActivitySort] = useState<'newest' | 'oldest' | 'amount'>('newest');

  const [monthStart, monthEnd] = useMemo(() => getMonthBounds(todayISO), [todayISO]);

  // Lent calculations
  const lentSummary = useMemo(() => {
    const activeLoans = data.loans.filter(
      l => l.status === 'ACTIVE' || l.status === 'OVERDUE' || l.status === 'PARTIALLY_SETTLED'
    );

    const totalOutstanding = activeLoans.reduce(
      (sum, l) => sum + (Number(l.currentPrincipalBalance) || 0),
      0
    );

    const expectedMonthly = activeLoans.reduce((sum, l) => {
      return sum + computeExpectedCyclePayment(l);
    }, 0);

    const collectedMonthly = data.transactions
      .filter(
        t =>
          t.status === 'VALID' &&
          t.type === 'PAYMENT' &&
          t.date >= monthStart &&
          t.date <= monthEnd
      )
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const pendingMonthly = Math.max(0, expectedMonthly - collectedMonthly);

    const totalForeclosed = data.transactions
      .filter(t => t.status === 'VALID' && t.isForeclosure === true)
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const totalWrittenOff = data.transactions
      .filter(t => t.status === 'VALID' && t.type === 'WRITE_OFF')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const collectionRate =
      expectedMonthly > 0 ? Math.min(100, Math.round((collectedMonthly / expectedMonthly) * 100)) : 0;

    return {
      outstanding: totalOutstanding,
      expected: expectedMonthly,
      collected: collectedMonthly,
      pending: pendingMonthly,
      foreclosure: totalForeclosed,
      writeOff: totalWrittenOff,
      collectionRate,
    };
  }, [data.loans, data.transactions, monthStart, monthEnd]);

  // Borrowed calculations
  const borrowedSummary = useMemo(() => {
    const borrowings = data.borrowings || [];
    const payments = data.borrowingPayments || [];

    const activeBorrowings = borrowings.filter(
      b => computeBorrowingStatus(b, payments, todayISO) !== 'CLOSED'
    );

    const totalPayable = activeBorrowings.reduce(
      (sum, b) => sum + computeBorrowingPayable(b, payments),
      0
    );

    const dueThisMonth = activeBorrowings
      .filter(b => b.type === 'FIXED')
      .reduce((sum, b) => sum + (Number(b.installmentAmount) || 0), 0);

    const paidThisMonth = payments
      .filter(p => p.status === 'VALID' && p.date >= monthStart && p.date <= monthEnd)
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const pendingThisMonth = Math.max(0, dueThisMonth - paidThisMonth);

    return {
      totalPayable,
      dueThisMonth,
      paidThisMonth,
      pendingThisMonth,
    };
  }, [data.borrowings, data.borrowingPayments, todayISO, monthStart, monthEnd]);

  // Upcoming items in next 3 days
  const upcomingItems = useMemo(() => {
    const maxLookahead = addDays(todayISO, 3);
    const list: { kind: 'receivable' | 'payable'; id: string; date: string; amount: number; isOverdue: boolean }[] = [];

    // Lent loans
    data.loans
      .filter(l => l.status === 'ACTIVE' || l.status === 'OVERDUE' || l.status === 'PARTIALLY_SETTLED')
      .forEach(l => {
        if (!l.nextDueDate || l.nextDueDate === 'N/A' || l.nextDueDate > maxLookahead) return;
        list.push({
          kind: 'receivable',
          id: l.id,
          date: l.nextDueDate,
          amount: computeExpectedCyclePayment(l),
          isOverdue: l.nextDueDate < todayISO,
        });
      });

    // Borrowings
    const bPayments = data.borrowingPayments || [];
    (data.borrowings || []).forEach(b => {
      if (b.type !== 'FIXED' || computeBorrowingStatus(b, bPayments, todayISO) === 'CLOSED') return;
      const nextDue = computeBorrowingNextDueDate(b, bPayments);
      if (!nextDue || nextDue === 'N/A' || nextDue > maxLookahead) return;
      list.push({
        kind: 'payable',
        id: b.id,
        date: nextDue,
        amount: Number(b.installmentAmount) || 0,
        isOverdue: nextDue < todayISO,
      });
    });

    return list.sort((a, b) => a.date.localeCompare(b.date));
  }, [data.loans, data.borrowings, data.borrowingPayments, todayISO]);

  // Recent activity list
  const recentActivity = useMemo(() => {
    const prevMonthStart = getPreviousMonthStart(todayISO);
    const inScope = (d?: string) => !!d && d >= prevMonthStart && d <= monthEnd;
    const items: Array<{
      key: string;
      type: 'due' | 'cycle' | 'payment';
      loanId: string;
      customerId: string | null;
      sub: string;
      subTone: 'mid' | 'warn' | 'danger';
      amount: number;
      amountTone: 'success' | 'warn' | 'danger';
      isStruck: boolean;
      chip?: 'paid' | 'partial' | null;
      canSms: boolean;
      sortDate: string;
    }> = [];

    // Active loans due
    data.loans
      .filter(l => l.status === 'ACTIVE' || l.status === 'OVERDUE' || l.status === 'PARTIALLY_SETTLED')
      .forEach(loan => {
        if (!loan.nextDueDate || loan.nextDueDate === 'N/A' || !inScope(loan.nextDueDate)) return;
        const isOverdue = loan.nextDueDate < todayISO;
        const diffDays = Math.abs(daysBetween(todayISO, loan.nextDueDate));

        const subText = isOverdue
          ? `Overdue by ${diffDays} day${diffDays === 1 ? '' : 's'}`
          : loan.nextDueDate === todayISO
          ? 'Due today'
          : `Due in ${diffDays} day${diffDays === 1 ? '' : 's'}`;

        items.push({
          key: `due-${loan.id}`,
          type: 'due',
          loanId: loan.id,
          customerId: loan.customerId,
          sub: subText,
          subTone: isOverdue || loan.nextDueDate === todayISO ? 'danger' : 'warn',
          amount: computeExpectedCyclePayment(loan),
          amountTone: 'danger',
          isStruck: false,
          chip: null,
          canSms: true,
          sortDate: loan.nextDueDate,
        });
      });

    // Valid recent transactions
    data.transactions
      .filter(t => t.status === 'VALID' && t.type === 'PAYMENT' && inScope(t.date))
      .forEach(t => {
        const loan = data.loans.find(l => l.id === t.loanId);
        items.push({
          key: `txn-${t.id}`,
          type: 'payment',
          loanId: t.loanId,
          customerId: loan?.customerId || null,
          sub: `Paid on ${formatDateDisplay(t.date)}`,
          subTone: 'mid',
          amount: t.amount,
          amountTone: 'success',
          isStruck: false,
          chip: null,
          canSms: false,
          sortDate: t.date,
        });
      });

    // Sort
    const sorters = {
      oldest: (a: any, b: any) => a.sortDate.localeCompare(b.sortDate),
      amount: (a: any, b: any) => Number(b.amount) - Number(a.amount),
      newest: (a: any, b: any) => b.sortDate.localeCompare(a.sortDate),
    };

    return items.sort(sorters[activitySort]).slice(0, 10);
  }, [data.loans, data.transactions, todayISO, monthEnd, activitySort]);

  const handleSendSms = (loan: Loan, customer?: Customer) => {
    if (!customer?.phone) {
      toast.push('This client has no phone number on file.', 'error');
      return;
    }
    const body = generateSmsReminderBody(loan, customer, data.settings);
    const cleanPhone = customer.phone.replace(/[^\d+]/g, '');
    window.location.href = `sms:${cleanPhone}?&body=${encodeURIComponent(body)}`;
    updateData(prev => ({
      ...prev,
      loans: prev.loans.map(l => (l.id === loan.id ? { ...l, lastReminderSentAt: todayISO } : l)),
    }));
    toast.push('SMS template opened in messaging app.', 'success');
  };

  const hasAnyData = data.loans.length > 0 || data.customers.length > 0;

  return (
    <div className="space-y-4 pb-20 animate-m3-fade-in">
      {/* Material 3 Hero Portfolio Overview Card */}
      <div className="bg-[#1E293B] border border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-[0_12px_32px_rgba(0,0,0,0.5)] relative overflow-hidden">
        {/* Subtle Ambient Glow */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header with Segmented Button Book Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest block">
              {activeBook === 'lent' ? 'Customer Loan Portfolio' : 'Liabilities & Capital Debt'}
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-white tracking-tight">
                {activeBook === 'lent'
                  ? formatCurrency(lentSummary.outstanding)
                  : formatCurrency(borrowedSummary.totalPayable)}
              </span>
              <span className="text-xs font-semibold text-indigo-300">
                {activeBook === 'lent' ? 'Principal Out' : 'Total Payable'}
              </span>
            </div>
          </div>

          <div className="w-full sm:w-auto">
            <M3SegmentedButton
              options={[
                { key: 'lent', label: t('book.lent', 'Lent'), icon: <ArrowUpRight size={14} /> },
                { key: 'borrowed', label: t('book.borrowed', 'Borrowed'), icon: <ArrowDownLeft size={14} /> },
              ]}
              selected={activeBook}
              onSelect={setActiveBook}
            />
          </div>
        </div>

        {/* Collection Progress & Metrics Strip (Lent Book) */}
        {activeBook === 'lent' && (
          <div className="space-y-2.5 pt-2 border-t border-slate-700/70">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-400" />
                Month Recovery Rate
              </span>
              <span className="font-mono font-bold text-emerald-400">
                {lentSummary.collectionRate}% ({formatCurrency(lentSummary.collected)} of {formatCurrency(lentSummary.expected)})
              </span>
            </div>
            {/* Native Material Progress Bar */}
            <div className="w-full bg-[#0F172A] h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-700/60">
              <div
                className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.max(4, lentSummary.collectionRate)}%` }}
              />
            </div>
          </div>
        )}

        {/* Quick Bento Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-4">
          {activeBook === 'lent' ? (
            <>
              <div className="bg-[#0F172A] border border-slate-700/70 rounded-2xl p-3">
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Expected Month</p>
                <p className="text-sm font-bold font-mono text-sky-400 mt-0.5 truncate">
                  {formatCurrency(lentSummary.expected)}
                </p>
              </div>
              <div className="bg-[#0F172A] border border-slate-700/70 rounded-2xl p-3">
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Collected Month</p>
                <p className="text-sm font-bold font-mono text-emerald-400 mt-0.5 truncate">
                  {formatCurrency(lentSummary.collected)}
                </p>
              </div>
              <div className="bg-[#0F172A] border border-slate-700/70 rounded-2xl p-3 col-span-2 sm:col-span-1">
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Pending Recovery</p>
                <p className="text-sm font-bold font-mono text-amber-400 mt-0.5 truncate">
                  {formatCurrency(lentSummary.pending)}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="bg-[#0F172A] border border-slate-700/70 rounded-2xl p-3">
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Due This Month</p>
                <p className="text-sm font-bold font-mono text-sky-400 mt-0.5 truncate">
                  {formatCurrency(borrowedSummary.dueThisMonth)}
                </p>
              </div>
              <div className="bg-[#0F172A] border border-slate-700/70 rounded-2xl p-3">
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Paid This Month</p>
                <p className="text-sm font-bold font-mono text-emerald-400 mt-0.5 truncate">
                  {formatCurrency(borrowedSummary.paidThisMonth)}
                </p>
              </div>
              <div className="bg-[#0F172A] border border-slate-700/70 rounded-2xl p-3 col-span-2 sm:col-span-1">
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Pending Debt</p>
                <p className="text-sm font-bold font-mono text-amber-400 mt-0.5 truncate">
                  {formatCurrency(borrowedSummary.pendingThisMonth)}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Material 3 Quick Action Bento (4 Essential Lending Functions) */}
      <div>
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">
          Quick Operations
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <button
            onClick={() => nav.push({ page: 'loans', openAdd: true })}
            className="bg-[#1E293B] border border-slate-700/80 hover:border-indigo-500/50 rounded-2xl p-3 flex flex-col items-start justify-between text-left transition-all active:scale-95 group m3-state-layer w-full min-w-0"
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mb-2 group-hover:scale-105 transition shadow-sm shrink-0">
              <PlusCircle size={18} />
            </div>
            <div className="w-full min-w-0">
              <p className="text-xs font-bold text-white group-hover:text-indigo-300 truncate">New Loan</p>
              <p className="text-[10px] text-slate-400 truncate">Issue contract</p>
            </div>
          </button>

          <button
            onClick={() => nav.push({ page: 'loans' })}
            className="bg-[#1E293B] border border-slate-700/80 hover:border-emerald-500/50 rounded-2xl p-3 flex flex-col items-start justify-between text-left transition-all active:scale-95 group m3-state-layer w-full min-w-0"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mb-2 group-hover:scale-105 transition shadow-sm shrink-0">
              <CreditCard size={18} />
            </div>
            <div className="w-full min-w-0">
              <p className="text-xs font-bold text-white group-hover:text-emerald-300 truncate">Add Payment</p>
              <p className="text-[10px] text-slate-400 truncate">Collect EMI / Int</p>
            </div>
          </button>

          <button
            onClick={() => nav.push({ page: 'clients', openAdd: true })}
            className="bg-[#1E293B] border border-slate-700/80 hover:border-sky-500/50 rounded-2xl p-3 flex flex-col items-start justify-between text-left transition-all active:scale-95 group m3-state-layer w-full min-w-0"
          >
            <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400 flex items-center justify-center mb-2 group-hover:scale-105 transition shadow-sm shrink-0">
              <UserPlus size={18} />
            </div>
            <div className="w-full min-w-0">
              <p className="text-xs font-bold text-white group-hover:text-sky-300 truncate">New Client</p>
              <p className="text-[10px] text-slate-400 truncate">Add borrower</p>
            </div>
          </button>

          <button
            onClick={() => nav.push({ page: 'reports' })}
            className="bg-[#1E293B] border border-slate-700/80 hover:border-amber-500/50 rounded-2xl p-3 flex flex-col items-start justify-between text-left transition-all active:scale-95 group m3-state-layer w-full min-w-0"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mb-2 group-hover:scale-105 transition shadow-sm shrink-0">
              <FileSpreadsheet size={18} />
            </div>
            <div className="w-full min-w-0">
              <p className="text-xs font-bold text-white group-hover:text-amber-300 truncate">Reports</p>
              <p className="text-[10px] text-slate-400 truncate">PDF & Ledger</p>
            </div>
          </button>
        </div>
      </div>

      {/* Field Collection & Collateral Vault Banners */}
      <div className="grid grid-cols-1 gap-3">
        {/* Field Collection / Pigmy Mode */}
        <div
          onClick={() => nav.push({ page: 'fieldCollection' })}
          className="bg-gradient-to-br from-teal-950/40 to-[#1E293B] border border-teal-500/30 hover:border-teal-500/60 rounded-3xl p-4 shadow-xl cursor-pointer transition active:scale-98 group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-2xl bg-teal-500/15 border border-teal-500/30 text-teal-400 flex items-center justify-center shrink-0">
                <CalendarClock size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-bold text-white group-hover:text-teal-300 transition truncate">
                  Field & Pigmy Collection
                </h4>
                <p className="text-[10px] text-slate-400 truncate">Door-to-door daily route recovery</p>
              </div>
            </div>
            <span className="shrink-0 whitespace-nowrap text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 uppercase font-mono">
              Live Route
            </span>
          </div>

          <div className="flex items-center justify-between text-xs pt-2.5 border-t border-slate-700/60">
            <span className="text-[11px] text-slate-400 truncate">1-Tap Receipt & UPI QR</span>
            <span className="font-bold text-teal-400 flex items-center gap-1 group-hover:translate-x-0.5 transition shrink-0 whitespace-nowrap">
              Open Sheet <ArrowRight size={13} />
            </span>
          </div>
        </div>

        {/* Collateral & Pawn Vault */}
        <div
          onClick={() => nav.push({ page: 'collateralVault' })}
          className="bg-gradient-to-br from-amber-950/40 to-[#1E293B] border border-amber-500/30 hover:border-amber-500/60 rounded-3xl p-4 shadow-xl cursor-pointer transition active:scale-98 group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                <ShieldCheck size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-bold text-white group-hover:text-amber-300 transition truncate">
                  Pawn & Collateral Vault
                </h4>
                <p className="text-[10px] text-slate-400 truncate">
                  {(data.collaterals || []).filter(c => c.status === 'PLEDGED').length} active assets in custody
                </p>
              </div>
            </div>
            <span className="shrink-0 whitespace-nowrap text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase font-mono">
              Locker Safe
            </span>
          </div>

          <div className="flex items-center justify-between text-xs pt-2.5 border-t border-slate-700/60">
            <span className="text-[11px] text-slate-400 truncate">Gold Purity, Vehicle & LTV</span>
            <span className="font-bold text-amber-400 flex items-center gap-1 group-hover:translate-x-0.5 transition shrink-0 whitespace-nowrap">
              View Vault <ArrowRight size={13} />
            </span>
          </div>
        </div>
      </div>

      {/* Urgent Attention / Upcoming Banner */}
      {upcomingItems.length > 0 && (
        <button
          onClick={() => nav.push({ page: 'loans' })}
          className="w-full bg-gradient-to-r from-amber-500/15 to-amber-600/10 border border-amber-500/40 rounded-3xl p-4 flex items-center justify-between gap-3 text-left transition-all active:scale-98 group m3-elevation-1"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0 shadow-inner">
              <BellRing size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-amber-200">
                {upcomingItems.length} items due in the next 3 days
              </p>
              <p className="text-[11px] text-slate-300 truncate mt-0.5">
                {upcomingItems.filter(i => i.kind === 'receivable').length} collections •{' '}
                {upcomingItems.filter(i => i.kind === 'payable').length} payables
              </p>
            </div>
          </div>
          <ChevronRight size={18} className="text-amber-400 group-hover:translate-x-0.5 transition shrink-0" />
        </button>
      )}

      {/* Empty State when no clients exist */}
      {!hasAnyData && (
        <EmptyState
          icon={<UserPlus size={28} className="text-indigo-400" />}
          title="No clients in your book yet"
          hint="Add your first client to start creating loans and managing repayments."
          action={
            <button
              onClick={() => nav.push({ page: 'clients', openAdd: true })}
              className="px-5 py-3 min-h-[48px] rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition active:scale-95"
            >
              <UserPlus size={16} />
              <span>Add First Client</span>
            </button>
          }
        />
      )}

      {/* Recent Ledger Activity Card */}
      {hasAnyData && (
        <div className="bg-[#1E293B] border border-slate-700/80 rounded-3xl p-4 sm:p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between gap-3 pb-2 border-b border-slate-700/70">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
                <Activity size={16} />
              </div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Recent Activity</h3>
            </div>

            <button
              onClick={() => nav.push({ page: 'ledger' })}
              className="min-h-[48px] px-3 py-2 -mr-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 group active:scale-95"
            >
              <span>Full Ledger</span>
              <ArrowRight size={14} className="group-hover:translate-x-0.5 transition" />
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 px-1">
            <span className="text-[11px] text-slate-400">Sort by:</span>
            <select
              value={activitySort}
              onChange={e => setActivitySort(e.target.value as any)}
              className="bg-[#0F172A] border border-slate-700/80 text-slate-200 text-xs rounded-xl px-3 min-h-[48px] h-10 outline-none font-medium"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="amount">Amount (High to Low)</option>
            </select>
          </div>

          {recentActivity.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">
              No activity in the last 60 days.
            </p>
          ) : (
            <div className="space-y-2">
              {recentActivity.map(item => {
                const cust = data.customers.find(c => c.id === item.customerId);
                const loan = data.loans.find(l => l.id === item.loanId);

                return (
                  <div
                    key={item.key}
                    className="p-3 bg-[#0F172A] border border-slate-700/70 rounded-2xl flex items-center justify-between gap-3 hover:border-slate-600 transition m3-state-layer"
                  >
                    <div
                      onClick={() => nav.push({ page: 'loanDetail', loanId: item.loanId })}
                      className="min-w-0 flex-1 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-white truncate hover:text-indigo-300">
                          {cust?.name || 'Client'}
                        </p>
                        {item.chip && (
                          <span
                            className={`px-2 py-0.2 rounded-full text-[10px] font-bold uppercase ${
                              item.chip === 'paid'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {item.chip}
                          </span>
                        )}
                      </div>
                      <p
                        className={`text-[11px] truncate mt-0.5 ${
                          item.subTone === 'danger'
                            ? 'text-rose-400 font-semibold'
                            : item.subTone === 'warn'
                            ? 'text-amber-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {item.sub}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`font-mono text-xs font-bold ${
                          item.amountTone === 'danger'
                            ? 'text-rose-400'
                            : item.amountTone === 'warn'
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        {formatCurrency(item.amount)}
                      </span>

                      {item.canSms && loan && (
                        <button
                          onClick={() => handleSendSms(loan, cust)}
                          title="Send SMS reminder"
                          aria-label={`Send SMS reminder to ${cust?.name}`}
                          className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition active:scale-95 shrink-0"
                        >
                          <MessageSquare size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

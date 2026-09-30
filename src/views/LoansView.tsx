import React, { useState, useMemo } from 'react';
import {
  Landmark,
  HandCoins,
  Search,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  Calendar,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';
import { formatCurrency } from '../utils/currency';
import { formatDateDisplay, getTodayISO, daysBetween } from '../utils/date';
import { computeBorrowingPayable, computeBorrowingStatus, computeBorrowingNextDueDate } from '../utils/calculations';
import { StatusPill, EmptyState, M3SegmentedButton, M3Chip, M3Button } from '../components/common/UIComponents';
import { BorrowingModal } from './BorrowingDetailView';
import { NewLoanWizardModal } from '../components/loans/NewLoanWizardModal';

export const LoansView: React.FC = () => {
  const { data } = useAuth();
  const nav = useNavigation();
  const todayISO = getTodayISO();

  const [book, setBook] = useState<'lent' | 'borrowed'>(
    nav.view.book === 'borrowed' ? 'borrowed' : 'lent'
  );
  const [lentFilter, setLentFilter] = useState<'all' | 'active' | 'closed'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showBorrowingModal, setShowBorrowingModal] = useState<boolean>(!!nav.view.openAdd && nav.view.book === 'borrowed');
  const [showLoanWizard, setShowLoanWizard] = useState<boolean>(!!nav.view.openAdd && nav.view.book !== 'borrowed');

  // Filtered Loans (Lent)
  const filteredLoans = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return data.loans
      .map(loan => {
        const cust = data.customers.find(c => c.id === loan.customerId);
        return { loan, cust };
      })
      .filter(({ loan, cust }) => {
        const isLive =
          loan.status === 'ACTIVE' ||
          loan.status === 'OVERDUE' ||
          loan.status === 'PARTIALLY_SETTLED';
        const isClosed = loan.status === 'CLOSED' || loan.status === 'WRITTEN_OFF';

        if (lentFilter === 'active' && !isLive) return false;
        if (lentFilter === 'closed' && !isClosed) return false;

        if (q) {
          const matchName = cust?.name.toLowerCase().includes(q);
          const matchLoanName = loan.loanName?.toLowerCase().includes(q);
          const matchId = loan.id.toLowerCase().includes(q);
          const matchPhone = cust?.phone.includes(q);
          return matchName || matchLoanName || matchId || matchPhone;
        }
        return true;
      })
      .sort((a, b) => {
        const liveA = a.loan.status === 'ACTIVE' || a.loan.status === 'OVERDUE' || a.loan.status === 'PARTIALLY_SETTLED';
        const liveB = b.loan.status === 'ACTIVE' || b.loan.status === 'OVERDUE' || b.loan.status === 'PARTIALLY_SETTLED';
        if (liveA !== liveB) return liveA ? -1 : 1;
        return (a.loan.nextDueDate || '9999').localeCompare(b.loan.nextDueDate || '9999');
      });
  }, [data.loans, data.customers, lentFilter, searchQuery]);

  // Filtered Borrowings
  const filteredBorrowings = useMemo(() => {
    const bPayments = data.borrowingPayments || [];
    const q = searchQuery.trim().toLowerCase();

    return (data.borrowings || [])
      .map(b => {
        const lender = (data.lenders || []).find(l => l.id === b.lenderId);
        const status = computeBorrowingStatus(b, bPayments, todayISO);
        const balance = computeBorrowingPayable(b, bPayments);
        const nextDue = computeBorrowingNextDueDate(b, bPayments);
        return { b, lender, status, balance, nextDue };
      })
      .filter(({ b, lender }) => {
        if (!q) return true;
        return (
          b.name.toLowerCase().includes(q) ||
          (lender && lender.name.toLowerCase().includes(q)) ||
          b.id.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const liveA = a.status !== 'CLOSED';
        const liveB = b.status !== 'CLOSED';
        if (liveA !== liveB) return liveA ? -1 : 1;
        return (a.nextDue || '9999').localeCompare(b.nextDue || '9999');
      });
  }, [data.borrowings, data.lenders, data.borrowingPayments, todayISO, searchQuery]);

  const counts = useMemo(() => {
    const active = data.loans.filter(
      l => l.status === 'ACTIVE' || l.status === 'OVERDUE' || l.status === 'PARTIALLY_SETTLED'
    ).length;
    const closed = data.loans.filter(
      l => l.status === 'CLOSED' || l.status === 'WRITTEN_OFF'
    ).length;
    return { all: data.loans.length, active, closed };
  }, [data.loans]);

  return (
    <div className="space-y-4 pb-20 animate-m3-fade-in">
      {/* Top Header & New Action */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight leading-tight">
            {book === 'lent' ? 'Loan Book' : 'Borrowing Book'}
          </h2>
          <p className="text-[11px] text-slate-400">
            {book === 'lent' ? 'Manage active customer contracts' : 'Manage liabilities owed to lenders'}
          </p>
        </div>

        {book === 'lent' ? (
          <M3Button
            size="sm"
            onClick={() => setShowLoanWizard(true)}
            icon={<Plus size={15} />}
          >
            New Loan
          </M3Button>
        ) : (
          <M3Button
            size="sm"
            onClick={() => setShowBorrowingModal(true)}
            icon={<Plus size={15} />}
          >
            Add Debt
          </M3Button>
        )}
      </div>

      {/* Material 3 Segmented Button Book Switcher */}
      <M3SegmentedButton
        options={[
          {
            key: 'lent',
            label: 'Lent Books',
            icon: <ArrowUpRight size={14} />,
            badge: counts.active,
          },
          {
            key: 'borrowed',
            label: 'Borrowings',
            icon: <ArrowDownLeft size={14} />,
            badge: (data.borrowings || []).length,
          },
        ]}
        selected={book}
        onSelect={setBook}
      />

      {/* Material 3 Search Bar with Pill Styling */}
      <div className="relative">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={book === 'lent' ? 'Search borrower name, loan ID, or phone...' : 'Search lender or borrowing...'}
          className="w-full min-h-[48px] h-12 bg-[#1E293B] border border-slate-700/80 focus:border-indigo-400 rounded-2xl pl-10 pr-12 text-sm text-white placeholder:text-slate-500 outline-none transition shadow-inner"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="w-12 h-12 min-w-[48px] min-h-[48px] flex items-center justify-center absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white active:scale-95 transition"
            aria-label="Clear search"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* LENT BOOK VIEW */}
      {book === 'lent' && (
        <div className="space-y-3">
          {/* Material 3 Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            <M3Chip
              label="All Contracts"
              selected={lentFilter === 'all'}
              onClick={() => setLentFilter('all')}
              count={counts.all}
            />
            <M3Chip
              label="Active & Live"
              selected={lentFilter === 'active'}
              onClick={() => setLentFilter('active')}
              count={counts.active}
            />
            <M3Chip
              label="Settled / Closed"
              selected={lentFilter === 'closed'}
              onClick={() => setLentFilter('closed')}
              count={counts.closed}
            />
          </div>

          {filteredLoans.length === 0 ? (
            <EmptyState
              icon={<Landmark size={28} className="text-indigo-400" />}
              title={data.loans.length === 0 ? 'No loans in ledger' : 'No loans match filters'}
              hint={
                data.loans.length === 0
                  ? 'Tap "New Loan" above or select a client from your roster to issue capital.'
                  : 'Try clearing the search query or changing active filter tabs.'
              }
            />
          ) : (
            <div className="space-y-2.5">
              {filteredLoans.map(({ loan, cust }) => {
                const diffDays =
                  loan.nextDueDate && loan.nextDueDate !== 'N/A'
                    ? daysBetween(todayISO, loan.nextDueDate)
                    : null;

                const dueInfo =
                  diffDays !== null
                    ? diffDays < 0
                      ? `Overdue by ${Math.abs(diffDays)}d`
                      : diffDays === 0
                      ? 'Due Today'
                      : `Due in ${diffDays}d`
                    : null;

                return (
                  <div
                    key={loan.id}
                    onClick={() => nav.push({ page: 'loanDetail', loanId: loan.id })}
                    className="w-full bg-[#1E293B] border border-slate-700/80 hover:border-slate-600 rounded-3xl p-4 flex items-center justify-between gap-3 text-left transition-all active:scale-98 cursor-pointer m3-state-layer m3-elevation-1"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="text-xs font-bold text-white truncate">
                          {cust?.name || 'Unknown Client'}
                        </p>
                        <StatusPill status={loan.status} />
                        {loan.frequency === 'DAILY' && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                            DAILY
                          </span>
                        )}
                        {(loan.isSecured || (loan.collateralIds && loan.collateralIds.length > 0)) && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-0.5">
                            <ShieldCheck size={9} /> SECURED
                          </span>
                        )}
                        {loan.activeMoratoriumUntil && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                            MORATORIUM
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 truncate">
                        {loan.loanName || (loan.type === 'EMI' ? 'EMI Loan' : 'Interest-Only')}
                      </p>
                      {dueInfo && (
                        <p
                          className={`text-[10px] font-semibold mt-1 inline-flex items-center gap-1 ${
                            diffDays! <= 0 ? 'text-rose-400' : 'text-amber-400'
                          }`}
                        >
                          <Calendar size={11} />
                          {dueInfo} • {formatDateDisplay(loan.nextDueDate)}
                        </p>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold font-mono text-emerald-400">
                        {formatCurrency(loan.currentPrincipalBalance)}
                      </p>
                      <p className="text-[9px] text-slate-400 uppercase font-semibold tracking-wider">Balance</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* BORROWED BOOK VIEW */}
      {book === 'borrowed' && (
        <div className="space-y-3">
          {filteredBorrowings.length === 0 ? (
            <EmptyState
              icon={<HandCoins size={28} className="text-amber-400" />}
              title="No liabilities recorded"
              hint="Track loans or capital you borrowed from banks, NBFCs, or individuals."
              action={
                <M3Button
                  onClick={() => setShowBorrowingModal(true)}
                  icon={<Plus size={15} />}
                >
                  Record First Borrowing
                </M3Button>
              }
            />
          ) : (
            <div className="space-y-2.5">
              {filteredBorrowings.map(({ b, lender, status, balance, nextDue }) => (
                <div
                  key={b.id}
                  onClick={() => nav.push({ page: 'borrowingDetail', borrowingId: b.id })}
                  className="w-full bg-[#1E293B] border border-slate-700/80 hover:border-slate-600 rounded-3xl p-4 flex items-center justify-between gap-3 text-left transition-all active:scale-98 cursor-pointer m3-state-layer m3-elevation-1"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs font-bold text-white truncate">
                        {lender?.name || 'Lender'}
                      </p>
                      <StatusPill status={status} />
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">{b.name}</p>
                    {b.type === 'FIXED' && nextDue && (
                      <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1 font-medium">
                        <Calendar size={11} />
                        Due: {formatDateDisplay(nextDue)}
                      </p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold font-mono text-amber-400">
                      {formatCurrency(balance)}
                    </p>
                    <p className="text-[9px] text-slate-400 uppercase font-semibold tracking-wider">Payable</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Borrowing Modal */}
      {showBorrowingModal && (
        <BorrowingModal onClose={() => setShowBorrowingModal(false)} />
      )}

      {/* Disburse New Loan Wizard */}
      {showLoanWizard && (
        <NewLoanWizardModal onClose={() => setShowLoanWizard(false)} />
      )}
    </div>
  );
};

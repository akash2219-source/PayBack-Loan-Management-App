import React, { useState } from 'react';
import {
  CreditCard,
  PlusCircle,
  UserPlus,
  HandCoins,
  X,
  ChevronRight,
  ArrowLeft,
  Search,
  CalendarClock,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';
import { useLanguage } from '../i18n/LanguageContext';
import { formatCurrency } from '../utils/currency';
import { NewLoanWizardModal } from './loans/NewLoanWizardModal';
import { CollateralModal } from './collateral/CollateralModal';

export const QuickAddModal: React.FC<{
  initialTab?: 'loan' | 'client' | 'payment';
  onClose: () => void;
}> = ({ initialTab, onClose }) => {
  const { data } = useAuth();
  const nav = useNavigation();
  const { t } = useLanguage();
  const [subMode, setSubMode] = useState<'payment' | 'loan' | null>(
    initialTab === 'payment' ? 'payment' : initialTab === 'client' ? null : null
  );
  const [searchFilter, setSearchFilter] = useState('');
  const [showLoanWizard, setShowLoanWizard] = useState<boolean>(false);
  const [wizardCustomerId, setWizardCustomerId] = useState<string | undefined>(undefined);
  const [showCollateralModal, setShowCollateralModal] = useState<boolean>(false);

  const activeLoans = data.loans.filter(
    l => l.status === 'ACTIVE' || l.status === 'OVERDUE' || l.status === 'PARTIALLY_SETTLED'
  );

  const navigateTo = (action: () => void) => {
    onClose();
    action();
  };

  const filteredLoans = activeLoans.filter(l => {
    const cust = data.customers.find(c => c.id === l.customerId);
    const q = searchFilter.toLowerCase().trim();
    if (!q) return true;
    return (
      (cust?.name && cust.name.toLowerCase().includes(q)) ||
      (l.loanName && l.loanName.toLowerCase().includes(q)) ||
      l.id.toLowerCase().includes(q)
    );
  });

  const filteredCustomers = data.customers.filter(c => {
    const q = searchFilter.toLowerCase().trim();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || c.phone.includes(q);
  });

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-end justify-center select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[440px] mx-auto bg-[#1E293B] border-t border-slate-700/80 rounded-t-[28px] rounded-b-none shadow-[0_-12px_40px_rgba(0,0,0,0.8)] max-h-[88vh] overflow-y-auto no-scrollbar animate-m3-slide-up flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Android Material 3 Drag Handle */}
        <div className="w-full flex items-center justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-500/70" />
        </div>

        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 pb-3 pt-1 border-b border-slate-700/70 shrink-0">
          <div className="flex items-center gap-2.5">
            {subMode !== null && (
              <button
                onClick={() => {
                  setSubMode(null);
                  setSearchFilter('');
                }}
                className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-full bg-slate-800 border border-slate-700/60 flex items-center justify-center text-slate-300 hover:text-white active:scale-95 transition"
                aria-label="Back to quick actions"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div>
              <h3 className="font-bold text-white text-base leading-tight">
                {subMode === 'payment'
                  ? 'Record Payment'
                  : subMode === 'loan'
                  ? 'Issue Loan to Client'
                  : 'Quick Actions'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {subMode === 'payment'
                  ? 'Select borrower to receive money'
                  : subMode === 'loan'
                  ? 'Choose a client to create loan contract'
                  : 'Fast-track common lending operations'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-full bg-slate-800 border border-slate-700/60 flex items-center justify-center text-slate-400 hover:text-white active:scale-95 transition"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-3 pb-8">
          {/* Sub-mode: Search if in list mode */}
          {subMode !== null && (
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by client name or ID..."
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                className="w-full bg-[#0F172A] border border-slate-700/80 rounded-2xl pl-10 pr-4 min-h-[48px] h-12 text-sm text-white placeholder:text-slate-500 outline-none focus:border-indigo-400"
                autoFocus
              />
            </div>
          )}

        {/* Sub-mode: Select loan for payment */}
        {subMode === 'payment' && (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
            {filteredLoans.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400 space-y-1">
                <p className="text-xl">🔍</p>
                <p className="font-semibold text-slate-200">No active loans found</p>
                <p className="text-[11px]">Create a loan contract first to record repayments.</p>
              </div>
            ) : (
              filteredLoans.map(loan => {
                const cust = data.customers.find(c => c.id === loan.customerId);
                return (
                  <button
                    key={loan.id}
                    onClick={() =>
                      navigateTo(() => nav.push({ page: 'addPayment', loanId: loan.id }))
                    }
                    className="w-full min-h-[56px] text-left bg-[#0F172A] border border-slate-700/70 hover:border-emerald-500/50 rounded-2xl p-3 flex items-center justify-between transition active:scale-98 group m3-state-layer"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-white truncate group-hover:text-emerald-300">
                        {cust?.name || 'Unknown Client'}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {loan.loanName || (loan.type === 'EMI' ? 'EMI Loan' : 'Interest-Only')}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold font-mono text-emerald-400">
                        {formatCurrency(loan.currentPrincipalBalance)}
                      </p>
                      <p className="text-[9px] text-slate-400 uppercase font-semibold">Balance Due</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}

        {/* Sub-mode: Select client for loan */}
        {subMode === 'loan' && (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
            {filteredCustomers.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400 space-y-2">
                <p className="text-xl">👥</p>
                <p className="font-semibold text-slate-200">No clients match query</p>
                <button
                  onClick={() => navigateTo(() => nav.push({ page: 'clients', openAdd: true }))}
                  className="min-h-[48px] px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-2xl text-white text-xs font-bold flex items-center justify-center mx-auto transition"
                >
                  Create New Client Contact
                </button>
              </div>
            ) : (
              filteredCustomers.map(cust => (
                <button
                  key={cust.id}
                  onClick={() => {
                    setWizardCustomerId(cust.id);
                    setShowLoanWizard(true);
                  }}
                  className="w-full min-h-[56px] text-left bg-[#0F172A] border border-slate-700/70 hover:border-indigo-500/50 rounded-2xl p-3 flex items-center justify-between transition active:scale-98 group m3-state-layer"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-white truncate group-hover:text-indigo-300">
                      {cust.name}
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono">{cust.phone}</p>
                  </div>
                  <ChevronRight size={15} className="text-slate-500 group-hover:text-white" />
                </button>
              ))
            )}
          </div>
        )}

        {/* Primary M3 Action List */}
        {subMode === null && (
          <div className="grid grid-cols-1 gap-2.5">
            <button
              onClick={() => setSubMode('payment')}
              className="w-full bg-[#0F172A] border border-slate-700/70 hover:border-emerald-500/50 rounded-2xl p-3.5 flex items-center gap-3.5 text-left transition group active:scale-98 m3-state-layer"
            >
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition shadow-sm">
                <CreditCard size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white group-hover:text-emerald-300">
                  {t('quickadd.payment', 'Record Payment')}
                </p>
                <p className="text-[11px] text-slate-400">Collect EMI, interest, or principal recovery</p>
              </div>
              <ChevronRight size={16} className="text-slate-500 group-hover:text-white" />
            </button>

            <button
              onClick={() => {
                setWizardCustomerId(undefined);
                setShowLoanWizard(true);
              }}
              className="w-full bg-[#0F172A] border border-slate-700/70 hover:border-indigo-500/50 rounded-2xl p-3.5 flex items-center gap-3.5 text-left transition group active:scale-98 m3-state-layer"
            >
              <div className="w-11 h-11 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition shadow-sm">
                <PlusCircle size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white group-hover:text-indigo-300">
                  {t('quickadd.loan', 'Disburse New Loan')}
                </p>
                <p className="text-[11px] text-slate-400">Originate Daily Pigmy, EMI, or flat loan</p>
              </div>
              <ChevronRight size={16} className="text-slate-500 group-hover:text-white" />
            </button>

            <button
              onClick={() => navigateTo(() => nav.push({ page: 'fieldCollection' }))}
              className="w-full bg-[#0F172A] border border-slate-700/70 hover:border-teal-500/50 rounded-2xl p-3.5 flex items-center gap-3.5 text-left transition group active:scale-98 m3-state-layer"
            >
              <div className="w-11 h-11 rounded-2xl bg-teal-500/15 border border-teal-500/30 text-teal-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition shadow-sm">
                <CalendarClock size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white group-hover:text-teal-300">
                  Field & Pigmy Collection
                </p>
                <p className="text-[11px] text-slate-400">Daily door-to-door route recovery & QR scan</p>
              </div>
              <ChevronRight size={16} className="text-slate-500 group-hover:text-white" />
            </button>

            <button
              onClick={() => navigateTo(() => nav.push({ page: 'collateralVault' }))}
              className="w-full bg-[#0F172A] border border-slate-700/70 hover:border-amber-500/50 rounded-2xl p-3.5 flex items-center gap-3.5 text-left transition group active:scale-98 m3-state-layer"
            >
              <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition shadow-sm">
                <ShieldCheck size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white group-hover:text-amber-300">
                  Pawn & Collateral Vault
                </p>
                <p className="text-[11px] text-slate-400">Pledge gold jewelry, vehicle RC & safe box</p>
              </div>
              <ChevronRight size={16} className="text-slate-500 group-hover:text-white" />
            </button>

            <button
              onClick={() => navigateTo(() => nav.push({ page: 'clients', openAdd: true }))}
              className="w-full bg-[#0F172A] border border-slate-700/70 hover:border-sky-500/50 rounded-2xl p-3.5 flex items-center gap-3.5 text-left transition group active:scale-98 m3-state-layer"
            >
              <div className="w-11 h-11 rounded-2xl bg-sky-500/15 border border-sky-500/30 text-sky-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition shadow-sm">
                <UserPlus size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white group-hover:text-sky-300">
                  {t('quickadd.client', 'Add Client Profile')}
                </p>
                <p className="text-[11px] text-slate-400">Save borrower contact, ID, & statement address</p>
              </div>
              <ChevronRight size={16} className="text-slate-500 group-hover:text-white" />
            </button>

            <button
              onClick={() =>
                navigateTo(() => nav.push({ page: 'loans', book: 'borrowed', openAdd: true }))
              }
              className="w-full bg-[#0F172A] border border-slate-700/70 hover:border-amber-500/50 rounded-2xl p-3.5 flex items-center gap-3.5 text-left transition group active:scale-98 m3-state-layer"
            >
              <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition shadow-sm">
                <HandCoins size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white group-hover:text-amber-300">
                  {t('quickadd.borrowing', 'Record Capital Borrowing')}
                </p>
                <p className="text-[11px] text-slate-400">Track liabilities & debts from external lenders</p>
              </div>
              <ChevronRight size={16} className="text-slate-500 group-hover:text-white" />
            </button>
          </div>
        )}
        </div>
      </div>

      {showLoanWizard && (
        <NewLoanWizardModal
          initialCustomerId={wizardCustomerId}
          onClose={() => {
            setShowLoanWizard(false);
            onClose();
          }}
        />
      )}

      {showCollateralModal && (
        <CollateralModal
          onClose={() => {
            setShowCollateralModal(false);
            onClose();
          }}
        />
      )}
    </div>
  );
};

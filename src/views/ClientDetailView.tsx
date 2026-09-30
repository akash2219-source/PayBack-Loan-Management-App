import React, { useState, useMemo } from 'react';
import {
  Phone,
  MessageSquare,
  Pencil,
  Trash2,
  Landmark,
  Wallet,
  Plus,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';
import { useToast } from '../context/ToastContext';
import { formatCurrency } from '../utils/currency';
import {
  ScreenHeader,
  StatusPill,
  MetricTile,
  EmptyState,
} from '../components/common/UIComponents';
import { CustomerModal } from './ClientsView';
import { NewLoanWizardModal } from '../components/loans/NewLoanWizardModal';

export const ClientDetailView: React.FC<{ customerId: string }> = ({ customerId }) => {
  const { data, updateData } = useAuth();
  const nav = useNavigation();
  const toast = useToast();

  const customer = data.customers.find(c => c.id === customerId);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [showLoanWizard, setShowLoanWizard] = useState<boolean>(!!nav.view.openWizard);

  const clientCollaterals = useMemo(
    () => (data.collaterals || []).filter(c => c.customerId === customerId),
    [data.collaterals, customerId]
  );

  const clientLoans = useMemo(
    () => (customer ? data.loans.filter(l => l.customerId === customer.id) : []),
    [data.loans, customer]
  );

  const activeLoans = useMemo(
    () =>
      clientLoans.filter(
        l => l.status === 'ACTIVE' || l.status === 'OVERDUE' || l.status === 'PARTIALLY_SETTLED'
      ),
    [clientLoans]
  );

  const totalOutstanding = useMemo(
    () => activeLoans.reduce((sum, l) => sum + (Number(l.currentPrincipalBalance) || 0), 0),
    [activeLoans]
  );

  const totalCollected = useMemo(() => {
    const loanIds = new Set(clientLoans.map(l => l.id));
    return data.transactions
      .filter(t => t.status === 'VALID' && t.type === 'PAYMENT' && loanIds.has(t.loanId))
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [data.transactions, clientLoans]);

  if (!customer) {
    return (
      <div className="space-y-4">
        <ScreenHeader title="Client Details" />
        <EmptyState title="Client not found" hint="This client may have been deleted." />
      </div>
    );
  }

  const handleCall = () => {
    window.location.href = `tel:${customer.phone.replace(/[^\d+]/g, '')}`;
  };

  const handleSms = () => {
    window.location.href = `sms:${customer.phone.replace(/[^\d+]/g, '')}`;
  };

  const handleDelete = () => {
    if (activeLoans.length > 0) {
      toast.push(
        `Cannot delete client with ${activeLoans.length} active loan(s). Close or settle loans first.`,
        'error'
      );
      return;
    }
    updateData(prev => ({
      ...prev,
      customers: prev.customers.filter(c => c.id !== customer.id),
      loans: prev.loans.filter(l => l.customerId !== customer.id),
    }));
    toast.push('Client and historic records removed.', 'success');
    nav.pop();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <ScreenHeader
        title={customer.name}
        subtitle={`ID: ${customer.id}`}
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEditModal(true)}
              className="w-12 h-12 min-w-[48px] min-h-[48px] flex items-center justify-center rounded-2xl bg-[#0F172A] border border-slate-700/60 text-slate-300 hover:text-white transition active:scale-95"
              title="Edit Profile"
              aria-label="Edit Profile"
            >
              <Pencil size={18} />
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="w-12 h-12 min-w-[48px] min-h-[48px] flex items-center justify-center rounded-2xl bg-[#0F172A] border border-slate-700/60 text-slate-400 hover:text-rose-400 transition active:scale-95"
              title="Delete Client"
              aria-label="Delete Client"
            >
              <Trash2 size={18} />
            </button>
          </div>
        }
      />

      {/* Quick Contact Action Bar */}
      <div className="bg-[#1E293B]/70 border border-slate-700/70 rounded-3xl p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400">Mobile Phone</p>
            <p className="text-base font-bold text-white font-mono">{customer.phone}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCall}
              className="px-4 py-2.5 min-h-[48px] rounded-xl bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 border border-indigo-500/30 transition flex items-center gap-1.5 text-xs font-semibold active:scale-95"
            >
              <Phone size={15} />
              <span>Call</span>
            </button>
            <button
              onClick={handleSms}
              className="px-4 py-2.5 min-h-[48px] rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700/60 transition flex items-center gap-1.5 text-xs font-semibold active:scale-95"
            >
              <MessageSquare size={15} />
              <span>SMS</span>
            </button>
          </div>
        </div>

        {(customer.address || customer.idNumber || customer.notes) && (
          <div className="pt-2 border-t border-slate-700/60 text-xs space-y-1 text-slate-400">
            {customer.idNumber && (
              <p>
                <span className="text-slate-500">ID / Aadhaar:</span> {customer.idNumber}
              </p>
            )}
            {customer.address && (
              <p>
                <span className="text-slate-500">Address:</span> {customer.address}
              </p>
            )}
            {customer.notes && (
              <p>
                <span className="text-slate-500">Notes:</span> {customer.notes}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <MetricTile
          label="Total Outstanding"
          value={formatCurrency(totalOutstanding)}
          accent="indigo"
          icon={<Landmark size={16} />}
        />
        <MetricTile
          label="Total Collected"
          value={formatCurrency(totalCollected)}
          accent="emerald"
          icon={<Wallet size={16} />}
        />
      </div>

      {/* Loans by this client */}
      <div className="bg-[#1E293B]/70 border border-slate-700/70 rounded-3xl p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Client Loans ({clientLoans.length})
          </h3>
          <button
            onClick={() => setShowLoanWizard(true)}
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition"
          >
            <Plus size={13} />
            <span>New Loan</span>
          </button>
        </div>

        {clientLoans.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">No loans recorded for this client.</p>
        ) : (
          <div className="space-y-2">
            {clientLoans.map(loan => (
              <button
                key={loan.id}
                onClick={() => nav.push({ page: 'loanDetail', loanId: loan.id })}
                className="w-full p-3.5 rounded-2xl bg-[#0F172A]/70 hover:bg-slate-800/80 border border-slate-700/60 flex items-center justify-between text-left transition group"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-xs font-bold text-white truncate">
                      {loan.loanName || (loan.type === 'EMI' ? 'EMI Loan' : 'Interest-Only')}
                    </p>
                    <StatusPill status={loan.status} />
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Principal: {formatCurrency(loan.principal)} • Rate: {loan.interestRateEntered ?? loan.interestRate}%
                  </p>
                </div>

                <div className="text-right shrink-0 flex items-center gap-2">
                  <div>
                    <p className="text-xs font-bold font-mono text-emerald-400">
                      {formatCurrency(loan.currentPrincipalBalance)}
                    </p>
                    <p className="text-[9px] text-slate-500 uppercase">Balance</p>
                  </div>
                  <ArrowRight size={14} className="text-slate-600 group-hover:text-white transition" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Collateral Assets Pledged by Client */}
      {clientCollaterals.length > 0 && (
        <div className="bg-[#1E293B]/70 border border-amber-500/30 rounded-3xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-amber-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Pledged Security Assets ({clientCollaterals.length})
              </h3>
            </div>
            <button
              onClick={() => nav.push({ page: 'collateralVault' })}
              className="text-xs font-semibold text-amber-400 hover:text-amber-300"
            >
              Vault
            </button>
          </div>

          <div className="space-y-2">
            {clientCollaterals.map(col => (
              <div
                key={col.id}
                className="bg-[#0F172A]/70 rounded-2xl p-3 border border-slate-700/60 flex items-center justify-between text-xs"
              >
                <div>
                  <p className="font-bold text-white">{col.itemTitle}</p>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Locker: {col.storageLocation} • Value: {formatCurrency(col.estimatedValue)}
                  </p>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    col.status === 'PLEDGED'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  }`}
                >
                  {col.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showLoanWizard && (
        <NewLoanWizardModal
          initialCustomerId={customer.id}
          onClose={() => setShowLoanWizard(false)}
        />
      )}

      {showEditModal && (
        <CustomerModal customer={customer} onClose={() => setShowEditModal(false)} />
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1E293B] border border-slate-700/80 rounded-3xl p-5 sm:p-6 w-full max-w-[340px] sm:max-w-sm shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Delete Client</h3>
            <p className="text-xs text-rose-400 font-medium">
              Are you sure you want to delete {customer.name}? Only clients without active loans can be deleted.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 min-h-[48px] h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 font-semibold text-sm transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 min-h-[48px] h-12 rounded-2xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold text-sm transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

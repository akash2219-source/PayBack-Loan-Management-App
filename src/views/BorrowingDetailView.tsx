import React, { useState, useMemo } from 'react';
import {
  MoreVertical,
  CreditCard,
  Pencil,
  FileDown,
  Trash2,
  Wallet,
  HandCoins,
  ShieldCheck,
  Plus,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';
import { useToast } from '../context/ToastContext';
import { formatCurrency } from '../utils/currency';
import { formatDateDisplay, getTodayISO, calculateNextDueDate } from '../utils/date';
import {
  computeBorrowingPayable,
  computeBorrowingTotalPaid,
  computeBorrowingNextDueDate,
  computeBorrowingStatus,
  getBorrowingPayments,
  generateNextId,
} from '../utils/calculations';
import { generateBorrowingStatementPDF } from '../utils/pdf';
import { Borrowing, BorrowingPayment, PaymentMode, BorrowingType, LenderType, PaymentFrequency, Lender } from '../types';
import {
  ScreenHeader,
  StatusPill,
  MetricTile,
  EmptyState,
  COMMON_INPUT_CLASS,
  CurrencyInputField,
  DatePickerField,
} from '../components/common/UIComponents';

export const BorrowingDetailView: React.FC<{ borrowingId: string }> = ({ borrowingId }) => {
  const { data, updateData } = useAuth();
  const nav = useNavigation();
  const toast = useToast();
  const todayISO = getTodayISO();

  const borrowing = (data.borrowings || []).find(b => b.id === borrowingId);
  const lender = borrowing ? (data.lenders || []).find(l => l.id === borrowing.lenderId) : null;
  const payments = data.borrowingPayments || [];

  const [showActionSheet, setShowActionSheet] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState<boolean>(false);

  const borrowingPayments = useMemo(
    () => (borrowing ? getBorrowingPayments(payments, borrowing.id).sort((a, b) => b.date.localeCompare(a.date)) : []),
    [payments, borrowing]
  );

  if (!borrowing) {
    return (
      <div className="space-y-4">
        <ScreenHeader title="Borrowing Details" />
        <EmptyState title="Borrowing not found" hint="This borrowing record may have been deleted." />
      </div>
    );
  }

  const status = computeBorrowingStatus(borrowing, payments, todayISO);
  const payable = computeBorrowingPayable(borrowing, payments);
  const totalPaid = computeBorrowingTotalPaid(borrowing, payments);
  const nextDue = computeBorrowingNextDueDate(borrowing, payments);
  const isSettled = status === 'CLOSED';

  const handleDownloadPdf = async () => {
    toast.push('Generating PDF statement...', 'info');
    try {
      await generateBorrowingStatementPDF(data, borrowing, lender || null);
      toast.push('Borrowing PDF statement downloaded.', 'success');
    } catch (err) {
      toast.push('Failed to generate statement.', 'error');
      console.error(err);
    }
  };

  const handleMarkSettled = () => {
    updateData(prev => ({
      ...prev,
      borrowings: prev.borrowings.map(b => (b.id === borrowing.id ? { ...b, status: 'CLOSED' as const } : b)),
    }));
    toast.push('Borrowing marked as settled.', 'success');
    setShowActionSheet(false);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <ScreenHeader
        title={borrowing.name}
        subtitle={lender ? lender.name : 'Unknown Lender'}
        right={
          <button
            onClick={() => setShowActionSheet(true)}
            className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-2xl bg-[#0F172A] border border-slate-700/60 flex items-center justify-center text-slate-300 hover:text-white shrink-0 transition active:scale-95"
            aria-label="More options"
          >
            <MoreVertical size={20} />
          </button>
        }
      />

      {/* Lender Overview Card */}
      <div className="bg-[#1E293B]/70 border border-slate-700/70 rounded-2xl p-4 flex items-center justify-between shadow-md">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white truncate">{lender?.name || 'Lender / Institution'}</p>
          <p className="text-xs text-slate-400 truncate">
            {lender ? `${lender.type} ${lender.contact ? '• ' + lender.contact : ''}` : '—'}
          </p>
        </div>
        <StatusPill status={status} />
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <MetricTile
          label="Total Payable"
          value={formatCurrency(payable)}
          accent="amber"
          icon={<HandCoins size={16} />}
        />
        <MetricTile
          label={borrowing.type === 'OPEN' ? 'Total Paid' : 'Installment'}
          value={formatCurrency(borrowing.type === 'OPEN' ? totalPaid : Number(borrowing.installmentAmount) || 0)}
          accent="indigo"
          icon={<Wallet size={16} />}
        />
      </div>

      {/* Borrowing Info */}
      <div className="bg-[#1E293B]/70 border border-slate-700/70 rounded-3xl p-5 shadow-xl space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Borrowing Terms</h3>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="bg-[#0F172A]/70 rounded-xl p-3 border border-slate-700/60">
            <span className="text-slate-500 block mb-0.5">Type</span>
            <span className="font-semibold text-white font-mono">
              {borrowing.type === 'FIXED' ? 'Fixed Installment' : 'Open-Ended'}
            </span>
          </div>
          <div className="bg-[#0F172A]/70 rounded-xl p-3 border border-slate-700/60">
            <span className="text-slate-500 block mb-0.5">Borrowed Amount</span>
            <span className="font-semibold text-white font-mono">{formatCurrency(borrowing.amount)}</span>
          </div>
          <div className="bg-[#0F172A]/70 rounded-xl p-3 border border-slate-700/60">
            <span className="text-slate-500 block mb-0.5">Start Date</span>
            <span className="font-semibold text-white font-mono">{formatDateDisplay(borrowing.startDate)}</span>
          </div>
          <div className="bg-[#0F172A]/70 rounded-xl p-3 border border-slate-700/60">
            <span className="text-slate-500 block mb-0.5">Next Due Date</span>
            <span className="font-semibold text-white font-mono">{formatDateDisplay(nextDue)}</span>
          </div>
          <div className="bg-[#0F172A]/70 rounded-xl p-3 border border-slate-700/60">
            <span className="text-slate-500 block mb-0.5">Paid So Far</span>
            <span className="font-bold text-emerald-400 font-mono text-sm">{formatCurrency(totalPaid)}</span>
          </div>
          <div className="bg-[#0F172A]/70 rounded-xl p-3 border border-slate-700/60">
            <span className="text-slate-500 block mb-0.5">Remaining Due</span>
            <span className="font-bold text-amber-400 font-mono text-sm">{formatCurrency(payable)}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      {!isSettled && (
        <div className="flex gap-2.5">
          <button
            onClick={() => setShowAddPaymentModal(true)}
            className="flex-1 min-h-[48px] py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 active:scale-98 transition"
          >
            <CreditCard size={18} />
            <span>Record Outbound Payment</span>
          </button>
          <button
            onClick={() => setShowEditModal(true)}
            className="px-4 py-3.5 min-h-[48px] rounded-2xl bg-[#1E293B] hover:bg-slate-800 border border-slate-700/60 text-slate-300 hover:text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
          >
            <Pencil size={16} />
            <span>Edit</span>
          </button>
        </div>
      )}

      {/* Payment History */}
      <div className="bg-[#1E293B]/70 border border-slate-700/70 rounded-3xl p-5 shadow-xl space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Payment History ({borrowingPayments.length})
        </h3>

        {borrowingPayments.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">No outbound payments recorded yet.</p>
        ) : (
          <div className="rounded-2xl border border-slate-700/60 bg-[#0F172A]/70 divide-y divide-slate-800/80 overflow-hidden">
            {borrowingPayments.map(p => (
              <div key={p.id} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-300">{formatDateDisplay(p.date)}</span>
                    <span className="text-[10px] text-slate-500">• {p.paymentMode}</span>
                  </div>
                  {p.notes && <p className="text-slate-500 truncate mt-0.5">{p.notes}</p>}
                </div>
                <span className="font-mono font-bold text-sm text-emerald-400">
                  {formatCurrency(p.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions Modal */}
      {showActionSheet && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-end justify-center select-none"
          onClick={() => setShowActionSheet(false)}
        >
          <div
            className="w-full max-w-[440px] mx-auto bg-[#1E293B] border-t border-slate-700/80 rounded-t-[28px] rounded-b-none p-4 sm:p-5 shadow-2xl space-y-3 max-h-[85vh] overflow-y-auto no-scrollbar pb-8 animate-m3-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-center pt-1 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-slate-500/70" />
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
              <h3 className="font-bold text-white text-sm">Borrowing Actions</h3>
              <button
                onClick={() => setShowActionSheet(false)}
                className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-full bg-[#0F172A] border border-slate-700/60 flex items-center justify-center text-slate-400 hover:text-white active:scale-95 transition"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => {
                  setShowActionSheet(false);
                  handleDownloadPdf();
                }}
                className="w-full min-h-[52px] p-3.5 rounded-2xl bg-[#0F172A]/70 hover:bg-slate-800 active:scale-98 flex items-center gap-3 text-left text-xs font-semibold text-slate-200 border border-slate-700/40 transition"
              >
                <FileDown size={18} className="text-indigo-400" />
                <span>Export Borrowing Statement (PDF)</span>
              </button>

              {!isSettled && (
                <button
                  onClick={handleMarkSettled}
                  className="w-full min-h-[52px] p-3.5 rounded-2xl bg-[#0F172A]/70 hover:bg-slate-800 active:scale-98 flex items-center gap-3 text-left text-xs font-semibold text-emerald-400 border border-slate-700/40 transition"
                >
                  <ShieldCheck size={18} />
                  <span>Mark as Settled</span>
                </button>
              )}

              <button
                onClick={() => {
                  setShowActionSheet(false);
                  setShowDeleteModal(true);
                }}
                className="w-full min-h-[52px] p-3.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 active:scale-98 flex items-center gap-3 text-left text-xs font-semibold text-rose-400 transition border border-rose-500/20"
              >
                <Trash2 size={18} />
                <span>Delete Borrowing</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <BorrowingModal borrowing={borrowing} onClose={() => setShowEditModal(false)} />
      )}

      {showAddPaymentModal && (
        <AddBorrowingPaymentModal
          borrowing={borrowing}
          onClose={() => setShowAddPaymentModal(false)}
        />
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1E293B] border border-slate-700/80 rounded-3xl p-5 sm:p-6 w-full max-w-[340px] sm:max-w-sm shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto no-scrollbar">
            <h3 className="text-base font-bold text-white">Delete Borrowing</h3>
            <p className="text-xs text-rose-400 font-medium">
              This will remove this borrowing record and all {borrowingPayments.length} associated payments.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 min-h-[48px] h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 font-semibold text-sm transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  updateData(prev => ({
                    ...prev,
                    borrowings: prev.borrowings.filter(b => b.id !== borrowing.id),
                    borrowingPayments: prev.borrowingPayments.filter(p => p.borrowingId !== borrowing.id),
                  }));
                  toast.push('Borrowing deleted.', 'success');
                  nav.pop();
                }}
                className="flex-1 min-h-[48px] h-12 rounded-2xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold text-sm shadow-lg shadow-rose-600/25 transition"
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

export const BorrowingModal: React.FC<{ borrowing?: Borrowing; onClose: () => void }> = ({
  borrowing,
  onClose,
}) => {
  const { data, updateData } = useAuth();
  const toast = useToast();
  const isEdit = !!borrowing;

  const lenders = data.lenders || [];
  const [lenderId, setLenderId] = useState<string>(borrowing?.lenderId || (lenders[0]?.id || ''));
  const [name, setName] = useState<string>(borrowing?.name || '');
  const [type, setType] = useState<BorrowingType>(borrowing?.type || 'FIXED');
  const [amount, setAmount] = useState<string>(borrowing ? String(borrowing.amount) : '');
  const openingBalance = borrowing ? String(borrowing.openingBalance) : '';
  const [installmentAmount, setInstallmentAmount] = useState<string>(borrowing?.installmentAmount ? String(borrowing.installmentAmount) : '');
  const [frequency, setFrequency] = useState<PaymentFrequency>(borrowing?.frequency || 'MONTHLY');
  const [startDate, setStartDate] = useState<string>(borrowing?.startDate || getTodayISO());
  const endDate = borrowing?.endDate || '';
  const [totalInstallments, setTotalInstallments] = useState<string>(borrowing?.totalInstallments ? String(borrowing.totalInstallments) : '');
  const [notes, setNotes] = useState<string>(borrowing?.notes || '');
  const [showAddLender, setShowAddLender] = useState<boolean>(false);

  const numAmount = Number(amount) || 0;
  const numOpening = openingBalance === '' ? numAmount : Number(openingBalance) || 0;

  const handleSave = () => {
    if (!lenderId) {
      toast.push('Please select or add a lender first.', 'error');
      return;
    }
    if (!name.trim()) {
      toast.push('Borrowing name is required.', 'error');
      return;
    }
    if (numAmount <= 0) {
      toast.push('Please enter a valid borrowing amount.', 'error');
      return;
    }

    const payload = {
      lenderId,
      name: name.trim(),
      type,
      amount: numAmount,
      openingBalance: numOpening,
      installmentAmount: type === 'FIXED' && Number(installmentAmount) ? Number(installmentAmount) : undefined,
      frequency: type === 'FIXED' ? frequency : null,
      startDate,
      endDate: endDate || null,
      totalInstallments: type === 'FIXED' && totalInstallments ? Number(totalInstallments) : null,
      notes: notes.trim(),
    };

    if (isEdit) {
      updateData(prev => ({
        ...prev,
        borrowings: prev.borrowings.map(b => (b.id === borrowing.id ? { ...b, ...payload } : b)),
      }));
      toast.push('Borrowing updated.', 'success');
    } else {
      const nextDue = type === 'FIXED' ? calculateNextDueDate(startDate, 1, frequency) : 'N/A';
      const newBorrowing: Borrowing = {
        id: generateNextId('BRW', data.borrowings || [], data),
        ...payload,
        nextDueDate: nextDue,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      };
      updateData(prev => ({
        ...prev,
        borrowings: [...(prev.borrowings || []), newBorrowing],
      }));
      toast.push('Borrowing added.', 'success');
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-end justify-center select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[440px] mx-auto bg-[#1E293B] border-t border-slate-700/80 rounded-t-[28px] rounded-b-none p-4 sm:p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto no-scrollbar animate-m3-slide-up pb-8"
        onClick={e => e.stopPropagation()}
      >
        {/* Android Material 3 Drag Handle */}
        <div className="w-full flex items-center justify-center pt-1 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-500/70" />
        </div>

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
              <HandCoins size={18} />
            </div>
            <div>
              <h3 className="font-bold text-white text-base leading-tight">
                {isEdit ? 'Edit Borrowing' : 'New Borrowing'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {isEdit ? 'Update liability & repayment details' : 'Record external debt or capital borrowed'}
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

        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-400">Lender / Institution</label>
              <button
                type="button"
                onClick={() => setShowAddLender(true)}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold transition"
              >
                <Plus size={12} /> Add Lender
              </button>
            </div>
            {lenders.length === 0 ? (
              <button
                type="button"
                onClick={() => setShowAddLender(true)}
                className="w-full py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-indigo-400 text-xs font-semibold"
              >
                + Add a lender first
              </button>
            ) : (
              <select
                value={lenderId}
                onChange={e => setLenderId(e.target.value)}
                className={COMMON_INPUT_CLASS}
              >
                {lenders.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.type})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Borrowing / Loan Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. HDFC Home Loan, Gold Loan"
              className={COMMON_INPUT_CLASS}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Type</label>
              <select
                value={type}
                onChange={e => setType(e.target.value as BorrowingType)}
                className={COMMON_INPUT_CLASS}
              >
                <option value="FIXED">Fixed Installment</option>
                <option value="OPEN">Open-Ended</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Frequency</label>
              <select
                disabled={type === 'OPEN'}
                value={frequency}
                onChange={e => setFrequency(e.target.value as PaymentFrequency)}
                className={`${COMMON_INPUT_CLASS} disabled:opacity-40`}
              >
                <option value="MONTHLY">Monthly</option>
                <option value="WEEKLY">Weekly</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Amount Borrowed (₹)</label>
              <CurrencyInputField value={amount} onChange={setAmount} placeholder="0" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Installment (₹)</label>
              <CurrencyInputField
                value={installmentAmount}
                onChange={setInstallmentAmount}
                placeholder={type === 'OPEN' ? 'N/A' : '0'}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Start Date</label>
              <DatePickerField value={startDate} onChange={setStartDate} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Total Installments (Optional)</label>
              <input
                type="number"
                value={totalInstallments}
                onChange={e => setTotalInstallments(e.target.value)}
                placeholder="e.g. 60"
                className={COMMON_INPUT_CLASS}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Notes</label>
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Account ref or notes"
              className={COMMON_INPUT_CLASS}
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 min-h-[48px] h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 font-semibold text-sm transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 min-h-[48px] h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-sm shadow-lg shadow-indigo-600/25 transition"
          >
            {isEdit ? 'Save Changes' : 'Add Borrowing'}
          </button>
        </div>

        {showAddLender && (
          <LenderModal
            onClose={() => setShowAddLender(false)}
            onCreated={newId => setLenderId(newId)}
          />
        )}
      </div>
    </div>
  );
};

export const LenderModal: React.FC<{
  lender?: Lender;
  onClose: () => void;
  onCreated?: (newId: string) => void;
}> = ({ lender, onClose, onCreated }) => {
  const { data, updateData } = useAuth();
  const toast = useToast();
  const isEdit = !!lender;

  const [name, setName] = useState(lender?.name || '');
  const [type, setType] = useState<LenderType>(lender?.type || 'BANK');
  const [contact, setContact] = useState(lender?.contact || '');
  const [notes, setNotes] = useState(lender?.notes || '');

  const handleSave = () => {
    if (!name.trim()) {
      toast.push('Lender name is required.', 'error');
      return;
    }

    const payload = {
      name: name.trim(),
      type,
      contact: contact.trim(),
      notes: notes.trim(),
    };

    if (isEdit) {
      updateData(prev => ({
        ...prev,
        lenders: prev.lenders.map(l => (l.id === lender.id ? { ...l, ...payload } : l)),
      }));
      toast.push('Lender updated.', 'success');
    } else {
      const newId = generateNextId('LEN', data.lenders || [], data);
      const newLender: Lender = {
        id: newId,
        ...payload,
        createdAt: new Date().toISOString(),
      };
      updateData(prev => ({
        ...prev,
        lenders: [...(prev.lenders || []), newLender],
      }));
      toast.push('Lender added.', 'success');
      onCreated?.(newId);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-end justify-center select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[440px] mx-auto bg-[#1E293B] border-t border-slate-700/80 rounded-t-[28px] rounded-b-none p-4 sm:p-5 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto no-scrollbar animate-m3-slide-up pb-8"
        onClick={e => e.stopPropagation()}
      >
        {/* Android Material 3 Drag Handle */}
        <div className="w-full flex items-center justify-center pt-1 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-500/70" />
        </div>

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
          <div>
            <h3 className="text-base font-bold text-white leading-tight">{isEdit ? 'Edit Lender' : 'New Lender'}</h3>
            <p className="text-[11px] text-slate-400">Save bank, institution or individual creditor</p>
          </div>
          <button
            onClick={onClose}
            className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-full bg-[#0F172A] border border-slate-700/60 flex items-center justify-center text-slate-400 hover:text-white active:scale-95 transition"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Name / Institution</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. HDFC Bank, SBI"
              className={COMMON_INPUT_CLASS}
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Type</label>
            <select
              value={type}
              onChange={e => setType(e.target.value as LenderType)}
              className={COMMON_INPUT_CLASS}
            >
              <option value="BANK">Bank</option>
              <option value="NBFC">NBFC</option>
              <option value="INDIVIDUAL">Individual</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Contact Details</label>
            <input
              value={contact}
              onChange={e => setContact(e.target.value)}
              placeholder="Phone, Branch, or RM"
              className={COMMON_INPUT_CLASS}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Notes</label>
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Additional details"
              className={COMMON_INPUT_CLASS}
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 min-h-[48px] h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 font-semibold text-sm transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 min-h-[48px] h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-sm shadow-lg shadow-indigo-600/25 transition"
          >
            {isEdit ? 'Save Changes' : 'Add Lender'}
          </button>
        </div>
      </div>
    </div>
  );
};

const AddBorrowingPaymentModal: React.FC<{ borrowing: Borrowing; onClose: () => void }> = ({
  borrowing,
  onClose,
}) => {
  const { data, updateData } = useAuth();
  const toast = useToast();

  const [amount, setAmount] = useState<string>(
    borrowing.type === 'FIXED' ? String(borrowing.installmentAmount || '') : ''
  );
  const [date, setDate] = useState<string>(getTodayISO());
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('BANK_TRANSFER');
  const [notes, setNotes] = useState<string>('');

  const numAmount = Number(amount) || 0;
  const currentPayable = computeBorrowingPayable(borrowing, data.borrowingPayments || []);

  const handleSave = () => {
    if (numAmount <= 0) {
      toast.push('Please enter a valid payment amount.', 'error');
      return;
    }

    const newPayment: BorrowingPayment = {
      id: generateNextId('BP', data.borrowingPayments || [], data),
      borrowingId: borrowing.id,
      date,
      amount: numAmount,
      paymentMode,
      notes: notes.trim(),
      status: 'VALID',
      createdAt: new Date().toISOString(),
    };

    updateData(prev => {
      const nextPayments = [...(prev.borrowingPayments || []), newPayment];
      const remaining = computeBorrowingPayable(borrowing, nextPayments);
      const updatedBorrowings = prev.borrowings.map(b => {
        if (b.id !== borrowing.id) return b;
        return {
          ...b,
          status: remaining <= 0 ? ('CLOSED' as const) : b.status,
          nextDueDate: computeBorrowingNextDueDate(b, nextPayments),
        };
      });

      return {
        ...prev,
        borrowings: updatedBorrowings,
        borrowingPayments: nextPayments,
      };
    });

    toast.push('Outbound payment recorded.', 'success');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-end justify-center select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[440px] mx-auto bg-[#1E293B] border-t border-slate-700/80 rounded-t-[28px] rounded-b-none p-4 sm:p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto no-scrollbar animate-m3-slide-up pb-8"
        onClick={e => e.stopPropagation()}
      >
        {/* Android Material 3 Drag Handle */}
        <div className="w-full flex items-center justify-center pt-1 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-500/70" />
        </div>

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
          <div>
            <h3 className="text-base font-bold text-white leading-tight">Record Outbound Payment</h3>
            <p className="text-xs text-slate-400">
              Payable balance: <span className="font-bold text-amber-400">{formatCurrency(currentPayable)}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-full bg-[#0F172A] border border-slate-700/60 flex items-center justify-center text-slate-400 hover:text-white active:scale-95 transition"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Amount Paid (₹)</label>
            <CurrencyInputField value={amount} onChange={setAmount} autoFocus />
            {borrowing.type === 'FIXED' && Number(borrowing.installmentAmount) > 0 && (
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setAmount(String(borrowing.installmentAmount))}
                  className="px-3 py-2 min-h-[48px] rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-indigo-400 font-semibold transition active:scale-95 flex items-center justify-center"
                >
                  Full Installment ({formatCurrency(borrowing.installmentAmount)})
                </button>
                <button
                  type="button"
                  onClick={() => setAmount(String(currentPayable))}
                  className="px-3 py-2 min-h-[48px] rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-amber-400 font-semibold transition active:scale-95 flex items-center justify-center"
                >
                  Full Balance ({formatCurrency(currentPayable)})
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Date</label>
            <DatePickerField value={date} onChange={setDate} />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Payment Mode</label>
            <select
              value={paymentMode}
              onChange={e => setPaymentMode(e.target.value as PaymentMode)}
              className={COMMON_INPUT_CLASS}
            >
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="UPI">UPI</option>
              <option value="CHEQUE">Cheque</option>
              <option value="CASH">Cash</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Notes (Optional)</label>
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. UTR reference number"
              className={COMMON_INPUT_CLASS}
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 min-h-[48px] h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 font-semibold text-sm transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 min-h-[48px] h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-sm shadow-lg shadow-indigo-600/25 transition"
          >
            Save Payment
          </button>
        </div>
      </div>
    </div>
  );
};

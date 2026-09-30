import React, { useState, useMemo } from 'react';
import {
  MoreVertical,
  CreditCard,
  Pencil,
  FileDown,
  MessageSquare,
  Ban,
  Trash2,
  Flag,
  RotateCcw,
  Wallet,
  Table2,
  Landmark,
  ShieldCheck,
  PauseCircle,
  Tag,
  QrCode,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';
import { useToast } from '../context/ToastContext';
import { formatCurrency } from '../utils/currency';
import { formatDateDisplay, getTodayISO, parseISODate } from '../utils/date';
import {
  computeExpectedCyclePayment,
  computeExpectedInterestPerCycle,
  computeAccruedPenalty,
  generateAmortizationSchedule,
  calculateForeclosurePayoff,
  revertTransactionEffects,
  computeWaterfall,
  computeLoanStatus,
  generateNextId,
} from '../utils/calculations';
import { generateSmsReminderBody } from '../utils/notifications';
import { generateLoanStatementPDF } from '../utils/pdf';
import { Loan, Transaction, PaymentMode } from '../types';
import {
  ScreenHeader,
  StatusPill,
  MetricTile,
  EmptyState,
  COMMON_INPUT_CLASS,
  CurrencyInputField,
  DatePickerField,
} from '../components/common/UIComponents';
import { RestructureLoanModal } from '../components/loans/RestructureLoanModal';
import { MoratoriumModal } from '../components/loans/MoratoriumModal';
import { PenaltyWaiverModal } from '../components/loans/PenaltyWaiverModal';
import { CollateralModal } from '../components/collateral/CollateralModal';
import { DynamicUpiQrModal } from '../components/common/DynamicUpiQrModal';

export const LoanDetailView: React.FC<{ loanId: string }> = ({ loanId }) => {
  const { data, updateData } = useAuth();
  const nav = useNavigation();
  const toast = useToast();
  const todayISO = getTodayISO();

  const loan = data.loans.find(l => l.id === loanId);
  const customer = loan ? data.customers.find(c => c.id === loan.customerId) : null;

  const [showActionSheet, setShowActionSheet] = useState<boolean>(false);
  const [showForecloseModal, setShowForecloseModal] = useState<boolean>(false);
  const [showWriteOffModal, setShowWriteOffModal] = useState<boolean>(false);
  const [showRenameModal, setShowRenameModal] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [showRestructureModal, setShowRestructureModal] = useState<boolean>(false);
  const [showMoratoriumModal, setShowMoratoriumModal] = useState<boolean>(false);
  const [showPenaltyWaiverModal, setShowPenaltyWaiverModal] = useState<boolean>(false);
  const [showCollateralModal, setShowCollateralModal] = useState<boolean>(false);
  const [showUpiModal, setShowUpiModal] = useState<boolean>(false);
  const [selectedTxnToVoid, setSelectedTxnToVoid] = useState<Transaction | null>(null);
  const [selectedTxnToEdit, setSelectedTxnToEdit] = useState<Transaction | null>(null);
  const [selectedTxnToDelete, setSelectedTxnToDelete] = useState<Transaction | null>(null);

  const loanCollaterals = useMemo(
    () =>
      (data.collaterals || []).filter(
        c => c.loanId === loan?.id || (loan?.collateralIds || []).includes(c.id)
      ),
    [data.collaterals, loan]
  );

  const transactions = useMemo(
    () => (loan ? data.transactions.filter(t => t.loanId === loan.id).sort((a, b) => b.date.localeCompare(a.date)) : []),
    [data.transactions, loan]
  );

  const schedule = useMemo(() => (loan ? generateAmortizationSchedule(loan) : []), [loan]);

  if (!loan || !customer) {
    return (
      <div className="space-y-4">
        <ScreenHeader title="Loan Details" />
        <EmptyState title="Loan not found" hint="This loan may have been deleted." />
      </div>
    );
  }

  const isClosed = loan.status === 'CLOSED' || loan.status === 'WRITTEN_OFF';
  const accruedPenalty = computeAccruedPenalty(loan, todayISO);
  const installmentOrInterest =
    loan.type === 'EMI'
      ? (loan.emiAmount ?? computeExpectedCyclePayment(loan))
      : computeExpectedInterestPerCycle(loan);

  const totalRepaid = transactions
    .filter(t => t.status === 'VALID' && t.type === 'PAYMENT')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const handleSendSms = () => {
    const body = generateSmsReminderBody(loan, customer, data.settings);
    const cleanPhone = customer.phone.replace(/[^\d+]/g, '');
    window.location.href = `sms:${cleanPhone}?&body=${encodeURIComponent(body)}`;
    updateData(prev => ({
      ...prev,
      loans: prev.loans.map(l => (l.id === loan.id ? { ...l, lastReminderSentAt: todayISO } : l)),
    }));
    toast.push('SMS template opened in messaging app.', 'success');
  };

  const handleDownloadPdf = async () => {
    toast.push('Generating PDF statement...', 'info');
    try {
      await generateLoanStatementPDF(data, loan, customer);
      toast.push('PDF statement downloaded successfully.', 'success');
    } catch (err) {
      toast.push('Failed to generate PDF statement.', 'error');
      console.error(err);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <ScreenHeader
        title={loan.loanName || (loan.type === 'EMI' ? 'EMI Loan' : 'Interest-Only Loan')}
        subtitle={`ID: ${loan.id}`}
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

      {/* Client Overview Tile */}
      <div
        onClick={() => nav.push({ page: 'clientDetail', customerId: customer.id })}
        className="bg-[#1E293B]/70 border border-slate-700/70 rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:border-indigo-500/40 transition shadow-md"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white truncate">{customer.name}</p>
          <p className="text-xs text-slate-400 font-mono truncate">{customer.phone}</p>
        </div>
        <StatusPill status={loan.status} />
      </div>

      {/* Main Metric Cards */}
      <div className="grid grid-cols-2 gap-3">
        <MetricTile
          label="Principal Loan"
          value={formatCurrency(loan.principal)}
          accent="indigo"
          icon={<Landmark size={16} />}
        />
        <MetricTile
          label={loan.type === 'EMI' ? 'Installment' : 'Interest / Cycle'}
          value={formatCurrency(installmentOrInterest)}
          accent="emerald"
          icon={<Wallet size={16} />}
        />
      </div>

      {/* Key Terms Details */}
      <div className="bg-[#1E293B]/70 border border-slate-700/70 rounded-3xl p-5 shadow-xl space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Loan Terms & Timeline</h3>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="bg-[#0F172A]/70 rounded-xl p-3 border border-slate-700/60">
            <span className="text-slate-500 block mb-0.5">Start Date</span>
            <span className="font-semibold text-white font-mono">{formatDateDisplay(loan.startDate)}</span>
          </div>
          <div className="bg-[#0F172A]/70 rounded-xl p-3 border border-slate-700/60">
            <span className="text-slate-500 block mb-0.5">Next Due Date</span>
            <span className={`font-semibold font-mono ${loan.status === 'OVERDUE' ? 'text-rose-400' : 'text-white'}`}>
              {formatDateDisplay(loan.nextDueDate)}
            </span>
          </div>
          <div className="bg-[#0F172A]/70 rounded-xl p-3 border border-slate-700/60">
            <span className="text-slate-500 block mb-0.5">Interest Rate</span>
            <span className="font-semibold text-white font-mono">
              {loan.interestRateEntered ?? loan.interestRate}% {loan.rateBasis === 'YEARLY' ? 'p.a.' : 'p.m.'}
            </span>
          </div>
          <div className="bg-[#0F172A]/70 rounded-xl p-3 border border-slate-700/60">
            <span className="text-slate-500 block mb-0.5">Method & Frequency</span>
            <span className="font-semibold text-white truncate block">
              {loan.interestMethod} • {loan.frequency}
            </span>
          </div>
          <div className="bg-[#0F172A]/70 rounded-xl p-3 border border-slate-700/60">
            <span className="text-slate-500 block mb-0.5">Outstanding Balance</span>
            <span className="font-bold text-emerald-400 font-mono text-sm">
              {formatCurrency(loan.currentPrincipalBalance)}
            </span>
          </div>
          <div className="bg-[#0F172A]/70 rounded-xl p-3 border border-slate-700/60">
            <span className="text-slate-500 block mb-0.5">Total Repaid</span>
            <span className="font-bold text-indigo-300 font-mono text-sm">
              {formatCurrency(totalRepaid)}
            </span>
          </div>
        </div>

        {/* Active Moratorium Banner */}
        {loan.activeMoratoriumUntil && parseISODate(todayISO) <= parseISODate(loan.activeMoratoriumUntil) && (
          <div className="bg-cyan-500/15 border border-cyan-500/40 rounded-2xl p-3.5 text-xs text-cyan-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PauseCircle size={18} className="text-cyan-400 shrink-0" />
              <div>
                <p className="font-bold text-white">Active Moratorium / EMI Holiday</p>
                <p className="text-[11px] text-cyan-200">
                  Late penalties suspended until {formatDateDisplay(loan.activeMoratoriumUntil)}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowMoratoriumModal(true)}
              className="px-2.5 py-1 rounded-xl bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/40 text-white font-bold text-[11px]"
            >
              Manage
            </button>
          </div>
        )}

        {accruedPenalty > 0 && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-400 flex items-center justify-between font-mono">
            <div>
              <span>Accrued Penalty: </span>
              <span className="font-bold">{formatCurrency(accruedPenalty)}</span>
            </div>
            <button
              onClick={() => setShowPenaltyWaiverModal(true)}
              className="px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-[11px] font-sans font-semibold"
            >
              Waive Late Fees
            </button>
          </div>
        )}

        {loan.waivedPenaltyTotal && loan.waivedPenaltyTotal > 0 ? (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-2.5 text-xs text-emerald-400 flex items-center justify-between font-mono">
            <span>Total Penalties Waived:</span>
            <span className="font-bold">{formatCurrency(loan.waivedPenaltyTotal)}</span>
          </div>
        ) : null}

        {loan.excessCreditBalance > 0 && (
          <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-3 text-xs text-indigo-400 flex items-center justify-between font-mono">
            <span>Advance Credit Available:</span>
            <span className="font-bold">{formatCurrency(loan.excessCreditBalance)}</span>
          </div>
        )}
      </div>

      {/* Secured Collaterals Card */}
      {(loan.isSecured || loanCollaterals.length > 0) && (
        <div className="bg-[#1E293B]/70 border border-amber-500/30 rounded-3xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-amber-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Pledged Collateral Assets ({loanCollaterals.length})
              </h3>
            </div>
            <button
              onClick={() => setShowCollateralModal(true)}
              className="text-xs font-semibold text-amber-400 hover:text-amber-300 transition"
            >
              + Add Asset
            </button>
          </div>

          {loanCollaterals.length === 0 ? (
            <p className="text-xs text-slate-500 py-2">Marked as secured loan, but no asset items registered.</p>
          ) : (
            <div className="space-y-2">
              {loanCollaterals.map(col => (
                <div
                  key={col.id}
                  className="bg-[#0F172A]/70 rounded-2xl p-3 border border-slate-700/60 flex items-center justify-between text-xs font-mono"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="font-bold text-white font-sans truncate">{col.itemTitle}</p>
                    <p className="text-[11px] text-slate-400">
                      Locker: <span className="text-slate-200">{col.storageLocation}</span> • Value: {formatCurrency(col.estimatedValue)}
                    </p>
                    {col.grossWeightGrams && (
                      <p className="text-[10px] text-amber-300">
                        {col.purityKarat || 22}K Gold • {col.grossWeightGrams}g
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        col.status === 'PLEDGED'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      }`}
                    >
                      {col.status}
                    </span>
                    <p className="text-[10px] text-slate-500 font-sans mt-0.5">LTV: {col.loanToValue || 0}%</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Restructuring History Card */}
      {loan.restructuringHistory && loan.restructuringHistory.length > 0 && (
        <div className="bg-[#1E293B]/70 border border-indigo-500/30 rounded-3xl p-5 shadow-xl space-y-2.5">
          <div className="flex items-center gap-2">
            <RotateCcw size={16} className="text-indigo-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Restructuring Audit Log ({loan.restructuringHistory.length})
            </h3>
          </div>
          <div className="space-y-2">
            {loan.restructuringHistory.map((rst, idx) => (
              <div
                key={rst.id || idx}
                className="bg-[#0F172A]/70 rounded-2xl p-3 border border-slate-700/60 text-xs space-y-1"
              >
                <div className="flex justify-between font-mono text-[11px]">
                  <span className="text-slate-400">{formatDateDisplay(rst.date)}</span>
                  <span className="text-indigo-300 font-bold">
                    {rst.previousInterestRate}% → {rst.newInterestRate}%
                  </span>
                </div>
                <p className="text-slate-300 text-[11px]">
                  Principal: <span className="font-mono">{formatCurrency(rst.previousPrincipal)}</span> →{' '}
                  <span className="font-mono font-bold text-white">{formatCurrency(rst.newPrincipal)}</span>
                  {rst.newTenure ? ` (${rst.newTenure} ${rst.newFrequency.toLowerCase()}s)` : ''}
                </p>
                <p className="text-[11px] text-slate-400 italic">"{rst.reason}"</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Primary Action Buttons */}
      {!isClosed && (
        <div className="flex gap-2">
          <button
            onClick={() => nav.push({ page: 'addPayment', loanId: loan.id })}
            className="flex-1 min-h-[48px] py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 active:scale-98 transition"
          >
            <CreditCard size={18} />
            <span>Record Payment</span>
          </button>
          <button
            onClick={() => setShowUpiModal(true)}
            className="px-4 py-3 min-h-[48px] rounded-2xl bg-[#1E293B] hover:bg-slate-800 border border-slate-700/60 text-sky-400 hover:text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
            title="Scan Dynamic UPI QR"
            aria-label="Scan Dynamic UPI QR"
          >
            <QrCode size={18} />
            <span>UPI QR</span>
          </button>
          <button
            onClick={handleSendSms}
            className="px-4 py-3 min-h-[48px] rounded-2xl bg-[#1E293B] hover:bg-slate-800 border border-slate-700/60 text-slate-300 hover:text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
            title="Send SMS Reminder"
            aria-label="Send SMS Reminder"
          >
            <MessageSquare size={18} />
            <span>SMS</span>
          </button>
        </div>
      )}

      {/* Payment History */}
      <div className="bg-[#1E293B]/70 border border-slate-700/70 rounded-3xl p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Payment History ({transactions.length})
          </h3>
          {transactions.length > 0 && (
            <button
              onClick={() => nav.push({ page: 'ledger', loanId: loan.id })}
              className="min-h-[48px] px-3 -mr-3 flex items-center text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition active:scale-95"
            >
              Full Ledger
            </button>
          )}
        </div>

        {transactions.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">No payments recorded yet.</p>
        ) : (
          <div className="rounded-2xl border border-slate-700/60 bg-[#0F172A]/70 divide-y divide-slate-800/80 overflow-hidden">
            {transactions.map(t => (
              <div
                key={t.id}
                className={`p-3.5 flex items-center justify-between gap-3 text-xs ${
                  t.status === 'VOIDED' ? 'opacity-40' : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-300">{formatDateDisplay(t.date)}</span>
                    <span className="text-[10px] text-slate-500">• {t.paymentMode}</span>
                    {t.status === 'VOIDED' && (
                      <span className="text-rose-400 font-bold uppercase text-[9px]">Voided</span>
                    )}
                    {t.isPartial && (
                      <span className="text-amber-400 font-bold uppercase text-[9px]">Partial</span>
                    )}
                  </div>
                  {t.notes && <p className="text-slate-500 truncate mt-0.5">{t.notes}</p>}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`font-mono font-bold text-sm ${
                      t.status === 'VOIDED' ? 'text-slate-500 line-through' : 'text-emerald-400'
                    }`}
                  >
                    {formatCurrency(t.amount)}
                  </span>
                  {t.status === 'VALID' && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setSelectedTxnToEdit(t)}
                        className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-200 active:scale-95 transition"
                        title="Edit transaction"
                        aria-label="Edit transaction"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => setSelectedTxnToVoid(t)}
                        className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-amber-400 active:scale-95 transition"
                        title="Void transaction"
                        aria-label="Void transaction"
                      >
                        <RotateCcw size={15} />
                      </button>
                      <button
                        onClick={() => setSelectedTxnToDelete(t)}
                        className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-400 active:scale-95 transition"
                        title="Delete transaction"
                        aria-label="Delete transaction"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Amortization Schedule (EMI Only) */}
      {loan.type === 'EMI' && schedule.length > 0 && (
        <div className="bg-[#1E293B]/70 border border-slate-700/70 rounded-3xl p-5 shadow-xl space-y-3">
          <div className="flex items-center gap-2">
            <Table2 size={16} className="text-indigo-400" />
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Amortization Schedule ({schedule.length} Cycles)
            </h3>
          </div>

          <div className="overflow-x-auto max-h-72 border border-slate-700/70 rounded-2xl bg-[#0F172A]/70">
            <table className="w-full text-xs font-mono">
              <thead className="sticky top-0 bg-[#0F172A] border-b border-slate-700/80 text-slate-400">
                <tr>
                  <th className="py-2.5 px-3 text-left">Cycle</th>
                  <th className="py-2.5 px-3 text-left">Due Date</th>
                  <th className="py-2.5 px-3 text-right">Opening</th>
                  <th className="py-2.5 px-3 text-right">EMI</th>
                  <th className="py-2.5 px-3 text-right">Interest</th>
                  <th className="py-2.5 px-3 text-right">Principal</th>
                  <th className="py-2.5 px-3 text-right">Closing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-slate-300">
                {schedule.map(row => (
                  <tr key={row.cycle} className="hover:bg-slate-800/40">
                    <td className="py-2 px-3">{row.cycle}</td>
                    <td className="py-2 px-3 text-slate-400">{formatDateDisplay(row.dueDate)}</td>
                    <td className="py-2 px-3 text-right">{formatCurrency(row.opening)}</td>
                    <td className="py-2 px-3 text-right font-semibold text-indigo-400">
                      {formatCurrency(row.emi)}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-400">
                      {formatCurrency(row.interest)}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-300">
                      {formatCurrency(row.principal)}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-400">
                      {formatCurrency(row.closing)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bottom Actions BottomSheet */}
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
              <h3 className="font-bold text-white text-sm">{loan.loanName || 'Loan Options'}</h3>
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
                <span>Export Loan Statement (PDF)</span>
              </button>

              <button
                onClick={() => {
                  setShowActionSheet(false);
                  setShowRenameModal(true);
                }}
                className="w-full min-h-[52px] p-3.5 rounded-2xl bg-[#0F172A]/70 hover:bg-slate-800 active:scale-98 flex items-center gap-3 text-left text-xs font-semibold text-slate-200 border border-slate-700/40 transition"
              >
                <Pencil size={18} className="text-indigo-300" />
                <span>Rename Loan</span>
              </button>

              <button
                onClick={() => {
                  setShowActionSheet(false);
                  setShowCollateralModal(true);
                }}
                className="w-full min-h-[52px] p-3.5 rounded-2xl bg-[#0F172A]/70 hover:bg-slate-800 active:scale-98 flex items-center gap-3 text-left text-xs font-semibold text-amber-300 border border-slate-700/40 transition"
              >
                <ShieldCheck size={18} className="text-amber-400" />
                <span>Pledge / Manage Collateral</span>
              </button>

              {!isClosed && (
                <>
                  <button
                    onClick={() => {
                      setShowActionSheet(false);
                      setShowRestructureModal(true);
                    }}
                    className="w-full min-h-[52px] p-3.5 rounded-2xl bg-[#0F172A]/70 hover:bg-slate-800 active:scale-98 flex items-center gap-3 text-left text-xs font-semibold text-indigo-300 border border-slate-700/40 transition"
                  >
                    <RotateCcw size={18} className="text-indigo-400" />
                    <span>Restructure Loan Terms</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowActionSheet(false);
                      setShowMoratoriumModal(true);
                    }}
                    className="w-full min-h-[52px] p-3.5 rounded-2xl bg-[#0F172A]/70 hover:bg-slate-800 active:scale-98 flex items-center gap-3 text-left text-xs font-semibold text-cyan-300 border border-slate-700/40 transition"
                  >
                    <PauseCircle size={18} className="text-cyan-400" />
                    <span>Apply Moratorium (EMI Holiday)</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowActionSheet(false);
                      setShowPenaltyWaiverModal(true);
                    }}
                    className="w-full min-h-[52px] p-3.5 rounded-2xl bg-[#0F172A]/70 hover:bg-slate-800 active:scale-98 flex items-center gap-3 text-left text-xs font-semibold text-rose-300 border border-slate-700/40 transition"
                  >
                    <Tag size={18} className="text-rose-400" />
                    <span>Waive Late Penalties</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowActionSheet(false);
                      setShowForecloseModal(true);
                    }}
                    className="w-full min-h-[52px] p-3.5 rounded-2xl bg-[#0F172A]/70 hover:bg-slate-800 active:scale-98 flex items-center gap-3 text-left text-xs font-semibold text-indigo-400 border border-slate-700/40 transition"
                  >
                    <Flag size={18} />
                    <span>Foreclose & Settle Loan</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowActionSheet(false);
                      setShowWriteOffModal(true);
                    }}
                    className="w-full min-h-[52px] p-3.5 rounded-2xl bg-[#0F172A]/70 hover:bg-slate-800 active:scale-98 flex items-center gap-3 text-left text-xs font-semibold text-amber-400 border border-slate-700/40 transition"
                  >
                    <Ban size={18} />
                    <span>Write Off Loan</span>
                  </button>
                </>
              )}

              <button
                onClick={() => {
                  setShowActionSheet(false);
                  setShowDeleteModal(true);
                }}
                className="w-full min-h-[52px] p-3.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 active:scale-98 flex items-center gap-3 text-left text-xs font-semibold text-rose-400 transition border border-rose-500/20"
              >
                <Trash2 size={18} />
                <span>Delete Loan & Records</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Foreclose Modal */}
      {showForecloseModal && (
        <ForecloseModal loan={loan} onClose={() => setShowForecloseModal(false)} />
      )}

      {/* Write Off Modal */}
      {showWriteOffModal && (
        <WriteOffModal loan={loan} onClose={() => setShowWriteOffModal(false)} />
      )}

      {/* Rename Modal */}
      {showRenameModal && (
        <RenameLoanModal loan={loan} onClose={() => setShowRenameModal(false)} />
      )}

      {/* Restructure Loan Modal */}
      {showRestructureModal && (
        <RestructureLoanModal
          loan={loan}
          onClose={() => setShowRestructureModal(false)}
        />
      )}

      {/* Moratorium Modal */}
      {showMoratoriumModal && (
        <MoratoriumModal
          loan={loan}
          onClose={() => setShowMoratoriumModal(false)}
        />
      )}

      {/* Penalty Waiver Modal */}
      {showPenaltyWaiverModal && (
        <PenaltyWaiverModal
          loan={loan}
          onClose={() => setShowPenaltyWaiverModal(false)}
        />
      )}

      {/* Collateral Modal */}
      {showCollateralModal && (
        <CollateralModal
          defaultLoanId={loan.id}
          defaultCustomerId={loan.customerId}
          onClose={() => setShowCollateralModal(false)}
        />
      )}

      {/* Dynamic UPI QR Modal */}
      {showUpiModal && (
        <DynamicUpiQrModal
          amount={Math.round(installmentOrInterest)}
          borrowerName={customer.name}
          loanName={loan.loanName}
          loanId={loan.id}
          onPaymentConfirmed={() => {
            setShowUpiModal(false);
            nav.push({ page: 'addPayment', loanId: loan.id });
          }}
          onClose={() => setShowUpiModal(false)}
        />
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <DeleteLoanModal
          loan={loan}
          onClose={() => setShowDeleteModal(false)}
          onDeleted={() => nav.pop()}
        />
      )}

      {/* Void Txn Modal */}
      {selectedTxnToVoid && (
        <VoidTxnModal txn={selectedTxnToVoid} onClose={() => setSelectedTxnToVoid(null)} />
      )}

      {/* Edit Txn Modal */}
      {selectedTxnToEdit && (
        <EditTxnModal txn={selectedTxnToEdit} onClose={() => setSelectedTxnToEdit(null)} />
      )}

      {/* Delete Txn Modal */}
      {selectedTxnToDelete && (
        <DeleteTxnModal txn={selectedTxnToDelete} onClose={() => setSelectedTxnToDelete(null)} />
      )}
    </div>
  );
};

// Submodals for Loan Actions
const ForecloseModal: React.FC<{ loan: Loan; onClose: () => void }> = ({ loan, onClose }) => {
  const { data, updateData } = useAuth();
  const toast = useToast();
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('CASH');

  const payoff = useMemo(() => calculateForeclosurePayoff(loan), [loan]);

  const handleConfirm = () => {
    const txnId = generateNextId('TXN', data.transactions, data);
    updateData(prev => {
      const updatedLoans = prev.loans.map(l =>
        l.id === loan.id
          ? {
              ...l,
              currentPrincipalBalance: 0,
              excessCreditBalance: 0,
              status: 'CLOSED' as const,
              nextDueDate: 'N/A',
              lastPaymentDate: getTodayISO(),
            }
          : l
      );

      let unapplied = payoff.payoff + (loan.excessCreditBalance || 0);
      const toPenalty = Math.min(unapplied, payoff.penalty);
      unapplied -= toPenalty;
      const toInterest = Math.min(unapplied, payoff.interest);
      unapplied -= toInterest;
      const toPrincipal = Math.min(unapplied, payoff.principal);
      unapplied -= toPrincipal;

      const newTxn: Transaction = {
        id: txnId,
        loanId: loan.id,
        type: 'PAYMENT',
        date: getTodayISO(),
        amount: payoff.payoff,
        paymentMode,
        appliedToPenalty: toPenalty,
        appliedToInterest: toInterest,
        appliedToPrincipal: toPrincipal,
        excessAdvance: Math.max(0, unapplied),
        principalBalanceBefore: loan.currentPrincipalBalance,
        isForeclosure: true,
        notes: 'Foreclosure & Full Settlement',
        status: 'VALID',
      };

      return {
        ...prev,
        loans: updatedLoans,
        transactions: [...prev.transactions, newTxn],
      };
    });

    toast.push('Loan foreclosed and closed.', 'success');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-[#1E293B] border border-slate-700/80 rounded-3xl p-5 sm:p-6 w-full max-w-[400px] mx-auto shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto no-scrollbar">
        <h3 className="text-base font-bold text-white">Foreclose Loan</h3>
        <p className="text-xs text-slate-400">
          Payoff amount calculates unearned interest waiver and immediate closure.
        </p>

        <div className="bg-[#0F172A] rounded-2xl p-4 border border-slate-700/80 text-center space-y-1">
          <p className="text-xs text-slate-400">Total Payoff Amount</p>
          <p className="text-3xl font-extrabold font-mono text-emerald-400">{formatCurrency(payoff.payoff)}</p>
        </div>

        <div className="space-y-1 text-xs text-slate-400 font-mono">
          <div className="flex justify-between">
            <span>Principal:</span>
            <span className="text-white">{formatCurrency(payoff.principal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Earned Interest:</span>
            <span className="text-white">{formatCurrency(payoff.interest)}</span>
          </div>
          <div className="flex justify-between">
            <span>Penalty:</span>
            <span className="text-white">{formatCurrency(payoff.penalty)}</span>
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-400 block mb-1.5 font-semibold">Payment Mode</label>
          <select
            value={paymentMode}
            onChange={e => setPaymentMode(e.target.value as any)}
            className={COMMON_INPUT_CLASS}
          >
            <option value="CASH">Cash</option>
            <option value="UPI">UPI</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="CHEQUE">Cheque</option>
          </select>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 min-h-[48px] h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 font-semibold text-sm transition"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 min-h-[48px] h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-sm shadow-lg shadow-indigo-600/25 transition"
          >
            Confirm Foreclosure
          </button>
        </div>
      </div>
    </div>
  );
};

const WriteOffModal: React.FC<{ loan: Loan; onClose: () => void }> = ({ loan, onClose }) => {
  const { data, updateData } = useAuth();
  const toast = useToast();

  const handleConfirm = () => {
    const txnId = generateNextId('TXN', data.transactions, data);
    updateData(prev => {
      const updatedLoans = prev.loans.map(l =>
        l.id === loan.id
          ? {
              ...l,
              currentPrincipalBalance: 0,
              excessCreditBalance: 0,
              status: 'WRITTEN_OFF' as const,
            }
          : l
      );

      const writeOffTxn: Transaction = {
        id: txnId,
        loanId: loan.id,
        type: 'WRITE_OFF',
        date: getTodayISO(),
        amount: loan.currentPrincipalBalance,
        paymentMode: 'CASH',
        appliedToPenalty: 0,
        appliedToInterest: 0,
        appliedToPrincipal: 0,
        excessAdvance: 0,
        notes: 'Loan written off as uncollectible',
        status: 'VALID',
      };

      return {
        ...prev,
        loans: updatedLoans,
        transactions: [...prev.transactions, writeOffTxn],
      };
    });

    toast.push('Loan written off.', 'success');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-[#1E293B] border border-slate-700/80 rounded-3xl p-5 sm:p-6 w-full max-w-[400px] mx-auto shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto no-scrollbar">
        <h3 className="text-base font-bold text-white">Write Off Loan</h3>
        <p className="text-xs text-rose-400 font-medium">
          Warning: This is a non-reversible action. Outstanding balance will be cleared and marked as written-off in records.
        </p>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 min-h-[48px] h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 font-semibold text-sm transition"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 min-h-[48px] h-12 rounded-2xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold text-sm shadow-lg shadow-rose-600/25 transition"
          >
            Confirm Write-Off
          </button>
        </div>
      </div>
    </div>
  );
};

const RenameLoanModal: React.FC<{ loan: Loan; onClose: () => void }> = ({ loan, onClose }) => {
  const { updateData } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(loan.loanName || '');

  const handleSave = () => {
    updateData(prev => ({
      ...prev,
      loans: prev.loans.map(l => (l.id === loan.id ? { ...l, loanName: name.trim() } : l)),
    }));
    toast.push('Loan name updated.', 'success');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-[#1E293B] border border-slate-700/80 rounded-3xl p-5 sm:p-6 w-full max-w-[400px] mx-auto shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto no-scrollbar">
        <h3 className="text-base font-bold text-white">Rename Loan</h3>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Home Business Loan"
          className={COMMON_INPUT_CLASS}
          autoFocus
        />
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
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

const DeleteLoanModal: React.FC<{ loan: Loan; onClose: () => void; onDeleted: () => void }> = ({
  loan,
  onClose,
  onDeleted,
}) => {
  const { updateData } = useAuth();
  const toast = useToast();

  const handleDelete = () => {
    updateData(prev => ({
      ...prev,
      loans: prev.loans.filter(l => l.id !== loan.id),
      transactions: prev.transactions.filter(t => t.loanId !== loan.id),
    }));
    toast.push('Loan and all records deleted.', 'success');
    onClose();
    onDeleted();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-[#1E293B] border border-slate-700/80 rounded-3xl p-5 sm:p-6 w-full max-w-[400px] mx-auto shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto no-scrollbar">
        <h3 className="text-base font-bold text-white">Delete Loan Permanently</h3>
        <p className="text-xs text-rose-400 font-medium">
          This will delete this loan and all associated transaction records. The client profile will not be removed.
        </p>
        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 min-h-[48px] h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 font-semibold text-sm transition"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            className="flex-1 min-h-[48px] h-12 rounded-2xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold text-sm shadow-lg shadow-rose-600/25 transition"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

const VoidTxnModal: React.FC<{ txn: Transaction; onClose: () => void }> = ({ txn, onClose }) => {
  const { data, updateData } = useAuth();
  const toast = useToast();

  const handleVoid = () => {
    const revId = generateNextId('TXN', data.transactions, data);
    updateData(prev => {
      const updatedLoans = prev.loans.map(l => {
        if (l.id !== txn.loanId) return l;
        return revertTransactionEffects(l, txn);
      });

      const updatedTxns = prev.transactions.map(t =>
        t.id === txn.id ? { ...t, status: 'VOIDED' as const } : t
      );

      const reversal: Transaction = {
        id: revId,
        loanId: txn.loanId,
        type: 'REVERSAL',
        date: getTodayISO(),
        amount: txn.amount,
        paymentMode: txn.paymentMode,
        appliedToPenalty: -(txn.appliedToPenalty || 0),
        appliedToInterest: -(txn.appliedToInterest || 0),
        appliedToPrincipal: -(txn.appliedToPrincipal || 0),
        excessAdvance: -(txn.excessAdvance || 0),
        notes: `Reversal of ${txn.id}`,
        status: 'VALID',
        reversesTxnId: txn.id,
      };

      return {
        ...prev,
        loans: updatedLoans,
        transactions: [...updatedTxns, reversal],
      };
    });

    toast.push('Payment voided and balance restored.', 'success');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-[#1E293B] border border-slate-700/80 rounded-3xl p-5 sm:p-6 w-full max-w-[400px] mx-auto shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto no-scrollbar">
        <h3 className="text-base font-bold text-white">Void Payment</h3>
        <p className="text-xs text-slate-400">
          Voiding will create an audit reversal entry and restore the principal balance.
        </p>
        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 min-h-[48px] h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 font-semibold text-sm transition"
          >
            Cancel
          </button>
          <button
            onClick={handleVoid}
            className="flex-1 min-h-[48px] h-12 rounded-2xl bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-bold text-sm shadow-lg shadow-amber-600/25 transition"
          >
            Confirm Void
          </button>
        </div>
      </div>
    </div>
  );
};

const EditTxnModal: React.FC<{ txn: Transaction; onClose: () => void }> = ({ txn, onClose }) => {
  const { updateData } = useAuth();
  const toast = useToast();

  const [amount, setAmount] = useState<number>(txn.amount);
  const [date, setDate] = useState<string>(txn.date);
  const [mode, setMode] = useState<PaymentMode>(txn.paymentMode);
  const [notes, setNotes] = useState<string>(txn.notes || '');

  const handleSave = () => {
    if (!amount || amount <= 0) {
      toast.push('Please enter a valid amount.', 'error');
      return;
    }

    updateData(prev => {
      const loan = prev.loans.find(l => l.id === txn.loanId);
      if (!loan) return prev;

      // 1. Revert previous txn effects
      const baseLoan = revertTransactionEffects(loan, txn);

      // 2. Apply new waterfall
      const wf = computeWaterfall(baseLoan, amount, date);
      const expectedInstallment = Math.round(computeExpectedCyclePayment(baseLoan));
      const penalty = computeAccruedPenalty(baseLoan, date);
      const totalAvail = amount + (baseLoan.excessCreditBalance || 0);
      const clearsCycle = totalAvail >= penalty + expectedInstallment;
      const isPartial = amount > 0 && !clearsCycle;
      const shortfall = Math.max(0, penalty + expectedInstallment - totalAvail);

      const updatedLoan = {
        ...baseLoan,
        currentPrincipalBalance: Math.max(0, baseLoan.currentPrincipalBalance - wf.appliedToPrincipal),
        excessCreditBalance: wf.excessAdvance,
        lastPaymentDate: date,
        status: baseLoan.currentPrincipalBalance <= 0 ? ('CLOSED' as const) : computeLoanStatus(baseLoan),
      };

      const updatedTxns = prev.transactions.map(t =>
        t.id === txn.id
          ? {
              ...t,
              amount,
              date,
              paymentMode: mode,
              notes,
              appliedToPenalty: wf.appliedToPenalty,
              appliedToInterest: wf.appliedToInterest,
              appliedToPrincipal: wf.appliedToPrincipal,
              excessAdvance: wf.excessAdvance,
              isPartial,
              cycleShortfall: isPartial ? shortfall : 0,
            }
          : t
      );

      return {
        ...prev,
        loans: prev.loans.map(l => (l.id === loan.id ? updatedLoan : l)),
        transactions: updatedTxns,
      };
    });

    toast.push('Payment updated.', 'success');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-[#1E293B] border border-slate-700/80 rounded-3xl p-5 sm:p-6 w-full max-w-[400px] mx-auto shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto no-scrollbar">
        <h3 className="text-base font-bold text-white">Edit Payment</h3>

        <div>
          <label className="text-xs text-slate-400 block mb-1">Amount (₹)</label>
          <CurrencyInputField value={amount} onChange={v => setAmount(Number(v))} />
        </div>

        <div>
          <label className="text-xs text-slate-400 block mb-1">Date</label>
          <DatePickerField value={date} onChange={setDate} />
        </div>

        <div>
          <label className="text-xs text-slate-400 block mb-1">Payment Mode</label>
          <select
            value={mode}
            onChange={e => setMode(e.target.value as any)}
            className={COMMON_INPUT_CLASS}
          >
            <option value="CASH">Cash</option>
            <option value="UPI">UPI</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="CHEQUE">Cheque</option>
          </select>
        </div>

        <div>
          <label className="text-xs text-slate-400 block mb-1">Notes</label>
          <input
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className={COMMON_INPUT_CLASS}
          />
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
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

const DeleteTxnModal: React.FC<{ txn: Transaction; onClose: () => void }> = ({ txn, onClose }) => {
  const { updateData } = useAuth();
  const toast = useToast();

  const handleDelete = () => {
    updateData(prev => {
      const updatedLoans = prev.loans.map(l => (l.id === txn.loanId ? revertTransactionEffects(l, txn) : l));
      return {
        ...prev,
        loans: updatedLoans,
        transactions: prev.transactions.filter(t => t.id !== txn.id),
      };
    });
    toast.push('Transaction deleted and balance restored.', 'success');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-[#1E293B] border border-slate-700/80 rounded-3xl p-5 sm:p-6 w-full max-w-[400px] mx-auto shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto no-scrollbar">
        <h3 className="text-base font-bold text-white">Delete Transaction</h3>
        <p className="text-xs text-rose-400 font-medium">
          This will permanently remove the payment and restore its amounts back into the loan balance.
        </p>
        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 min-h-[48px] h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 font-semibold text-sm transition"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            className="flex-1 min-h-[48px] h-12 rounded-2xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold text-sm shadow-lg shadow-rose-600/25 transition"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

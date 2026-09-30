import React, { useState } from 'react';
import {
  ShieldCheck,
  X,
  Gem,
  Car,
  Home,
  Laptop,
  FileText,
  Key,
  CheckCircle2,
} from 'lucide-react';
import { CollateralAsset, CollateralAssetType, CollateralStatus } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatCurrency } from '../../utils/currency';
import { getTodayISO } from '../../utils/date';
import { calculateLTV, generateNextId } from '../../utils/calculations';

interface CollateralModalProps {
  collateral?: CollateralAsset | null;
  defaultLoanId?: string;
  defaultCustomerId?: string;
  onClose: () => void;
  onSaved?: (saved: CollateralAsset) => void;
}

export const CollateralModal: React.FC<CollateralModalProps> = ({
  collateral,
  defaultLoanId,
  defaultCustomerId,
  onClose,
  onSaved,
}) => {
  const { data, updateData } = useAuth();
  const toast = useToast();
  const todayISO = getTodayISO();

  const isEditing = !!collateral;

  const [loanId, setLoanId] = useState<string>(
    collateral?.loanId || defaultLoanId || data.loans[0]?.id || ''
  );
  const selectedLoan = data.loans.find(l => l.id === loanId);
  const customerId =
    collateral?.customerId || defaultCustomerId || selectedLoan?.customerId || data.customers[0]?.id || '';
  const customer = data.customers.find(c => c.id === customerId);

  const [assetType, setAssetType] = useState<CollateralAssetType>(
    collateral?.assetType || 'GOLD_JEWELRY'
  );
  const [itemTitle, setItemTitle] = useState<string>(collateral?.itemTitle || '');
  const [description, setDescription] = useState<string>(collateral?.description || '');
  const [estimatedValue, setEstimatedValue] = useState<string>(
    collateral?.estimatedValue ? String(collateral.estimatedValue) : ''
  );
  const [storageLocation, setStorageLocation] = useState<string>(
    collateral?.storageLocation || 'Safe Box #1'
  );
  const [status, setStatus] = useState<CollateralStatus>(collateral?.status || 'PLEDGED');

  // Gold specific
  const [grossWeight, setGrossWeight] = useState<string>(
    collateral?.grossWeightGrams ? String(collateral.grossWeightGrams) : ''
  );
  const [netWeight, setNetWeight] = useState<string>(
    collateral?.netWeightGrams ? String(collateral.netWeightGrams) : ''
  );
  const [purityKarat, setPurityKarat] = useState<number>(collateral?.purityKarat || 22);

  // Vehicle / Property / Document specific
  const [regNumber, setRegNumber] = useState<string>(collateral?.registrationNumber || '');
  const [docRef, setDocRef] = useState<string>(collateral?.documentRef || '');

  // Release info
  const [releasedDate, setReleasedDate] = useState<string>(
    collateral?.releasedDate || todayISO
  );
  const [releaseNotes, setReleaseNotes] = useState<string>(collateral?.releaseNotes || '');

  const numValuation = Number(estimatedValue) || 0;
  const loanPrincipal = selectedLoan?.principal || 0;
  const ltv = calculateLTV(loanPrincipal, numValuation);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemTitle.trim()) {
      toast.push('Please enter a title/name for the collateral asset', 'error');
      return;
    }
    if (numValuation <= 0) {
      toast.push('Please enter an estimated valuation greater than zero', 'error');
      return;
    }

    const assetId = collateral?.id || generateNextId('COL', data.collaterals || [], data);

    const updatedAsset: CollateralAsset = {
      id: assetId,
      loanId,
      customerId,
      assetType,
      itemTitle: itemTitle.trim(),
      description: description.trim(),
      estimatedValue: numValuation,
      loanToValue: ltv,
      storageLocation: storageLocation.trim() || 'Main Safe',
      status,
      pledgedDate: collateral?.pledgedDate || todayISO,
      releasedDate: status !== 'PLEDGED' ? releasedDate : undefined,
      releaseNotes: status !== 'PLEDGED' ? releaseNotes : undefined,
      grossWeightGrams: assetType === 'GOLD_JEWELRY' && grossWeight ? Number(grossWeight) : undefined,
      netWeightGrams: assetType === 'GOLD_JEWELRY' && netWeight ? Number(netWeight) : undefined,
      purityKarat: assetType === 'GOLD_JEWELRY' ? purityKarat : undefined,
      registrationNumber: assetType === 'VEHICLE' ? regNumber.trim() : undefined,
      documentRef: ['REAL_ESTATE', 'PROMISSORY_NOTE', 'CHEQUE'].includes(assetType) ? docRef.trim() : undefined,
    };

    updateData(prev => {
      const existingList = prev.collaterals || [];
      const updatedList = isEditing
        ? existingList.map(c => (c.id === assetId ? updatedAsset : c))
        : [...existingList, updatedAsset];

      // Mark loan as secured and link collateral ID
      const updatedLoans = prev.loans.map(l => {
        if (l.id === loanId) {
          const cIds = new Set(l.collateralIds || []);
          cIds.add(assetId);
          return {
            ...l,
            isSecured: true,
            collateralIds: Array.from(cIds),
          };
        }
        return l;
      });

      return {
        ...prev,
        collaterals: updatedList,
        loans: updatedLoans,
      };
    });

    toast.push(
      isEditing ? 'Collateral record updated successfully' : 'Security asset pledged and stored in vault',
      'success'
    );
    if (onSaved) onSaved(updatedAsset);
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
        {/* Handle */}
        <div className="w-full flex items-center justify-center pt-1 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-500/70" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">
                {isEditing ? 'Edit Collateral Asset' : 'Pledge Security Asset / Pawn'}
              </h3>
              <p className="text-[11px] text-slate-400">
                Locker tracking, purity valuation & LTV metrics
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Associated Loan & Borrower */}
          <div className="bg-[#0F172A] rounded-2xl p-3 border border-slate-700/70 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase font-bold text-slate-400">
                Pledged For Loan Account *
              </label>
              {selectedLoan && (
                <span className="text-[11px] font-mono text-indigo-400">
                  Principal: {formatCurrency(selectedLoan.principal)}
                </span>
              )}
            </div>
            <select
              value={loanId}
              onChange={e => setLoanId(e.target.value)}
              className="w-full bg-[#1E293B] border border-slate-700 rounded-xl px-3 min-h-[48px] h-12 text-sm text-white outline-none focus:border-amber-400"
            >
              {data.loans.map(l => {
                const c = data.customers.find(cust => cust.id === l.customerId);
                return (
                  <option key={l.id} value={l.id}>
                    {c?.name || 'Borrower'} — {l.loanName || l.id} ({formatCurrency(l.principal)})
                  </option>
                );
              })}
            </select>
            {customer && (
              <p className="text-[11px] text-slate-400">
                Owner / Borrower: <span className="text-white font-semibold">{customer.name}</span> ({customer.phone})
              </p>
            )}
          </div>

          {/* Asset Category Selector */}
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">
              Asset Category *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { type: 'GOLD_JEWELRY', label: 'Gold & Jewelry', icon: Gem },
                { type: 'VEHICLE', label: 'Vehicle (RC)', icon: Car },
                { type: 'REAL_ESTATE', label: 'Land / House', icon: Home },
                { type: 'ELECTRONICS', label: 'Electronics', icon: Laptop },
                { type: 'PROMISSORY_NOTE', label: 'Promissory Note', icon: FileText },
                { type: 'OTHER', label: 'Other Asset', icon: Key },
              ].map(item => {
                const Icon = item.icon;
                const active = assetType === item.type;
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => setAssetType(item.type as CollateralAssetType)}
                    className={`min-h-[52px] p-2 rounded-xl border text-center transition flex flex-col items-center justify-center gap-1 active:scale-95 ${
                      active
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                        : 'bg-[#0F172A] border-slate-700/70 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Icon size={16} />
                    <span className="text-[10px] font-semibold truncate w-full">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title & Description */}
          <div className="space-y-2">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Asset Name / Identification *
              </label>
              <input
                type="text"
                placeholder={
                  assetType === 'GOLD_JEWELRY'
                    ? 'e.g. 22K Gold Chain with Pendant (45g)'
                    : assetType === 'VEHICLE'
                    ? 'e.g. Hero Splendor Plus (KA-05-EX-4421)'
                    : 'e.g. Property Deed No. 441/2019'
                }
                value={itemTitle}
                onChange={e => setItemTitle(e.target.value)}
                className="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-3 min-h-[48px] h-12 text-sm text-white placeholder:text-slate-500 outline-none focus:border-amber-400"
                required
              />
            </div>

            {/* Gold Specific Fields */}
            {assetType === 'GOLD_JEWELRY' && (
              <div className="p-3 bg-[#0F172A] rounded-2xl border border-slate-700/70 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                  <Gem size={14} />
                  <span>Gold Appraisal Details</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[9px] uppercase text-slate-400 font-bold block mb-1">
                      Purity
                    </label>
                    <select
                      value={purityKarat}
                      onChange={e => setPurityKarat(Number(e.target.value))}
                      className="w-full bg-[#1E293B] border border-slate-700 rounded-xl px-2 min-h-[48px] h-12 text-xs text-white outline-none"
                    >
                      <option value={24}>24 Karat (99.9%)</option>
                      <option value={22}>22 Karat (91.6%)</option>
                      <option value={18}>18 Karat (75.0%)</option>
                      <option value={14}>14 Karat (58.5%)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] uppercase text-slate-400 font-bold block mb-1">
                      Gross Wt (g)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 48.5"
                      value={grossWeight}
                      onChange={e => setGrossWeight(e.target.value)}
                      className="w-full bg-[#1E293B] border border-slate-700 rounded-xl px-2.5 min-h-[48px] h-12 text-xs text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] uppercase text-slate-400 font-bold block mb-1">
                      Net Wt (g)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 45.2"
                      value={netWeight}
                      onChange={e => setNetWeight(e.target.value)}
                      className="w-full bg-[#1E293B] border border-slate-700 rounded-xl px-2.5 min-h-[48px] h-12 text-xs text-white outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Vehicle Specific Fields */}
            {assetType === 'VEHICLE' && (
              <div className="p-3 bg-[#0F172A] rounded-2xl border border-slate-700/70 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                  <Car size={14} />
                  <span>Vehicle Registration Particulars</span>
                </div>
                <div>
                  <label className="text-[9px] uppercase text-slate-400 font-bold block mb-1">
                    Registration Number / Chassis No
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. KA-01-MJ-9921 / Chassis #ME42..."
                    value={regNumber}
                    onChange={e => setRegNumber(e.target.value)}
                    className="w-full bg-[#1E293B] border border-slate-700 rounded-xl px-3 min-h-[48px] h-12 text-xs text-white outline-none"
                  />
                </div>
              </div>
            )}

            {/* Real Estate / Doc Specific Fields */}
            {['REAL_ESTATE', 'PROMISSORY_NOTE', 'CHEQUE'].includes(assetType) && (
              <div className="p-3 bg-[#0F172A] rounded-2xl border border-slate-700/70 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                  <FileText size={14} />
                  <span>Document & Survey Reference</span>
                </div>
                <div>
                  <label className="text-[9px] uppercase text-slate-400 font-bold block mb-1">
                    Document / Cheque / Survey Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Survey No 112/4, Cheque #004921 HDFC"
                    value={docRef}
                    onChange={e => setDocRef(e.target.value)}
                    className="w-full bg-[#1E293B] border border-slate-700 rounded-xl px-3 min-h-[48px] h-12 text-xs text-white outline-none"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Description / Condition Notes
              </label>
              <textarea
                rows={2}
                placeholder="Details of markings, stone deductions, condition, or custody specifics..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full bg-[#0F172A] border border-slate-700 rounded-xl p-3 min-h-[48px] text-sm text-white placeholder:text-slate-500 outline-none focus:border-amber-400"
              />
            </div>
          </div>

          {/* Valuation & Safe Box Location */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Market Valuation (₹) *
              </label>
              <input
                type="number"
                placeholder="e.g. 150000"
                value={estimatedValue}
                onChange={e => setEstimatedValue(e.target.value)}
                className="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-3 min-h-[48px] h-12 text-sm text-white font-mono font-bold outline-none focus:border-amber-400"
                required
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Safe Locker / Vault Box *
              </label>
              <input
                type="text"
                placeholder="e.g. Safe Box #A-14"
                value={storageLocation}
                onChange={e => setStorageLocation(e.target.value)}
                className="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-3 min-h-[48px] h-12 text-sm text-white outline-none focus:border-amber-400"
                required
              />
            </div>
          </div>

          {/* LTV Metric Indicator */}
          {numValuation > 0 && selectedLoan && (
            <div className="p-3 bg-[#0F172A] rounded-2xl border border-slate-700/60 flex items-center justify-between text-xs font-mono">
              <div>
                <span className="text-[10px] uppercase text-slate-400 block font-sans">
                  Calculated LTV (Loan-to-Value)
                </span>
                <span
                  className={`text-base font-bold ${
                    ltv > 85 ? 'text-rose-400' : ltv > 70 ? 'text-amber-400' : 'text-emerald-400'
                  }`}
                >
                  {ltv}%
                </span>
              </div>
              <div className="text-right text-[11px] font-sans">
                <span className="text-slate-400 block">Security Cushion</span>
                <span className="text-emerald-400 font-bold font-mono">
                  {formatCurrency(Math.max(0, numValuation - selectedLoan.principal))}
                </span>
              </div>
            </div>
          )}

          {/* Status (Pledged vs Released) */}
          <div className="p-3 bg-[#0F172A] rounded-2xl border border-slate-700/70 space-y-2">
            <label className="text-[10px] uppercase font-bold text-slate-400 block">
              Asset Custody Status
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['PLEDGED', 'RELEASED', 'FORFEITED'] as CollateralStatus[]).map(st => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatus(st)}
                  className={`min-h-[48px] py-2 px-2 rounded-xl text-xs font-bold border transition flex items-center justify-center active:scale-95 ${
                    status === st
                      ? st === 'PLEDGED'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : st === 'RELEASED'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'bg-rose-500/20 border-rose-500 text-rose-300'
                      : 'bg-[#1E293B] border-slate-700/70 text-slate-400 hover:text-white'
                  }`}
                >
                  {st === 'PLEDGED' ? 'Pledged' : st === 'RELEASED' ? 'Released' : 'Liquidated'}
                </button>
              ))}
            </div>

            {status !== 'PLEDGED' && (
              <div className="space-y-2 pt-2 border-t border-slate-700/60 animate-m3-fade-in">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] uppercase text-slate-400 font-bold block mb-1">
                      {status === 'RELEASED' ? 'Release Date' : 'Liquidation Date'}
                    </label>
                    <input
                      type="date"
                      value={releasedDate}
                      onChange={e => setReleasedDate(e.target.value)}
                      className="w-full bg-[#1E293B] border border-slate-700 rounded-xl px-2.5 min-h-[48px] h-12 text-xs text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] uppercase text-slate-400 font-bold block mb-1">
                      Acknowledgment / Reason
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Loan settled in full. Handed to owner."
                      value={releaseNotes}
                      onChange={e => setReleaseNotes(e.target.value)}
                      className="w-full bg-[#1E293B] border border-slate-700 rounded-xl px-2.5 min-h-[48px] h-12 text-xs text-white outline-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-h-[48px] h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 font-semibold text-sm transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 min-h-[48px] h-12 rounded-2xl bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-bold text-sm shadow-lg shadow-amber-600/30 transition flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 size={16} />
              <span>{isEditing ? 'Save Changes' : 'Record & Deposit'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

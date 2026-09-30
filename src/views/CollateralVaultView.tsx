import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  Plus,
  Gem,
  Car,
  Home,
  Laptop,
  FileText,
  Key,
  Search,
  ArrowRight,
  Printer,
  Lock,
  Unlock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';
import { useToast } from '../context/ToastContext';
import { formatCurrency } from '../utils/currency';
import { formatDateDisplay, getTodayISO } from '../utils/date';
import { CollateralAsset, CollateralAssetType, CollateralStatus } from '../types';
import { ScreenHeader, EmptyState, MetricTile } from '../components/common/UIComponents';
import { CollateralModal } from '../components/collateral/CollateralModal';

export const CollateralVaultView: React.FC = () => {
  const { data, updateData } = useAuth();
  const nav = useNavigation();
  const toast = useToast();
  const todayISO = getTodayISO();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | CollateralAssetType>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | CollateralStatus>('ALL');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [selectedAssetToEdit, setSelectedAssetToEdit] = useState<CollateralAsset | null>(null);
  const [selectedAssetForReceipt, setSelectedAssetForReceipt] = useState<CollateralAsset | null>(null);
  const [assetToRelease, setAssetToRelease] = useState<CollateralAsset | null>(null);

  const collaterals = data.collaterals || [];

  // Summary Metrics
  const metrics = useMemo(() => {
    const activePledged = collaterals.filter(c => c.status === 'PLEDGED');
    const totalValuation = activePledged.reduce((sum, c) => sum + (Number(c.estimatedValue) || 0), 0);
    const avgLtv =
      activePledged.length > 0
        ? Math.round(
            activePledged.reduce((sum, c) => sum + (Number(c.loanToValue) || 0), 0) /
              activePledged.length
          )
        : 0;
    const releasedCount = collaterals.filter(c => c.status === 'RELEASED').length;

    return {
      activeCount: activePledged.length,
      totalValuation,
      avgLtv,
      releasedCount,
    };
  }, [collaterals]);

  // Filtered List
  const filteredAssets = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return collaterals.filter(asset => {
      const cust = data.customers.find(c => c.id === asset.customerId);
      const matchCat = categoryFilter === 'ALL' || asset.assetType === categoryFilter;
      const matchStatus = statusFilter === 'ALL' || asset.status === statusFilter;

      if (!matchCat || !matchStatus) return false;

      if (q) {
        return (
          asset.itemTitle.toLowerCase().includes(q) ||
          asset.id.toLowerCase().includes(q) ||
          asset.storageLocation.toLowerCase().includes(q) ||
          (cust && cust.name.toLowerCase().includes(q)) ||
          (asset.registrationNumber && asset.registrationNumber.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [collaterals, data.customers, categoryFilter, statusFilter, searchQuery]);

  const executeRelease = (asset: CollateralAsset) => {
    updateData(prev => ({
      ...prev,
      collaterals: (prev.collaterals || []).map(c =>
        c.id === asset.id
          ? {
              ...c,
              status: 'RELEASED',
              releasedDate: todayISO,
              releaseNotes: 'Released to borrower upon full settlement.',
            }
          : c
      ),
    }));
    setAssetToRelease(null);
    toast.push(`Collateral "${asset.itemTitle}" (${asset.id}) successfully marked as RELEASED`, 'success');
  };

  const getAssetIcon = (type: CollateralAssetType) => {
    switch (type) {
      case 'GOLD_JEWELRY':
        return <Gem size={18} className="text-amber-400" />;
      case 'VEHICLE':
        return <Car size={18} className="text-sky-400" />;
      case 'REAL_ESTATE':
        return <Home size={18} className="text-emerald-400" />;
      case 'ELECTRONICS':
        return <Laptop size={18} className="text-indigo-400" />;
      case 'PROMISSORY_NOTE':
      case 'CHEQUE':
        return <FileText size={18} className="text-rose-400" />;
      default:
        return <Key size={18} className="text-slate-400" />;
    }
  };

  return (
    <div className="space-y-4 pb-20 animate-m3-fade-in">
      <ScreenHeader
        title="Collateral & Pawn Vault"
        subtitle="Secured lending assets, locker custody & pawn certificates"
        right={
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-2 min-h-[44px] rounded-xl bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-amber-600/25 transition shrink-0"
          >
            <Plus size={16} />
            <span>Pledge Asset</span>
          </button>
        }
      />

      {/* Top Metric Tiles */}
      <div className="grid grid-cols-2 gap-3">
        <MetricTile
          label="Active Pledged Value"
          value={formatCurrency(metrics.totalValuation)}
          accent="amber"
          icon={<ShieldCheck size={16} />}
        />
        <MetricTile
          label="Average Vault LTV"
          value={`${metrics.avgLtv}%`}
          accent="emerald"
          icon={<Lock size={16} />}
        />
      </div>

      {/* Secondary Metrics Bar */}
      <div className="bg-[#1E293B]/70 border border-slate-700/70 rounded-2xl p-3 flex items-center justify-around text-xs">
        <div className="text-center">
          <span className="text-[10px] text-slate-400 uppercase block font-semibold">Active In Vault</span>
          <span className="text-sm font-bold font-mono text-white">{metrics.activeCount} assets</span>
        </div>
        <div className="h-6 w-px bg-slate-700" />
        <div className="text-center">
          <span className="text-[10px] text-slate-400 uppercase block font-semibold">Released Back</span>
          <span className="text-sm font-bold font-mono text-emerald-400">{metrics.releasedCount} assets</span>
        </div>
        <div className="h-6 w-px bg-slate-700" />
        <div className="text-center">
          <span className="text-[10px] text-slate-400 uppercase block font-semibold">Vault Security</span>
          <span className="text-sm font-bold text-amber-400">Insured Safe</span>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="space-y-2">
        <div className="relative">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by asset title, borrower, locker #, or vehicle reg..."
            className="w-full bg-[#1E293B] border border-slate-700/80 focus:border-amber-400 rounded-2xl pl-10 pr-4 min-h-[48px] h-12 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition"
          />
        </div>

        {/* Category Filter Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
          {[
            { id: 'ALL', label: 'All Categories' },
            { id: 'GOLD_JEWELRY', label: 'Gold & Jewelry' },
            { id: 'VEHICLE', label: 'Vehicles' },
            { id: 'REAL_ESTATE', label: 'Property' },
            { id: 'OTHER', label: 'Others' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setCategoryFilter(f.id as any)}
              className={`min-h-[48px] px-4 py-2 rounded-2xl whitespace-nowrap transition font-semibold border flex items-center justify-center select-none active:scale-95 ${
                categoryFilter === f.id
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                  : 'bg-[#0F172A] border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Status Filter Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
          {[
            { id: 'ALL', label: 'All Statuses' },
            { id: 'PLEDGED', label: 'In Custody / Pledged' },
            { id: 'RELEASED', label: 'Released Back' },
          ].map(s => (
            <button
              key={s.id}
              onClick={() => setStatusFilter(s.id as any)}
              className={`min-h-[48px] px-4 py-2 rounded-2xl whitespace-nowrap transition font-semibold text-xs border flex items-center justify-center select-none active:scale-95 ${
                statusFilter === s.id
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                  : 'bg-[#0F172A]/70 border-slate-800 text-slate-400 hover:text-slate-300'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Assets List */}
      {filteredAssets.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck size={32} className="text-amber-400" />}
          title={collaterals.length === 0 ? 'No collateral pledged yet' : 'No assets found'}
          hint={
            collaterals.length === 0
              ? 'Pledge gold, vehicle RC, or deeds when originating loans to secure your capital.'
              : 'Try matching other search terms or filters.'
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredAssets.map(asset => {
            const customer = data.customers.find(c => c.id === asset.customerId);
            const loan = data.loans.find(l => l.id === asset.loanId);

            return (
              <div
                key={asset.id}
                className="bg-[#1E293B]/70 border border-slate-700/70 rounded-3xl p-4 shadow-xl space-y-3 hover:border-amber-500/40 transition"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-[#0F172A] border border-slate-700 flex items-center justify-center shrink-0">
                      {getAssetIcon(asset.assetType)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{asset.itemTitle}</p>
                      <p className="text-[11px] text-slate-400 truncate">
                        Borrower: <span className="text-slate-200 font-semibold">{customer?.name || 'Client'}</span>
                      </p>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                      asset.status === 'PLEDGED'
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        : asset.status === 'RELEASED'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {asset.status}
                  </span>
                </div>

                {/* Specs Grid */}
                <div className="grid grid-cols-3 gap-2 text-xs bg-[#0F172A]/70 rounded-2xl p-2.5 border border-slate-700/60 font-mono">
                  <div>
                    <span className="text-[9px] uppercase font-sans text-slate-500 block">Valuation</span>
                    <span className="font-bold text-amber-300">{formatCurrency(asset.estimatedValue)}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-sans text-slate-500 block">Vault Locker</span>
                    <span className="font-semibold text-white truncate block">{asset.storageLocation}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-sans text-slate-500 block">LTV Ratio</span>
                    <span
                      className={`font-bold ${
                        (asset.loanToValue || 0) > 80 ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      {asset.loanToValue || 0}%
                    </span>
                  </div>
                </div>

                {/* Specifics details if Gold or Vehicle */}
                {(asset.grossWeightGrams || asset.registrationNumber || asset.documentRef) && (
                  <div className="text-[11px] text-slate-400 space-y-0.5 px-1 font-mono">
                    {asset.grossWeightGrams && (
                      <p>
                        Purity: {asset.purityKarat || 22}K • Gross: {asset.grossWeightGrams}g • Net: {asset.netWeightGrams || asset.grossWeightGrams}g
                      </p>
                    )}
                    {asset.registrationNumber && <p>Reg No: {asset.registrationNumber}</p>}
                    {asset.documentRef && <p>Document: {asset.documentRef}</p>}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-700/60 text-xs">
                  <div className="flex items-center gap-2">
                    {loan && (
                      <button
                        onClick={() => nav.push({ page: 'loanDetail', loanId: loan.id })}
                        className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition min-h-[48px] px-2 active:scale-95"
                      >
                        <span>Loan {loan.id}</span>
                        <ArrowRight size={14} />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedAssetForReceipt(asset)}
                      className="min-h-[48px] px-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1.5 text-xs font-semibold active:scale-95"
                      title="Pawn Slip Receipt"
                    >
                      <Printer size={15} />
                      <span>Slip</span>
                    </button>

                    {asset.status === 'PLEDGED' && (
                      <button
                        onClick={() => setAssetToRelease(asset)}
                        className="min-h-[48px] px-3.5 rounded-2xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 font-semibold text-xs flex items-center gap-1.5 transition active:scale-95"
                      >
                        <Unlock size={15} />
                        <span>Release</span>
                      </button>
                    )}

                    <button
                      onClick={() => setSelectedAssetToEdit(asset)}
                      className="min-h-[48px] px-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition text-xs font-semibold active:scale-95"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pawn Deposit Slip Modal */}
      {selectedAssetForReceipt && (
        <div
          className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none"
          onClick={() => setSelectedAssetForReceipt(null)}
        >
          <div
            className="w-full max-w-[400px] mx-auto bg-[#1E293B] border border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
              <div className="flex items-center gap-2">
                <ShieldCheck size={20} className="text-amber-400" />
                <h3 className="font-bold text-white text-base">Pawn Deposit Certificate</h3>
              </div>
              <button
                onClick={() => setSelectedAssetForReceipt(null)}
                className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-full bg-slate-800 border border-slate-700/60 flex items-center justify-center text-slate-400 hover:text-white transition active:scale-95"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Printable Certificate Preview */}
            <div className="bg-white text-slate-900 rounded-2xl p-4 text-xs space-y-3 font-sans shadow-inner">
              <div className="text-center border-b pb-2">
                <h4 className="font-bold text-sm uppercase tracking-wider">{data.settings.lenderName}</h4>
                <p className="text-[10px] text-slate-600">OFFICIAL PAWN & SECURED CUSTODY RECEIPT</p>
                <p className="text-[10px] font-mono text-slate-500">Ref: {selectedAssetForReceipt.id}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-500 block text-[10px]">Pledgor (Borrower):</span>
                  <span className="font-bold">
                    {data.customers.find(c => c.id === selectedAssetForReceipt.customerId)?.name || 'Client'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Date Pledged:</span>
                  <span className="font-bold font-mono">{formatDateDisplay(selectedAssetForReceipt.pledgedDate)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Asset Pledged:</span>
                  <span className="font-bold">{selectedAssetForReceipt.itemTitle}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Locker Location:</span>
                  <span className="font-bold font-mono">{selectedAssetForReceipt.storageLocation}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Appraised Value:</span>
                  <span className="font-bold font-mono">{formatCurrency(selectedAssetForReceipt.estimatedValue)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Status:</span>
                  <span className="font-bold uppercase text-amber-700">{selectedAssetForReceipt.status}</span>
                </div>
              </div>

              {selectedAssetForReceipt.grossWeightGrams && (
                <div className="p-2 bg-slate-100 rounded-xl text-[10px] font-mono">
                  Gold Purity: {selectedAssetForReceipt.purityKarat || 22}K | Gross: {selectedAssetForReceipt.grossWeightGrams}g | Net: {selectedAssetForReceipt.netWeightGrams}g
                </div>
              )}

              <div className="pt-2 border-t text-[9px] text-slate-500 text-center leading-tight">
                This document certifies that the security asset described above has been accepted under safe custody in our secure vault until loan obligations are discharged.
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setSelectedAssetForReceipt(null)}
                className="flex-1 min-h-[48px] h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 font-semibold text-sm transition"
              >
                Close
              </button>
              <button
                onClick={() => {
                  window.print();
                  toast.push('Opening print preview for Pawn Certificate', 'info');
                }}
                className="flex-1 min-h-[48px] h-12 rounded-2xl bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-bold text-sm flex items-center justify-center gap-1.5 shadow-md transition"
              >
                <Printer size={16} />
                <span>Print Certificate</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Release Confirmation Dialog */}
      {assetToRelease && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#1E293B] border border-slate-700/80 rounded-3xl p-5 sm:p-6 max-w-sm w-full shadow-2xl space-y-4 animate-m3-slide-up">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                <Unlock size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-white">Release Collateral Asset</h3>
                <p className="text-xs text-slate-400 truncate">{assetToRelease.itemTitle}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Confirm handover and release of this security asset back to the borrower? This will mark the asset as <strong className="text-emerald-400">RELEASED</strong> in the safe custody vault.
            </p>

            <div className="bg-[#0F172A] rounded-2xl p-3 border border-slate-700/60 text-xs space-y-1 font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Asset ID:</span>
                <span className="text-white font-bold">{assetToRelease.id}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Estimated Value:</span>
                <span className="text-amber-300 font-bold">{formatCurrency(assetToRelease.estimatedValue)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Vault Location:</span>
                <span className="text-slate-200">{assetToRelease.storageLocation}</span>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setAssetToRelease(null)}
                className="flex-1 min-h-[48px] h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 font-semibold text-sm transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => executeRelease(assetToRelease)}
                className="flex-1 min-h-[48px] h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-1.5"
              >
                <Unlock size={16} />
                <span>Confirm Release</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add or Edit Modal */}
      {(showAddModal || selectedAssetToEdit) && (
        <CollateralModal
          collateral={selectedAssetToEdit}
          onClose={() => {
            setShowAddModal(false);
            setSelectedAssetToEdit(null);
          }}
        />
      )}
    </div>
  );
};

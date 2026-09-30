import React, { useState, useMemo } from 'react';
import {
  X,
  PlusCircle,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import {
  CollateralAsset,
  CollateralAssetType,
  InterestMethod,
  Loan,
  LoanType,
  PaymentFrequency,
  RateBasis,
} from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useNavigation } from '../../context/NavigationContext';
import { formatCurrency } from '../../utils/currency';
import { getTodayISO, calculateNextDueDate } from '../../utils/date';
import {
  computeFlatLoan,
  computeReducingLoan,
  generateNextId,
  getEffectiveMonthlyRate,
  calculateLTV,
} from '../../utils/calculations';

interface NewLoanWizardModalProps {
  initialCustomerId?: string;
  onClose: () => void;
}

export const NewLoanWizardModal: React.FC<NewLoanWizardModalProps> = ({
  initialCustomerId,
  onClose,
}) => {
  const { data, updateData } = useAuth();
  const toast = useToast();
  const nav = useNavigation();
  const todayISO = getTodayISO();

  // Basic loan state
  const [customerId, setCustomerId] = useState<string>(
    initialCustomerId || data.customers[0]?.id || ''
  );
  const [loanName, setLoanName] = useState<string>('');
  const [principal, setPrincipal] = useState<string>('50000');
  const [type, setType] = useState<LoanType>('EMI');
  const [interestMethod, setInterestMethod] = useState<InterestMethod>('FLAT');
  const [frequency, setFrequency] = useState<PaymentFrequency>('DAILY');
  const [interestRate, setInterestRate] = useState<string>('2');
  const [rateBasis, setRateBasis] = useState<RateBasis>('MONTHLY');
  const [tenure, setTenure] = useState<string>('30');
  const [startDate, setStartDate] = useState<string>(todayISO);
  const [gracePeriodDays, setGracePeriodDays] = useState<number>(0);
  const [penaltyRatePerDay, setPenaltyRatePerDay] = useState<number>(0.1);

  // Collateral / Secured loan state
  const [isSecured, setIsSecured] = useState<boolean>(false);
  const [assetType, setAssetType] = useState<CollateralAssetType>('GOLD_JEWELRY');
  const [collateralTitle, setCollateralTitle] = useState<string>('');
  const [collateralValuation, setCollateralValuation] = useState<string>('75000');
  const [storageLocation, setStorageLocation] = useState<string>('Safe Box #1');
  const [goldGrossWt, setGoldGrossWt] = useState<string>('');
  const [goldNetWt, setGoldNetWt] = useState<string>('');
  const [goldPurity, setGoldPurity] = useState<number>(22);
  const [vehicleReg, setVehicleReg] = useState<string>('');
  const [docRef, setDocRef] = useState<string>('');

  const numPrincipal = Number(principal) || 0;
  const numRate = Number(interestRate) || 0;
  const effectiveMonthlyRate = rateBasis === 'YEARLY' ? numRate / 12 : numRate;
  const numTenure = Math.max(1, Number(tenure) || 1);
  const numCollateralVal = Number(collateralValuation) || 0;

  // LTV calculation
  const ltv = calculateLTV(numPrincipal, numCollateralVal);

  // Compute live periodic installment
  const calculationPreview = useMemo(() => {
    if (numPrincipal <= 0) return { emi: 0, totalInterest: 0 };
    const mockLoan = {
      frequency,
      interestRate: effectiveMonthlyRate,
      principal: numPrincipal,
    };
    const r = getEffectiveMonthlyRate(mockLoan);

    if (type === 'INTEREST_ONLY') {
      const interestPerCycle = numPrincipal * r;
      return {
        emi: interestPerCycle,
        interestPerCycle,
        totalInterest: interestPerCycle * numTenure,
      };
    }
    if (interestMethod === 'FLAT') {
      const flat = computeFlatLoan(numPrincipal, r, numTenure);
      return {
        emi: flat.emi,
        interestPerCycle: flat.interestPerCycle,
        totalInterest: flat.totalInterest,
      };
    }
    const red = computeReducingLoan(numPrincipal, r, numTenure);
    return {
      emi: red.emi,
      interestPerCycle: red.emi - numPrincipal / numTenure,
      totalInterest: red.emi * numTenure - numPrincipal,
    };
  }, [type, interestMethod, frequency, effectiveMonthlyRate, numPrincipal, numTenure]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) {
      toast.push('Please select or create a client first', 'error');
      return;
    }
    if (numPrincipal <= 0) {
      toast.push('Please enter a valid loan principal amount', 'error');
      return;
    }

    const loanId = generateNextId('LN', data.loans, data);
    const nextDueDate = calculateNextDueDate(startDate, 1, frequency);

    let collateralId: string | undefined = undefined;
    let newCollateralAsset: CollateralAsset | null = null;

    if (isSecured) {
      if (!collateralTitle.trim()) {
        toast.push('Please enter a title/name for the pledged collateral', 'error');
        return;
      }
      collateralId = generateNextId('COL', data.collaterals || [], data);
      newCollateralAsset = {
        id: collateralId,
        loanId,
        customerId,
        assetType,
        itemTitle: collateralTitle.trim(),
        description: `Pledged for Loan ${loanId}`,
        estimatedValue: numCollateralVal,
        loanToValue: ltv,
        storageLocation: storageLocation.trim() || 'Locker A',
        status: 'PLEDGED',
        pledgedDate: startDate,
        grossWeightGrams: assetType === 'GOLD_JEWELRY' && goldGrossWt ? Number(goldGrossWt) : undefined,
        netWeightGrams: assetType === 'GOLD_JEWELRY' && goldNetWt ? Number(goldNetWt) : undefined,
        purityKarat: assetType === 'GOLD_JEWELRY' ? goldPurity : undefined,
        registrationNumber: assetType === 'VEHICLE' ? vehicleReg.trim() : undefined,
        documentRef: ['REAL_ESTATE', 'PROMISSORY_NOTE', 'CHEQUE'].includes(assetType) ? docRef.trim() : undefined,
      };
    }

    const newLoan: Loan = {
      id: loanId,
      loanName: loanName.trim() || `${frequency === 'DAILY' ? 'Pigmy Daily' : type === 'EMI' ? 'EMI' : 'Interest'} Loan`,
      customerId,
      type,
      interestMethod,
      principal: numPrincipal,
      currentPrincipalBalance: numPrincipal,
      interestRate: effectiveMonthlyRate,
      interestRateEntered: numRate,
      rateBasis,
      frequency,
      tenure: numTenure,
      startDate,
      nextDueDate,
      gracePeriodDays,
      penaltyRatePerDay,
      excessCreditBalance: 0,
      status: 'ACTIVE',
      emiAmount: type === 'EMI' ? Math.round(calculationPreview.emi) : undefined,
      interestPerCycle: Math.round(calculationPreview.interestPerCycle || 0),
      isSecured: isSecured,
      collateralIds: collateralId ? [collateralId] : undefined,
    };

    updateData(prev => ({
      ...prev,
      loans: [newLoan, ...prev.loans],
      collaterals: newCollateralAsset ? [...(prev.collaterals || []), newCollateralAsset] : prev.collaterals,
    }));

    toast.push(`Loan ${loanId} originated successfully!`, 'success');
    onClose();
    nav.push({ page: 'loanDetail', loanId });
  };

  return (
    <div
      className="fixed inset-0 z-[105] bg-black/80 backdrop-blur-sm flex items-end justify-center select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[440px] mx-auto bg-[#1E293B] border-t border-slate-700/80 rounded-t-[28px] rounded-b-none p-4 sm:p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto no-scrollbar animate-m3-slide-up pb-8"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-full flex items-center justify-center pt-1 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-500/70" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
              <PlusCircle size={18} />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Disburse New Loan</h3>
              <p className="text-[11px] text-slate-400">
                Originate Daily Pigmy, Weekly or Monthly contract
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
          {/* Client Selection */}
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
              Select Borrower / Client *
            </label>
            {data.customers.length === 0 ? (
              <div className="bg-[#0F172A] rounded-xl p-3 border border-slate-700 text-xs text-center text-slate-400 space-y-1">
                <p>No clients exist yet.</p>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    nav.push({ page: 'clients', openAdd: true });
                  }}
                  className="text-indigo-400 font-bold hover:underline inline-flex items-center justify-center min-h-[48px] py-2 px-3"
                >
                  Create Client Profile First
                </button>
              </div>
            ) : (
              <select
                value={customerId}
                onChange={e => setCustomerId(e.target.value)}
                className="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-3 min-h-[48px] h-12 text-sm text-white outline-none focus:border-indigo-400 font-semibold"
                required
              >
                {data.customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Loan Title & Principal */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Contract Name / Ref
              </label>
              <input
                type="text"
                placeholder="e.g. Shop Daily Pigmy"
                value={loanName}
                onChange={e => setLoanName(e.target.value)}
                className="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-3 min-h-[48px] h-12 text-sm text-white placeholder:text-slate-500 outline-none focus:border-indigo-400"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Principal Amount (₹) *
              </label>
              <input
                type="number"
                placeholder="50000"
                value={principal}
                onChange={e => setPrincipal(e.target.value)}
                className="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-3 min-h-[48px] h-12 text-sm text-white font-mono font-bold outline-none focus:border-indigo-400"
                required
              />
            </div>
          </div>

          {/* Repayment Frequency (DAILY / WEEKLY / MONTHLY) */}
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">
              Repayment Frequency *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { freq: 'DAILY', label: 'Daily (Pigmy)', hint: 'Field recovery' },
                { freq: 'WEEKLY', label: 'Weekly', hint: 'Market collection' },
                { freq: 'MONTHLY', label: 'Monthly', hint: 'Salaried / standard' },
              ].map(f => (
                <button
                  key={f.freq}
                  type="button"
                  onClick={() => {
                    setFrequency(f.freq as PaymentFrequency);
                    if (f.freq === 'DAILY' && tenure === '12') setTenure('30');
                    if (f.freq === 'DAILY') setGracePeriodDays(0);
                  }}
                  className={`p-2.5 rounded-xl border text-left transition min-h-[52px] flex flex-col justify-center ${
                    frequency === f.freq
                      ? 'bg-indigo-600/20 border-indigo-500 text-white'
                      : 'bg-[#0F172A] border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  <p className="text-xs font-bold truncate">{f.label}</p>
                  <p className="text-[10px] text-slate-400 truncate">{f.hint}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Loan Type & Interest Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Loan Structure
              </label>
              <div className="grid grid-cols-2 gap-1 bg-[#0F172A] p-1 rounded-xl border border-slate-700">
                <button
                  type="button"
                  onClick={() => setType('EMI')}
                  className={`min-h-[48px] py-2 rounded-lg text-xs font-bold transition flex items-center justify-center ${
                    type === 'EMI' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                  }`}
                >
                  EMI
                </button>
                <button
                  type="button"
                  onClick={() => setType('INTEREST_ONLY')}
                  className={`min-h-[48px] py-2 rounded-lg text-xs font-bold transition flex items-center justify-center ${
                    type === 'INTEREST_ONLY' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                  }`}
                >
                  Interest-Only
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Method
              </label>
              <div className="grid grid-cols-2 gap-1 bg-[#0F172A] p-1 rounded-xl border border-slate-700">
                <button
                  type="button"
                  onClick={() => setInterestMethod('FLAT')}
                  className={`min-h-[48px] py-2 rounded-lg text-xs font-bold transition flex items-center justify-center ${
                    interestMethod === 'FLAT' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                  }`}
                >
                  Flat
                </button>
                <button
                  type="button"
                  onClick={() => setInterestMethod('REDUCING')}
                  className={`min-h-[48px] py-2 rounded-lg text-xs font-bold transition flex items-center justify-center ${
                    interestMethod === 'REDUCING' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                  }`}
                >
                  Reducing
                </button>
              </div>
            </div>
          </div>

          {/* Interest Rate & Tenure */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Rate (%) *
              </label>
              <input
                type="number"
                step="0.1"
                value={interestRate}
                onChange={e => setInterestRate(e.target.value)}
                className="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-2.5 min-h-[48px] h-12 text-sm text-white font-mono outline-none focus:border-indigo-400"
                required
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Rate Basis
              </label>
              <select
                value={rateBasis}
                onChange={e => setRateBasis(e.target.value as RateBasis)}
                className="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-2 min-h-[48px] h-12 text-sm text-white outline-none"
              >
                <option value="MONTHLY">% p.m.</option>
                <option value="YEARLY">% p.a.</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Tenure ({frequency.toLowerCase()}s) *
              </label>
              <input
                type="number"
                min="1"
                value={tenure}
                onChange={e => setTenure(e.target.value)}
                className="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-2.5 min-h-[48px] h-12 text-sm text-white font-mono outline-none focus:border-indigo-400"
                required
              />
            </div>
          </div>

          {/* Dates & Grace Period */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Disbursement Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-3 min-h-[48px] h-12 text-sm text-white outline-none focus:border-indigo-400"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Grace (Days)
              </label>
              <input
                type="number"
                min="0"
                value={gracePeriodDays}
                onChange={e => setGracePeriodDays(Number(e.target.value))}
                className="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-3 min-h-[48px] h-12 text-sm text-white font-mono outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Late Penalty (% per day)
              </label>
              <input
                type="number"
                step="0.05"
                min="0"
                value={penaltyRatePerDay}
                onChange={e => setPenaltyRatePerDay(Number(e.target.value) || 0)}
                className="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-3 min-h-[48px] h-12 text-sm text-white font-mono outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Locker Reference
              </label>
              <input
                type="text"
                placeholder="Safe #1"
                value={storageLocation}
                onChange={e => setStorageLocation(e.target.value)}
                className="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-3 min-h-[48px] h-12 text-sm text-white outline-none"
              />
            </div>
          </div>

          {/* Collateral / Secured Lending Toggle */}
          <div className="bg-[#0F172A] rounded-2xl p-3.5 border border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-amber-400" />
                <div>
                  <p className="text-xs font-bold text-white">Secured / Pawn Collateral Asset</p>
                  <p className="text-[10px] text-slate-400">Pledge gold jewelry, vehicle RC, or title deed</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer min-h-[48px] min-w-[48px] justify-center">
                <input
                  type="checkbox"
                  checked={isSecured}
                  onChange={e => setIsSecured(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[14px] after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>

            {isSecured && (
              <div className="space-y-3 pt-2 border-t border-slate-700/60 animate-m3-fade-in">
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { type: 'GOLD_JEWELRY', label: 'Gold Jewelry' },
                    { type: 'VEHICLE', label: 'Vehicle RC' },
                    { type: 'REAL_ESTATE', label: 'Property Deed' },
                  ].map(c => (
                    <button
                      key={c.type}
                      type="button"
                      onClick={() => setAssetType(c.type as CollateralAssetType)}
                      className={`p-2 rounded-xl text-xs font-bold border transition min-h-[48px] flex items-center justify-center ${
                        assetType === c.type
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                          : 'bg-[#1E293B] border-slate-700 text-slate-400'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">
                    Asset Details & Title *
                  </label>
                  <input
                    type="text"
                    placeholder={
                      assetType === 'GOLD_JEWELRY'
                        ? 'e.g. 22K Gold Bangles & Ring (38 grams)'
                        : assetType === 'VEHICLE'
                        ? 'e.g. Bajaj Pulsar 150 (KA-04-E-1234)'
                        : 'e.g. Residential Plot Title Deed #419'
                    }
                    value={collateralTitle}
                    onChange={e => setCollateralTitle(e.target.value)}
                    className="w-full bg-[#1E293B] border border-slate-700 rounded-xl px-3 min-h-[48px] h-12 text-sm text-white placeholder:text-slate-500 outline-none focus:border-amber-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">
                      Appraised Valuation (₹) *
                    </label>
                    <input
                      type="number"
                      placeholder="75000"
                      value={collateralValuation}
                      onChange={e => setCollateralValuation(e.target.value)}
                      className="w-full bg-[#1E293B] border border-slate-700 rounded-xl px-2.5 min-h-[48px] h-12 text-sm text-white font-mono outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">
                      Safe Locker Box #
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Safe #A-2"
                      value={storageLocation}
                      onChange={e => setStorageLocation(e.target.value)}
                      className="w-full bg-[#1E293B] border border-slate-700 rounded-xl px-2.5 min-h-[48px] h-12 text-sm text-white outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                {assetType === 'GOLD_JEWELRY' && (
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">
                        Gross Wt (g)
                      </label>
                      <input
                        type="number"
                        placeholder="35.5"
                        value={goldGrossWt}
                        onChange={e => setGoldGrossWt(e.target.value)}
                        className="w-full bg-[#1E293B] border border-slate-700 rounded-xl px-2 min-h-[48px] h-12 text-sm text-white font-mono outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">
                        Net Wt (g)
                      </label>
                      <input
                        type="number"
                        placeholder="32.0"
                        value={goldNetWt}
                        onChange={e => setGoldNetWt(e.target.value)}
                        className="w-full bg-[#1E293B] border border-slate-700 rounded-xl px-2 min-h-[48px] h-12 text-sm text-white font-mono outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">
                        Purity
                      </label>
                      <select
                        value={goldPurity}
                        onChange={e => setGoldPurity(Number(e.target.value))}
                        className="w-full bg-[#1E293B] border border-slate-700 rounded-xl px-2 min-h-[48px] h-12 text-sm text-white outline-none"
                      >
                        <option value={24}>24K (99.9%)</option>
                        <option value={22}>22K (91.6%)</option>
                        <option value={18}>18K (75.0%)</option>
                        <option value={14}>14K (58.5%)</option>
                      </select>
                    </div>
                  </div>
                )}

                {assetType === 'VEHICLE' && (
                  <div>
                    <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">
                      Registration / RC No
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. MH-12-AB-1234"
                      value={vehicleReg}
                      onChange={e => setVehicleReg(e.target.value)}
                      className="w-full bg-[#1E293B] border border-slate-700 rounded-xl px-2.5 min-h-[48px] h-12 text-sm text-white outline-none"
                    />
                  </div>
                )}

                {['REAL_ESTATE', 'PROMISSORY_NOTE', 'CHEQUE'].includes(assetType) && (
                  <div>
                    <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">
                      Title Deed / Cheque / Survey Ref #
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Doc #4092/2024"
                      value={docRef}
                      onChange={e => setDocRef(e.target.value)}
                      className="w-full bg-[#1E293B] border border-slate-700 rounded-xl px-2.5 min-h-[48px] h-12 text-sm text-white outline-none"
                    />
                  </div>
                )}

                {numCollateralVal > 0 && (
                  <div className="flex items-center justify-between text-xs bg-[#1E293B] p-2 rounded-xl border border-slate-700 font-mono">
                    <span className="text-[10px] uppercase font-sans text-slate-400">
                      Calculated LTV:
                    </span>
                    <span
                      className={`font-bold ${
                        ltv > 85 ? 'text-rose-400' : ltv > 70 ? 'text-amber-400' : 'text-emerald-400'
                      }`}
                    >
                      {ltv}%
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Repayment Calculation Preview */}
          <div className="bg-indigo-600/10 border border-indigo-500/30 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-indigo-300">
                Installment Amount ({frequency}):
              </span>
              <span className="text-xl font-mono font-extrabold text-indigo-400">
                {formatCurrency(calculationPreview.emi)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 font-mono pt-1 border-t border-indigo-500/20">
              <div>
                <span>Total Interest: </span>
                <span className="text-white font-bold">
                  {formatCurrency(calculationPreview.totalInterest)}
                </span>
              </div>
              <div className="text-right">
                <span>Total Payable: </span>
                <span className="text-white font-bold">
                  {formatCurrency(numPrincipal + calculationPreview.totalInterest)}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-h-[48px] h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 font-semibold text-sm transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 min-h-[48px] h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 size={18} />
              <span>Create Loan Contract</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

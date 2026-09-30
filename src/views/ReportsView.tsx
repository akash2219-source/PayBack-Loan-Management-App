import React, { useState, useMemo } from 'react';
import {
  FileDown,
  TrendingUp,
  AlertTriangle,
  Calendar,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatCurrency } from '../utils/currency';
import { getTodayISO, getMonthBounds, daysBetween } from '../utils/date';
import { generateBusinessReportPDF } from '../utils/pdf';
import { ScreenHeader, MetricTile } from '../components/common/UIComponents';

export const ReportsView: React.FC = () => {
  const { data } = useAuth();
  const toast = useToast();
  const todayISO = getTodayISO();

  const [selectedMonth, setSelectedMonth] = useState<string>(todayISO.slice(0, 7)); // YYYY-MM
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const [startOfMonth, endOfMonth] = useMemo(
    () => getMonthBounds(`${selectedMonth}-01`),
    [selectedMonth]
  );

  // Profit & Loss metrics for selected month
  const plMetrics = useMemo(() => {
    const monthTxns = data.transactions.filter(
      t => t.status === 'VALID' && t.date >= startOfMonth && t.date <= endOfMonth
    );

    const interestCollected = monthTxns
      .filter(t => t.type === 'PAYMENT')
      .reduce((sum, t) => sum + (Number(t.appliedToInterest) || 0), 0);

    const penaltiesCollected = monthTxns
      .filter(t => t.type === 'PAYMENT')
      .reduce((sum, t) => sum + (Number(t.appliedToPenalty) || 0), 0);

    const principalRecovered = monthTxns
      .filter(t => t.type === 'PAYMENT')
      .reduce((sum, t) => sum + (Number(t.appliedToPrincipal) || 0), 0);

    const writeOffs = monthTxns
      .filter(t => t.type === 'WRITE_OFF')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const totalGrossEarnings = interestCollected + penaltiesCollected;
    const netOperatingProfit = totalGrossEarnings - writeOffs;

    return {
      interestCollected,
      penaltiesCollected,
      principalRecovered,
      writeOffs,
      totalGrossEarnings,
      netOperatingProfit,
      totalInflow: interestCollected + penaltiesCollected + principalRecovered,
    };
  }, [data.transactions, startOfMonth, endOfMonth]);

  // Portfolio Aging / Risk Analysis
  const riskAnalysis = useMemo(() => {
    let current = 0;
    let d1_30 = 0;
    let d31_60 = 0;
    let d60Plus = 0;
    let totalOutstanding = 0;

    data.loans
      .filter(l => l.status === 'ACTIVE' || l.status === 'OVERDUE' || l.status === 'PARTIALLY_SETTLED')
      .forEach(loan => {
        const bal = Number(loan.currentPrincipalBalance) || 0;
        totalOutstanding += bal;

        if (!loan.nextDueDate || loan.nextDueDate === 'N/A' || loan.nextDueDate >= todayISO) {
          current += bal;
        } else {
          const overdueDays = Math.abs(daysBetween(todayISO, loan.nextDueDate));
          if (overdueDays <= 30) d1_30 += bal;
          else if (overdueDays <= 60) d31_60 += bal;
          else d60Plus += bal;
        }
      });

    const par30 = totalOutstanding > 0 ? ((d1_30 + d31_60 + d60Plus) / totalOutstanding) * 100 : 0;

    return {
      totalOutstanding,
      current,
      d1_30,
      d31_60,
      d60Plus,
      par30,
    };
  }, [data.loans, todayISO]);

  const handleExportPDF = async () => {
    setIsExporting(true);
    toast.push('Generating Master Financial Report PDF...', 'info');
    try {
      await generateBusinessReportPDF(data, selectedMonth);
      toast.push('Report PDF downloaded successfully.', 'success');
    } catch (err) {
      toast.push('Failed to generate report PDF.', 'error');
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <ScreenHeader
        title="Financial Reports"
        subtitle="P&L, Risk Aging & Business Analytics"
        right={
          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className="px-3 py-2 min-h-[44px] rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-indigo-600/25 transition disabled:opacity-50 shrink-0"
          >
            <FileDown size={15} />
            <span>Export PDF</span>
          </button>
        }
      />

      {/* Month Selector */}
      <div className="bg-[#1E293B]/70 border border-slate-700/70 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
          <Calendar size={18} className="text-indigo-400" />
          <span>Accounting Period</span>
        </div>
        <input
          type="month"
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          className="bg-[#0F172A] border border-slate-700/80 text-slate-100 text-sm rounded-2xl px-3 min-h-[48px] h-12 outline-none font-mono"
        />
      </div>

      {/* P&L Breakdown Card */}
      <div className="bg-[#1E293B]/70 border border-slate-700/70 rounded-3xl p-5 shadow-xl space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp size={18} className="text-emerald-400" />
          <h3 className="text-sm font-bold text-white">Monthly Profit & Loss</h3>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <MetricTile
            label="Interest Earned"
            value={formatCurrency(plMetrics.interestCollected)}
            accent="emerald"
          />
          <MetricTile
            label="Net Operating Profit"
            value={formatCurrency(plMetrics.netOperatingProfit)}
            accent="indigo"
          />
        </div>

        <div className="rounded-2xl border border-slate-700/60 bg-[#0F172A]/70 divide-y divide-slate-800/80 overflow-hidden text-xs">
          <div className="flex items-center justify-between p-3 gap-2">
            <span className="text-slate-400 min-w-0 flex-1 truncate">Interest Collections</span>
            <span className="font-mono text-emerald-400 font-bold shrink-0 text-right">
              {formatCurrency(plMetrics.interestCollected)}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 gap-2">
            <span className="text-slate-400 min-w-0 flex-1 truncate">Penalties Collected</span>
            <span className="font-mono text-emerald-400 font-bold shrink-0 text-right">
              {formatCurrency(plMetrics.penaltiesCollected)}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 gap-2">
            <span className="text-slate-400 min-w-0 flex-1 truncate">Principal Amortization Collected</span>
            <span className="font-mono text-slate-200 font-semibold shrink-0 text-right">
              {formatCurrency(plMetrics.principalRecovered)}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 gap-2">
            <span className="text-slate-400 min-w-0 flex-1 truncate">Bad Debt / Write-Offs</span>
            <span className="font-mono text-rose-400 font-bold shrink-0 text-right">
              -{formatCurrency(plMetrics.writeOffs)}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 bg-[#1E293B]/50 font-semibold gap-2">
            <span className="text-white min-w-0 flex-1 truncate">Total Cash Inflow</span>
            <span className="font-mono text-indigo-400 font-bold shrink-0 text-right">
              {formatCurrency(plMetrics.totalInflow)}
            </span>
          </div>
        </div>
      </div>

      {/* Portfolio Risk & Aging Card */}
      <div className="bg-[#1E293B]/70 border border-slate-700/70 rounded-3xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <AlertTriangle size={18} className="text-amber-400 shrink-0" />
            <h3 className="text-sm font-bold text-white truncate">Portfolio Risk & Aging</h3>
          </div>
          <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 shrink-0 whitespace-nowrap">
            PAR 30+: {riskAnalysis.par30.toFixed(1)}%
          </span>
        </div>

        <div className="rounded-2xl border border-slate-700/60 bg-[#0F172A]/70 divide-y divide-slate-800/80 overflow-hidden text-xs">
          <div className="flex items-center justify-between p-3 gap-2">
            <span className="text-slate-300 font-medium min-w-0 flex-1 truncate">Standard / Performing (Current)</span>
            <span className="font-mono text-emerald-400 font-semibold shrink-0 text-right">
              {formatCurrency(riskAnalysis.current)}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 gap-2">
            <span className="text-slate-300 font-medium min-w-0 flex-1 truncate">1 - 30 Days Overdue</span>
            <span className="font-mono text-amber-400 font-semibold shrink-0 text-right">
              {formatCurrency(riskAnalysis.d1_30)}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 gap-2">
            <span className="text-slate-300 font-medium min-w-0 flex-1 truncate">31 - 60 Days Overdue</span>
            <span className="font-mono text-rose-300 font-semibold shrink-0 text-right">
              {formatCurrency(riskAnalysis.d31_60)}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 gap-2">
            <span className="text-slate-300 font-medium min-w-0 flex-1 truncate">60+ Days Overdue (Critical)</span>
            <span className="font-mono text-rose-400 font-bold shrink-0 text-right">
              {formatCurrency(riskAnalysis.d60Plus)}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 bg-[#1E293B]/50 font-semibold gap-2">
            <span className="text-white min-w-0 flex-1 truncate">Total Active Book Value</span>
            <span className="font-mono text-indigo-400 font-bold shrink-0 text-right">
              {formatCurrency(riskAnalysis.totalOutstanding)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

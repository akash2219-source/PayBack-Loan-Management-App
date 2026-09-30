import React, { useState, useEffect } from 'react';
import { QrCode, X, Copy, Check, ExternalLink, ShieldCheck, Edit3 } from 'lucide-react';
import { generateUpiQrDataUrl, openUpiIntent } from '../../utils/upi';
import { formatCurrency } from '../../utils/currency';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

interface DynamicUpiQrModalProps {
  amount: number;
  borrowerName: string;
  loanName?: string;
  loanId: string;
  onPaymentConfirmed?: () => void;
  onClose: () => void;
}

export const DynamicUpiQrModal: React.FC<DynamicUpiQrModalProps> = ({
  amount,
  borrowerName,
  loanName,
  loanId,
  onPaymentConfirmed,
  onClose,
}) => {
  const { data, updateData } = useAuth();
  const toast = useToast();

  const [upiId, setUpiId] = useState<string>(data.settings.upiId || '');
  const [payeeName, setPayeeName] = useState<string>(data.settings.upiPayeeName || data.settings.lenderName || 'PayBack Merchant');
  const [isEditingUpi, setIsEditingUpi] = useState<boolean>(!data.settings.upiId);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Generate QR Code
  useEffect(() => {
    if (!upiId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    generateUpiQrDataUrl({
      upiId,
      payeeName,
      amount,
      transactionNote: `${loanName || 'Loan'} repayment - ${borrowerName}`,
      transactionRef: loanId,
    })
      .then(url => {
        setQrDataUrl(url);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [upiId, payeeName, amount, borrowerName, loanName, loanId]);

  const handleSaveUpiConfig = () => {
    if (!upiId.trim() || !upiId.includes('@')) {
      toast.push('Please enter a valid UPI ID (e.g. yourname@okhdfcbank)', 'error');
      return;
    }
    updateData(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        upiId: upiId.trim(),
        upiPayeeName: payeeName.trim(),
      },
    }));
    setIsEditingUpi(false);
    toast.push('UPI details saved for instant collection!', 'success');
  };

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(upiId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.push('UPI ID copied to clipboard', 'info');
  };

  const handleOpenApp = () => {
    if (!upiId) return;
    openUpiIntent({
      upiId,
      payeeName,
      amount,
      transactionNote: `${loanName || 'Loan'} repayment - ${borrowerName}`,
      transactionRef: loanId,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-end justify-center select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[440px] mx-auto bg-[#1E293B] border-t border-slate-700/80 rounded-t-[28px] rounded-b-none p-4 sm:p-5 shadow-2xl space-y-4 max-h-[88vh] overflow-y-auto no-scrollbar animate-m3-slide-up pb-8"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-full flex items-center justify-center pt-1 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-500/70" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <QrCode size={18} />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Instant UPI QR Code</h3>
              <p className="text-[11px] text-slate-400">Scan & Pay on Field</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-full bg-[#0F172A] border border-slate-700/60 flex items-center justify-center text-slate-400 hover:text-white transition active:scale-95"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* If no UPI ID configured yet or user is editing */}
        {isEditingUpi ? (
          <div className="bg-[#0F172A] rounded-2xl p-4 border border-slate-700/70 space-y-3">
            <p className="text-xs font-semibold text-slate-300">
              Configure your Receiver UPI ID
            </p>
            <div className="space-y-2">
              <div>
                <label className="text-[10px] uppercase text-slate-400 font-bold block mb-1">
                  Receiver UPI ID (VPA) *
                </label>
                <input
                  type="text"
                  placeholder="e.g. 9876543210@paytm or name@okaxis"
                  value={upiId}
                  onChange={e => setUpiId(e.target.value)}
                  className="w-full bg-[#1E293B] border border-slate-700 rounded-xl px-3 min-h-[48px] h-12 text-sm text-white placeholder:text-slate-500 outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase text-slate-400 font-bold block mb-1">
                  Business / Receiver Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sri Lakshmi Finance"
                  value={payeeName}
                  onChange={e => setPayeeName(e.target.value)}
                  className="w-full bg-[#1E293B] border border-slate-700 rounded-xl px-3 min-h-[48px] h-12 text-sm text-white placeholder:text-slate-500 outline-none focus:border-emerald-500"
                />
              </div>
              <button
                onClick={handleSaveUpiConfig}
                className="w-full min-h-[48px] h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition flex items-center justify-center"
              >
                Save & Generate QR
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Amount & Borrower info */}
            <div className="text-center py-1">
              <span className="text-[11px] text-slate-400">Collecting from</span>
              <p className="font-bold text-white text-sm truncate">{borrowerName}</p>
              <div className="mt-1 inline-block px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full">
                <span className="text-xl font-mono font-extrabold text-emerald-400">
                  {formatCurrency(amount)}
                </span>
              </div>
            </div>

            {/* QR Code Presentation */}
            <div className="flex flex-col items-center justify-center p-3 bg-white rounded-2xl shadow-inner mx-auto max-w-[240px]">
              {loading ? (
                <div className="w-52 h-52 flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="UPI Payment QR Code"
                  className="w-52 h-52 object-contain rounded-lg"
                />
              ) : (
                <div className="w-52 h-52 flex flex-col items-center justify-center text-slate-500 text-xs">
                  <p>QR code unavailable</p>
                </div>
              )}
              <div className="flex items-center gap-1.5 mt-2 text-[10px] text-slate-600 font-semibold uppercase tracking-wider">
                <ShieldCheck size={12} className="text-emerald-600" />
                <span>NPCI UPI Verified</span>
              </div>
            </div>

            {/* Receiver UPI Info with Copy & Edit */}
            <div className="bg-[#0F172A] rounded-2xl p-3 border border-slate-700/60 flex items-center justify-between text-xs">
              <div className="min-w-0 flex-1 pr-2">
                <p className="text-[10px] text-slate-400">Pay to VPA:</p>
                <p className="text-white font-mono font-semibold truncate">{upiId}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleCopyUpi}
                  className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-2xl bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition active:scale-95"
                  title="Copy UPI ID"
                  aria-label="Copy UPI ID"
                >
                  {copied ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} />}
                </button>
                <button
                  onClick={() => setIsEditingUpi(true)}
                  className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-2xl bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition active:scale-95"
                  title="Edit UPI ID"
                  aria-label="Edit UPI ID"
                >
                  <Edit3 size={18} />
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              <button
                onClick={handleOpenApp}
                className="w-full min-h-[48px] h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition"
              >
                <ExternalLink size={15} />
                <span>Open Installed UPI App</span>
              </button>

              {onPaymentConfirmed && (
                <button
                  onClick={() => {
                    onPaymentConfirmed();
                    onClose();
                  }}
                  className="w-full min-h-[48px] h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition"
                >
                  <Check size={16} />
                  <span>Confirm Payment Received</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

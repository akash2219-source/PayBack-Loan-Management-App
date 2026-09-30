import React, { useState } from 'react';
import {
  Download,
  Upload,
  Shield,
  FileCheck,
  Database,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { encryptData, decryptData } from '../utils/crypto';
import { AppData } from '../types';
import { ScreenHeader, COMMON_INPUT_CLASS } from '../components/common/UIComponents';

export const BackupView: React.FC = () => {
  const { data, updateData } = useAuth();
  const toast = useToast();

  const [importPin, setImportPin] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [exportMode, setExportMode] = useState<'encrypted' | 'plain'>('encrypted');

  const handleExport = async () => {
    setIsProcessing(true);
    try {
      let contentStr = '';
      let filename = `payback-backup-${new Date().toISOString().slice(0, 10)}`;

      if (exportMode === 'encrypted') {
        const pin = prompt('Enter a 6-digit PIN to encrypt this backup file:');
        if (!pin || pin.length !== 6) {
          toast.push('Valid 6-digit PIN required to encrypt backup.', 'error');
          setIsProcessing(false);
          return;
        }
        const encrypted = await encryptData(data, pin);
        contentStr = JSON.stringify({
          version: '2.0.0',
          type: 'ENCRYPTED_PAYBACK_BACKUP',
          createdAt: new Date().toISOString(),
          payload: encrypted,
        });
        filename += '.payback.enc';
      } else {
        contentStr = JSON.stringify(data, null, 2);
        filename += '.json';
      }

      const blob = new Blob([contentStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.push('Backup file downloaded.', 'success');
    } catch (err) {
      toast.push('Failed to generate backup.', 'error');
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleRestore = async () => {
    if (!selectedFile) {
      toast.push('Please select a backup file first.', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      const text = await selectedFile.text();
      const parsed = JSON.parse(text);

      let restoredData: AppData | null = null;

      if (parsed.type === 'ENCRYPTED_PAYBACK_BACKUP') {
        if (!importPin || importPin.length !== 6) {
          toast.push('Enter the 6-digit PIN used to encrypt this file.', 'error');
          setIsProcessing(false);
          return;
        }
        restoredData = await decryptData(parsed.payload, importPin);
        if (!restoredData) {
          toast.push('Incorrect PIN or corrupted backup file.', 'error');
          setIsProcessing(false);
          return;
        }
      } else if (parsed.loans && parsed.customers && parsed.settings) {
        restoredData = parsed as AppData;
      } else {
        toast.push('Invalid backup file format.', 'error');
        setIsProcessing(false);
        return;
      }

      updateData(() => restoredData!);
      toast.push('All data restored successfully.', 'success');
      setSelectedFile(null);
      setImportPin('');
    } catch (err) {
      toast.push('Failed to parse or restore backup.', 'error');
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <ScreenHeader title="Backup & Restore" subtitle="Encrypted local data management" />

      {/* Storage Summary */}
      <div className="bg-[#1E293B]/70 border border-slate-700/70 rounded-3xl p-5 shadow-xl space-y-3">
        <div className="flex items-center gap-2">
          <Database size={18} className="text-indigo-400" />
          <h3 className="text-sm font-bold text-white">Database Snapshot</h3>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-[#0F172A]/70 p-3 rounded-2xl border border-slate-700/60">
            <span className="text-slate-400 block mb-0.5">Borrowers / Clients</span>
            <span className="font-bold text-white font-mono text-sm">{data.customers.length}</span>
          </div>
          <div className="bg-[#0F172A]/70 p-3 rounded-2xl border border-slate-700/60">
            <span className="text-slate-400 block mb-0.5">Loans Created</span>
            <span className="font-bold text-emerald-400 font-mono text-sm">{data.loans.length}</span>
          </div>
          <div className="bg-[#0F172A]/70 p-3 rounded-2xl border border-slate-700/60">
            <span className="text-slate-400 block mb-0.5">Transactions</span>
            <span className="font-bold text-indigo-400 font-mono text-sm">{data.transactions.length}</span>
          </div>
          <div className="bg-[#0F172A]/70 p-3 rounded-2xl border border-slate-700/60">
            <span className="text-slate-400 block mb-0.5">Borrowings</span>
            <span className="font-bold text-amber-400 font-mono text-sm">{data.borrowings?.length || 0}</span>
          </div>
        </div>
      </div>

      {/* Export Backup Card */}
      <div className="bg-[#1E293B]/70 border border-slate-700/70 rounded-3xl p-5 shadow-xl space-y-4">
        <div className="flex items-center gap-2">
          <Download size={18} className="text-indigo-400" />
          <h3 className="text-sm font-bold text-white">Export Backup File</h3>
        </div>

        <div className="flex items-center bg-[#0F172A] p-1 rounded-2xl border border-slate-700/70 gap-1.5">
          <button
            onClick={() => setExportMode('encrypted')}
            className={`flex-1 min-h-[48px] py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-95 ${
              exportMode === 'encrypted'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Shield size={15} />
            <span>Encrypted (.enc)</span>
          </button>
          <button
            onClick={() => setExportMode('plain')}
            className={`flex-1 min-h-[48px] py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-95 ${
              exportMode === 'plain'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileCheck size={15} />
            <span>Plain JSON</span>
          </button>
        </div>

        <p className="text-[11px] text-slate-400">
          {exportMode === 'encrypted'
            ? 'Military-grade AES-GCM 256 encryption. Requires a PIN to unlock when restoring.'
            : 'Unencrypted JSON. Suitable for manual auditing or spreadsheets.'}
        </p>

        <button
          onClick={handleExport}
          disabled={isProcessing}
          className="w-full min-h-[48px] py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 transition disabled:opacity-50"
        >
          <Download size={16} />
          <span>Generate & Download Backup</span>
        </button>
      </div>

      {/* Restore Backup Card */}
      <div className="bg-[#1E293B]/70 border border-slate-700/70 rounded-3xl p-5 shadow-xl space-y-4">
        <div className="flex items-center gap-2">
          <Upload size={18} className="text-emerald-400" />
          <h3 className="text-sm font-bold text-white">Restore from Backup</h3>
        </div>

        <div className="space-y-3">
          <div className="min-h-[64px] border-2 border-dashed border-slate-700/70 hover:border-indigo-500/50 rounded-2xl p-4 text-center cursor-pointer relative bg-[#0F172A]/70 transition flex flex-col items-center justify-center">
            <input
              type="file"
              accept=".enc,.json,.payback"
              onChange={handleFileSelect}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <p className="text-xs font-semibold text-white">
              {selectedFile ? selectedFile.name : 'Tap to select backup file (.enc or .json)'}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : 'Supports encrypted and plain backups'}
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">
              File PIN (If encrypted)
            </label>
            <input
              type="password"
              maxLength={6}
              value={importPin}
              onChange={e => setImportPin(e.target.value.replace(/\D/g, ''))}
              placeholder="6-digit PIN"
              className={COMMON_INPUT_CLASS}
            />
          </div>

          <button
            onClick={handleRestore}
            disabled={!selectedFile || isProcessing}
            className="w-full min-h-[48px] py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition disabled:opacity-50"
          >
            <Upload size={16} />
            <span>Restore Data</span>
          </button>
        </div>
      </div>
    </div>
  );
};

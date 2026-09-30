import React, { useState } from 'react';
import { Building2, Plus, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Lender } from '../types';
import { ScreenHeader, EmptyState } from '../components/common/UIComponents';
import { LenderModal } from './BorrowingDetailView';

export const LendersView: React.FC = () => {
  const { data, updateData } = useAuth();
  const toast = useToast();

  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [selectedLenderToEdit, setSelectedLenderToEdit] = useState<Lender | null>(null);

  const lenders = data.lenders || [];
  const borrowings = data.borrowings || [];

  const handleDelete = (lender: Lender) => {
    const attachedCount = borrowings.filter(b => b.lenderId === lender.id).length;
    if (attachedCount > 0) {
      toast.push(`Cannot delete lender with ${attachedCount} active borrowing(s). Delete or reassign them first.`, 'error');
      return;
    }

    updateData(prev => ({
      ...prev,
      lenders: prev.lenders.filter(l => l.id !== lender.id),
    }));
    toast.push('Lender deleted.', 'success');
  };

  return (
    <div className="space-y-4">
      <ScreenHeader
        title="Lenders"
        subtitle={`${lenders.length} on file`}
        right={
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-2 min-h-[44px] rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-indigo-600/25 transition active:scale-95 shrink-0"
          >
            <Plus size={16} />
            <span>Add Lender</span>
          </button>
        }
      />

      {lenders.length === 0 ? (
        <EmptyState
          icon={<Building2 size={28} className="text-indigo-400" />}
          title="No lenders added yet"
          hint="Add banks, NBFCs, or individuals you borrow capital or loans from."
          action={
            <button
              onClick={() => setShowAddModal(true)}
              className="px-5 py-3 min-h-[48px] rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-indigo-600/25 transition active:scale-95"
            >
              <Plus size={16} />
              <span>Add First Lender</span>
            </button>
          }
        />
      ) : (
        <div className="space-y-2.5">
          {lenders.map(lender => {
            const count = borrowings.filter(b => b.lenderId === lender.id).length;
            return (
              <div
                key={lender.id}
                className="bg-[#1E293B]/70 border border-slate-700/70 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-md"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white truncate">{lender.name}</p>
                  <p className="text-xs text-slate-400 truncate">
                    {lender.type} • {count} borrowing{count === 1 ? '' : 's'}
                    {lender.contact ? ` • ${lender.contact}` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setSelectedLenderToEdit(lender)}
                    className="w-12 h-12 min-w-[48px] min-h-[48px] flex items-center justify-center rounded-xl bg-[#0F172A] hover:bg-slate-800 border border-slate-700/60 text-slate-300 hover:text-white transition active:scale-95"
                    title="Edit Lender"
                    aria-label="Edit Lender"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(lender)}
                    className="w-12 h-12 min-w-[48px] min-h-[48px] flex items-center justify-center rounded-xl bg-[#0F172A] hover:bg-rose-500/20 border border-slate-700/60 text-slate-400 hover:text-rose-400 transition active:scale-95"
                    title="Delete Lender"
                    aria-label="Delete Lender"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAddModal && <LenderModal onClose={() => setShowAddModal(false)} />}
      {selectedLenderToEdit && (
        <LenderModal
          lender={selectedLenderToEdit}
          onClose={() => setSelectedLenderToEdit(null)}
        />
      )}
    </div>
  );
};

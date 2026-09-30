import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Plus,
  ChevronRight,
  X,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';
import { useToast } from '../context/ToastContext';
import { formatCurrency } from '../utils/currency';
import { generateNextId } from '../utils/calculations';
import { Customer } from '../types';
import { ScreenHeader, EmptyState, COMMON_INPUT_CLASS } from '../components/common/UIComponents';

export const ClientsView: React.FC = () => {
  const { data } = useAuth();
  const nav = useNavigation();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState<boolean>(!!nav.view.openAdd);
  const [selectedClientToEdit, setSelectedClientToEdit] = useState<Customer | null>(null);

  const filteredClients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return data.customers
      .map(customer => {
        const clientLoans = data.loans.filter(l => l.customerId === customer.id);
        const activeLoans = clientLoans.filter(
          l => l.status === 'ACTIVE' || l.status === 'OVERDUE' || l.status === 'PARTIALLY_SETTLED'
        );
        const totalOutstanding = activeLoans.reduce(
          (sum, l) => sum + (Number(l.currentPrincipalBalance) || 0),
          0
        );
        return {
          customer,
          totalLoans: clientLoans.length,
          activeLoansCount: activeLoans.length,
          totalOutstanding,
        };
      })
      .filter(({ customer }) => {
        if (!q) return true;
        return (
          customer.name.toLowerCase().includes(q) ||
          customer.phone.includes(q) ||
          (customer.notes && customer.notes.toLowerCase().includes(q)) ||
          (customer.idNumber && customer.idNumber.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        if (b.activeLoansCount !== a.activeLoansCount) return b.activeLoansCount - a.activeLoansCount;
        return a.customer.name.localeCompare(b.customer.name);
      });
  }, [data.customers, data.loans, searchQuery]);

  return (
    <div className="space-y-4">
      <ScreenHeader
        title="Clients & Borrowers"
        subtitle={`${data.customers.length} client${data.customers.length === 1 ? '' : 's'} on record`}
        right={
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-2 min-h-[44px] rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-indigo-600/25 transition active:scale-95 shrink-0"
          >
            <Plus size={16} />
            <span>Add Client</span>
          </button>
        }
      />

      {/* Search Input */}
      <div className="relative">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search by name, phone or ID..."
          className="w-full min-h-[48px] h-12 bg-[#1E293B] border border-slate-700/80 focus:border-indigo-400 rounded-2xl pl-10 pr-4 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition"
        />
      </div>

      {/* Client List */}
      {filteredClients.length === 0 ? (
        <EmptyState
          icon={<Users size={28} className="text-indigo-400" />}
          title={data.customers.length === 0 ? 'No clients added yet' : 'No clients found'}
          hint={
            data.customers.length === 0
              ? 'Add your first borrower profile with their contact information and identification.'
              : 'Try searching with a different name or phone number.'
          }
          action={
            data.customers.length === 0 ? (
              <button
                onClick={() => setShowAddModal(true)}
                className="px-5 py-3 min-h-[48px] rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-indigo-600/25 transition active:scale-95"
              >
                <Plus size={16} />
                <span>Add First Client</span>
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-2.5">
          {filteredClients.map(({ customer, activeLoansCount, totalOutstanding }) => (
            <div
              key={customer.id}
              onClick={() => nav.push({ page: 'clientDetail', customerId: customer.id })}
              className="bg-[#1E293B]/70 border border-slate-700/70 hover:border-indigo-500/40 rounded-2xl p-4 flex items-center justify-between gap-3 text-left transition shadow-md group cursor-pointer"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-bold text-white truncate">{customer.name}</p>
                  {activeLoansCount > 0 ? (
                    <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                      {activeLoansCount} Active
                    </span>
                  ) : (
                    <span className="px-2 py-0.2 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400">
                      Settled
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 font-mono truncate">{customer.phone}</p>
              </div>

              <div className="text-right shrink-0">
                <p className="text-sm font-bold font-mono text-emerald-400">
                  {formatCurrency(totalOutstanding)}
                </p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Balance</p>
              </div>

              <ChevronRight size={16} className="text-slate-500 group-hover:text-white transition shrink-0" />
            </div>
          ))}
        </div>
      )}

      {/* Add Client Modal */}
      {showAddModal && <CustomerModal onClose={() => setShowAddModal(false)} />}

      {/* Edit Client Modal */}
      {selectedClientToEdit && (
        <CustomerModal
          customer={selectedClientToEdit}
          onClose={() => setSelectedClientToEdit(null)}
        />
      )}
    </div>
  );
};

export const CustomerModal: React.FC<{
  customer?: Customer;
  onClose: () => void;
  onCreated?: (newId: string) => void;
}> = ({ customer, onClose, onCreated }) => {
  const { data, updateData } = useAuth();
  const toast = useToast();
  const isEdit = !!customer;

  const [name, setName] = useState<string>(customer?.name || '');
  const [phone, setPhone] = useState<string>(customer?.phone || '');
  const [idNumber, setIdNumber] = useState<string>(customer?.idNumber || '');
  const [address, setAddress] = useState<string>(customer?.address || '');
  const [notes, setNotes] = useState<string>(customer?.notes || '');

  const handleSave = () => {
    if (!name.trim()) {
      toast.push('Client name is required.', 'error');
      return;
    }
    if (!phone.trim()) {
      toast.push('Phone number is required.', 'error');
      return;
    }

    const payload = {
      name: name.trim(),
      phone: phone.trim(),
      idNumber: idNumber.trim(),
      address: address.trim(),
      notes: notes.trim(),
    };

    if (isEdit) {
      updateData(prev => ({
        ...prev,
        customers: prev.customers.map(c => (c.id === customer.id ? { ...c, ...payload } : c)),
      }));
      toast.push('Client details updated.', 'success');
    } else {
      const newId = generateNextId('CUST', data.customers, data);
      const newCustomer: Customer = {
        id: newId,
        ...payload,
        createdAt: new Date().toISOString(),
      };
      updateData(prev => ({
        ...prev,
        customers: [...prev.customers, newCustomer],
      }));
      toast.push('Client added successfully.', 'success');
      onCreated?.(newId);
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
              <UserPlus size={18} />
            </div>
            <div>
              <h3 className="font-bold text-white text-base leading-tight">
                {isEdit ? 'Edit Client Profile' : 'New Client'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {isEdit ? 'Update borrower identity & details' : 'Save borrower contact, KYC & address'}
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
            <label className="text-[11px] font-semibold text-slate-300 block mb-1">Full Name *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Ramesh Kumar"
              className={COMMON_INPUT_CLASS}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">Mobile Phone *</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className={`${COMMON_INPUT_CLASS} font-mono`}
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">Aadhaar / ID (Optional)</label>
              <input
                value={idNumber}
                onChange={e => setIdNumber(e.target.value)}
                placeholder="XXXX-XXXX-XXXX"
                className={COMMON_INPUT_CLASS}
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-300 block mb-1">Address (Optional)</label>
            <input
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Street, City, Pin"
              className={COMMON_INPUT_CLASS}
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-300 block mb-1">Notes / Guarantor Details</label>
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Guarantor, reference or notes"
              className={COMMON_INPUT_CLASS}
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 min-h-[48px] h-12 rounded-2xl bg-[#0F172A] hover:bg-slate-700 active:scale-95 text-slate-300 font-semibold text-sm border border-slate-700/60 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 min-h-[48px] h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-sm shadow-md shadow-indigo-600/25 transition"
          >
            {isEdit ? 'Save Changes' : 'Create Client'}
          </button>
        </div>
      </div>
    </div>
  );
};

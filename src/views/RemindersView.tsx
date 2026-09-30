import React, { useState, useMemo } from 'react';
import {
  Bell,
  MessageSquare,
  Send,
  Save,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatCurrency } from '../utils/currency';
import { getTodayISO, formatDateDisplay, daysBetween } from '../utils/date';
import { computeExpectedCyclePayment } from '../utils/calculations';
import {
  generateSmsReminderBody,
  requestNotificationPermission,
  getNotificationPermissionStatus,
} from '../utils/notifications';
import { Loan, Customer } from '../types';
import { ScreenHeader, COMMON_INPUT_CLASS, EmptyState } from '../components/common/UIComponents';

export const RemindersView: React.FC = () => {
  const { data, updateData } = useAuth();
  const toast = useToast();
  const todayISO = getTodayISO();

  const [customTemplate, setCustomTemplate] = useState<string>(
    data.settings.customSmsTemplate ||
      'Dear {NAME}, this is a gentle reminder from {BUSINESS} regarding your payment of {AMOUNT} due on {DUE_DATE}. Please settle at your earliest convenience.'
  );

  const [permStatus, setPermStatus] = useState<NotificationPermission>(
    getNotificationPermissionStatus()
  );

  // List of overdue or upcoming due in next 7 days
  const pendingReminders = useMemo(() => {
    const list: Array<{ loan: Loan; customer?: Customer; diffDays: number }> = [];

    data.loans
      .filter(l => l.status === 'ACTIVE' || l.status === 'OVERDUE' || l.status === 'PARTIALLY_SETTLED')
      .forEach(loan => {
        if (!loan.nextDueDate || loan.nextDueDate === 'N/A') return;
        const diffDays = daysBetween(todayISO, loan.nextDueDate);
        if (diffDays <= 7) {
          const customer = data.customers.find(c => c.id === loan.customerId);
          list.push({ loan, customer, diffDays });
        }
      });

    return list.sort((a, b) => a.diffDays - b.diffDays);
  }, [data.loans, data.customers, todayISO]);

  const handleSaveTemplate = () => {
    updateData(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        customSmsTemplate: customTemplate.trim(),
      },
    }));
    toast.push('SMS Reminder template saved.', 'success');
  };

  const handleRequestNotifications = async () => {
    const granted = await requestNotificationPermission();
    setPermStatus(getNotificationPermissionStatus());
    if (granted) {
      toast.push('Notifications enabled for due date alerts.', 'success');
    } else {
      toast.push('Notification permissions were not granted.', 'error');
    }
  };

  const handleSendReminder = (loan: Loan, customer?: Customer) => {
    if (!customer?.phone) {
      toast.push('Client has no phone number on record.', 'error');
      return;
    }

    const body = generateSmsReminderBody(loan, customer, {
      ...data.settings,
      customSmsTemplate: customTemplate,
    });
    const cleanPhone = customer.phone.replace(/[^\d+]/g, '');
    window.location.href = `sms:${cleanPhone}?&body=${encodeURIComponent(body)}`;

    updateData(prev => ({
      ...prev,
      loans: prev.loans.map(l => (l.id === loan.id ? { ...l, lastReminderSentAt: todayISO } : l)),
    }));
    toast.push('SMS template opened.', 'success');
  };

  return (
    <div className="space-y-4">
      <ScreenHeader
        title="Reminders & Alerts"
        subtitle="SMS templates & payment notifications"
      />

      {/* Notification Banner */}
      <div className="bg-[#1E293B]/70 border border-slate-700/70 rounded-3xl p-5 shadow-xl flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
            <Bell size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-white">Daily Due Date Alerts</p>
            <p className="text-[11px] text-slate-400 truncate">
              Status: <span className="font-mono capitalize text-slate-200">{permStatus}</span>
            </p>
          </div>
        </div>

        {permStatus !== 'granted' && (
          <button
            onClick={handleRequestNotifications}
            className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shrink-0 shadow-md shadow-indigo-600/25 transition"
          >
            Enable
          </button>
        )}
      </div>

      {/* SMS Template Customizer */}
      <div className="bg-[#1E293B]/70 border border-slate-700/70 rounded-3xl p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare size={16} className="text-indigo-400" />
            <h3 className="text-sm font-bold text-white">SMS Reminder Template</h3>
          </div>
        </div>

        <p className="text-[11px] text-slate-400">
          Available tokens:{' '}
          <span className="font-mono text-indigo-400 font-semibold">{'{NAME}'}</span>,{' '}
          <span className="font-mono text-indigo-400 font-semibold">{'{AMOUNT}'}</span>,{' '}
          <span className="font-mono text-indigo-400 font-semibold">{'{DUE_DATE}'}</span>,{' '}
          <span className="font-mono text-indigo-400 font-semibold">{'{BUSINESS}'}</span>,{' '}
          <span className="font-mono text-indigo-400 font-semibold">{'{DAYS_OVERDUE}'}</span>
        </p>

        <textarea
          rows={4}
          value={customTemplate}
          onChange={e => setCustomTemplate(e.target.value)}
          className={COMMON_INPUT_CLASS}
        />

        <button
          onClick={handleSaveTemplate}
          className="w-full min-h-[48px] py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 transition active:scale-95"
        >
          <Save size={16} />
          <span>Save SMS Template</span>
        </button>
      </div>

      {/* Pending Reminders List */}
      <div className="bg-[#1E293B]/70 border border-slate-700/70 rounded-3xl p-5 shadow-xl space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Due in Next 7 Days / Overdue ({pendingReminders.length})
        </h3>

        {pendingReminders.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 size={28} className="text-emerald-400" />}
            title="All caught up"
            hint="No loans are overdue or due within the next 7 days."
          />
        ) : (
          <div className="rounded-2xl border border-slate-700/60 bg-[#0F172A]/70 divide-y divide-slate-800/80 overflow-hidden">
            {pendingReminders.map(({ loan, customer, diffDays }) => {
              const amount = computeExpectedCyclePayment(loan);
              const isOverdue = diffDays < 0;

              return (
                <div key={loan.id} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white truncate">{customer?.name || 'Client'}</span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.2 rounded-full ${
                          isOverdue
                            ? 'bg-rose-500/20 text-rose-400'
                            : diffDays === 0
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-indigo-500/20 text-indigo-400'
                        }`}
                      >
                        {isOverdue
                          ? `${Math.abs(diffDays)}d Overdue`
                          : diffDays === 0
                          ? 'Today'
                          : `in ${diffDays}d`}
                      </span>
                    </div>
                    <p className="text-slate-400 font-mono text-[11px] truncate mt-0.5">
                      {customer?.phone} • Due: {formatDateDisplay(loan.nextDueDate)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono font-bold text-emerald-400">{formatCurrency(amount)}</span>
                    <button
                      onClick={() => handleSendReminder(loan, customer)}
                      className="px-4 py-2.5 min-h-[48px] rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition flex items-center gap-1.5 font-semibold text-xs active:scale-95"
                    >
                      <Send size={14} />
                      <span>Send</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

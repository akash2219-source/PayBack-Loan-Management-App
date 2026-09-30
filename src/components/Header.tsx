import React, { useState, useMemo } from 'react';
import {
  Bell,
  Lock,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';
import { computeScheduleMap } from '../utils/notifications';
import { DueNotificationItem } from '../types';
import { AppLogo } from './common/AppLogo';

export const Header: React.FC = () => {
  const { data, lockNow, pinEnabled, updateData } = useAuth();
  const nav = useNavigation();
  const [showDueDropdown, setShowDueDropdown] = useState<boolean>(false);

  const schedule = useMemo(() => computeScheduleMap(data.loans, data.customers), [data.loans, data.customers]);
  const todayBucket = schedule.todayBucket || [];
  const seenNotifs = data.settings?.seenDueNotifications?.[schedule.todayISO] || [];
  const seenSet = useMemo(() => new Set(seenNotifs), [seenNotifs]);
  const unreadCount = todayBucket.filter(i => !seenSet.has(i.loanId)).length;

  const markAllSeen = () => {
    if (todayBucket.length === 0) return;
    updateData(prev => {
      const current = prev.settings.seenDueNotifications?.[schedule.todayISO] || [];
      const updated = Array.from(new Set([...current, ...todayBucket.map(i => i.loanId)]));
      return {
        ...prev,
        settings: {
          ...prev.settings,
          seenDueNotifications: {
            ...prev.settings.seenDueNotifications,
            [schedule.todayISO]: updated,
          },
        },
      };
    });
  };

  const toggleDropdown = () => {
    setShowDueDropdown(prev => {
      const next = !prev;
      if (next) markAllSeen();
      return next;
    });
  };

  const handleDueItemClick = (item: DueNotificationItem) => {
    setShowDueDropdown(false);
    nav.push({ page: 'loanDetail', loanId: item.loanId });
  };

  const userGreeting = () => {
    const raw = (data.settings?.userName || data.settings?.lenderName || '').trim();
    if (!raw) return 'Lender';
    return raw.split(/\s+/)[0];
  };

  return (
    <header className="sticky top-0 bg-[#0F172A]/95 border-b border-slate-800/90 backdrop-blur-xl px-4 py-2.5 z-40 w-full">
      <div className="flex items-center justify-between gap-3 w-full max-w-[440px] mx-auto">
        {/* Material 3 Brand & Greeting */}
        <div
          onClick={() => nav.switchTab('home')}
          className="cursor-pointer min-w-0 flex-1 flex items-center gap-3 group select-none"
        >
          <AppLogo size="sm" withGlow={false} className="group-active:scale-95 transition-transform" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-bold text-white leading-tight truncate">
                Hi, {userGreeting()}
              </h1>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" title="System Online" />
            </div>
          </div>
        </div>

        {/* Action Button Strip */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Due Alerts Notifications Icon Button */}
          <div className="relative">
            <button
              type="button"
              onClick={toggleDropdown}
              aria-label="Due date notifications"
              className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-2xl bg-[#1E293B] border border-slate-700/80 flex items-center justify-center text-slate-300 hover:text-white hover:border-slate-600 active:scale-90 transition-all m3-state-layer relative"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-extrabold flex items-center justify-center leading-none ring-2 ring-[#0F172A] animate-bounce shadow-md">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showDueDropdown && (
              <>
                <div
                  className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs"
                  onClick={() => setShowDueDropdown(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-80 max-w-[88vw] bg-[#1E293B] border border-slate-700 rounded-3xl shadow-2xl p-4 z-50 animate-m3-slide-up">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-1.5">
                      <Bell size={16} className="text-indigo-400" />
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        Due Today ({todayBucket.length})
                      </h4>
                    </div>
                    <button
                      onClick={() => setShowDueDropdown(false)}
                      className="w-12 h-12 min-w-[48px] min-h-[48px] flex items-center justify-center text-slate-400 hover:text-white rounded-2xl hover:bg-slate-800 transition"
                      aria-label="Close notifications"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {todayBucket.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400 space-y-1">
                      <p className="text-base">🎉</p>
                      <p className="font-semibold text-slate-200">All caught up!</p>
                      <p className="text-[11px]">No loans or EMIs scheduled for today.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-0.5">
                      {todayBucket.map(item => (
                        <div
                          key={item.loanId}
                          onClick={() => handleDueItemClick(item)}
                          className="text-xs flex items-center justify-between gap-2 cursor-pointer bg-[#0F172A] hover:bg-slate-800/90 border border-slate-700/70 rounded-2xl p-3.5 transition active:scale-98 min-h-[48px]"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-white truncate">{item.customerName}</p>
                            <p className="text-[11px] text-slate-400 truncate">{item.loanName}</p>
                          </div>
                          <span
                            className={`shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              item.isOverdue
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                                : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                            }`}
                          >
                            {item.isOverdue ? 'Overdue' : 'Due Today'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Quick Lock Vault Button */}
          <button
            type="button"
            onClick={lockNow}
            aria-label="Lock Vault"
            title={pinEnabled ? 'Lock App Vault' : 'Lock session'}
            className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-2xl bg-[#1E293B] border border-slate-700/80 flex items-center justify-center text-slate-300 hover:text-white hover:border-slate-600 active:scale-90 transition-all m3-state-layer"
          >
            <Lock size={19} />
          </button>
        </div>
      </div>
    </header>
  );
};

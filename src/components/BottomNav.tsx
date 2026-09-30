import React from 'react';
import { Home, Landmark, FileText, Settings, Plus } from 'lucide-react';
import { useNavigation, MainTab } from '../context/NavigationContext';
import { useLanguage } from '../i18n/LanguageContext';

export const BottomNav: React.FC<{
  onOpenQuickAdd: () => void;
}> = ({ onOpenQuickAdd }) => {
  const { activeTab, switchTab } = useNavigation();
  const { t } = useLanguage();

  const tabs: { key: MainTab; label: string; icon: React.ReactNode }[] = [
    { key: 'home', label: t('nav.home', 'Home'), icon: <Home size={20} /> },
    { key: 'loans', label: t('nav.loans', 'Loans'), icon: <Landmark size={20} /> },
    { key: 'reports', label: t('nav.reports', 'Reports'), icon: <FileText size={20} /> },
    { key: 'more', label: t('nav.settings', 'Settings'), icon: <Settings size={20} /> },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 w-full max-w-[440px] mx-auto pointer-events-none pb-2 px-3">
      {/* Material 3 Surface Container Bar */}
      <nav
        aria-label="Android Bottom Navigation"
        className="pointer-events-auto bg-[#1E293B]/95 border border-slate-700/80 rounded-[28px] backdrop-blur-2xl shadow-[0_16px_36px_rgba(0,0,0,0.65)] px-2 py-1.5 flex items-center justify-between"
      >
        {/* First 2 Navigation Items */}
        <div className="flex-1 flex items-center justify-around">
          {tabs.slice(0, 2).map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => switchTab(tab.key)}
                className="flex-1 min-h-[50px] py-1 flex flex-col items-center justify-center gap-1 group m3-state-layer"
                aria-selected={isActive}
              >
                {/* M3 Active Indicator Pill */}
                <div
                  className={`h-8 px-5 rounded-full flex items-center justify-center transition-all duration-200 ${
                    isActive
                      ? 'bg-indigo-600/30 text-indigo-300 ring-1 ring-indigo-500/40 shadow-sm'
                      : 'text-slate-400 group-hover:text-slate-200 group-hover:bg-slate-800/50'
                  }`}
                >
                  {tab.icon}
                </div>
                <span
                  className={`text-[11px] leading-none transition-colors duration-150 ${
                    isActive ? 'text-indigo-300 font-bold' : 'text-slate-400 font-medium'
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Center M3 Floating Action Button (FAB) */}
        <div className="shrink-0 px-1 -mt-6">
          <button
            onClick={onOpenQuickAdd}
            aria-label="Quick Add (New Loan / Payment / Client)"
            className="w-[52px] h-[52px] min-w-[48px] min-h-[48px] rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white flex items-center justify-center border-4 border-[#1E293B] shadow-[0_8px_20px_rgba(79,70,229,0.45)] active:scale-90 transition-all duration-150 m3-state-layer"
          >
            <Plus size={24} strokeWidth={2.6} />
          </button>
        </div>

        {/* Last 2 Navigation Items */}
        <div className="flex-1 flex items-center justify-around">
          {tabs.slice(2).map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => switchTab(tab.key)}
                className="flex-1 min-h-[50px] py-1 flex flex-col items-center justify-center gap-1 group m3-state-layer"
                aria-selected={isActive}
              >
                {/* M3 Active Indicator Pill */}
                <div
                  className={`h-8 px-5 rounded-full flex items-center justify-center transition-all duration-200 ${
                    isActive
                      ? 'bg-indigo-600/30 text-indigo-300 ring-1 ring-indigo-500/40 shadow-sm'
                      : 'text-slate-400 group-hover:text-slate-200 group-hover:bg-slate-800/50'
                  }`}
                >
                  {tab.icon}
                </div>
                <span
                  className={`text-[11px] leading-none transition-colors duration-150 ${
                    isActive ? 'text-indigo-300 font-bold' : 'text-slate-400 font-medium'
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

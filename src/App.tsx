import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NavigationProvider, useNavigation } from './context/NavigationContext';
import { ToastProvider } from './context/ToastContext';
import { LanguageProvider } from './i18n/LanguageContext';

import { AndroidFrame } from './components/AndroidFrame';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { QuickAddModal } from './components/QuickAddModal';
import { AppLogo } from './components/common/AppLogo';

import { OnboardingView } from './views/OnboardingView';
import { LoginPinView } from './views/LoginPinView';
import { HomeView } from './views/HomeView';
import { LoansView } from './views/LoansView';
import { ClientsView } from './views/ClientsView';
import { ClientDetailView } from './views/ClientDetailView';
import { LoanDetailView } from './views/LoanDetailView';
import { BorrowingDetailView } from './views/BorrowingDetailView';
import { LendersView } from './views/LendersView';
import { LedgerView } from './views/LedgerView';
import { ReportsView } from './views/ReportsView';
import { RemindersView } from './views/RemindersView';
import { SettingsView } from './views/SettingsView';
import { BackupView } from './views/BackupView';
import { AddPaymentView } from './views/AddPaymentView';
import { FieldCollectionView } from './views/FieldCollectionView';
import { CollateralVaultView } from './views/CollateralVaultView';

const MainAppContent: React.FC = () => {
  const { isSetup, isLocked, isLoading, unlockVault, createVault } = useAuth();
  const nav = useNavigation();
  const [quickAddOpen, setQuickAddOpen] = useState<boolean>(false);
  const [quickAddTab, setQuickAddTab] = useState<'loan' | 'client' | 'payment'>('loan');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <AppLogo size="xl" />
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!isSetup) {
    return (
      <AndroidFrame>
        <OnboardingView onComplete={createVault} />
      </AndroidFrame>
    );
  }

  if (isLocked) {
    return (
      <AndroidFrame>
        <LoginPinView onUnlock={unlockVault} />
      </AndroidFrame>
    );
  }

  const renderActiveView = () => {
    switch (nav.view.page) {
      case 'home':
        return <HomeView />;
      case 'loans':
        return <LoansView />;
      case 'clients':
        return <ClientsView />;
      case 'clientDetail':
        return <ClientDetailView customerId={nav.view.customerId!} />;
      case 'loanDetail':
        return <LoanDetailView loanId={nav.view.loanId!} />;
      case 'borrowingDetail':
        return <BorrowingDetailView borrowingId={nav.view.borrowingId!} />;
      case 'lenders':
        return <LendersView />;
      case 'ledger':
        return <LedgerView />;
      case 'reports':
        return <ReportsView />;
      case 'reminders':
        return <RemindersView />;
      case 'more':
      case 'settings':
        return <SettingsView />;
      case 'backup':
        return <BackupView />;
      case 'fieldCollection':
        return <FieldCollectionView />;
      case 'collateralVault':
        return <CollateralVaultView />;
      case 'addPayment':
        return <AddPaymentView loanId={nav.view.loanId} />;
      default:
        return <HomeView />;
    }
  };

  const handleOpenQuickAdd = (tab: 'loan' | 'client' | 'payment' = 'loan') => {
    setQuickAddTab(tab);
    setQuickAddOpen(true);
  };

  return (
    <AndroidFrame>
      <div className="flex flex-col min-h-full pb-24 w-full">
        {nav.view.page === 'home' && <Header />}

        <main className={`flex-1 px-3.5 sm:px-4 ${nav.view.page === 'home' ? 'py-3.5' : 'pt-4 pb-3.5'} w-full`}>
          {renderActiveView()}
        </main>

        <BottomNav
          onOpenQuickAdd={() => handleOpenQuickAdd('loan')}
        />

        {quickAddOpen && (
          <QuickAddModal
            initialTab={quickAddTab}
            onClose={() => setQuickAddOpen(false)}
          />
        )}
      </div>
    </AndroidFrame>
  );
};

export default function App() {
  return (
    <LanguageProvider>
      <ToastProvider>
        <AuthProvider>
          <NavigationProvider>
            <MainAppContent />
          </NavigationProvider>
        </AuthProvider>
      </ToastProvider>
    </LanguageProvider>
  );
}

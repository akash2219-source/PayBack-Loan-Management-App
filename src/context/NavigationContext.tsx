import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

export type MainTab = 'home' | 'loans' | 'reports' | 'more';

export interface ViewState {
  page:
    | 'home'
    | 'loans'
    | 'reports'
    | 'more'
    | 'loanDetail'
    | 'addPayment'
    | 'ledger'
    | 'borrowingDetail'
    | 'addBorrowingPayment'
    | 'lenders'
    | 'clients'
    | 'clientDetail'
    | 'settings'
    | 'reminders'
    | 'backup'
    | 'fieldCollection'
    | 'collateralVault';
  loanId?: string;
  customerId?: string;
  borrowingId?: string;
  collateralId?: string;
  book?: 'lent' | 'borrowed';
  openWizard?: boolean;
  openAdd?: boolean;
  dueListDate?: string;
}

interface NavigationContextType {
  view: ViewState;
  depth: number;
  push: (view: ViewState) => void;
  pop: () => void;
  replace: (view: ViewState) => void;
  switchTab: (tab: MainTab) => void;
  activeTab: MainTab;
}

const NavigationContext = createContext<NavigationContextType | null>(null);

export function useNavigation() {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useNavigation must be used within NavigationProvider');
  return ctx;
}

export function parseHashRoute(): ViewState[] {
  const hash = location.hash || '';
  const loanMatch = hash.match(/loan=([^&]+)/);
  const custMatch = hash.match(/customer=([^&]+)/);
  const dueMatch = hash.match(/dueList=([^&]+)/);

  if (loanMatch) {
    return [{ page: 'loans' }, { page: 'loanDetail', loanId: loanMatch[1] }];
  }
  if (custMatch) {
    return [{ page: 'more' }, { page: 'clients' }, { page: 'clientDetail', customerId: custMatch[1] }];
  }
  if (dueMatch) {
    return [{ page: 'home', dueListDate: dueMatch[1] }];
  }
  return [{ page: 'home' }];
}

export const MAIN_TABS: Set<string> = new Set(['home', 'loans', 'reports', 'more']);

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [stack, setStack] = useState<ViewState[]>(parseHashRoute);
  const currentView = stack[stack.length - 1];
  const depth = stack.length;
  const depthRef = useRef(depth);

  useEffect(() => {
    depthRef.current = depth;
  }, [depth]);

  const push = useCallback((newView: ViewState) => {
    depthRef.current = depthRef.current + 1;
    setStack(prev => [...prev, newView]);
    try {
      history.pushState({ pbDepth: depthRef.current }, '');
    } catch {
      // ignore
    }
  }, []);

  const pop = useCallback(() => {
    if (depthRef.current <= 1) return;
    depthRef.current = depthRef.current - 1;
    setStack(prev => (prev.length > 1 ? prev.slice(0, -1) : prev));
    try {
      history.back();
    } catch {
      // ignore
    }
  }, []);

  const replace = useCallback((newView: ViewState) => {
    setStack(prev => [...prev.slice(0, -1), newView]);
  }, []);

  const switchTab = useCallback((tab: MainTab) => {
    depthRef.current = 1;
    setStack([{ page: tab }]);
  }, []);

  // System back button handling
  useEffect(() => {
    const onPopState = () => {
      setStack(prev => {
        if (prev.length > 1) {
          depthRef.current = prev.length - 1;
          return prev.slice(0, -1);
        }
        return prev;
      });
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Determine active tab
  let activeTab: MainTab = 'home';
  if (MAIN_TABS.has(currentView.page)) {
    activeTab = currentView.page as MainTab;
  } else if (
    currentView.page === 'loanDetail' ||
    currentView.page === 'addPayment' ||
    currentView.page === 'borrowingDetail' ||
    currentView.page === 'addBorrowingPayment'
  ) {
    activeTab = 'loans';
  } else if (
    currentView.page === 'clients' ||
    currentView.page === 'clientDetail' ||
    currentView.page === 'lenders' ||
    currentView.page === 'settings' ||
    currentView.page === 'reminders' ||
    currentView.page === 'backup' ||
    currentView.page === 'fieldCollection' ||
    currentView.page === 'collateralVault'
  ) {
    activeTab = 'more';
  } else if (currentView.page === 'ledger') {
    activeTab = currentView.loanId || currentView.borrowingId ? 'loans' : 'home';
  }

  const value: NavigationContextType = {
    view: currentView,
    depth,
    push,
    pop,
    replace,
    switchTab,
    activeTab,
  };

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
};

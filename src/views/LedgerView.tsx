import React, { useState, useMemo } from 'react';
import {
  ArrowUpRight,
  ArrowDownLeft,
  ChevronUp,
  ChevronDown,
  Receipt,
  HandCoins,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';
import { formatCurrency } from '../utils/currency';
import { formatDateDisplay } from '../utils/date';
import { ScreenHeader, EmptyState } from '../components/common/UIComponents';

export const LedgerView: React.FC = () => {
  const { data } = useAuth();
  const nav = useNavigation();

  const [book, setBook] = useState<'lent' | 'borrowed'>(
    nav.view.book === 'borrowed' || nav.view.borrowingId ? 'borrowed' : 'lent'
  );
  const [sortKey, setSortKey] = useState<'date' | 'client' | 'amount'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const filterLoanId = nav.view.loanId;
  const filterBorrowingId = nav.view.borrowingId;

  const handleSort = (key: 'date' | 'client' | 'amount') => {
    if (sortKey === key) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  // Lent Transactions
  const lentRows = useMemo(() => {
    const list = data.transactions
      .filter(t => !filterLoanId || t.loanId === filterLoanId)
      .map(t => {
        const loan = data.loans.find(l => l.id === t.loanId);
        const cust = loan ? data.customers.find(c => c.id === loan.customerId) : null;
        return { txn: t, loan, cust };
      });

    const sorters = {
      client: (a: any, b: any) => (a.cust?.name || '').localeCompare(b.cust?.name || ''),
      amount: (a: any, b: any) => (Number(a.txn.amount) || 0) - (Number(b.txn.amount) || 0),
      date: (a: any, b: any) => (a.txn.date || '').localeCompare(b.txn.date || ''),
    };

    return list.sort((a, b) => (sortDir === 'asc' ? sorters[sortKey](a, b) : sorters[sortKey](b, a)));
  }, [data.transactions, data.loans, data.customers, filterLoanId, sortKey, sortDir]);

  // Borrowed Payments
  const borrowedRows = useMemo(() => {
    const list = (data.borrowingPayments || [])
      .filter(p => !filterBorrowingId || p.borrowingId === filterBorrowingId)
      .map(p => {
        const b = (data.borrowings || []).find(x => x.id === p.borrowingId);
        const lender = b ? (data.lenders || []).find(l => l.id === b.lenderId) : null;
        return { p, b, lender };
      });

    const sorters = {
      client: (a: any, b: any) => (a.lender?.name || '').localeCompare(b.lender?.name || ''),
      amount: (a: any, b: any) => (Number(a.p.amount) || 0) - (Number(b.p.amount) || 0),
      date: (a: any, b: any) => (a.p.date || '').localeCompare(b.p.date || ''),
    };

    return list.sort((a, b) => (sortDir === 'asc' ? sorters[sortKey](a, b) : sorters[sortKey](b, a)));
  }, [data.borrowingPayments, data.borrowings, data.lenders, filterBorrowingId, sortKey, sortDir]);

  return (
    <div className="space-y-4">
      <ScreenHeader
        title="Ledger"
        subtitle={
          book === 'lent'
            ? `Lent Book • ${lentRows.length} entry${lentRows.length === 1 ? '' : 'ies'}`
            : `Borrowed Book • ${borrowedRows.length} entry${borrowedRows.length === 1 ? '' : 'ies'}`
        }
      />

      {/* Book Toggle */}
      {!filterLoanId && !filterBorrowingId && (
        <div className="flex items-center bg-[#0F172A] border border-slate-700/80 p-1 rounded-2xl gap-1 w-full min-w-0">
          <button
            onClick={() => setBook('lent')}
            className={`flex-1 min-h-[48px] py-2.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 min-w-0 ${
              book === 'lent'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ArrowUpRight size={16} className="shrink-0" />
            <span className="truncate">Lent (Receivables)</span>
          </button>
          <button
            onClick={() => setBook('borrowed')}
            className={`flex-1 min-h-[48px] py-2.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 min-w-0 ${
              book === 'borrowed'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ArrowDownLeft size={16} className="shrink-0" />
            <span className="truncate">Borrowed (Payables)</span>
          </button>
        </div>
      )}

      {/* LENT TRANSACTIONS TABLE */}
      {book === 'lent' && (
        <>
          {lentRows.length === 0 ? (
            <EmptyState
              icon={<Receipt size={28} className="text-indigo-400" />}
              title="No transactions recorded"
              hint="When payments or settlements are made on loans, they will appear here."
            />
          ) : (
            <div className="bg-[#1E293B]/70 border border-slate-700/70 rounded-3xl p-3.5 sm:p-5 shadow-xl space-y-3">
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead className="border-b border-slate-700/80 text-slate-400">
                    <tr>
                      <th className="py-2 px-3 text-left">
                        <button
                          onClick={() => handleSort('client')}
                          className="min-h-[48px] flex items-center gap-1 hover:text-white"
                        >
                          <span>Client</span>
                          {sortKey === 'client' && (
                            sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                          )}
                        </button>
                      </th>
                      <th className="py-2 px-3 text-left">
                        <button
                          onClick={() => handleSort('date')}
                          className="min-h-[48px] flex items-center gap-1 hover:text-white"
                        >
                          <span>Date</span>
                          {sortKey === 'date' && (
                            sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                          )}
                        </button>
                      </th>
                      <th className="py-2 px-3 text-left">Type</th>
                      <th className="py-2 px-3 text-left">Mode</th>
                      <th className="py-2 px-3 text-right">
                        <button
                          onClick={() => handleSort('amount')}
                          className="min-h-[48px] flex items-center gap-1 hover:text-white ml-auto"
                        >
                          <span>Collected</span>
                          {sortKey === 'amount' && (
                            sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                          )}
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-slate-300">
                    {lentRows.map(({ txn, cust, loan }) => (
                      <tr
                        key={txn.id}
                        onClick={() => loan && nav.push({ page: 'loanDetail', loanId: loan.id })}
                        className={`hover:bg-slate-800/40 cursor-pointer min-h-[48px] ${
                          txn.status === 'VOIDED' ? 'opacity-40' : ''
                        }`}
                      >
                        <td className="py-3 px-3 font-semibold text-white truncate max-w-[120px]">
                          {cust?.name || '—'}
                        </td>
                        <td className="py-3 px-3 text-slate-400 whitespace-nowrap">
                          {formatDateDisplay(txn.date)}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {txn.isPartial
                            ? 'Partial'
                            : txn.isForeclosure
                            ? 'Foreclosure'
                            : txn.type === 'WRITE_OFF'
                            ? 'Write-Off'
                            : txn.type === 'REVERSAL'
                            ? 'Reversal'
                            : 'Payment'}
                        </td>
                        <td className="py-3 px-3 text-slate-400">{txn.paymentMode}</td>
                        <td
                          className={`py-3 px-3 text-right font-bold ${
                            txn.status === 'VOIDED'
                              ? 'text-slate-500 line-through'
                              : 'text-emerald-400'
                          }`}
                        >
                          {formatCurrency(txn.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* BORROWED PAYMENTS TABLE */}
      {book === 'borrowed' && (
        <>
          {borrowedRows.length === 0 ? (
            <EmptyState
              icon={<HandCoins size={28} className="text-indigo-400" />}
              title="No outbound payments recorded"
              hint="Payments you make against borrowings will appear in this ledger."
            />
          ) : (
            <div className="bg-[#1E293B]/70 border border-slate-700/70 rounded-3xl p-3.5 sm:p-5 shadow-xl space-y-3">
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead className="border-b border-slate-700/80 text-slate-400">
                    <tr>
                      <th className="py-2 px-3 text-left">
                        <button
                          onClick={() => handleSort('client')}
                          className="min-h-[48px] flex items-center gap-1 hover:text-white"
                        >
                          <span>Lender</span>
                          {sortKey === 'client' && (
                            sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                          )}
                        </button>
                      </th>
                      <th className="py-2 px-3 text-left">
                        <button
                          onClick={() => handleSort('date')}
                          className="min-h-[48px] flex items-center gap-1 hover:text-white"
                        >
                          <span>Date</span>
                          {sortKey === 'date' && (
                            sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                          )}
                        </button>
                      </th>
                      <th className="py-2 px-3 text-left">Borrowing</th>
                      <th className="py-2 px-3 text-left">Mode</th>
                      <th className="py-2 px-3 text-right">
                        <button
                          onClick={() => handleSort('amount')}
                          className="min-h-[48px] flex items-center gap-1 hover:text-white ml-auto"
                        >
                          <span>Paid</span>
                          {sortKey === 'amount' && (
                            sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                          )}
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-slate-300">
                    {borrowedRows.map(({ p, b, lender }) => (
                      <tr
                        key={p.id}
                        onClick={() => b && nav.push({ page: 'borrowingDetail', borrowingId: b.id })}
                        className="hover:bg-slate-800/40 cursor-pointer min-h-[48px]"
                      >
                        <td className="py-3 px-3 font-semibold text-white truncate max-w-[120px]">
                          {lender?.name || '—'}
                        </td>
                        <td className="py-3 px-3 text-slate-400 whitespace-nowrap">
                          {formatDateDisplay(p.date)}
                        </td>
                        <td className="py-3 px-3 text-slate-300 truncate max-w-[120px]">
                          {b?.name || '—'}
                        </td>
                        <td className="py-3 px-3 text-slate-400">{p.paymentMode}</td>
                        <td className="py-3 px-3 text-right font-bold text-emerald-400">
                          {formatCurrency(p.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

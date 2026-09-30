import {
  Loan,
  Transaction,
  Borrowing,
  BorrowingPayment,
  AmortizationRow,
  PayoffCalculation,
  WaterfallResult,
  PaymentFrequency,
} from '../types';
import {
  getTodayISO,
  calculateNextDueDate,
  daysBetween,
  addDays,
  parseISODate,
} from './date';

const MAX_CYCLES = 600;

export function getEffectiveMonthlyRate(loan: { frequency: PaymentFrequency; interestRate: number }): number {
  const monthlyDecimal = loan.interestRate / 100;
  if (loan.frequency === 'MONTHLY') {
    return monthlyDecimal;
  }
  if (loan.frequency === 'WEEKLY') {
    return (monthlyDecimal * 12) / 52;
  }
  // DAILY frequency
  return (monthlyDecimal * 12) / 365;
}

export function getFrequencyDays(freq: PaymentFrequency): number {
  if (freq === 'MONTHLY') return 30;
  if (freq === 'WEEKLY') return 7;
  return 1; // DAILY
}

export function calculateLTV(loanAmount: number, collateralValuation: number): number {
  if (!collateralValuation || collateralValuation <= 0) return 0;
  return Math.round((loanAmount / collateralValuation) * 100);
}

export function computeFlatLoan(
  principal: number,
  monthlyRate: number,
  tenure: number
): { emi: number; totalInterest: number; interestPerCycle: number; principalPerCycle: number } {
  const totalInterest = principal * monthlyRate * tenure;
  const totalPayable = principal + totalInterest;
  const emi = totalPayable / tenure;
  return {
    emi,
    totalInterest,
    interestPerCycle: totalInterest / tenure,
    principalPerCycle: principal / tenure,
  };
}

export function computeReducingLoan(
  principal: number,
  periodicRate: number,
  tenure: number
): { emi: number } {
  if (periodicRate === 0) {
    return { emi: principal / tenure };
  }
  const factor = Math.pow(1 + periodicRate, tenure);
  const emi = (principal * (periodicRate * factor)) / (factor - 1);
  return { emi };
}

export function generateAmortizationSchedule(loan: {
  type: string;
  interestMethod: string;
  principal: number;
  currentPrincipalBalance?: number;
  interestRate: number;
  frequency: PaymentFrequency;
  tenure: number | null;
  startDate: string;
}): AmortizationRow[] {
  const r = getEffectiveMonthlyRate(loan);
  const rows: AmortizationRow[] = [];

  if (loan.type === 'EMI') {
    const tenure = loan.tenure || 12;
    if (loan.interestMethod === 'FLAT') {
      const { emi, interestPerCycle, principalPerCycle } = computeFlatLoan(loan.principal, r, tenure);
      let balance = loan.principal;
      for (let i = 1; i <= tenure; i++) {
        const open = balance;
        const close = Math.max(0, balance - principalPerCycle);
        rows.push({
          cycle: i,
          dueDate: calculateNextDueDate(loan.startDate, i, loan.frequency),
          opening: open,
          emi,
          interest: interestPerCycle,
          principal: principalPerCycle,
          closing: close,
        });
        balance = close;
      }
    } else {
      const { emi } = computeReducingLoan(loan.principal, r, tenure);
      let balance = loan.principal;
      for (let i = 1; i <= tenure; i++) {
        const open = balance;
        const interest = open * r;
        let principalPart = emi - interest;
        if (i === tenure || principalPart > open) {
          principalPart = open;
        }
        const close = Math.max(0, open - principalPart);
        rows.push({
          cycle: i,
          dueDate: calculateNextDueDate(loan.startDate, i, loan.frequency),
          opening: open,
          emi: principalPart + interest,
          interest,
          principal: principalPart,
          closing: close,
        });
        balance = close;
      }
    }
  } else {
    // Interest Only
    const balance = loan.principal;
    for (let i = 1; i <= 6; i++) {
      const interest = balance * r;
      rows.push({
        cycle: i,
        dueDate: calculateNextDueDate(loan.startDate, i, loan.frequency),
        opening: balance,
        interestDue: interest,
        principalPayment: 0,
        closing: balance,
      });
    }
  }

  return rows;
}

export function computeExpectedCyclePayment(loan: Loan): number {
  const r = getEffectiveMonthlyRate(loan);
  if (loan.type === 'INTEREST_ONLY') {
    return loan.currentPrincipalBalance * r;
  }
  if (loan.emiAmount) {
    return loan.emiAmount;
  }
  if (loan.interestMethod === 'FLAT') {
    return computeFlatLoan(loan.principal, r, loan.tenure || 1).emi;
  }
  return computeReducingLoan(loan.currentPrincipalBalance, r, loan.tenure || 1).emi;
}

export function computeExpectedInterestPerCycle(loan: Loan): number {
  const r = getEffectiveMonthlyRate(loan);
  if (loan.type === 'INTEREST_ONLY') {
    return loan.currentPrincipalBalance * r;
  }
  if (loan.interestMethod === 'FLAT') {
    return loan.interestPerCycle || computeFlatLoan(loan.principal, r, loan.tenure || 1).interestPerCycle;
  }
  return loan.currentPrincipalBalance * r;
}

export function computeAccruedPenalty(loan: Loan, asOfISO?: string): number {
  const targetDate = asOfISO || getTodayISO();
  if (
    !loan.nextDueDate ||
    loan.nextDueDate === 'N/A' ||
    ['CLOSED', 'WRITTEN_OFF', 'DRAFT'].includes(loan.status) ||
    parseISODate(loan.nextDueDate) > parseISODate(targetDate)
  ) {
    return 0;
  }

  // Moratorium freeze: if loan is under active moratorium, penalties do not accrue
  if (loan.activeMoratoriumUntil && parseISODate(targetDate) <= parseISODate(loan.activeMoratoriumUntil)) {
    return 0;
  }

  const emiOrInterest = computeExpectedCyclePayment(loan);
  let totalPenalty = 0;
  let cycleDue = loan.nextDueDate;
  let count = 0;

  while (parseISODate(cycleDue) <= parseISODate(targetDate) && count < MAX_CYCLES) {
    count++;
    const graceExpiry = addDays(cycleDue, loan.gracePeriodDays);
    const overdueDays = Math.max(0, daysBetween(graceExpiry, targetDate));
    if (overdueDays > 0) {
      totalPenalty += emiOrInterest * (loan.penaltyRatePerDay / 100) * overdueDays;
    }
    cycleDue = calculateNextDueDate(cycleDue, 1, loan.frequency);
  }

  const grossPenalty = Math.round(totalPenalty);
  const waived =
    loan.waivedPenaltyTotal ??
    (loan.penaltyWaivers || []).reduce((sum, w) => sum + (Number(w.amountWaived) || 0), 0);
  return Math.max(0, grossPenalty - waived);
}

export function getRemainingCycles(loan: Loan): number {
  if (loan.type !== 'EMI') return 0;
  let remaining = 0;
  let cursor = loan.nextDueDate;
  const mat = loan.maturityDate;
  if (!cursor || cursor === 'N/A' || !mat || mat === 'N/A') return 0;
  let count = 0;
  while (parseISODate(cursor) <= parseISODate(mat) && count < MAX_CYCLES) {
    remaining++;
    cursor = calculateNextDueDate(cursor, 1, loan.frequency);
    count++;
  }
  return remaining;
}

export function calculateForeclosurePayoff(loan: Loan, asOfISO?: string): PayoffCalculation {
  const targetDate = asOfISO || getTodayISO();
  const penalty = computeAccruedPenalty(loan, targetDate);
  let earnedInterest = 0;

  if (loan.type === 'INTEREST_ONLY') {
    const r = getEffectiveMonthlyRate(loan);
    const freqDays = getFrequencyDays(loan.frequency);
    const daysSinceLast = Math.max(0, daysBetween(loan.lastPaymentDate || loan.startDate, targetDate));
    earnedInterest = loan.currentPrincipalBalance * r * Math.min(1, daysSinceLast / freqDays);
  } else if (loan.interestMethod === 'REDUCING') {
    earnedInterest = 0;
  } else {
    // FLAT EMI
    const remaining = getRemainingCycles(loan);
    earnedInterest = (loan.interestPerCycle || 0) * remaining;
  }

  const principal = loan.currentPrincipalBalance;
  const rawPayoff = principal + earnedInterest + penalty - loan.excessCreditBalance;

  return {
    payoff: Math.max(0, Math.round(rawPayoff)),
    penalty: Math.round(penalty),
    interest: Math.round(earnedInterest),
    principal: Math.round(principal),
  };
}

export function computeWaterfall(loan: Loan, amount: number, asOfISO?: string): WaterfallResult {
  const targetDate = asOfISO || getTodayISO();
  let remaining = amount + (loan.excessCreditBalance || 0);

  const penaltyDue = computeAccruedPenalty(loan, targetDate);
  const appliedToPenalty = Math.min(remaining, penaltyDue);
  remaining -= appliedToPenalty;

  const interestDue = computeExpectedInterestPerCycle(loan);
  const appliedToInterest = Math.min(remaining, interestDue);
  remaining -= appliedToInterest;

  const appliedToPrincipal = Math.min(remaining, loan.currentPrincipalBalance);
  remaining -= appliedToPrincipal;

  const excessAdvance = remaining;

  return {
    appliedToPenalty: Math.round(appliedToPenalty),
    appliedToInterest: Math.round(appliedToInterest),
    appliedToPrincipal: Math.round(appliedToPrincipal),
    excessAdvance: Math.round(excessAdvance),
  };
}

export function computeLoanStatus(loan: Loan): Loan['status'] {
  if (loan.status === 'WRITTEN_OFF' || loan.status === 'CLOSED') {
    return loan.status;
  }
  if (loan.currentPrincipalBalance <= 0) {
    return 'CLOSED';
  }
  const today = getTodayISO();
  // If under an active moratorium, loan is protected from OVERDUE status
  if (loan.activeMoratoriumUntil && parseISODate(today) <= parseISODate(loan.activeMoratoriumUntil)) {
    return 'ACTIVE';
  }
  if (loan.nextDueDate && loan.nextDueDate !== 'N/A') {
    const graceExpiry = addDays(loan.nextDueDate, loan.gracePeriodDays);
    if (parseISODate(graceExpiry) < parseISODate(today)) {
      return 'OVERDUE';
    }
  }
  return loan.status === 'PARTIALLY_SETTLED' ? 'PARTIALLY_SETTLED' : 'ACTIVE';
}

export function revertTransactionEffects(loan: Loan, txn: Transaction): Loan {
  const updated = { ...loan };
  updated.currentPrincipalBalance += txn.appliedToPrincipal || 0;
  updated.excessCreditBalance = Math.max(0, (updated.excessCreditBalance || 0) - (txn.excessAdvance || 0));

  if (updated.currentPrincipalBalance > 0) {
    if (!updated.nextDueDate || updated.nextDueDate === 'N/A') {
      updated.nextDueDate = calculateNextDueDate(txn.date, 1, updated.frequency);
    }
    if (updated.status === 'CLOSED') {
      updated.status = 'ACTIVE';
    }
    updated.status = computeLoanStatus(updated);
  }
  return updated;
}

export function generateNextId(prefix: string, list: { id: string }[], data?: any): string {
  const currentYear = parseInt(getTodayISO().slice(0, 4), 10);
  const pattern = `${prefix}-${currentYear}-`;
  
  let maxSeq = 0;
  (list || []).forEach(item => {
    if (item && item.id && item.id.startsWith(pattern)) {
      const num = parseInt(item.id.slice(pattern.length), 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  });

  const storedSeq = data?.settings?.idSeq?.[pattern] || 0;
  const nextVal = Math.max(maxSeq, storedSeq) + 1;
  return `${pattern}${String(nextVal).padStart(4, '0')}`;
}

export function maskIdNumber(val?: string): string {
  if (!val) return '';
  const chars = val.split('');
  const alnumIndices: number[] = [];
  chars.forEach((c, idx) => {
    if (/[a-zA-Z0-9]/.test(c)) alnumIndices.push(idx);
  });
  const unmaskedSet = new Set(alnumIndices.slice(-4));
  return chars
    .map((c, idx) => (/[a-zA-Z0-9]/.test(c) && !unmaskedSet.has(idx) ? 'X' : c))
    .join('');
}

// Borrowing calculations
export function getBorrowingPayments(payments: BorrowingPayment[], borrowingId: string): BorrowingPayment[] {
  return (payments || []).filter(p => p.borrowingId === borrowingId && p.status !== 'VOIDED');
}

export function computeBorrowingTotalPaid(borrowing: Borrowing, payments: BorrowingPayment[]): number {
  return getBorrowingPayments(payments, borrowing.id).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
}

export function computeBorrowingPayable(borrowing: Borrowing, payments: BorrowingPayment[]): number {
  const paid = computeBorrowingTotalPaid(borrowing, payments);
  return Math.max(0, Math.round((Number(borrowing.openingBalance) || 0) - paid));
}

export function computeBorrowingNextDueDate(borrowing: Borrowing, payments: BorrowingPayment[]): string {
  if (borrowing.type === 'OPEN' || !borrowing.nextDueDate || borrowing.nextDueDate === 'N/A') {
    return borrowing.nextDueDate || 'N/A';
  }
  const installment = Number(borrowing.installmentAmount) || 0;
  if (installment <= 0 || !borrowing.startDate || !borrowing.frequency) {
    return borrowing.nextDueDate;
  }
  const totalPaid = computeBorrowingTotalPaid(borrowing, payments);
  const cyclesPaid = Math.floor(totalPaid / installment);
  if (cyclesPaid <= 0) return borrowing.nextDueDate;

  const nextCycle = borrowing.totalInstallments
    ? Math.min(cyclesPaid + 1, Number(borrowing.totalInstallments))
    : cyclesPaid + 1;
  return calculateNextDueDate(borrowing.startDate, nextCycle, borrowing.frequency);
}

export function computeBorrowingStatus(
  borrowing: Borrowing,
  payments: BorrowingPayment[],
  todayISO: string
): Borrowing['status'] {
  if (borrowing.status === 'CLOSED' || computeBorrowingPayable(borrowing, payments) <= 0) {
    return 'CLOSED';
  }
  if (borrowing.type === 'OPEN') {
    return 'ACTIVE';
  }
  const nextDue = computeBorrowingNextDueDate(borrowing, payments);
  if (nextDue && nextDue !== 'N/A' && nextDue < todayISO) {
    return 'OVERDUE';
  }
  return 'ACTIVE';
}

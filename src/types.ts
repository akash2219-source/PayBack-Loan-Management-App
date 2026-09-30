export type LoanType = 'EMI' | 'INTEREST_ONLY';
export type InterestMethod = 'FLAT' | 'REDUCING';
export type PaymentFrequency = 'MONTHLY' | 'WEEKLY' | 'DAILY';
export type RateBasis = 'MONTHLY' | 'YEARLY';
export type LoanStatus = 'ACTIVE' | 'OVERDUE' | 'PARTIALLY_SETTLED' | 'CLOSED' | 'WRITTEN_OFF' | 'DRAFT';
export type BorrowingType = 'FIXED' | 'OPEN';
export type LenderType = 'BANK' | 'NBFC' | 'INDIVIDUAL' | 'OTHER';
export type BorrowingStatus = 'ACTIVE' | 'OVERDUE' | 'CLOSED';
export type TransactionType = 'PAYMENT' | 'REVERSAL' | 'WRITE_OFF' | 'PENALTY_WAIVER' | 'RESTRUCTURE';
export type TransactionStatus = 'VALID' | 'VOIDED';
export type PaymentMode = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE';
export type SupportedLanguage = 'en' | 'kn' | 'hi';

export type CollateralAssetType =
  | 'GOLD_JEWELRY'
  | 'VEHICLE'
  | 'REAL_ESTATE'
  | 'ELECTRONICS'
  | 'PROMISSORY_NOTE'
  | 'CHEQUE'
  | 'OTHER';

export type CollateralStatus = 'PLEDGED' | 'RELEASED' | 'FORFEITED' | 'AUCTIONED';

export interface CollateralAsset {
  id: string;
  loanId: string;
  customerId: string;
  assetType: CollateralAssetType;
  itemTitle: string;
  description: string;
  estimatedValue: number;
  loanToValue?: number; // %
  storageLocation: string; // e.g. "Safe Box #A-14", "Locker Room B"
  status: CollateralStatus;
  pledgedDate: string; // YYYY-MM-DD
  releasedDate?: string;
  releaseNotes?: string;
  grossWeightGrams?: number;
  netWeightGrams?: number;
  purityKarat?: number;
  registrationNumber?: string;
  documentRef?: string;
  photoUrl?: string;
}

export interface RestructureLog {
  id: string;
  date: string;
  previousPrincipal: number;
  newPrincipal: number;
  previousInterestRate: number;
  newInterestRate: number;
  previousTenure: number | null;
  newTenure: number | null;
  previousFrequency: PaymentFrequency;
  newFrequency: PaymentFrequency;
  capitalizedInterest: number;
  capitalizedPenalty: number;
  reason: string;
}

export interface MoratoriumLog {
  id: string;
  appliedDate: string;
  startDate: string;
  cyclesDeferred: number;
  type: 'PRINCIPAL_ONLY' | 'FULL_PAYMENT';
  resumedDueDate: string;
  notes: string;
}

export interface PenaltyWaiverLog {
  id: string;
  date: string;
  amountWaived: number;
  reason: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  idDetails?: string;
  idNumber?: string;
  address?: string;
  notes?: string;
  createdAt: string;
}

export interface Loan {
  id: string;
  loanName?: string;
  customerId: string;
  type: LoanType;
  interestMethod: InterestMethod;
  principal: number;
  currentPrincipalBalance: number;
  interestRate: number; // Effective monthly rate %
  interestRateEntered?: number; // User entered rate
  rateBasis?: RateBasis;
  frequency: PaymentFrequency;
  tenure: number | null; // Number of periods
  startDate: string; // YYYY-MM-DD
  lastPaymentDate?: string;
  nextDueDate: string;
  maturityDate?: string;
  gracePeriodDays: number;
  penaltyRatePerDay: number;
  excessCreditBalance: number;
  lastReminderSentAt?: string | null;
  status: LoanStatus;
  emiAmount?: number | null;
  interestPerCycle?: number | null;

  // New features
  isSecured?: boolean;
  collateralIds?: string[];
  restructuringHistory?: RestructureLog[];
  moratoriumHistory?: MoratoriumLog[];
  penaltyWaivers?: PenaltyWaiverLog[];
  activeMoratoriumUntil?: string; // YYYY-MM-DD
  waivedPenaltyTotal?: number;
  dailyPigmyAgent?: string;
}

export interface Transaction {
  id: string;
  loanId: string;
  type: TransactionType;
  date: string;
  amount: number;
  paymentMode: PaymentMode;
  appliedToPenalty: number;
  appliedToInterest: number;
  appliedToPrincipal: number;
  excessAdvance: number;
  principalBalanceBefore?: number;
  isPartial?: boolean;
  cycleShortfall?: number;
  isForeclosure?: boolean;
  notes?: string;
  status: TransactionStatus;
  reversesTxnId?: string | null;
}

export interface Lender {
  id: string;
  name: string;
  type: LenderType;
  contact?: string;
  notes?: string;
  createdAt: string;
}

export interface Borrowing {
  id: string;
  lenderId: string;
  name: string;
  type: BorrowingType;
  amount: number;
  openingBalance: number;
  installmentAmount?: number;
  frequency?: PaymentFrequency | null;
  startDate: string;
  endDate?: string | null;
  totalInstallments?: number | null;
  nextDueDate?: string;
  notes?: string;
  status: BorrowingStatus;
  createdAt: string;
}

export interface BorrowingPayment {
  id: string;
  borrowingId: string;
  date: string;
  amount: number;
  paymentMode: PaymentMode;
  notes?: string;
  status: TransactionStatus;
  createdAt: string;
}

export interface AppSettings {
  userName?: string;
  lenderName: string;
  businessName?: string;
  phone?: string;
  ownerPhone?: string;
  address?: string;
  language: SupportedLanguage;
  notificationsEnabled?: boolean;
  idSeq?: Record<string, number>;
  seenDueNotifications?: Record<string, string[]>;
  upiId?: string; // e.g. merchant@okhdfcbank
  upiPayeeName?: string;
  defaultPenaltyPercent?: number;
  defaultGracePeriodDays?: number;
  autoLockTimeoutMinutes?: number;
}

export interface AppData {
  customers: Customer[];
  loans: Loan[];
  transactions: Transaction[];
  settings: AppSettings;
  lenders: Lender[];
  borrowings: Borrowing[];
  borrowingPayments: BorrowingPayment[];
  collaterals: CollateralAsset[];
}

export interface AmortizationRow {
  cycle: number;
  dueDate: string;
  opening: number;
  emi?: number;
  interest?: number;
  principal?: number;
  interestDue?: number;
  principalPayment?: number;
  closing: number;
}

export interface PayoffCalculation {
  payoff: number;
  penalty: number;
  interest: number;
  principal: number;
}

export interface WaterfallResult {
  appliedToPenalty: number;
  appliedToInterest: number;
  appliedToPrincipal: number;
  excessAdvance: number;
}

export interface DueNotificationItem {
  loanId: string;
  loanName: string;
  customerId: string;
  customerName: string;
  isOverdue: boolean;
  dueISO: string;
}

export interface ScheduleMap {
  dueMap: Record<string, DueNotificationItem[]>;
  todayISO: string;
  todayBucket: DueNotificationItem[];
}

import { Loan, Customer, AppSettings, DueNotificationItem, ScheduleMap } from '../types';
import { getTodayISO, parseISODate, toISODate, formatDateDisplay } from './date';
import { computeExpectedCyclePayment } from './calculations';
import { formatCurrency } from './currency';

const ACTIVE_LOAN_STATUSES = ['ACTIVE', 'OVERDUE', 'PARTIALLY_SETTLED'];
const DEFAULT_NOTIFICATION_SLOTS = [
  { hour: 9, minute: 0 },
  { hour: 14, minute: 0 },
  { hour: 19, minute: 0 },
];
const QUIET_HOURS_START = 22; // 10 PM
const QUIET_HOURS_END = 8; // 8 AM
const NOTIF_LOG_KEY = 'payback_notif_fired_log';

let pollTimer: any = null;

function isQuietHours(hour: number): boolean {
  if (QUIET_HOURS_START > QUIET_HOURS_END) {
    return hour >= QUIET_HOURS_START || hour < QUIET_HOURS_END;
  }
  return hour >= QUIET_HOURS_START && hour < QUIET_HOURS_END;
}

export function computeScheduleMap(loans: Loan[], customers: Customer[]): ScheduleMap {
  const custMap: Record<string, Customer> = {};
  (customers || []).forEach(c => {
    custMap[c.id] = c;
  });

  const today = parseISODate(getTodayISO());
  const maxLookahead = new Date(today);
  maxLookahead.setDate(maxLookahead.getDate() + 30);

  const dueMap: Record<string, DueNotificationItem[]> = {};

  (loans || []).forEach(loan => {
    if (!ACTIVE_LOAN_STATUSES.includes(loan.status) || !loan.nextDueDate || loan.nextDueDate === 'N/A') {
      return;
    }

    let dueDate: Date;
    try {
      dueDate = parseISODate(loan.nextDueDate);
    } catch {
      return;
    }

    const windowStart = new Date(dueDate);
    windowStart.setDate(windowStart.getDate() - 3);
    const windowEnd = new Date(dueDate);
    windowEnd.setDate(windowEnd.getDate() + 30);

    const actualStart = windowStart > today ? windowStart : today;
    const actualEnd = windowEnd < maxLookahead ? windowEnd : maxLookahead;

    for (let d = new Date(actualStart); d <= actualEnd; d.setDate(d.getDate() + 1)) {
      const iso = toISODate(d);
      if (!dueMap[iso]) {
        dueMap[iso] = [];
      }
      dueMap[iso].push({
        loanId: loan.id,
        loanName: loan.loanName || 'Loan',
        customerId: loan.customerId,
        customerName: custMap[loan.customerId]?.name || 'Customer',
        isOverdue: d > dueDate,
        dueISO: loan.nextDueDate,
      });
    }
  });

  const todayISO = getTodayISO();
  return {
    dueMap,
    todayISO,
    todayBucket: dueMap[todayISO] || [],
  };
}

export function formatBucketMessage(dateISO: string, items: DueNotificationItem[]): {
  title: string;
  body: string;
  data?: any;
} {
  const overdueCount = items.filter(i => i.isOverdue).length;
  if (items.length === 1) {
    const item = items[0];
    const title = item.isOverdue ? `Overdue: ${item.customerName}` : `Payment due: ${item.customerName}`;
    const body = item.isOverdue
      ? `${item.loanName} was due ${item.dueISO} and is still unpaid.`
      : `${item.loanName} is due on ${item.dueISO}.`;
    return {
      title,
      body,
      data: { page: 'customerProfile', customerId: item.customerId, openLoanId: item.loanId },
    };
  }

  const title = overdueCount > 0 ? `${items.length} loans need attention` : `${items.length} loans due`;
  const preview = items
    .slice(0, 3)
    .map(i => i.customerName)
    .join(', ');
  const extra = items.length > 3 ? ` +${items.length - 3} more` : '';
  return {
    title,
    body: `${preview}${extra} — tap to view.`,
    data: { page: 'dueList', date: dateISO },
  };
}

export const BrowserNotificationService = {
  isSupported(): boolean {
    return typeof Notification !== 'undefined';
  },

  async requestPermission(): Promise<NotificationPermission | 'unsupported'> {
    if (!this.isSupported()) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    try {
      return await Notification.requestPermission();
    } catch {
      return Notification.permission;
    }
  },

  fire(notification: { title: string; body: string; data?: any }) {
    if (!this.isSupported() || Notification.permission !== 'granted') return;
    try {
      const notif = new Notification(notification.title, {
        body: notification.body,
        tag: 'payback-due',
      });
      notif.onclick = () => {
        window.focus();
        if (notification.data?.page === 'customerProfile') {
          location.hash = `#loan=${notification.data.openLoanId}&customer=${notification.data.customerId}`;
        } else {
          location.hash = `#dueList=${notification.data.date}`;
        }
        notif.close();
      };
    } catch {
      // Ignored in non-supporting contexts
    }
  },

  startPolling(getSchedule: () => ScheduleMap) {
    this.stopPolling();
    const checkAndFire = () => {
      const now = new Date();
      if (isQuietHours(now.getHours())) return;

      const slotIdx = DEFAULT_NOTIFICATION_SLOTS.findIndex(slot => {
        const slotMinutes = slot.hour * 60 + slot.minute;
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        return Math.abs(nowMinutes - slotMinutes) <= 10;
      });

      if (slotIdx === -1) return;

      const todayISO = getTodayISO();
      const logKey = `${todayISO}_${slotIdx}`;
      let log: Record<string, boolean> = {};
      try {
        log = JSON.parse(localStorage.getItem(NOTIF_LOG_KEY) || '{}');
      } catch {
        log = {};
      }

      if (log[logKey]) return;

      const { todayBucket } = getSchedule();
      if (todayBucket.length === 0) return;

      this.fire(formatBucketMessage(todayISO, todayBucket));
      log[logKey] = true;
      localStorage.setItem(NOTIF_LOG_KEY, JSON.stringify(log));
    };

    checkAndFire();
    pollTimer = setInterval(checkAndFire, 300 * 1000);
  },

  stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  },
};

export function getNotificationPermissionStatus(): NotificationPermission {
  if (typeof Notification === 'undefined') return 'denied';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false;
  try {
    const res = await Notification.requestPermission();
    return res === 'granted';
  } catch {
    return false;
  }
}

export const SMS_REMINDER_TEMPLATE =
  'Hi {borrowerName}, this is a reminder from {lenderName} that {amountLabel} is due on {dueDate} for your loan "{loanName}". Please make the payment at your earliest convenience. Thank you.';

export function generateSmsReminderBody(
  loan: Loan,
  customer: Customer,
  settings: AppSettings
): string {
  const amountLabel =
    (loan.type === 'EMI' ? 'EMI ' : 'Interest ') + formatCurrency(computeExpectedCyclePayment(loan));
  const replacements: Record<string, string> = {
    borrowerName: customer.name,
    lenderName: settings.lenderName || 'Your Lending Business',
    amountLabel,
    dueDate: formatDateDisplay(loan.nextDueDate),
    loanName: loan.loanName || (loan.type === 'EMI' ? 'EMI Loan' : 'Interest-Only Loan'),
  };

  let body = SMS_REMINDER_TEMPLATE;
  Object.keys(replacements).forEach(key => {
    body = body.split(`{${key}}`).join(replacements[key]);
  });
  return body;
}

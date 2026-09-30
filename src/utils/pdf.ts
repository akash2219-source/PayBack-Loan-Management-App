import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Loan, Customer, AppData, Borrowing, Lender } from '../types';
import { getTodayISO, formatDateDisplay } from './date';
import { formatRsPlain } from './currency';
import {
  generateAmortizationSchedule,
  computeExpectedCyclePayment,
  computeExpectedInterestPerCycle,
  computeAccruedPenalty,
  computeBorrowingPayable,
  computeBorrowingTotalPaid,
  getBorrowingPayments,
} from './calculations';

export async function generateLoanStatementPDF(
  data: AppData,
  loan: Loan,
  customer: Customer
): Promise<void> {
  const isEMI = loan.type === 'EMI';
  const schedule = isEMI ? generateAmortizationSchedule(loan) : [];
  const transactions = (data.transactions || [])
    .filter(t => t.loanId === loan.id)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 14;
  const brandDark = [17, 33, 61];
  const brandTeal = [13, 148, 136];
  const borderLight = [222, 228, 238];
  const textMuted = [108, 120, 138];
  const textDark = [28, 36, 50];
  const headerHeight = 26;
  const footerHeight = 16;

  const getPageWidth = () => doc.internal.pageSize.getWidth();
  const getPageHeight = () => doc.internal.pageSize.getHeight();

  function drawHeader() {
    const w = getPageWidth();
    doc.setFillColor(brandDark[0], brandDark[1], brandDark[2]);
    doc.rect(0, 0, w, headerHeight, 'F');
    doc.setFillColor(brandTeal[0], brandTeal[1], brandTeal[2]);
    doc.rect(0, headerHeight - 1.2, w, 1.2, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(String(data.settings?.lenderName || 'PayBack'), margin, 12.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(178, 196, 222);
    doc.text('Loan Statement', margin, 19);

    doc.setFontSize(8);
    doc.text(`Generated: ${formatDateDisplay(getTodayISO())}`, w - margin, 12.5, { align: 'right' });
    const loanTitle = loan.loanName || (isEMI ? 'EMI Loan' : 'Interest-Only Loan');
    doc.text(loanTitle, w - margin, 19, { align: 'right' });
  }

  function drawFooter() {
    const w = getPageWidth();
    const h = getPageHeight();
    const pageNum = (doc as any).internal.getNumberOfPages ? (doc as any).internal.getNumberOfPages() : 1;

    doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
    doc.setLineWidth(0.3);
    doc.line(margin, h - footerHeight + 4, w - margin, h - footerHeight + 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text('Computer-generated statement — no signature required.', margin, h - footerHeight + 9);
    doc.text(`Page ${pageNum}`, w - margin, h - footerHeight + 9, { align: 'right' });
  }

  function drawCard(x: number, y: number, w: number, h: number) {
    doc.setFillColor(247, 249, 252);
    doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, w, h, 1.6, 1.6, 'FD');
  }

  function drawKV(x: number, y: number, label: string, value: string, isHighlight = false) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(String(label).toUpperCase(), x, y);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    if (isHighlight) {
      doc.setTextColor(brandTeal[0], brandTeal[1], brandTeal[2]);
    } else {
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    }
    doc.text(String(value), x, y + 5.2);
  }

  function drawSection(y: number, title: string): number {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(title, margin, y);
    doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
    doc.setLineWidth(0.4);
    doc.line(margin, y + 2, getPageWidth() - margin, y + 2);
    return y + 8;
  }

  // Page 1: Overview
  drawHeader();

  let curY = headerHeight + 10;
  const pw = getPageWidth();
  const halfCardW = (pw - margin * 2 - 6) / 2;

  // Borrower Card
  drawCard(margin, curY, halfCardW, 26);
  drawKV(margin + 5, curY + 7, 'Borrower', customer.name);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(`${customer.id}   ${customer.phone || ''}`, margin + 5, curY + 19);

  // Loan Card
  drawCard(margin + halfCardW + 6, curY, halfCardW, 26);
  const loanName = loan.loanName || (isEMI ? 'EMI Loan' : 'Interest-Only Loan');
  drawKV(margin + halfCardW + 11, curY + 7, 'Loan Account', loanName);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(`${isEMI ? 'EMI' : 'Interest-Only'}   ${loan.interestMethod || ''}   ${loan.status || ''}`, margin + halfCardW + 11, curY + 19);

  curY += 32;

  // 4 metric tiles
  const installment = isEMI ? (loan.emiAmount ?? computeExpectedCyclePayment(loan)) : computeExpectedInterestPerCycle(loan);
  const metrics = [
    ['Principal', formatRsPlain(loan.principal), false],
    ['Installment', formatRsPlain(installment), true],
    ['Interest Rate', `${loan.interestRateEntered ?? loan.interestRate}% ${loan.rateBasis === 'YEARLY' ? 'p.a.' : 'p.m.'}`, false],
    ['Frequency', loan.frequency === 'WEEKLY' ? 'Weekly' : 'Monthly', false],
  ];

  const col4W = (pw - margin * 2 - 18) / 4;
  metrics.forEach((m, idx) => {
    const x = margin + idx * (col4W + 6);
    drawCard(x, curY, col4W, 17);
    drawKV(x + 4, curY + 6.5, m[0] as string, m[1] as string, m[2] as boolean);
  });

  curY += 24;

  const totalPaid = transactions
    .filter(t => t.status === 'VALID' && t.type === 'PAYMENT')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const stats = [
    ['Start Date', formatDateDisplay(loan.startDate), false],
    ['Next Due Date', formatDateDisplay(loan.nextDueDate), false],
    ['Outstanding Balance', formatRsPlain(loan.currentPrincipalBalance), true],
    ['Total Repaid', formatRsPlain(totalPaid), false],
    ['Penalty Accrued', formatRsPlain(computeAccruedPenalty(loan, getTodayISO())), false],
    ['Advance Credit', formatRsPlain(loan.excessCreditBalance || 0), false],
  ];

  curY = drawSection(curY, `Current Position as of ${formatDateDisplay(getTodayISO())}`);

  const col3W = (pw - margin * 2 - 12) / 3;
  stats.forEach((s, idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const x = margin + col * (col3W + 6);
    const y = curY + row * 23;
    drawCard(x, y, col3W, 17);
    drawKV(x + 4, y + 6.5, s[0] as string, s[1] as string, s[2] as boolean);
  });

  drawFooter();

  // Page 2: Transaction Ledger (Landscape)
  doc.addPage('a4', 'landscape');
  drawHeader();

  const ledgerY = drawSection(headerHeight + 12, `Transaction History (${transactions.length})`);

  if (transactions.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text('No transactions recorded against this loan.', margin, ledgerY + 2);
    drawFooter();
  } else {
    const tableBody = transactions.map(t => [
      formatDateDisplay(t.date),
      t.type === 'PAYMENT' ? (t.isPartial ? 'Partial Payment' : t.isForeclosure ? 'Foreclosure' : 'Payment') : t.type === 'WRITE_OFF' ? 'Write-Off' : 'Reversal',
      t.paymentMode || '—',
      formatRsPlain(t.amount),
      formatRsPlain(t.appliedToPenalty || 0),
      formatRsPlain(t.appliedToInterest || 0),
      formatRsPlain(t.appliedToPrincipal || 0),
      formatRsPlain(t.excessAdvance || 0),
      t.status === 'VOIDED' ? 'Voided' : 'Valid',
    ]);

    const validTxns = transactions.filter(t => t.status === 'VALID');
    const tableFoot = [[
      '', 'Total', '',
      formatRsPlain(totalPaid),
      formatRsPlain(validTxns.reduce((s, t) => s + (t.appliedToPenalty || 0), 0)),
      formatRsPlain(validTxns.reduce((s, t) => s + (t.appliedToInterest || 0), 0)),
      formatRsPlain(validTxns.reduce((s, t) => s + (t.appliedToPrincipal || 0), 0)),
      formatRsPlain(validTxns.reduce((s, t) => s + (t.excessAdvance || 0), 0)),
      '',
    ]];

    autoTable(doc, {
      startY: ledgerY,
      head: [['Date', 'Type', 'Mode', 'Amount', 'Penalty', 'Interest', 'Principal', 'Advance', 'Status']],
      body: tableBody,
      foot: tableFoot,
      theme: 'plain',
      styles: {
        fontSize: 7.5,
        cellPadding: { top: 2, bottom: 2, left: 2.5, right: 2.5 },
        textColor: textDark as any,
        lineColor: borderLight as any,
        lineWidth: 0,
      },
      headStyles: {
        fillColor: brandDark as any,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
        halign: 'right',
      },
      footStyles: {
        fillColor: [237, 241, 247] as any,
        textColor: textDark as any,
        fontStyle: 'bold',
        fontSize: 7.5,
        halign: 'right',
      },
      alternateRowStyles: {
        fillColor: [249, 250, 253] as any,
      },
      columnStyles: {
        0: { halign: 'left', cellWidth: 22 },
        1: { halign: 'left', cellWidth: 28 },
        2: { halign: 'left', cellWidth: 24 },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
        7: { halign: 'right' },
        8: { halign: 'center', cellWidth: 18 },
      },
      margin: { top: headerHeight + 8, left: margin, right: margin, bottom: footerHeight + 4 },
      didDrawPage: () => {
        drawHeader();
        drawFooter();
      },
      willDrawCell: (data: any) => {
        if (data.section === 'head' && data.column.index <= 2) {
          data.cell.styles.halign = 'left';
        }
        if (data.section === 'head' && data.column.index === 8) {
          data.cell.styles.halign = 'center';
        }
        if (data.section === 'foot' && data.column.index <= 2) {
          data.cell.styles.halign = 'left';
        }
        if (data.section === 'body' && transactions[data.row.index]?.status === 'VOIDED') {
          data.cell.styles.textColor = textMuted as any;
          data.cell.styles.fontStyle = 'italic';
        }
      },
    });
  }

  // Page 3: Amortization Schedule (if EMI)
  if (isEMI && schedule.length > 0) {
    doc.addPage('a4', 'portrait');
    drawHeader();
    const schedY = drawSection(headerHeight + 12, 'Amortization Schedule');

    const totalEMI = schedule.reduce((sum, r) => sum + (r.emi || 0), 0);
    const totalInt = schedule.reduce((sum, r) => sum + (r.interest || 0), 0);
    const totalPrin = schedule.reduce((sum, r) => sum + (r.principal || 0), 0);

    const schedBody = schedule.map(r => [
      r.cycle,
      formatDateDisplay(r.dueDate),
      formatRsPlain(r.opening),
      formatRsPlain(r.emi),
      formatRsPlain(r.interest),
      formatRsPlain(r.principal),
      formatRsPlain(r.closing),
    ]);

    autoTable(doc, {
      startY: schedY,
      head: [['Cycle', 'Due Date', 'Opening', 'EMI', 'Interest', 'Principal', 'Closing']],
      body: schedBody,
      foot: [['', 'Total', '', formatRsPlain(totalEMI), formatRsPlain(totalInt), formatRsPlain(totalPrin), '']],
      theme: 'plain',
      styles: {
        fontSize: 7.6,
        cellPadding: { top: 2.2, bottom: 2.2, left: 2.6, right: 2.6 },
        textColor: textDark as any,
        lineColor: borderLight as any,
        lineWidth: 0,
      },
      headStyles: {
        fillColor: brandDark as any,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.4,
        halign: 'right',
      },
      footStyles: {
        fillColor: [237, 241, 247] as any,
        textColor: textDark as any,
        fontStyle: 'bold',
        fontSize: 7.6,
        halign: 'right',
      },
      alternateRowStyles: {
        fillColor: [249, 250, 253] as any,
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 14 },
        1: { halign: 'left', cellWidth: 24 },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
      },
      margin: { top: headerHeight + 8, left: margin, right: margin, bottom: footerHeight + 4 },
      didDrawPage: () => {
        drawHeader();
        drawFooter();
      },
      willDrawCell: (data: any) => {
        if (data.section === 'head' && data.column.index <= 1) {
          data.cell.styles.halign = data.column.index === 0 ? 'center' : 'left';
        }
        if (data.section === 'foot' && data.column.index <= 1) {
          data.cell.styles.halign = 'left';
        }
      },
    });
  }

  const safeFilename = `${customer.name}_${loanName}`.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');
  doc.save(`${safeFilename}_Statement.pdf`);
}

export async function generateBorrowingStatementPDF(
  data: AppData,
  borrowing: Borrowing,
  lender: Lender | null
): Promise<void> {
  const payments = getBorrowingPayments(data.borrowingPayments || [], borrowing.id)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 14;
  const brandDark = [17, 33, 61];
  const brandTeal = [13, 148, 136];
  const borderLight = [222, 228, 238];
  const textMuted = [108, 120, 138];
  const textDark = [28, 36, 50];
  const headerHeight = 26;
  const footerHeight = 16;

  const getPageWidth = () => doc.internal.pageSize.getWidth();
  const getPageHeight = () => doc.internal.pageSize.getHeight();

  function drawHeader() {
    const w = getPageWidth();
    doc.setFillColor(brandDark[0], brandDark[1], brandDark[2]);
    doc.rect(0, 0, w, headerHeight, 'F');
    doc.setFillColor(brandTeal[0], brandTeal[1], brandTeal[2]);
    doc.rect(0, headerHeight - 1.2, w, 1.2, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(String(data.settings?.lenderName || 'PayBack'), margin, 12.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(178, 196, 222);
    doc.text('Borrowing Statement (Payables)', margin, 19);

    doc.setFontSize(8);
    doc.text(`Generated: ${formatDateDisplay(getTodayISO())}`, w - margin, 12.5, { align: 'right' });
    doc.text(borrowing.name, w - margin, 19, { align: 'right' });
  }

  function drawFooter() {
    const w = getPageWidth();
    const h = getPageHeight();
    const pageNum = (doc as any).internal.getNumberOfPages ? (doc as any).internal.getNumberOfPages() : 1;

    doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
    doc.setLineWidth(0.3);
    doc.line(margin, h - footerHeight + 4, w - margin, h - footerHeight + 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text('Computer-generated statement — no signature required.', margin, h - footerHeight + 9);
    doc.text(`Page ${pageNum}`, w - margin, h - footerHeight + 9, { align: 'right' });
  }

  function drawCard(x: number, y: number, w: number, h: number) {
    doc.setFillColor(247, 249, 252);
    doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, w, h, 1.6, 1.6, 'FD');
  }

  function drawKV(x: number, y: number, label: string, value: string, isHighlight = false) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(String(label).toUpperCase(), x, y);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    if (isHighlight) {
      doc.setTextColor(brandTeal[0], brandTeal[1], brandTeal[2]);
    } else {
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    }
    doc.text(String(value), x, y + 5.2);
  }

  drawHeader();

  let curY = headerHeight + 10;
  const pw = getPageWidth();
  const halfCardW = (pw - margin * 2 - 6) / 2;

  // Lender Card
  drawCard(margin, curY, halfCardW, 26);
  drawKV(margin + 5, curY + 7, 'Lender / Institution', lender?.name || 'Unknown');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(`${lender?.type || ''}   ${lender?.contact || ''}`, margin + 5, curY + 19);

  // Borrowing Card
  drawCard(margin + halfCardW + 6, curY, halfCardW, 26);
  drawKV(margin + halfCardW + 11, curY + 7, 'Borrowing Details', borrowing.name);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(`${borrowing.type === 'FIXED' ? 'Fixed Installment' : 'Open-Ended'}   Status: ${borrowing.status}`, margin + halfCardW + 11, curY + 19);

  curY += 32;

  const totalPaid = computeBorrowingTotalPaid(borrowing, data.borrowingPayments || []);
  const payable = computeBorrowingPayable(borrowing, data.borrowingPayments || []);

  const metrics = [
    ['Borrowed', formatRsPlain(borrowing.amount), false],
    ['Installment', borrowing.type === 'FIXED' ? formatRsPlain(borrowing.installmentAmount) : '--', true],
    ['Total Paid', formatRsPlain(totalPaid), false],
    ['Total Payable', formatRsPlain(payable), true],
  ];

  const col4W = (pw - margin * 2 - 18) / 4;
  metrics.forEach((m, idx) => {
    const x = margin + idx * (col4W + 6);
    drawCard(x, curY, col4W, 17);
    drawKV(x + 4, curY + 6.5, m[0] as string, m[1] as string, m[2] as boolean);
  });

  curY += 24;

  const tableBody = payments.map(p => [
    formatDateDisplay(p.date),
    p.paymentMode || '—',
    formatRsPlain(p.amount),
    p.notes || '—',
    p.status === 'VOIDED' ? 'Voided' : 'Valid',
  ]);

  autoTable(doc, {
    startY: curY,
    head: [['Date', 'Mode', 'Amount Paid', 'Notes', 'Status']],
    body: tableBody,
    foot: [['', 'Total', formatRsPlain(totalPaid), '', '']],
    theme: 'plain',
    styles: {
      fontSize: 8,
      cellPadding: { top: 2.2, bottom: 2.2, left: 2.6, right: 2.6 },
      textColor: textDark as any,
      lineColor: borderLight as any,
      lineWidth: 0,
    },
    headStyles: {
      fillColor: brandDark as any,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    footStyles: {
      fillColor: [237, 241, 247] as any,
      textColor: textDark as any,
      fontStyle: 'bold',
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 26 },
      1: { cellWidth: 28 },
      2: { halign: 'right', cellWidth: 30 },
      4: { halign: 'center', cellWidth: 20 },
    },
    margin: { top: headerHeight + 8, left: margin, right: margin, bottom: footerHeight + 4 },
    didDrawPage: () => {
      drawHeader();
      drawFooter();
    },
  });

  const safeFilename = `${lender?.name || 'Lender'}_${borrowing.name}`.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');
  doc.save(`${safeFilename}_Borrowing_Statement.pdf`);
}

export async function generateBusinessReportPDF(
  data: AppData,
  monthISO: string
): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 14;
  const brandDark = [17, 33, 61];
  const brandTeal = [13, 148, 136];
  const borderLight = [222, 228, 238];
  const textMuted = [108, 120, 138];
  const textDark = [28, 36, 50];
  const headerHeight = 26;
  const footerHeight = 16;

  const getPageWidth = () => doc.internal.pageSize.getWidth();
  const getPageHeight = () => doc.internal.pageSize.getHeight();

  function drawHeader() {
    const w = getPageWidth();
    doc.setFillColor(brandDark[0], brandDark[1], brandDark[2]);
    doc.rect(0, 0, w, headerHeight, 'F');
    doc.setFillColor(brandTeal[0], brandTeal[1], brandTeal[2]);
    doc.rect(0, headerHeight - 1.2, w, 1.2, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(String(data.settings?.lenderName || 'PayBack'), margin, 12.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(178, 196, 222);
    doc.text(`Monthly Business & Portfolio Report (${monthISO})`, margin, 19);

    doc.setFontSize(8);
    doc.text(`Generated: ${formatDateDisplay(getTodayISO())}`, w - margin, 12.5, { align: 'right' });
    doc.text('Master Financial Report', w - margin, 19, { align: 'right' });
  }

  function drawFooter() {
    const w = getPageWidth();
    const h = getPageHeight();
    const pageNum = (doc as any).internal.getNumberOfPages ? (doc as any).internal.getNumberOfPages() : 1;

    doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
    doc.setLineWidth(0.3);
    doc.line(margin, h - footerHeight + 4, w - margin, h - footerHeight + 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text('Confidential Master Business Report — PayBack Financials', margin, h - footerHeight + 9);
    doc.text(`Page ${pageNum}`, w - margin, h - footerHeight + 9, { align: 'right' });
  }

  function drawCard(x: number, y: number, w: number, h: number) {
    doc.setFillColor(247, 249, 252);
    doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, w, h, 1.6, 1.6, 'FD');
  }

  function drawKV(x: number, y: number, label: string, value: string, isHighlight = false) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(String(label).toUpperCase(), x, y);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    if (isHighlight) {
      doc.setTextColor(brandTeal[0], brandTeal[1], brandTeal[2]);
    } else {
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    }
    doc.text(String(value), x, y + 5.2);
  }

  drawHeader();

  let curY = headerHeight + 10;
  const pw = getPageWidth();

  // Summary Metrics
  const activeLoans = (data.loans || []).filter(
    l => l.status === 'ACTIVE' || l.status === 'OVERDUE' || l.status === 'PARTIALLY_SETTLED'
  );
  const totalOutstanding = activeLoans.reduce((sum, l) => sum + (Number(l.currentPrincipalBalance) || 0), 0);
  const totalCollectedThisMonth = (data.transactions || [])
    .filter(t => t.status === 'VALID' && t.date.startsWith(monthISO) && t.type === 'PAYMENT')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const interestThisMonth = (data.transactions || [])
    .filter(t => t.status === 'VALID' && t.date.startsWith(monthISO) && t.type === 'PAYMENT')
    .reduce((sum, t) => sum + (Number(t.appliedToInterest) || 0), 0);

  const col3W = (pw - margin * 2 - 12) / 3;
  const metrics = [
    ['Total Outstanding Portfolio', formatRsPlain(totalOutstanding), true],
    ['Total Collections This Month', formatRsPlain(totalCollectedThisMonth), false],
    ['Net Interest Earned', formatRsPlain(interestThisMonth), true],
  ];

  metrics.forEach((m, idx) => {
    const x = margin + idx * (col3W + 6);
    drawCard(x, curY, col3W, 18);
    drawKV(x + 4, curY + 6.5, m[0] as string, m[1] as string, m[2] as boolean);
  });

  curY += 26;

  // Active Loans Table
  const tableBody = activeLoans.map(loan => {
    const cust = (data.customers || []).find(c => c.id === loan.customerId);
    return [
      cust?.name || '—',
      loan.loanName || loan.type,
      formatDateDisplay(loan.startDate),
      formatDateDisplay(loan.nextDueDate),
      `${loan.interestRateEntered ?? loan.interestRate}%`,
      formatRsPlain(loan.currentPrincipalBalance),
    ];
  });

  autoTable(doc, {
    startY: curY,
    head: [['Client Name', 'Loan Type', 'Disbursed', 'Next Due', 'Rate', 'Current Balance']],
    body: tableBody,
    foot: [['', '', '', '', 'Total Portfolio', formatRsPlain(totalOutstanding)]],
    theme: 'plain',
    styles: {
      fontSize: 8,
      cellPadding: { top: 2.2, bottom: 2.2, left: 2.6, right: 2.6 },
      textColor: textDark as any,
      lineColor: borderLight as any,
      lineWidth: 0,
    },
    headStyles: {
      fillColor: brandDark as any,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    footStyles: {
      fillColor: [237, 241, 247] as any,
      textColor: textDark as any,
      fontStyle: 'bold',
      fontSize: 8,
    },
    columnStyles: {
      5: { halign: 'right' },
    },
    margin: { top: headerHeight + 8, left: margin, right: margin, bottom: footerHeight + 4 },
    didDrawPage: () => {
      drawHeader();
      drawFooter();
    },
  });

  doc.save(`PayBack_Financial_Report_${monthISO}.pdf`);
}


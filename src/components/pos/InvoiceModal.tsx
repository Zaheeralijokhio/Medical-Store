/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import {
  Printer,
  Download,
  X,
  CheckCircle2,
  Pill,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { Sale, StoreSettings } from '../../types/pharmacy';
import { formatPKR } from '../../utils/helpers';

interface InvoiceModalProps {
  sale: Sale | null;
  settings: StoreSettings;
  isOpen: boolean;
  onClose: () => void;
}

export type ReceiptPrintFormat = '58mm' | '80mm' | 'A4';

const BARCODE_WEIGHTS = [3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 2, 4, 1, 2, 3, 1, 2, 4, 1, 3];

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  sale,
  settings,
  isOpen,
  onClose,
}) => {
  const [printFormat, setPrintFormat] = useState<ReceiptPrintFormat>('80mm');
  const printContainerRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !sale) return null;

  const storeName = String(settings?.storeName || 'PharmaCare Medical & General Store').trim();
  const storeTagline = String(settings?.storeTagline || 'Registered Retail & Clinical Pharmacy').trim();
  const addressParts = [settings?.storeAddress?.trim(), settings?.city?.trim()].filter(Boolean);
  const fullAddress = addressParts.join(', ');

  const regulatoryParts = [
    settings?.phone?.trim() ? `Ph: ${settings.phone.trim()}` : '',
    settings?.drugLicenseNumber?.trim() ? `DRAP: ${settings.drugLicenseNumber.trim()}` : '',
    settings?.taxRegistrationNumber?.trim() ? `NTN: ${settings.taxRegistrationNumber.trim()}` : '',
  ].filter(Boolean);

  const saleItems = Array.isArray(sale.items) ? sale.items : [];
  const invoiceHeaderLabel = String(settings?.invoiceHeader || 'COMPUTERIZED PHARMACY CASH MEMO').trim();
  const invoiceFooterText = String(
    settings?.invoiceFooter ||
      'Medicines once sold will not be returned without cash memo within 7 days. Cold chain products & cut strips non-returnable.'
  ).trim();

  const formatMoneyPlain = (val: number) =>
    Number(val || 0).toLocaleString('en-PK', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadRealPDF = () => {
    const isThermal58 = printFormat === '58mm';
    const isThermal80 = printFormat === '80mm';
    const isA4 = printFormat === 'A4';
    const pageWidth = isThermal58 ? 58 : isThermal80 ? 80 : 210;
    const margin = isThermal58 ? 3.5 : isThermal80 ? 5 : 14;
    const contentWidth = pageWidth - margin * 2;

    const renderPdfContent = (doc: jsPDF): number => {
      let y = 0;

      // Top Brand Accent Bar (Botanical Obsidian + Clinical Emerald)
      const topBarH = isA4 ? 5 : 3;
      doc.setFillColor(11, 25, 30); // #0B191E
      doc.rect(0, 0, pageWidth, topBarH, 'F');
      doc.setFillColor(15, 118, 110); // #0F766E
      doc.rect(0, topBarH, pageWidth, 1.1, 'F');

      y = topBarH + (isA4 ? 8 : 5.5);

      // Store Name (Wrapped cleanly — never clipped horizontally)
      doc.setTextColor(11, 25, 30);
      doc.setFont('helvetica', 'bold');
      const titleFontSize = isA4 ? 16 : isThermal58 ? 9.5 : 11;
      doc.setFontSize(titleFontSize);
      const titleLines: string[] = doc.splitTextToSize(storeName.toUpperCase(), contentWidth);
      const titleLineStep = isA4 ? 6.2 : isThermal58 ? 3.8 : 4.4;
      titleLines.forEach(line => {
        doc.text(line, pageWidth / 2, y, { align: 'center' });
        y += titleLineStep;
      });

      // Tagline & Address
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85); // slate-700 crisp contrast
      const subFontSize = isA4 ? 9 : isThermal58 ? 6.4 : 7.2;
      doc.setFontSize(subFontSize);
      const subLineStep = isA4 ? 4.2 : 3.3;

      if (storeTagline) {
        const tagLines: string[] = doc.splitTextToSize(storeTagline, contentWidth);
        tagLines.forEach(line => {
          doc.text(line, pageWidth / 2, y, { align: 'center' });
          y += subLineStep;
        });
      }

      if (fullAddress) {
        const addrLines: string[] = doc.splitTextToSize(fullAddress, contentWidth);
        addrLines.forEach(line => {
          doc.text(line, pageWidth / 2, y, { align: 'center' });
          y += subLineStep;
        });
      }

      if (regulatoryParts.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(isA4 ? 8 : isThermal58 ? 5.9 : 6.6);
        const regLines: string[] = doc.splitTextToSize(regulatoryParts.join('  |  '), contentWidth);
        regLines.forEach(line => {
          doc.text(line, pageWidth / 2, y, { align: 'center' });
          y += isA4 ? 3.8 : 3.0;
        });
      }

      y += 1.5;

      // Cash Memo Banner Strip
      const bannerH = isA4 ? 8 : 6.2;
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(15, 118, 110);
      doc.setLineWidth(0.35);
      doc.rect(margin, y, contentWidth, bannerH, 'FD');

      doc.setTextColor(15, 118, 110);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(isA4 ? 9.5 : isThermal58 ? 6.2 : 7.2);
      doc.text(invoiceHeaderLabel.toUpperCase(), margin + 2.5, y + bannerH / 2 + 1.1);

      const statusText = String(sale.status || 'completed').toUpperCase();
      doc.setTextColor(11, 25, 30);
      doc.text(statusText, pageWidth - margin - 2.5, y + bannerH / 2 + 1.1, { align: 'right' });

      y += bannerH + 3.5;

      // Meta & Customer Details Box
      const metaPadding = isA4 ? 3.5 : 2.2;
      const metaFontSize = isA4 ? 8.8 : isThermal58 ? 6.3 : 7.2;
      const metaLineStep = isA4 ? 4.3 : 3.3;

      const customerLabel = `${sale.customerName || 'Walk-in Customer'}${
        sale.customerPhone ? ` (${sale.customerPhone})` : ''
      }`;
      const customerLines: string[] = doc.splitTextToSize(
        `Customer: ${customerLabel}`,
        isA4 ? contentWidth * 0.55 : contentWidth - metaPadding * 2
      );

      if (isA4) {
        const boxH = Math.max(metaPadding * 2 + 3 * metaLineStep, metaPadding * 2 + customerLines.length * metaLineStep + 5);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.25);
        doc.rect(margin, y, contentWidth, boxH, 'FD');

        let ly = y + metaPadding + 2.8;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(11, 25, 30);
        doc.text(`INVOICE #${sale.invoiceNumber || ''}`, margin + metaPadding, ly);
        ly += 4.8;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(metaFontSize);
        doc.setTextColor(30, 41, 59);
        customerLines.forEach(line => {
          doc.text(line, margin + metaPadding, ly);
          ly += metaLineStep;
        });

        let ry = y + metaPadding + 2.8;
        doc.text(`Date: ${sale.date || ''} ${sale.time || ''}`, pageWidth - margin - metaPadding, ry, { align: 'right' });
        ry += metaLineStep;
        doc.text(`Dispenser: ${sale.staffName || 'Cashier'}`, pageWidth - margin - metaPadding, ry, { align: 'right' });
        ry += metaLineStep;
        doc.text(`Payment: ${sale.paymentMethod || 'Cash'}`, pageWidth - margin - metaPadding, ry, { align: 'right' });

        y += boxH + 4;
      } else {
        const metaLinesCount = 4 + customerLines.length;
        const boxH = metaPadding * 2 + metaLinesCount * metaLineStep + 0.5;
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.25);
        doc.rect(margin, y, contentWidth, boxH, 'FD');

        let my = y + metaPadding + 2.2;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(isThermal58 ? 7 : 8);
        doc.setTextColor(11, 25, 30);
        doc.text(`INVOICE: #${sale.invoiceNumber || ''}`, margin + metaPadding, my);
        my += metaLineStep + 0.3;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(metaFontSize);
        doc.setTextColor(30, 41, 59);
        doc.text(`Date: ${sale.date || ''} ${sale.time || ''}`, margin + metaPadding, my);
        my += metaLineStep;
        doc.text(`Dispenser: ${sale.staffName || 'Cashier'}`, margin + metaPadding, my);
        my += metaLineStep;
        customerLines.forEach(line => {
          doc.text(line, margin + metaPadding, my);
          my += metaLineStep;
        });
        doc.text(`Payment: ${sale.paymentMethod || 'Cash'}`, margin + metaPadding, my);

        y += boxH + 3;
      }

      // Items Table Header (Dark Obsidian Fill)
      const thHeight = isA4 ? 7 : 5.5;
      doc.setFillColor(11, 25, 30);
      doc.rect(margin, y, contentWidth, thHeight, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(isA4 ? 8.5 : isThermal58 ? 6.2 : 7);

      const colQtyX = margin + contentWidth * 0.58;
      const colRateX = margin + contentWidth * 0.77;
      const colTotalX = pageWidth - margin - 1.5;

      doc.text('Medicine / Batch', margin + 1.5, y + thHeight / 2 + 1);
      doc.text('Qty', colQtyX, y + thHeight / 2 + 1, { align: 'center' });
      doc.text('Rate', colRateX, y + thHeight / 2 + 1, { align: 'right' });
      doc.text('Total', colTotalX, y + thHeight / 2 + 1, { align: 'right' });

      y += thHeight + 3;

      // Items Rows
      const itemNameColWidth = contentWidth * 0.49;
      saleItems.forEach((item, idx) => {
        const titleText = `${idx + 1}. ${item.medicineName || 'Medicine'}`;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(isA4 ? 9 : isThermal58 ? 6.4 : 7.3);
        doc.setTextColor(15, 23, 42);
        const nameLines: string[] = doc.splitTextToSize(titleText, itemNameColWidth);

        doc.text(String(Number(item.quantity || 0)), colQtyX, y, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.text(formatMoneyPlain(Number(item.unitPrice || 0)), colRateX, y, { align: 'right' });
        doc.setFont('helvetica', 'bold');
        doc.text(formatMoneyPlain(Number(item.totalAmount || 0)), colTotalX, y, { align: 'right' });

        const itemStep = isA4 ? 4 : 3.2;
        nameLines.forEach(line => {
          doc.text(line, margin + 1.5, y);
          y += itemStep;
        });

        if (item.genericName) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(isA4 ? 7.8 : isThermal58 ? 5.6 : 6.2);
          doc.setTextColor(51, 65, 85);
          const genLines: string[] = doc.splitTextToSize(String(item.genericName), itemNameColWidth);
          genLines.forEach(line => {
            doc.text(line, margin + 2.5, y);
            y += isA4 ? 3.5 : 2.7;
          });
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(isA4 ? 7.6 : isThermal58 ? 5.5 : 6.1);
        doc.setTextColor(71, 85, 105);
        const batchLine = `Batch: ${item.batchNumber || '-'} | Exp: ${item.expiryDate || '-'}${
          Number(item.discountAmount || 0) > 0 ? ` | Disc: -Rs.${formatMoneyPlain(item.discountAmount)}` : ''
        }`;
        const batchWrapped: string[] = doc.splitTextToSize(batchLine, contentWidth - 4);
        batchWrapped.forEach(line => {
          doc.text(line, margin + 2.5, y);
          y += isA4 ? 3.5 : 2.7;
        });

        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.2);
        doc.line(margin, y, pageWidth - margin, y);
        y += isA4 ? 3.8 : 2.8;
      });

      y += 1.5;

      // Summary Totals Section
      const sumLeftX = isA4 ? margin + contentWidth * 0.45 : margin + 2;
      const sumRightX = pageWidth - margin - 2;
      const sumStep = isA4 ? 4.8 : 3.8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(isA4 ? 9 : isThermal58 ? 6.5 : 7.5);
      doc.setTextColor(30, 41, 59);
      doc.text('Subtotal:', sumLeftX, y);
      doc.text(formatPKR(sale.subtotal), sumRightX, y, { align: 'right' });
      y += sumStep;

      if (Number(sale.discountTotal || 0) > 0) {
        doc.setTextColor(15, 118, 110);
        doc.text('Discount:', sumLeftX, y);
        doc.text(`-${formatPKR(sale.discountTotal)}`, sumRightX, y, { align: 'right' });
        y += sumStep;
      }

      if (Number(sale.taxTotal || 0) > 0) {
        doc.setTextColor(30, 41, 59);
        doc.text(`Tax (${settings.taxRatePercentage}%):`, sumLeftX, y);
        doc.text(formatPKR(sale.taxTotal), sumRightX, y, { align: 'right' });
        y += sumStep;
      }

      // Highlighted NET TOTAL Box
      const netBoxH = isA4 ? 8.5 : 6.8;
      const netBoxX = isA4 ? margin + contentWidth * 0.42 : margin;
      const netBoxW = pageWidth - margin - netBoxX;
      doc.setFillColor(236, 253, 245); // emerald-50
      doc.setDrawColor(15, 118, 110);
      doc.setLineWidth(0.45);
      doc.rect(netBoxX, y - 1, netBoxW, netBoxH, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(isA4 ? 11 : isThermal58 ? 7.8 : 9);
      doc.setTextColor(11, 25, 30);
      doc.text('NET TOTAL:', netBoxX + 2.5, y + netBoxH / 2);
      doc.setTextColor(15, 118, 110);
      doc.text(formatPKR(sale.grandTotal), sumRightX, y + netBoxH / 2, { align: 'right' });
      y += netBoxH + 2.5;

      // Payment Settlement Details (High-contrast slate-900)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(isA4 ? 8.5 : isThermal58 ? 6.2 : 7.1);
      doc.setTextColor(30, 41, 59);

      if (sale.paymentMethod === 'Credit') {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(180, 83, 9);
        doc.text('Debited to Patient Credit Ledger Balance', sumRightX, y, { align: 'right' });
        y += sumStep;
      } else {
        doc.text('Amount Paid:', sumLeftX, y);
        doc.text(formatPKR(sale.amountPaid), sumRightX, y, { align: 'right' });
        y += sumStep;

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text('Change Returned:', sumLeftX, y);
        doc.text(formatPKR(sale.changeGiven), sumRightX, y, { align: 'right' });
        y += sumStep + 1;
      }

      // Vector Barcode + Invoice Verification Strip
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.25);
      doc.line(margin, y, pageWidth - margin, y);
      y += 3.5;

      const barUnit = isA4 ? 0.85 : isThermal58 ? 0.52 : 0.65;
      const totalBarcodeW = BARCODE_WEIGHTS.reduce((acc, w) => acc + w * barUnit + 0.4, 0);
      let bx = isA4 ? margin + 2 : (pageWidth - totalBarcodeW) / 2;
      const barH = isA4 ? 7 : 5;

      doc.setFillColor(15, 23, 42);
      BARCODE_WEIGHTS.forEach((w, idx) => {
        const bw = w * barUnit;
        if (idx % 2 === 0) {
          doc.rect(bx, y, bw, barH, 'F');
        }
        bx += bw + 0.4;
      });

      if (isA4) {
        // Pharmacist Stamp Box on A4 right side
        doc.setDrawColor(100, 116, 139);
        doc.line(pageWidth - margin - 45, y + barH + 1, pageWidth - margin, y + barH + 1);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(51, 65, 85);
        doc.text('PHARMACIST SIGNATURE & STAMP', pageWidth - margin - 22.5, y + barH + 4.5, { align: 'center' });
      }

      y += barH + 3.2;
      doc.setFont('courier', 'bold');
      doc.setFontSize(isA4 ? 7.5 : 6);
      doc.setTextColor(51, 65, 85);
      doc.text(`*${sale.invoiceNumber}*`, isA4 ? margin + totalBarcodeW / 2 + 2 : pageWidth / 2, y, {
        align: 'center',
      });
      y += isA4 ? 6 : 4.2;

      // Return Policy Footer
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, y, pageWidth - margin, y);
      y += 3.5;

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(isA4 ? 8 : isThermal58 ? 5.6 : 6.3);
      doc.setTextColor(51, 65, 85);
      const footerLines: string[] = doc.splitTextToSize(invoiceFooterText, contentWidth);
      footerLines.forEach(line => {
        doc.text(line, pageWidth / 2, y, { align: 'center' });
        y += isA4 ? 3.8 : 2.9;
      });

      y += 1.5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(isA4 ? 7.5 : 5.6);
      doc.setTextColor(15, 118, 110);
      doc.text('Thank you for trusting our pharmacy with your care.', pageWidth / 2, y, {
        align: 'center',
      });
      y += 4;

      return y;
    };

    // Pass 1: Measure exact content height so thermal PDFs never cut off top or bottom
    const measureDoc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: isA4 ? 'a4' : [pageWidth, 500],
    });
    const exactHeight = renderPdfContent(measureDoc);

    // Pass 2: Generate crisp final PDF sized accurately
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: isA4 ? 'a4' : [pageWidth, Math.max(135, exactHeight + 4)],
    });
    renderPdfContent(doc);
    doc.save(`${sale.invoiceNumber}.pdf`);
  };

  return (
    <div className="print-invoice-modal fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:static print:bg-white print:p-0">
      <div
        className={`relative w-full ${
          printFormat === 'A4' ? 'max-w-3xl' : 'max-w-2xl'
        } max-h-[92vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 transition-all print:max-h-none print:shadow-none print:border-none print:rounded-none print:block`}
      >
        {/* Action Header Bar (Always Pinned & Never Cut Off) */}
        <div className="no-print shrink-0 px-4 py-3 bg-[#0B191E] text-white flex flex-wrap items-center justify-between gap-2.5 border-b border-emerald-500/25">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm text-white truncate">
                Sale: {sale.invoiceNumber}
              </h3>
              <p className="text-[11px] text-emerald-200/80 truncate">
                FEFO Stock Deducted • Thermal &amp; A4 Receipt
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 ml-auto">
            {/* Print Format Tabs */}
            <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
              {(['58mm', '80mm', 'A4'] as ReceiptPrintFormat[]).map(fmt => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setPrintFormat(fmt)}
                  className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${
                    printFormat === fmt
                      ? 'bg-emerald-500 text-[#0B191E] shadow-xs'
                      : 'text-slate-200 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {fmt === 'A4' ? 'A4 Page' : `${fmt} Thermal`}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handlePrint}
              className="min-h-[36px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#0B191E] font-bold text-xs shadow-xs whitespace-nowrap transition-colors"
            >
              <Printer className="w-4 h-4 shrink-0" />
              <span>Print</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadRealPDF}
              className="min-h-[36px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs border border-white/15 whitespace-nowrap transition-colors"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>Download PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close receipt preview"
              className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Receipt Preview Stage */}
        <div className="flex-1 overflow-y-auto bg-slate-100/90 p-3 sm:p-6 print:p-0 print:bg-white print:overflow-visible">
          {/* The Printable Invoice Paper Sheet */}
          <div
            ref={printContainerRef}
            className={`print-invoice-paper bg-white text-slate-950 mx-auto rounded-xl border border-slate-200 shadow-md overflow-hidden print:m-0 print:border-none print:shadow-none print:rounded-none ${
              printFormat === '58mm'
                ? 'max-w-[300px] text-[11px] font-mono leading-snug'
                : printFormat === '80mm'
                ? 'max-w-[390px] text-xs font-mono leading-snug'
                : 'max-w-2xl text-xs font-sans leading-normal'
            }`}
          >
            {/* Crisp Clinical Top Accent Strip */}
            <div className="h-1.5 bg-gradient-to-r from-[#0B191E] via-[#0F766E] to-emerald-500" />

            <div className={printFormat === '58mm' ? 'p-3.5' : printFormat === '80mm' ? 'p-5' : 'p-6 sm:p-8'}>
              {/* Pharmacy Header */}
              <div className="text-center pb-3 border-b-2 border-slate-900">
                <div className="inline-flex items-center gap-2 justify-center mb-1">
                  <div className="w-6 h-6 rounded-md bg-[#0B191E] text-emerald-400 flex items-center justify-center shrink-0">
                    <Pill className="w-3.5 h-3.5" />
                  </div>
                  <h1
                    className={`font-black tracking-tight text-slate-950 uppercase break-words ${
                      printFormat === '58mm'
                        ? 'text-sm'
                        : printFormat === '80mm'
                        ? 'text-base'
                        : 'text-lg sm:text-xl'
                    }`}
                  >
                    {storeName}
                  </h1>
                </div>

                {storeTagline && (
                  <p className="text-[11px] font-semibold text-slate-700 mt-0.5">
                    {storeTagline}
                  </p>
                )}

                {fullAddress && (
                  <p className="text-[10.5px] text-slate-700 mt-0.5">
                    {fullAddress}
                  </p>
                )}

                {regulatoryParts.length > 0 && (
                  <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-[10px] font-semibold text-slate-800 mt-1.5 font-mono">
                    {regulatoryParts.map((part, i) => (
                      <React.Fragment key={part}>
                        {i > 0 && <span className="text-slate-400">•</span>}
                        <span>{part}</span>
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>

              {/* Memo Title & Meta Details */}
              <div className="py-2.5 border-b border-dashed border-slate-400 space-y-2 text-[11px]">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-100 border border-slate-300 rounded-lg px-2.5 py-1.5">
                  <div>
                    <span className="font-extrabold text-[#0F766E] uppercase tracking-wide block text-[10px]">
                      {invoiceHeaderLabel}
                    </span>
                    <span className="font-mono font-black text-slate-950 text-xs">
                      #{sale.invoiceNumber}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-[10px] uppercase">
                    {sale.status || 'COMPLETED'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] text-slate-800">
                  <div>
                    <span className="font-semibold text-slate-600">Date: </span>
                    <span className="font-semibold text-slate-950 tabular-nums">
                      {sale.date} {sale.time}
                    </span>
                  </div>
                  <div className="sm:text-right">
                    <span className="font-semibold text-slate-600">Dispenser: </span>
                    <span className="font-bold text-slate-950">{sale.staffName || 'Cashier'}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-600">Patient: </span>
                    <span className="font-bold text-slate-950">
                      {sale.customerName || 'Walk-in Customer'}
                    </span>
                    {sale.customerPhone && (
                      <span className="text-slate-700 ml-1 text-[10px]">({sale.customerPhone})</span>
                    )}
                  </div>
                  <div className="sm:text-right">
                    <span className="font-semibold text-slate-600">Payment: </span>
                    <span className="font-bold text-slate-950">{sale.paymentMethod || 'Cash'}</span>
                  </div>
                </div>
              </div>

              {/* Items Table (High Contrast, Full Visible Details) */}
              <div className="my-3 overflow-x-auto">
                <table className="w-full text-[11px] text-left border-collapse">
                  <thead>
                    <tr className="bg-[#0B191E] text-white text-[10px] font-bold uppercase tracking-wider">
                      <th className="py-1.5 px-2 rounded-tl-md">Item / Batch</th>
                      <th className="py-1.5 px-1.5 text-center">Qty</th>
                      <th className="py-1.5 px-1.5 text-right">Rate</th>
                      <th className="py-1.5 px-2 text-right rounded-tr-md">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 tabular-nums">
                    {saleItems.map((item, idx) => (
                      <tr key={idx} className="align-top">
                        <td className="py-2 px-1.5 pr-2">
                          <span className="font-bold text-slate-950 block break-words">
                            {idx + 1}. {item.medicineName || 'Medicine'}
                          </span>
                          {item.genericName && (
                            <span className="text-[10px] text-slate-700 block break-words">
                              {item.genericName}
                            </span>
                          )}
                          <span className="text-[9.5px] font-mono text-slate-700 block mt-0.5">
                            Batch: <strong className="text-slate-900">{item.batchNumber || '-'}</strong>
                            {item.expiryDate ? ` • Exp: ${item.expiryDate}` : ''}
                            {Number(item.discountAmount || 0) > 0
                              ? ` • Disc: -Rs.${formatMoneyPlain(item.discountAmount)}`
                              : ''}
                          </span>
                        </td>
                        <td className="py-2 px-1.5 text-center font-bold text-slate-950">
                          {Number(item.quantity || 0)}
                        </td>
                        <td className="py-2 px-1.5 text-right font-mono text-slate-800">
                          {formatMoneyPlain(Number(item.unitPrice || 0))}
                        </td>
                        <td className="py-2 px-1.5 text-right font-mono font-bold text-slate-950">
                          {formatMoneyPlain(Number(item.totalAmount || 0))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals & Settlement Block */}
              <div className="border-t-2 border-slate-900 pt-2.5 flex justify-end">
                <div className={`${printFormat === '58mm' ? 'w-full' : 'w-full sm:w-64'} space-y-1.5 text-[11px] text-slate-900 tabular-nums`}>
                  <div className="flex justify-between">
                    <span className="font-semibold text-slate-700">Subtotal:</span>
                    <span className="font-mono font-semibold text-slate-950">{formatPKR(sale.subtotal)}</span>
                  </div>

                  {Number(sale.discountTotal || 0) > 0 && (
                    <div className="flex justify-between text-[#0F766E] font-semibold">
                      <span>Discount:</span>
                      <span className="font-mono">-{formatPKR(sale.discountTotal)}</span>
                    </div>
                  )}

                  {Number(sale.taxTotal || 0) > 0 && (
                    <div className="flex justify-between">
                      <span className="font-semibold text-slate-700">Tax ({settings.taxRatePercentage}%):</span>
                      <span className="font-mono font-semibold text-slate-950">{formatPKR(sale.taxTotal)}</span>
                    </div>
                  )}

                  <div className="p-2 rounded-lg bg-emerald-50 border-2 border-[#0F766E] flex justify-between items-center font-black text-slate-950">
                    <span className="text-xs">NET TOTAL:</span>
                    <span className="font-mono text-sm text-[#0F766E]">{formatPKR(sale.grandTotal)}</span>
                  </div>

                  {sale.paymentMethod === 'Credit' ? (
                    <div className="text-[10.5px] text-amber-800 font-bold text-right pt-1">
                      Debited to Patient Credit Ledger Balance
                    </div>
                  ) : (
                    <div className="pt-1 space-y-1 border-t border-slate-300 text-[11px]">
                      <div className="flex justify-between text-slate-800">
                        <span className="font-semibold">Amount Paid:</span>
                        <span className="font-mono font-bold text-slate-950">{formatPKR(sale.amountPaid)}</span>
                      </div>
                      <div className="flex justify-between text-slate-950 font-bold">
                        <span>Change Returned:</span>
                        <span className="font-mono">{formatPKR(sale.changeGiven)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Barcode & Pharmacist Stamp */}
              <div className="mt-5 pt-3 border-t border-dashed border-slate-400 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                <div className="inline-block px-2 py-1.5 bg-white border border-slate-300 rounded-md">
                  <div className="h-6 w-36 flex items-stretch gap-0.5 justify-center">
                    {BARCODE_WEIGHTS.map((w, i) => (
                      <div
                        key={i}
                        style={{ width: `${w * 1.2}px` }}
                        className={`h-full ${i % 2 === 0 ? 'bg-slate-950' : 'bg-transparent'}`}
                      />
                    ))}
                  </div>
                  <p className="text-[9px] font-mono font-bold tracking-widest text-slate-800 text-center mt-1">
                    *{sale.invoiceNumber}*
                  </p>
                </div>

                <div className="text-center sm:text-right">
                  <div className="h-6 border-b border-slate-600 w-36 mx-auto sm:ml-auto" />
                  <p className="text-[9.5px] text-slate-800 uppercase tracking-wider mt-1 font-bold">
                    Pharmacist Signature &amp; Stamp
                  </p>
                </div>
              </div>

              {/* Return Policy Notice */}
              <div className="mt-3 pt-2.5 text-center text-[10px] text-slate-700 border-t border-slate-200 space-y-1">
                <p className="italic">{invoiceFooterText}</p>
                <p className="font-bold text-[#0F766E] text-[10px]">
                  Thank you for trusting {storeName} with your health!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions (Always Visible & Pinned) */}
        <div className="no-print shrink-0 px-4 py-3 bg-white border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-2">
          <span className="text-xs text-slate-600 font-medium text-center sm:text-left">
            Print &amp; PDF ready for 58mm / 80mm thermal or standard A4 paper
          </span>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto min-h-[40px] px-5 py-2 rounded-xl bg-[#0B191E] hover:bg-[#112A32] text-white text-xs font-bold transition-colors"
          >
            Done &amp; Next Customer
          </button>
        </div>
      </div>
    </div>
  );
};

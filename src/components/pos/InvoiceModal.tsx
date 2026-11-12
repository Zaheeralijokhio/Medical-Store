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
  Phone,
  MapPin,
  Calendar,
  Clock,
  User,
  ShieldCheck,
  Receipt,
  FileText,
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

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  sale,
  settings,
  isOpen,
  onClose,
}) => {
  const [printFormat, setPrintFormat] = useState<ReceiptPrintFormat>('80mm');
  const printContainerRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !sale) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadRealPDF = () => {
    const isThermal58 = printFormat === '58mm';
    const isThermal80 = printFormat === '80mm';
    const pageWidth = isThermal58 ? 58 : isThermal80 ? 80 : 210;
    const estimatedHeight = Math.max(160, 110 + sale.items.length * 12);

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: printFormat === 'A4' ? 'a4' : [pageWidth, estimatedHeight],
    });

    const margin = isThermal58 ? 4 : isThermal80 ? 5 : 15;
    const contentWidth = pageWidth - margin * 2;
    let y = margin + 4;

    // Store Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(printFormat === 'A4' ? 16 : isThermal58 ? 10 : 12);
    doc.text(settings.storeName.toUpperCase(), pageWidth / 2, y, { align: 'center' });
    y += printFormat === 'A4' ? 6 : 4.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(printFormat === 'A4' ? 9 : 7);
    doc.text(settings.storeTagline || 'Registered Retail & Clinical Pharmacy', pageWidth / 2, y, { align: 'center' });
    y += 4;
    doc.text(`${settings.storeAddress}, ${settings.city}`, pageWidth / 2, y, { align: 'center' });
    y += 4;
    doc.text(`Ph: ${settings.phone} | DRAP: ${settings.drugLicenseNumber}`, pageWidth / 2, y, { align: 'center' });
    y += 3.5;
    doc.text(`NTN: ${settings.taxRegistrationNumber}`, pageWidth / 2, y, { align: 'center' });
    y += 3;

    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 4.5;

    // Invoice Meta
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(printFormat === 'A4' ? 10 : 7.5);
    doc.text(`INVOICE: #${sale.invoiceNumber}`, margin, y);
    y += 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(printFormat === 'A4' ? 9 : 7);
    doc.text(`Date & Time: ${sale.date} ${sale.time}`, margin, y);
    y += 3.8;
    doc.text(`Dispenser: ${sale.staffName}`, margin, y);
    y += 3.8;
    doc.text(
      `Customer: ${sale.customerName}${sale.customerPhone ? ` (${sale.customerPhone})` : ''}`,
      margin,
      y
    );
    y += 3.8;
    doc.text(`Payment Method: ${sale.paymentMethod} | Status: ${sale.status.toUpperCase()}`, margin, y);
    y += 3.5;

    doc.line(margin, y, pageWidth - margin, y);
    y += 4;

    // Table Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(printFormat === 'A4' ? 9 : 7);
    doc.text('Medicine / Batch', margin, y);
    doc.text('Qty', margin + contentWidth * 0.58, y, { align: 'center' });
    doc.text('Rate', margin + contentWidth * 0.76, y, { align: 'right' });
    doc.text('Total', pageWidth - margin, y, { align: 'right' });
    y += 2.5;
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;

    // Items
    doc.setFont('helvetica', 'normal');
    sale.items.forEach((item, idx) => {
      const itemTitle = `${idx + 1}. ${item.medicineName}`;
      doc.setFont('helvetica', 'bold');
      doc.text(itemTitle.substring(0, isThermal58 ? 20 : 34), margin, y);
      doc.setFont('helvetica', 'normal');
      doc.text(String(item.quantity), margin + contentWidth * 0.58, y, { align: 'center' });
      doc.text(item.unitPrice.toFixed(0), margin + contentWidth * 0.76, y, { align: 'right' });
      doc.text(item.totalAmount.toFixed(0), pageWidth - margin, y, { align: 'right' });
      y += 3.5;

      doc.setFontSize(printFormat === 'A4' ? 7.5 : 6);
      doc.text(
        `   Batch: ${item.batchNumber} | Exp: ${item.expiryDate}${
          item.discountAmount > 0 ? ` | Disc: -Rs.${item.discountAmount}` : ''
        }`,
        margin,
        y
      );
      doc.setFontSize(printFormat === 'A4' ? 9 : 7);
      y += 4.2;
    });

    doc.line(margin, y, pageWidth - margin, y);
    y += 4.5;

    // Summary Totals
    doc.setFont('helvetica', 'normal');
    doc.text('Subtotal:', margin + contentWidth * 0.35, y);
    doc.text(formatPKR(sale.subtotal), pageWidth - margin, y, { align: 'right' });
    y += 4;

    if (sale.discountTotal > 0) {
      doc.text('Discount:', margin + contentWidth * 0.35, y);
      doc.text(`-${formatPKR(sale.discountTotal)}`, pageWidth - margin, y, { align: 'right' });
      y += 4;
    }

    if (sale.taxTotal > 0) {
      doc.text(`Tax (${settings.taxRatePercentage}%):`, margin + contentWidth * 0.35, y);
      doc.text(formatPKR(sale.taxTotal), pageWidth - margin, y, { align: 'right' });
      y += 4;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(printFormat === 'A4' ? 11 : 8.5);
    doc.text('NET TOTAL:', margin + contentWidth * 0.35, y);
    doc.text(formatPKR(sale.grandTotal), pageWidth - margin, y, { align: 'right' });
    y += 4.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(printFormat === 'A4' ? 8.5 : 7);
    doc.text('Amount Paid:', margin + contentWidth * 0.35, y);
    doc.text(formatPKR(sale.amountPaid), pageWidth - margin, y, { align: 'right' });
    y += 3.8;

    doc.text('Change Returned:', margin + contentWidth * 0.35, y);
    doc.text(formatPKR(sale.changeGiven), pageWidth - margin, y, { align: 'right' });
    y += 5;

    doc.line(margin, y, pageWidth - margin, y);
    y += 4.5;

    doc.setFontSize(printFormat === 'A4' ? 8 : 6.5);
    doc.text(settings.invoiceFooter || 'Thank you for choosing our pharmacy!', pageWidth / 2, y, {
      align: 'center',
      maxWidth: contentWidth,
    });

    doc.save(`${sale.invoiceNumber}.pdf`);
  };

  return (
    <div className="print-invoice-modal fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 print:static print:bg-white print:p-0">
      <div className={`relative w-full ${printFormat === '58mm' ? 'max-w-sm' : printFormat === '80mm' ? 'max-w-md' : 'max-w-3xl'} bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 transition-all print:shadow-none print:border-none print:rounded-none`}>
        {/* Action Header bar (no-print) */}
        <div className="no-print p-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-teal-400 shrink-0" />
            <div>
              <h3 className="font-bold text-sm text-white">
                Sale: {sale.invoiceNumber}
              </h3>
              <p className="text-[11px] text-slate-300">
                FEFO Stock Deducted • Select Printer Format:
              </p>
            </div>
          </div>

          {/* Print Format Tabs */}
          <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700">
            <button
              type="button"
              onClick={() => setPrintFormat('58mm')}
              className={`px-2 py-1 rounded text-[11px] font-bold transition-all ${
                printFormat === '58mm'
                  ? 'bg-teal-500 text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              58mm Thermal
            </button>
            <button
              type="button"
              onClick={() => setPrintFormat('80mm')}
              className={`px-2 py-1 rounded text-[11px] font-bold transition-all ${
                printFormat === '80mm'
                  ? 'bg-teal-500 text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              80mm Thermal
            </button>
            <button
              type="button"
              onClick={() => setPrintFormat('A4')}
              className={`px-2 py-1 rounded text-[11px] font-bold transition-all ${
                printFormat === 'A4'
                  ? 'bg-teal-500 text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              A4 Standard
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold text-xs shadow-xs transition-colors"
            >
              <Printer className="w-4 h-4" /> Print
            </button>
            <button
              onClick={handleDownloadRealPDF}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-colors"
            >
              <Download className="w-4 h-4" /> Download PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* The Printable Invoice Container */}
        <div
          ref={printContainerRef}
          className={`bg-white text-slate-900 mx-auto print:m-0 print:p-0 ${
            printFormat === '58mm'
              ? 'p-4 max-w-[280px] text-[11px] font-mono leading-tight'
              : printFormat === '80mm'
              ? 'p-6 max-w-[360px] text-xs font-mono leading-tight'
              : 'p-6 sm:p-8 max-w-2xl font-sans'
          }`}
        >
          {/* Pharmacy Header */}
          <div className="text-center pb-3 border-b-2 border-slate-900">
            <div className="inline-flex items-center gap-2 justify-center mb-1">
              <div className="w-6 h-6 rounded bg-teal-700 text-white flex items-center justify-center font-bold">
                <Pill className="w-3.5 h-3.5" />
              </div>
              <h1 className="text-base sm:text-xl font-black tracking-tight text-slate-900 uppercase">
                {settings.storeName}
              </h1>
            </div>
            <p className="text-[10px] font-semibold text-slate-600">
              {settings.storeTagline}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {settings.storeAddress}, {settings.city}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 text-[9px] text-slate-600 mt-1 font-mono">
              <span>Ph: {settings.phone}</span>
              <span>•</span>
              <span>DRAP: {settings.drugLicenseNumber}</span>
              <span>•</span>
              <span>NTN: {settings.taxRegistrationNumber}</span>
            </div>
          </div>

          {/* Memo Title & Meta Details */}
          <div className="py-2.5 border-b border-dashed border-slate-300 flex flex-wrap items-center justify-between gap-1 text-[11px]">
            <div>
              <span className="font-bold text-slate-900 uppercase tracking-wide block">
                {settings.invoiceHeader}
              </span>
              <span className="font-mono font-bold text-teal-800 text-xs">
                #{sale.invoiceNumber}
              </span>
            </div>

            <div className="text-right text-[10px] text-slate-600 space-y-0.5">
              <div>
                <span className="font-semibold text-slate-700">Date:</span> {sale.date} {sale.time}
              </div>
              <div>
                <span className="font-semibold text-slate-700">Dispenser:</span> {sale.staffName}
              </div>
              <div>
                <span className="font-semibold text-slate-700">Payment:</span> {sale.paymentMethod}
              </div>
            </div>
          </div>

          {/* Customer Meta */}
          <div className="py-2 bg-slate-50 px-2.5 rounded border border-slate-100 my-2 flex items-center justify-between text-[11px]">
            <div>
              <span className="text-[9px] text-slate-400 uppercase font-bold block">Patient / Customer</span>
              <span className="font-bold text-slate-800">{sale.customerName}</span>
              {sale.customerPhone && (
                <span className="text-slate-500 ml-1.5 text-[10px]">({sale.customerPhone})</span>
              )}
            </div>
            <div className="text-right">
              <span className="text-[9px] text-slate-400 uppercase font-bold block">Status</span>
              <span className="font-bold text-emerald-700 uppercase">{sale.status}</span>
            </div>
          </div>

          {/* Items Table */}
          <table className="w-full text-[11px] text-left my-3 border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-800 text-[10px] font-bold uppercase text-slate-700 bg-slate-100">
                <th className="py-1.5 px-1.5">Item</th>
                <th className="py-1.5 px-1">Batch</th>
                <th className="py-1.5 px-1 text-center">Qty</th>
                <th className="py-1.5 px-1 text-right">Rate</th>
                <th className="py-1.5 px-1 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {sale.items.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="py-1.5 px-1.5">
                    <span className="font-bold text-slate-900 block truncate max-w-[120px] sm:max-w-none">{item.medicineName}</span>
                    <span className="text-[9px] text-slate-500 block truncate max-w-[120px] sm:max-w-none">{item.genericName}</span>
                  </td>
                  <td className="py-1.5 px-1 font-mono text-[10px] text-slate-700">
                    {item.batchNumber}
                  </td>
                  <td className="py-1.5 px-1 text-center font-bold text-slate-800">
                    {item.quantity}
                  </td>
                  <td className="py-1.5 px-1 text-right font-mono text-[10px]">
                    {item.unitPrice.toFixed(0)}
                  </td>
                  <td className="py-1.5 px-1 text-right font-mono font-bold text-slate-900">
                    {item.totalAmount.toFixed(0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals & Calculations */}
          <div className="border-t-2 border-slate-800 pt-2 flex justify-end">
            <div className="w-56 space-y-1 text-[11px] text-slate-700">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-mono">{formatPKR(sale.subtotal)}</span>
              </div>
              {sale.discountTotal > 0 && (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>Discount:</span>
                  <span className="font-mono">-{formatPKR(sale.discountTotal)}</span>
                </div>
              )}
              {sale.taxTotal > 0 && (
                <div className="flex justify-between">
                  <span>Tax ({settings.taxRatePercentage}%):</span>
                  <span className="font-mono">{formatPKR(sale.taxTotal)}</span>
                </div>
              )}
              <div className="border-t-2 border-slate-900 pt-1 flex justify-between text-xs font-black text-slate-950">
                <span>NET TOTAL:</span>
                <span className="font-mono text-sm text-teal-800">{formatPKR(sale.grandTotal)}</span>
              </div>

              {sale.paymentMethod === 'Cash' && (
                <>
                  <div className="flex justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-200">
                    <span>Cash Tendered:</span>
                    <span className="font-mono">{formatPKR(sale.amountPaid)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-bold text-slate-800">
                    <span>Change Returned:</span>
                    <span className="font-mono">{formatPKR(sale.changeGiven)}</span>
                  </div>
                </>
              )}

              {sale.paymentMethod === 'Credit' && (
                <div className="text-[10px] text-amber-700 font-bold text-right pt-1 border-t border-slate-200">
                  Debited to Patient Ledger Balance
                </div>
              )}
            </div>
          </div>

          {/* Barcode & Signature stamp */}
          <div className="mt-6 pt-3 border-t border-dashed border-slate-300 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div>
              {/* Simulated Code-128 Barcode Display */}
              <div className="inline-block p-1 bg-white border border-slate-200 rounded">
                <div className="h-6 w-36 flex items-stretch gap-0.5 justify-center">
                  {[3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 2, 4, 1, 2, 3, 1, 2, 4, 1, 3].map((w, i) => (
                    <div
                      key={i}
                      style={{ width: `${w * 1.2}px` }}
                      className={`h-full ${i % 2 === 0 ? 'bg-slate-900' : 'bg-transparent'}`}
                    />
                  ))}
                </div>
                <p className="text-[8px] font-mono tracking-widest text-slate-600 text-center mt-0.5">
                  *{sale.invoiceNumber}*
                </p>
              </div>
            </div>

            <div className="text-right">
              <div className="h-7 border-b border-slate-400 w-32 mx-auto sm:ml-auto"></div>
              <p className="text-[9px] text-slate-500 uppercase tracking-wider mt-0.5 font-semibold">
                Pharmacist Stamp
              </p>
            </div>
          </div>

          {/* Return Policy Notice */}
          <div className="mt-3 pt-2 text-center text-[9px] text-slate-500 italic border-t border-slate-100">
            {settings.invoiceFooter}
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="no-print p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
          <span className="text-xs text-slate-500">
            Print ready for 58mm / 80mm thermal or standard A4 printer
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors"
          >
            Done & Next Customer
          </button>
        </div>
      </div>
    </div>
  );
};

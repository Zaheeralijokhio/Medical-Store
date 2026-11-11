/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { bulkImportMedicines } = useStore();

  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [fileName, setFileName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null);

  if (!isOpen) return null;

  const handleDownloadSample = () => {
    const sampleHeaders = [
      'name',
      'genericName',
      'brandName',
      'category',
      'manufacturer',
      'medicineType',
      'strength',
      'packingSize',
      'barcode',
      'batchNumber',
      'purchasePrice',
      'salePrice',
      'quantity',
      'mfgDate',
      'expiryDate',
      'storageLocation',
    ].join(',');

    const sampleRow1 = [
      'Panadol Extra 500mg',
      'Paracetamol + Caffeine',
      'Panadol',
      'Analgesics & Antipyretics',
      'GlaxoSmithKline (GSK)',
      'Tablet',
      '500mg/65mg',
      'Box of 100 Tablets',
      '8964000109999',
      'PND-EX26',
      '4.20',
      '5.50',
      '200',
      '2025-01-01',
      '2028-01-01',
      'Rack A-1',
    ].join(',');

    const sampleRow2 = [
      'Cefiget 400mg',
      'Cefixime',
      'Cefiget',
      'Antibiotics',
      'Getz Pharma',
      'Capsule',
      '400mg',
      'Box of 5 Capsules',
      '8964000209998',
      'CFG-25M4',
      '65.00',
      '82.00',
      '50',
      '2025-02-15',
      '2027-08-30',
      'Rack B-2',
    ].join(',');

    const csvContent = `${sampleHeaders}\n${sampleRow1}\n${sampleRow2}\n`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'PharmaCare_Medicine_Bulk_Import_Sample.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = event => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r\n|\n/).filter(line => line.trim().length > 0);
      if (lines.length < 2) {
        alert('CSV must contain a header row and at least one data row.');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      const rows: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        // Basic CSV split
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const rowObj: Record<string, any> = {};
        headers.forEach((h, index) => {
          rowObj[h] = values[index] || '';
        });
        if (rowObj.name) {
          rows.push(rowObj);
        }
      }

      setParsedRows(rows);
    };

    reader.readAsText(file);
  };

  const handleConfirmImport = () => {
    if (parsedRows.length === 0) return;
    setIsProcessing(true);
    const res = bulkImportMedicines(parsedRows);
    setResult(res);
    setIsProcessing(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-teal-400" />
            <div>
              <h3 className="font-bold text-sm text-white">
                Bulk Import Medicines via CSV / Excel
              </h3>
              <p className="text-[11px] text-slate-300">
                Quickly populate store formulations, barcodes & initial opening batches
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto text-xs flex-1">
          {/* Step 1: Download Sample Template */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <div>
              <span className="font-bold text-slate-800 block">
                Step 1: Download Standard Template
              </span>
              <span className="text-[11px] text-slate-500">
                Pre-formatted CSV with required formulation and batch columns
              </span>
            </div>
            <button
              onClick={handleDownloadSample}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:border-teal-500 text-slate-700 font-semibold text-xs shadow-xs"
            >
              <Download className="w-3.5 h-3.5 text-teal-600" /> Download CSV
            </button>
          </div>

          {/* Step 2: Upload CSV */}
          <div className="p-4 border-2 border-dashed border-slate-300 rounded-xl text-center hover:border-teal-500 transition-colors">
            <Upload className="w-8 h-8 text-teal-600 mx-auto mb-2 opacity-80" />
            <p className="font-semibold text-slate-700 mb-1">
              Select or Drop your prepared CSV file
            </p>
            <p className="text-[11px] text-slate-400 mb-3">
              Supports standard CSV exported from Excel, Google Sheets, or legacy pharmacy POS
            </p>
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold cursor-pointer text-xs transition-colors">
              <FileText className="w-4 h-4" />
              <span>Browse CSV File</span>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            {fileName && (
              <p className="text-xs font-mono text-teal-800 mt-2 font-bold">
                Selected: {fileName} ({parsedRows.length} valid medicines detected)
              </p>
            )}
          </div>

          {/* Step 3: Preview */}
          {parsedRows.length > 0 && !result && (
            <div>
              <span className="font-bold text-slate-800 block mb-1">
                Data Preview ({parsedRows.length} rows):
              </span>
              <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg">
                <table className="w-full text-[11px] text-left">
                  <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0">
                    <tr>
                      <th className="p-1.5">Name</th>
                      <th className="p-1.5">Generic</th>
                      <th className="p-1.5">Batch</th>
                      <th className="p-1.5">Qty</th>
                      <th className="p-1.5">Sale (PKR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.slice(0, 10).map((r, i) => (
                      <tr key={i}>
                        <td className="p-1.5 font-bold">{r.name}</td>
                        <td className="p-1.5 text-slate-500">{r.genericName}</td>
                        <td className="p-1.5 font-mono">{r.batchNumber}</td>
                        <td className="p-1.5 font-bold">{r.quantity}</td>
                        <td className="p-1.5 font-mono">{r.salePrice}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Import Result Feedback */}
          {result && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-emerald-800 font-bold">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Successfully imported {result.imported} medicines into inventory!</span>
              </div>
              {result.errors.length > 0 && (
                <div className="text-rose-700 text-[11px] mt-1 space-y-0.5">
                  <span className="font-bold">Errors encountered in some rows:</span>
                  {result.errors.map((err, i) => (
                    <div key={i}>• {err}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs"
          >
            {result ? 'Done' : 'Cancel'}
          </button>
          {!result && parsedRows.length > 0 && (
            <button
              onClick={handleConfirmImport}
              disabled={isProcessing}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs shadow-xs"
            >
              {isProcessing ? 'Importing...' : `Import ${parsedRows.length} Medicines`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

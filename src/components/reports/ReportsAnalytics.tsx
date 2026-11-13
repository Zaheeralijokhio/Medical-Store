/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Download,
  Printer,
  Calendar,
  Filter,
  Package,
  Layers,
  PieChart,
  FileSpreadsheet,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { formatPKR, exportToCSV, isExpired, isNearExpiry } from '../../utils/helpers';

export const ReportsAnalytics: React.FC = () => {
  const {
    sales,
    saleReturns,
    purchases,
    medicines,
    suppliers,
    customers,
    expenses,
    settings,
  } = useStore();

  const [reportTab, setReportTab] = useState<'financial' | 'sales' | 'inventory' | 'purchases'>('financial');
  const [dateRange, setDateRange] = useState<'today' | '7days' | 'month' | 'year' | 'all'>('month');

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const currentMonthStr = useMemo(() => todayStr.substring(0, 7), [todayStr]);
  const currentYearStr = useMemo(() => todayStr.substring(0, 4), [todayStr]);

  // Date filtering helper
  const filterByDate = (dateString?: string) => {
    const safeDate = String(dateString || '');
    if (dateRange === 'all') return true;
    if (dateRange === 'today') return safeDate === todayStr;
    if (dateRange === 'month') return safeDate.startsWith(currentMonthStr);
    if (dateRange === 'year') return safeDate.startsWith(currentYearStr);
    if (dateRange === '7days') {
      if (!safeDate) return false;
      const d = new Date(safeDate);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return d >= sevenDaysAgo;
    }
    return true;
  };

  // Filtered datasets
  const filteredSales = useMemo(() => sales.filter(s => filterByDate(s.date)), [sales, dateRange]);
  const filteredPurchases = useMemo(() => purchases.filter(p => filterByDate(p.purchaseDate)), [purchases, dateRange]);
  const filteredExpenses = useMemo(() => expenses.filter(e => filterByDate(e.date)), [expenses, dateRange]);

  // Accurate COGS & Profit Calculations using exact batch purchase prices
  const financialMetrics = useMemo(() => {
    let grossSales = 0;
    let totalDiscount = 0;
    let netSales = 0;
    let totalCOGS = 0;

    filteredSales.forEach(sale => {
      grossSales += Number(sale.subtotal || 0);
      totalDiscount += Number(sale.discountTotal || 0);
      netSales += Number(sale.grandTotal || 0);

      // Exact COGS = sum of (quantity * item.purchaseCost) from the specific sold batch!
      const saleCOGS = (sale.items || []).reduce(
        (acc, item) => acc + Number(item?.quantity || 0) * Number(item?.purchaseCost || 0),
        0
      );
      totalCOGS += saleCOGS;
    });

    const totalExpenseAmount = filteredExpenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);
    const totalReturnsAmount = saleReturns.reduce((acc, r) => acc + Number(r.totalRefund || 0), 0);

    const grossProfit = Math.max(0, netSales - totalCOGS);
    const netProfit = grossProfit - totalExpenseAmount - totalReturnsAmount;
    const grossMarginPercent = netSales > 0 ? ((grossProfit / netSales) * 100).toFixed(1) : '0';
    const netMarginPercent = netSales > 0 ? ((netProfit / netSales) * 100).toFixed(1) : '0';

    // Balance Sheet snapshots
    const supplierPayable = suppliers.reduce((sum, s) => sum + Number(s.outstandingBalance || 0), 0);
    const customerReceivable = customers.reduce((sum, c) => sum + Number(c.outstandingBalance || 0), 0);

    // Current Inventory Valuation
    let inventoryCost = 0;
    let inventoryRetail = 0;
    medicines.forEach(m => {
      (m.batches || []).forEach(b => {
        inventoryCost += Number(b?.quantity || 0) * Number(b?.purchasePrice || 0);
        inventoryRetail += Number(b?.quantity || 0) * Number(b?.salePrice || 0);
      });
    });

    return {
      grossSales,
      totalDiscount,
      netSales,
      totalCOGS,
      grossProfit,
      totalExpenseAmount,
      totalReturnsAmount,
      netProfit,
      grossMarginPercent,
      netMarginPercent,
      supplierPayable,
      customerReceivable,
      inventoryCost,
      inventoryRetail,
      potentialProfitInStock: Math.max(0, inventoryRetail - inventoryCost),
    };
  }, [filteredSales, filteredExpenses, saleReturns, suppliers, customers, medicines]);

  // Method-Wise Sales Breakdown
  const methodSales = useMemo(() => {
    const map: Record<string, number> = {};
    filteredSales.forEach(s => {
      const method = s.paymentMethod || 'Cash';
      map[method] = (map[method] || 0) + Number(s.grandTotal || 0);
    });
    return map;
  }, [filteredSales]);

  // Medicine Formulation Sales Ranking
  const medicineSalesRanking = useMemo(() => {
    const map: Record<string, { name: string; quantity: number; revenue: number; cogs: number; profit: number }> = {};

    filteredSales.forEach(sale => {
      (sale.items || []).forEach(item => {
        if (!item || !item.medicineId) return;
        if (!map[item.medicineId]) {
          map[item.medicineId] = {
            name: String(item.medicineName || 'Medicine'),
            quantity: 0,
            revenue: 0,
            cogs: 0,
            profit: 0,
          };
        }
        const qty = Number(item.quantity || 0);
        const rev = Number(item.totalAmount || 0);
        const cost = qty * Number(item.purchaseCost || 0);
        map[item.medicineId].quantity += qty;
        map[item.medicineId].revenue += rev;
        map[item.medicineId].cogs += cost;
        map[item.medicineId].profit += rev - cost;
      });
    });

    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [filteredSales]);

  const handleExportFinancialsCSV = () => {
    const rows = [
      { Metric: 'Gross Sales (Subtotal)', ValuePKR: financialMetrics.grossSales },
      { Metric: 'Total Customer Discounts', ValuePKR: financialMetrics.totalDiscount },
      { Metric: 'Net Revenue', ValuePKR: financialMetrics.netSales },
      { Metric: 'Cost of Goods Sold (Exact Batch COGS)', ValuePKR: financialMetrics.totalCOGS },
      { Metric: 'Gross Profit', ValuePKR: financialMetrics.grossProfit },
      { Metric: 'Operating Expenses', ValuePKR: financialMetrics.totalExpenseAmount },
      { Metric: 'Sale Returns & Refunds', ValuePKR: financialMetrics.totalReturnsAmount },
      { Metric: 'Net Clean Profit', ValuePKR: financialMetrics.netProfit },
      { Metric: 'Current Stock Valuation (Cost)', ValuePKR: financialMetrics.inventoryCost },
      { Metric: 'Current Stock Valuation (Retail)', ValuePKR: financialMetrics.inventoryRetail },
      { Metric: 'Outstanding Accounts Payable (Suppliers)', ValuePKR: financialMetrics.supplierPayable },
      { Metric: 'Outstanding Accounts Receivable (Patients)', ValuePKR: financialMetrics.customerReceivable },
    ];
    exportToCSV(`Financial_PnL_Statement_${new Date().toISOString().split('T')[0]}`, rows);
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-teal-600" />
            Financial Analytics & Executive Management Reports
          </h3>
          <p className="text-xs text-slate-500">
            Certified profit calculations using actual batch purchase costs, COGS, and expense ledgers
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Date Range Selector */}
          <select
            value={dateRange}
            onChange={e => setDateRange(e.target.value as any)}
            className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:bg-white"
          >
            <option value="today">Today's Shift</option>
            <option value="7days">Last 7 Days</option>
            <option value="month">Current Month (MTD)</option>
            <option value="year">Current Year (YTD)</option>
            <option value="all">Lifetime History</option>
          </select>

          <button
            onClick={handleExportFinancialsCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" /> Export Statement
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition-colors"
          >
            <Printer className="w-3.5 h-3.5" /> Print P&L
          </button>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-1">
        {[
          { id: 'financial', label: 'Profit & Loss Statement (COGS)' },
          { id: 'sales', label: 'Formulation Sales & Margin Ranking' },
          { id: 'inventory', label: 'Stock Valuation & Working Capital' },
          { id: 'purchases', label: 'Procurement & Vendor Ledger' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setReportTab(tab.id as any)}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              reportTab === tab.id
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Financial Profit & Loss Statement */}
      {reportTab === 'financial' && (
        <div className="space-y-4">
          {/* Main Profit Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Net Sales Revenue
              </span>
              <h4 className="text-2xl font-black text-slate-900 mt-1">
                {formatPKR(financialMetrics.netSales)}
              </h4>
              <p className="text-[10px] text-slate-400 mt-1">
                Gross: {formatPKR(financialMetrics.grossSales)} (Disc: -{formatPKR(financialMetrics.totalDiscount)})
              </p>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Cost of Goods Sold (COGS)
              </span>
              <h4 className="text-2xl font-black text-slate-700 mt-1">
                {formatPKR(financialMetrics.totalCOGS)}
              </h4>
              <p className="text-[10px] text-slate-400 mt-1">
                Based on exact batch unit cost
              </p>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Gross Profit
              </span>
              <h4 className="text-2xl font-black text-teal-800 mt-1">
                {formatPKR(financialMetrics.grossProfit)}
              </h4>
              <p className="text-[10px] text-teal-600 font-semibold mt-1">
                Gross Margin: {financialMetrics.grossMarginPercent}%
              </p>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Net Clean Store Profit
              </span>
              <h4 className="text-2xl font-black text-emerald-700 mt-1">
                {formatPKR(financialMetrics.netProfit)}
              </h4>
              <p className="text-[10px] text-emerald-600 font-semibold mt-1">
                Net Margin: {financialMetrics.netMarginPercent}% (after expenses & returns)
              </p>
            </div>
          </div>

          {/* Detailed Financial Breakdown Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
            <h4 className="font-bold text-slate-900 text-sm mb-3">
              Comprehensive Income & Expense Statement ({dateRange.toUpperCase()})
            </h4>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600 font-medium">1. Gross Counter Sales (Subtotal)</span>
                <span className="font-mono font-bold text-slate-900">{formatPKR(financialMetrics.grossSales)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 text-emerald-700">
                <span className="font-medium">2. Less: Authorized Customer Discounts</span>
                <span className="font-mono font-bold">-{formatPKR(financialMetrics.totalDiscount)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-200 font-bold bg-slate-50 px-2 rounded">
                <span className="text-slate-800">3. Net Revenue</span>
                <span className="font-mono text-slate-900">{formatPKR(financialMetrics.netSales)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 text-slate-600">
                <span className="font-medium">4. Less: Cost of Goods Sold (Exact Batch Purchase Cost)</span>
                <span className="font-mono font-bold text-rose-700">-{formatPKR(financialMetrics.totalCOGS)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-200 font-bold bg-teal-50 px-2 rounded text-teal-900">
                <span>5. Gross Margin Profit</span>
                <span className="font-mono text-base">{formatPKR(financialMetrics.grossProfit)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 text-slate-600">
                <span className="font-medium">6. Less: Operational Overhead (Rent, Electric, Salaries, Internet)</span>
                <span className="font-mono font-bold text-rose-700">-{formatPKR(financialMetrics.totalExpenseAmount)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 text-slate-600">
                <span className="font-medium">7. Less: Sale Returns & Customer Refunds</span>
                <span className="font-mono font-bold text-rose-700">-{formatPKR(financialMetrics.totalReturnsAmount)}</span>
              </div>
              <div className="flex justify-between py-3 border-t-2 border-slate-900 font-black text-sm bg-emerald-50 px-2 rounded text-emerald-950">
                <span>NET STORE PROFIT (FINAL)</span>
                <span className="font-mono text-lg text-emerald-800">{formatPKR(financialMetrics.netProfit)}</span>
              </div>
            </div>
          </div>

          {/* Payment Method Distribution Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
            <h4 className="font-bold text-slate-900 text-sm mb-3">
              Payment Method Breakdown
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {Object.entries(methodSales).map(([method, amt]) => (
                <div key={method} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">{method}</span>
                  <span className="text-base font-black font-mono text-slate-900 mt-0.5 block">{formatPKR(amt)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Medicine-Wise Sales & Profit Margins */}
      {reportTab === 'sales' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h4 className="font-bold text-slate-900 text-sm">
              Formulation Performance & Margin Contribution Ranking
            </h4>
            <span className="text-xs text-slate-500">
              Sorted by Gross Sales Revenue
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="p-3">Rank</th>
                  <th className="p-3">Medicine Name</th>
                  <th className="p-3 text-center">Units Dispensed</th>
                  <th className="p-3 text-right">Revenue (PKR)</th>
                  <th className="p-3 text-right">Cost (COGS)</th>
                  <th className="p-3 text-right">Gross Profit (PKR)</th>
                  <th className="p-3 text-right">Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {medicineSalesRanking.map((m, idx) => {
                  const marginPct = m.revenue > 0 ? ((m.profit / m.revenue) * 100).toFixed(1) : '0';
                  return (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-400">#{idx + 1}</td>
                      <td className="p-3 font-bold text-slate-900">{m.name}</td>
                      <td className="p-3 text-center font-bold text-slate-800">{m.quantity}</td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">{formatPKR(m.revenue)}</td>
                      <td className="p-3 text-right font-mono text-slate-500">{formatPKR(m.cogs)}</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-700">{formatPKR(m.profit)}</td>
                      <td className="p-3 text-right font-mono font-semibold text-teal-800">{marginPct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Inventory Valuation */}
      {reportTab === 'inventory' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Current Inventory Cost Valuation
              </span>
              <h4 className="text-2xl font-black text-slate-900 mt-1">
                {formatPKR(financialMetrics.inventoryCost)}
              </h4>
              <span className="text-[10px] text-slate-400">Working capital locked in active batches</span>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Current Inventory Retail Valuation
              </span>
              <h4 className="text-2xl font-black text-teal-800 mt-1">
                {formatPKR(financialMetrics.inventoryRetail)}
              </h4>
              <span className="text-[10px] text-slate-400">Expected revenue when fully dispensed</span>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Unrealized Stock Profit
              </span>
              <h4 className="text-2xl font-black text-emerald-700 mt-1">
                {formatPKR(financialMetrics.potentialProfitInStock)}
              </h4>
              <span className="text-[10px] text-slate-400">Projected inventory margin</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Procurement & Vendor Balances */}
      {reportTab === 'purchases' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Total Outstanding Vendor Payables
              </span>
              <h4 className="text-2xl font-black text-rose-700 mt-1">
                {formatPKR(financialMetrics.supplierPayable)}
              </h4>
              <span className="text-[10px] text-slate-400">Due to GSK, Getz, Abbott, Searle, etc.</span>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Total Customer Receivables (Credit)
              </span>
              <h4 className="text-2xl font-black text-amber-700 mt-1">
                {formatPKR(financialMetrics.customerReceivable)}
              </h4>
              <span className="text-[10px] text-slate-400">Due from regular patient clinic accounts</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

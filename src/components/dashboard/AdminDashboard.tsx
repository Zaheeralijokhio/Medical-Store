/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Pill,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  AlertOctagon,
  Clock,
  Package,
  ShoppingCart,
  Users,
  Building2,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  PieChart as PieIcon,
  CheckCircle2,
  Layers,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { formatPKR, isExpired, isNearExpiry } from '../../utils/helpers';
import { NavTab } from '../layout/Sidebar';

interface AdminDashboardProps {
  onNavigate: (tab: NavTab) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  const {
    medicines,
    sales,
    purchases,
    suppliers,
    customers,
    staffMembers,
    expenses,
    auditLogs,
    settings,
  } = useStore();

  const [timeframe, setTimeframe] = useState<'today' | 'month' | 'all'>('month');

  // Today string YYYY-MM-DD
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const currentMonthStr = useMemo(() => todayStr.substring(0, 7), [todayStr]);

  // Inventory Aggregations
  const inventoryStats = useMemo(() => {
    let totalStockQty = 0;
    let purchaseVal = 0;
    let saleVal = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let nearExpiryCount = 0;
    let expiredCount = 0;

    (medicines || []).forEach(med => {
      if (!med) return;
      const qty = Number(med.totalQuantity || 0);
      const minStock = Number(med.minStockLevel ?? 15);
      totalStockQty += qty;

      if (qty === 0) {
        outOfStockCount++;
      } else if (qty <= minStock) {
        lowStockCount++;
      }

      (med.batches || []).forEach(b => {
        if (!b) return;
        const bQty = Number(b.quantity || 0);
        purchaseVal += bQty * Number(b.purchasePrice || 0);
        saleVal += bQty * Number(b.salePrice || 0);

        if (bQty > 0) {
          if (isExpired(b.expiryDate)) {
            expiredCount++;
          } else if (isNearExpiry(b.expiryDate, settings?.expiryAlertDays ?? 90)) {
            nearExpiryCount++;
          }
        }
      });
    });

    return {
      totalMedicines: (medicines || []).length,
      totalStockQty,
      purchaseVal,
      saleVal,
      lowStockCount,
      outOfStockCount,
      nearExpiryCount,
      expiredCount,
    };
  }, [medicines, settings?.expiryAlertDays]);

  // Financial & Sales Aggregations (Part 4 Strict Definitions)
  const salesStats = useMemo(() => {
    let todaySales = 0;
    let todayNetSales = 0;
    let todayCost = 0;
    let monthSales = 0;
    let monthNetSales = 0;
    let monthCost = 0;
    let totalRevenue = 0;
    let totalNetSales = 0;
    let totalCOGS = 0;

    // Exclude returned/cancelled sales from Revenue & Profit calculations
    const activeSales = sales.filter(s => s && s.status !== 'returned');

    activeSales.forEach(sale => {
      const saleDate = String(sale.date || '');
      const isToday = saleDate === todayStr;
      const isThisMonth = saleDate.startsWith(currentMonthStr);

      // Net sales excluding discounts (subtotal - discountTotal)
      const lineDiscounts = (sale.items || []).reduce((sum, i) => sum + Number(i?.discountAmount || 0), 0);
      const netSaleExclDiscount = Math.max(
        0,
        Number(sale.subtotal || sale.grandTotal || 0) - Number(sale.discountTotal || 0) - lineDiscounts
      );

      totalRevenue += Number(sale.grandTotal || 0);
      totalNetSales += netSaleExclDiscount;

      // Exact COGS based on batch unit purchase cost
      const saleCogs = (sale.items || []).reduce(
        (sum, item) => sum + Number(item?.quantity || 0) * Number(item?.purchaseCost || 0),
        0
      );
      totalCOGS += saleCogs;

      if (isToday) {
        todaySales += Number(sale.grandTotal || 0);
        todayNetSales += netSaleExclDiscount;
        todayCost += saleCogs;
      }
      if (isThisMonth) {
        monthSales += Number(sale.grandTotal || 0);
        monthNetSales += netSaleExclDiscount;
        monthCost += saleCogs;
      }
    });

    // Today & Month Purchases
    let todayPurchases = 0;
    let monthPurchases = 0;
    purchases.forEach(p => {
      if (!p) return;
      const pDate = String(p.purchaseDate || '');
      if (pDate === todayStr) todayPurchases += Number(p.totalAmount || 0);
      if (pDate.startsWith(currentMonthStr)) monthPurchases += Number(p.totalAmount || 0);
    });

    // Today, Month, & Total Expenses
    let monthExpenses = 0;
    let totalExpenses = 0;
    expenses.forEach(e => {
      if (!e) return;
      const eDate = String(e.date || '');
      const amt = Number(e.amount || 0);
      totalExpenses += amt;
      if (eDate.startsWith(currentMonthStr)) monthExpenses += amt;
    });

    const todayGrossProfit = todayNetSales - todayCost;
    const monthlyGrossProfit = monthNetSales - monthCost;
    const monthlyNetProfit = monthlyGrossProfit - monthExpenses;
    const totalGrossProfit = totalNetSales - totalCOGS;
    const totalNetProfit = totalGrossProfit - totalExpenses;

    return {
      todaySales,
      todayPurchases,
      todayGrossProfit,
      monthSales,
      monthPurchases,
      monthlyGrossProfit,
      monthlyNetProfit,
      totalRevenue,
      totalCOGS,
      totalExpenses,
      totalGrossProfit,
      totalNetProfit,
    };
  }, [sales, purchases, expenses, todayStr, currentMonthStr]);

  // Top Best-Selling Medicines (excluding returned sales)
  const topSellingMedicines = useMemo(() => {
    const medSalesMap: Record<string, { name: string; quantity: number; revenue: number }> = {};

    (sales || [])
      .filter(s => s && s.status !== 'returned')
      .forEach(s => {
        (s.items || []).forEach(item => {
          if (!item || !item.medicineId) return;
          if (!medSalesMap[item.medicineId]) {
            medSalesMap[item.medicineId] = {
              name: String(item.medicineName || 'Medicine'),
              quantity: 0,
              revenue: 0,
            };
          }
          medSalesMap[item.medicineId].quantity += Number(item.quantity || 0);
          medSalesMap[item.medicineId].revenue += Number(item.totalAmount || 0);
        });
      });

    return Object.values(medSalesMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 7);
  }, [sales]);

  // Category-Wise Stock Distribution
  const categoryDistribution = useMemo(() => {
    const catMap: Record<string, { count: number; value: number }> = {};
    (medicines || []).forEach(m => {
      if (!m) return;
      const cat = m.category || 'General';
      if (!catMap[cat]) catMap[cat] = { count: 0, value: 0 };
      catMap[cat].count += Number(m.totalQuantity || 0);
      const catVal = (m.batches || []).reduce(
        (sum, b) => sum + Number(b?.quantity || 0) * Number(b?.purchasePrice || 0),
        0
      );
      catMap[cat].value += catVal;
    });

    return Object.entries(catMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [medicines]);

  // Staff-Wise Performance
  const staffPerformance = useMemo(() => {
    const staffMap: Record<string, { name: string; totalSales: number; count: number }> = {};
    (staffMembers || []).forEach(sm => {
      if (!sm || !sm.id) return;
      staffMap[sm.id] = {
        name: String(sm.fullName || sm.username || 'Staff'),
        totalSales: 0,
        count: 0,
      };
    });

    (sales || [])
      .filter(s => s && s.status !== 'returned')
      .forEach(s => {
        if (s.staffId && staffMap[s.staffId]) {
          staffMap[s.staffId].totalSales += Number(s.grandTotal || 0);
          staffMap[s.staffId].count += 1;
        }
      });

    return Object.values(staffMap).sort((a, b) => b.totalSales - a.totalSales);
  }, [staffMembers, sales]);

  // 7-day Sales Trend Data for visual SVG chart
  const last7DaysTrend = useMemo(() => {
    const days: { date: string; label: string; sales: number; purchases: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric' });

      const daySales = (sales || [])
        .filter(s => s && s.date === dateStr && s.status !== 'returned')
        .reduce((sum, s) => sum + Number(s.grandTotal || 0), 0);

      const dayPurchases = (purchases || [])
        .filter(p => p && p.purchaseDate === dateStr)
        .reduce((sum, p) => sum + Number(p.totalAmount || 0), 0);

      days.push({ date: dateStr, label, sales: daySales, purchases: dayPurchases });
    }
    return days;
  }, [sales, purchases]);

  const maxTrendVal = Math.max(
    ...last7DaysTrend.map(d => Math.max(Number(d.sales || 0), Number(d.purchases || 0))),
    1000
  );

  const otherStaffCount = useMemo(
    () => (staffMembers || []).filter(s => s && s.id !== 'usr-owner-1').length,
    [staffMembers]
  );

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Quick Setup Guide Banner when no staff account or no medicines exist yet */}
      {(otherStaffCount === 0 || inventoryStats.totalMedicines === 0) && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#0B191E] via-[#0F2A2E] to-[#11423E] text-white border border-emerald-500/25 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5">
          <div>
            <h4 className="text-sm sm:text-base font-extrabold text-white">
              Store Quick Setup — Start Your Operations
            </h4>
            <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
              {otherStaffCount === 0
                ? 'Step 1: Create a Staff / Seller account so your team can sign in and record medicines & sales.'
                : 'Step 2: Add medicines to your inventory catalog and start counter billing.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('staff')}
              className="flex-1 sm:flex-initial min-h-[42px] px-4 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-extrabold transition-colors cursor-pointer whitespace-nowrap"
            >
              {otherStaffCount === 0 ? '+ Create Staff Account' : 'Manage Staff'}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('inventory')}
              className="flex-1 sm:flex-initial min-h-[42px] px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
            >
              + Add Medicine
            </button>
          </div>
        </div>
      )}

      {/* Top Banner Alert for Expired or Low Stock if any */}
      {(inventoryStats.expiredCount > 0 || inventoryStats.nearExpiryCount > 0) && (
        <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-950">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500 text-white shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-950">
                Action Required: Medicine Expiry Attention
              </h4>
              <p className="text-xs text-amber-800 mt-0.5">
                {inventoryStats.expiredCount > 0 && (
                  <span className="font-semibold text-rose-700 mr-2">
                    {inventoryStats.expiredCount} batch(es) expired (Locked from POS)
                  </span>
                )}
                {inventoryStats.expiredCount > 0 && inventoryStats.nearExpiryCount > 0 && '· '}
                {inventoryStats.nearExpiryCount > 0 && (
                  <span>
                    {inventoryStats.nearExpiryCount} batch(es) expiring within {settings.expiryAlertDays} days
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('inventory')}
            className="w-full sm:w-auto min-h-[40px] px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors shrink-0 shadow-xs"
          >
            Review Batches
          </button>
        </div>
      )}

      {/* Row 1: Primary Financial & Inventory KPI Cards (8 Cards) */}
      <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* 1. Today's Sales */}
        <div className="pro-card p-4 sm:p-5 rounded-2xl">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Today&apos;s Sales
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight tabular-nums">
              {formatPKR(salesStats.todaySales)}
            </h3>
            <p className="mt-1 text-xs text-slate-500 tabular-nums">
              Gross Profit · <span className="font-bold text-emerald-700">{formatPKR(salesStats.todayGrossProfit)}</span>
            </p>
          </div>
        </div>

        {/* 2. Monthly Sales */}
        <div className="pro-card p-4 sm:p-5 rounded-2xl">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Monthly Sales
            </span>
            <div className="p-2 rounded-xl bg-teal-50 text-teal-700">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight tabular-nums">
              {formatPKR(salesStats.monthSales)}
            </h3>
            <p className="mt-1 text-xs text-slate-500 tabular-nums">
              Monthly Net · <span className="font-bold text-teal-700">{formatPKR(salesStats.monthlyNetProfit)}</span>
            </p>
          </div>
        </div>

        {/* 3. Today's Purchases */}
        <div className="pro-card p-4 sm:p-5 rounded-2xl">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Today&apos;s Purchases
            </span>
            <div className="p-2 rounded-xl bg-sky-50 text-sky-700">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight tabular-nums">
              {formatPKR(salesStats.todayPurchases)}
            </h3>
            <p className="mt-1 text-xs text-slate-500 tabular-nums">
              Monthly POs · <span className="font-bold text-slate-700">{formatPKR(salesStats.monthPurchases)}</span>
            </p>
          </div>
        </div>

        {/* 4. Total Revenue */}
        <div className="pro-card p-4 sm:p-5 rounded-2xl">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Revenue
            </span>
            <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
              <BarChart3 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight tabular-nums">
              {formatPKR(salesStats.totalRevenue)}
            </h3>
            <p className="mt-1 text-xs text-slate-500 tabular-nums">
              {(sales || []).filter(s => s && s.status !== 'returned').length} completed invoices
            </p>
          </div>
        </div>

        {/* 5. Gross Profit */}
        <div className="pro-card p-4 sm:p-5 rounded-2xl">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Gross Profit
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl sm:text-2xl font-extrabold text-emerald-700 tracking-tight tabular-nums">
              {formatPKR(salesStats.totalGrossProfit)}
            </h3>
            <p className="mt-1 text-xs text-slate-500 tabular-nums">
              COGS · {formatPKR(salesStats.totalCOGS)}
            </p>
          </div>
        </div>

        {/* 6. Net Profit */}
        <div className="pro-card p-4 sm:p-5 rounded-2xl">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Net Profit
            </span>
            <div className="p-2 rounded-xl bg-teal-50 text-teal-700">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3
              className={`text-xl sm:text-2xl font-extrabold tracking-tight tabular-nums ${
                salesStats.totalNetProfit >= 0 ? 'text-teal-700' : 'text-rose-600'
              }`}
            >
              {formatPKR(salesStats.totalNetProfit)}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Gross Profit minus Expenses
            </p>
          </div>
        </div>

        {/* 7. Total Expenses */}
        <div className="pro-card p-4 sm:p-5 rounded-2xl">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Expenses
            </span>
            <div className="p-2 rounded-xl bg-rose-50 text-rose-700">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight tabular-nums">
              {formatPKR(salesStats.totalExpenses)}
            </h3>
            <p className="mt-1 text-xs text-slate-500 tabular-nums">
              {expenses.length} store expense(s)
            </p>
          </div>
        </div>

        {/* 8. Total Stock Value */}
        <div className="pro-card p-4 sm:p-5 rounded-2xl">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Stock Value
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-teal-700">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight tabular-nums">
              {formatPKR(inventoryStats.purchaseVal)}
            </h3>
            <p className="mt-1 text-xs text-slate-500 tabular-nums">
              Retail · <span className="font-semibold text-slate-700">{formatPKR(inventoryStats.saleVal)}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Row 2: Operational Quick-Access Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
        <button
          type="button"
          onClick={() => onNavigate('inventory')}
          className="pro-card p-3.5 rounded-xl text-left group min-h-[82px]"
        >
          <div className="flex items-center justify-between text-teal-700 mb-1.5">
            <span className="text-[11px] font-bold">Medicines</span>
            <Pill className="w-4 h-4 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-xl font-extrabold text-slate-900 tabular-nums">
            {inventoryStats.totalMedicines}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Formulations</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('inventory')}
          className="pro-card p-3.5 rounded-xl text-left group min-h-[82px]"
        >
          <div className="flex items-center justify-between text-emerald-700 mb-1.5">
            <span className="text-[11px] font-bold">Stock Qty</span>
            <Layers className="w-4 h-4 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-xl font-extrabold text-slate-900 tabular-nums">
            {inventoryStats.totalStockQty.toLocaleString()}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Available units</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('inventory')}
          className="pro-card p-3.5 rounded-xl text-left group min-h-[82px]"
        >
          <div className="flex items-center justify-between text-amber-600 mb-1.5">
            <span className="text-[11px] font-bold">Low Stock</span>
            <AlertTriangle className="w-4 h-4 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-xl font-extrabold text-slate-900 tabular-nums">
            {inventoryStats.lowStockCount}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Below alert level</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('inventory')}
          className="pro-card p-3.5 rounded-xl text-left group min-h-[82px]"
        >
          <div className="flex items-center justify-between text-orange-600 mb-1.5">
            <span className="text-[11px] font-bold">Near Expiry</span>
            <Clock className="w-4 h-4 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-xl font-extrabold text-slate-900 tabular-nums">
            {inventoryStats.nearExpiryCount}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Within {settings.expiryAlertDays}d</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('inventory')}
          className="pro-card p-3.5 rounded-xl text-left group min-h-[82px]"
        >
          <div className="flex items-center justify-between text-rose-700 mb-1.5">
            <span className="text-[11px] font-bold">Expired</span>
            <AlertOctagon className="w-4 h-4 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-xl font-extrabold text-rose-700 tabular-nums">
            {inventoryStats.expiredCount}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Locked batches</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('customers')}
          className="pro-card p-3.5 rounded-xl text-left group min-h-[82px]"
        >
          <div className="flex items-center justify-between text-teal-700 mb-1.5">
            <span className="text-[11px] font-bold">Customers</span>
            <Users className="w-4 h-4 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-xl font-extrabold text-slate-900 tabular-nums">
            {customers.length}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Registered</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('suppliers')}
          className="pro-card p-3.5 rounded-xl text-left group min-h-[82px]"
        >
          <div className="flex items-center justify-between text-sky-700 mb-1.5">
            <span className="text-[11px] font-bold">Suppliers</span>
            <Building2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-xl font-extrabold text-slate-900 tabular-nums">
            {suppliers.length}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Pharma vendors</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('staff')}
          className="pro-card p-3.5 rounded-xl text-left group min-h-[82px]"
        >
          <div className="flex items-center justify-between text-slate-700 mb-1.5">
            <span className="text-[11px] font-bold">Staff</span>
            <Users className="w-4 h-4 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-xl font-extrabold text-slate-900 tabular-nums">
            {staffMembers.length}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Store accounts</p>
        </button>
      </div>

      {/* Row 3: Interactive Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
        {/* Sales & Purchases Weekly Trend Chart */}
        <div className="lg:col-span-2 pro-card p-4 sm:p-5 rounded-2xl flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-teal-700" />
                Sales &amp; Purchases Trend (Last 7 Days)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Daily turnover vs vendor stock purchases ({settings.currency})
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-slate-700 font-medium">
                <span className="w-2.5 h-2.5 rounded-xs bg-teal-600" /> Sales
              </span>
              <span className="flex items-center gap-1.5 text-slate-700 font-medium">
                <span className="w-2.5 h-2.5 rounded-xs bg-slate-300" /> Purchases
              </span>
            </div>
          </div>

          <div className="h-56 sm:h-64 flex items-end gap-1.5 sm:gap-4 pt-6 pb-2 px-1 sm:px-2 border-b border-slate-100">
            {last7DaysTrend.map((d, index) => {
              const salesHeight = maxTrendVal > 0 ? (d.sales / maxTrendVal) * 165 : 0;
              const purchHeight = maxTrendVal > 0 ? (d.purchases / maxTrendVal) * 165 : 0;

              return (
                <div key={index} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group min-w-0">
                  <div className="flex items-end gap-1 w-full justify-center">
                    <div
                      style={{ height: `${Math.max(salesHeight, 6)}px` }}
                      className="w-1/2 max-w-[18px] rounded-t-md bg-teal-600 group-hover:bg-emerald-500 transition-all relative flex justify-center"
                      title={`Sales: Rs. ${d.sales.toLocaleString()}`}
                    >
                      {d.sales > 0 && (
                        <div className="opacity-0 group-hover:opacity-100 absolute -top-8 px-1.5 py-0.5 rounded bg-[#0B191E] text-white text-[10px] whitespace-nowrap z-10 transition-opacity font-mono">
                          Rs. {d.sales.toLocaleString()}
                        </div>
                      )}
                    </div>

                    <div
                      style={{ height: `${Math.max(purchHeight, 6)}px` }}
                      className="w-1/2 max-w-[18px] rounded-t-md bg-slate-300 group-hover:bg-slate-400 transition-all relative flex justify-center"
                      title={`Purchases: Rs. ${d.purchases.toLocaleString()}`}
                    >
                      {d.purchases > 0 && (
                        <div className="opacity-0 group-hover:opacity-100 absolute -top-8 px-1.5 py-0.5 rounded bg-[#0B191E] text-white text-[10px] whitespace-nowrap z-10 transition-opacity font-mono">
                          Rs. {d.purchases.toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] sm:text-[11px] font-medium text-slate-500 mt-1.5 truncate max-w-full">
                    {d.label}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-3.5 pt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span className="tabular-nums">Peak Volume · {formatPKR(maxTrendVal)}</span>
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="text-teal-700 hover:text-teal-800 font-bold flex items-center gap-1"
            >
              Detailed Report <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Best-Selling Medicines */}
        <div className="pro-card p-4 sm:p-5 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
                Best-Selling Items
              </h3>
              <span className="text-[11px] text-slate-400 font-semibold">Volume</span>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Highest turnover formulations at counter
            </p>

            <div className="space-y-3">
              {topSellingMedicines.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">No sales recorded yet</p>
              ) : (
                topSellingMedicines.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 font-bold text-[11px] flex items-center justify-center shrink-0 tabular-nums">
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-slate-800 truncate">
                        {item.name}
                      </span>
                    </div>
                    <div className="text-right shrink-0 tabular-nums">
                      <span className="font-bold text-slate-900 block">
                        {item.quantity} sold
                      </span>
                      <span className="text-[10px] text-emerald-700 font-mono">
                        {formatPKR(item.revenue)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="w-full py-1.5 text-center text-xs font-bold text-teal-700 hover:text-teal-800"
            >
              Analyze All Formulations &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* Row 4: Category Distribution & Staff Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        <div className="pro-card p-4 sm:p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                <PieIcon className="w-4 h-4 sm:w-5 sm:h-5 text-teal-700" />
                Category Stock Distribution
              </h3>
              <p className="text-xs text-slate-500">Inventory valuation by category</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('inventory')}
              className="text-xs text-teal-700 font-bold hover:underline shrink-0"
            >
              Catalog
            </button>
          </div>

          <div className="space-y-3">
            {categoryDistribution.map((cat, idx) => {
              const totalVal = inventoryStats.saleVal || 1;
              const percent = Math.min(100, Math.round((cat.value / totalVal) * 100));

              return (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-slate-800 truncate">{cat.name}</span>
                    <span className="text-slate-500 shrink-0 tabular-nums font-mono text-[11px]">
                      {cat.count} units · {formatPKR(cat.value)}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden flex">
                    <div
                      style={{ width: `${percent}%` }}
                      className={`h-full rounded-full ${
                        idx === 0
                          ? 'bg-emerald-500'
                          : idx === 1
                          ? 'bg-teal-600'
                          : idx === 2
                          ? 'bg-sky-500'
                          : idx === 3
                          ? 'bg-amber-500'
                          : 'bg-slate-500'
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pro-card p-4 sm:p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 text-teal-700" />
                Staff Sales Performance
              </h3>
              <p className="text-xs text-slate-500">Revenue by dispensers &amp; cashiers</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('staff')}
              className="text-xs text-teal-700 font-bold hover:underline shrink-0"
            >
              Staff Portal
            </button>
          </div>

          <div className="space-y-2.5">
            {staffPerformance.map((staff, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/70 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[#0B191E] text-emerald-300 font-bold text-xs flex items-center justify-center shrink-0">
                    {(staff.name || 'S').charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-slate-900 truncate">{staff.name || 'Staff'}</h4>
                    <p className="text-[11px] text-slate-500">{staff.count} transactions</p>
                  </div>
                </div>
                <div className="text-right shrink-0 tabular-nums">
                  <div className="text-sm font-extrabold text-slate-900 font-mono">
                    {formatPKR(staff.totalSales)}
                  </div>
                  <span className="text-[10px] text-emerald-700 font-semibold">Recorded</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 5: Live Activity & Audit Trail */}
      <div className="pro-card p-4 sm:p-5 rounded-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
              <Layers className="w-4 h-4 sm:w-5 sm:h-5 text-slate-700" />
              Live Activity &amp; Audit Log
            </h3>
            <p className="text-xs text-slate-500">
              Traceable record of sales, purchases, adjustments &amp; logins
            </p>
          </div>
          <span className="text-xs font-semibold text-emerald-700">Real-time Database Sync</span>
        </div>

        {/* Mobile Audit Cards (<768px) */}
        <div className="md:hidden space-y-2.5">
          {(auditLogs || []).slice(0, 6).map(log => {
            const actionStr = String(log?.action || 'ACTIVITY');
            return (
              <div
                key={log.id}
                className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/70 space-y-1.5 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      actionStr.includes('SALE')
                        ? 'bg-emerald-100 text-emerald-800'
                        : actionStr.includes('PURCHASE')
                        ? 'bg-sky-100 text-sky-800'
                        : actionStr.includes('ADJUST')
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-200 text-slate-800'
                    }`}
                  >
                    {actionStr}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">{log.timestamp || ''}</span>
                </div>
                <p className="text-slate-700 leading-snug">{log.description || ''}</p>
                <p className="text-[11px] font-semibold text-slate-500">
                  By {log.userName || 'System'}
                </p>
              </div>
            );
          })}
        </div>

        {/* Desktop Table (>=768px) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Action Type</th>
                <th className="py-2.5 px-3">User</th>
                <th className="py-2.5 px-3">Description &amp; Impact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(auditLogs || []).slice(0, 6).map(log => {
                const actionStr = String(log?.action || 'ACTIVITY');
                return (
                  <tr key={log.id} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                      {log.timestamp || ''}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          actionStr.includes('SALE')
                            ? 'bg-emerald-100 text-emerald-800'
                            : actionStr.includes('PURCHASE')
                            ? 'bg-sky-100 text-sky-800'
                            : actionStr.includes('ADJUST')
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {actionStr}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap font-semibold text-slate-800">
                      {log.userName || 'System'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">
                      {log.description || ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

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

    medicines.forEach(med => {
      totalStockQty += med.totalQuantity;

      if (med.totalQuantity === 0) {
        outOfStockCount++;
      } else if (med.totalQuantity <= med.minStockLevel) {
        lowStockCount++;
      }

      med.batches.forEach(b => {
        purchaseVal += b.quantity * b.purchasePrice;
        saleVal += b.quantity * b.salePrice;

        if (b.quantity > 0) {
          if (isExpired(b.expiryDate)) {
            expiredCount++;
          } else if (isNearExpiry(b.expiryDate, settings.expiryAlertDays)) {
            nearExpiryCount++;
          }
        }
      });
    });

    return {
      totalMedicines: medicines.length,
      totalStockQty,
      purchaseVal,
      saleVal,
      lowStockCount,
      outOfStockCount,
      nearExpiryCount,
      expiredCount,
    };
  }, [medicines, settings.expiryAlertDays]);

  // Financial & Sales Aggregations
  const salesStats = useMemo(() => {
    let todaySales = 0;
    let todayCost = 0;
    let monthSales = 0;
    let monthCost = 0;
    let totalRevenue = 0;
    let totalCOGS = 0;

    sales.forEach(sale => {
      const isToday = sale.date === todayStr;
      const isThisMonth = sale.date.startsWith(currentMonthStr);

      totalRevenue += sale.grandTotal;

      // Exact COGS based on batch unit purchase cost
      const saleCogs = sale.items.reduce((sum, item) => sum + item.quantity * item.purchaseCost, 0);
      totalCOGS += saleCogs;

      if (isToday) {
        todaySales += sale.grandTotal;
        todayCost += saleCogs;
      }
      if (isThisMonth) {
        monthSales += sale.grandTotal;
        monthCost += saleCogs;
      }
    });

    // Today & Month Purchases
    let todayPurchases = 0;
    let monthPurchases = 0;
    purchases.forEach(p => {
      if (p.purchaseDate === todayStr) todayPurchases += p.totalAmount;
      if (p.purchaseDate.startsWith(currentMonthStr)) monthPurchases += p.totalAmount;
    });

    // Today & Month Expenses
    let monthExpenses = 0;
    expenses.forEach(e => {
      if (e.date.startsWith(currentMonthStr)) monthExpenses += e.amount;
    });

    const todayGrossProfit = Math.max(0, todaySales - todayCost);
    const monthlyGrossProfit = Math.max(0, monthSales - monthCost);
    const monthlyNetProfit = monthlyGrossProfit - monthExpenses;

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
    };
  }, [sales, purchases, expenses, todayStr, currentMonthStr]);

  // Top 10 Best-Selling Medicines
  const topSellingMedicines = useMemo(() => {
    const medSalesMap: Record<string, { name: string; quantity: number; revenue: number }> = {};

    sales.forEach(s => {
      s.items.forEach(item => {
        if (!medSalesMap[item.medicineId]) {
          medSalesMap[item.medicineId] = {
            name: item.medicineName,
            quantity: 0,
            revenue: 0,
          };
        }
        medSalesMap[item.medicineId].quantity += item.quantity;
        medSalesMap[item.medicineId].revenue += item.totalAmount;
      });
    });

    return Object.values(medSalesMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 7);
  }, [sales]);

  // Category-Wise Stock Distribution
  const categoryDistribution = useMemo(() => {
    const catMap: Record<string, { count: number; value: number }> = {};
    medicines.forEach(m => {
      const cat = m.category || 'General';
      if (!catMap[cat]) catMap[cat] = { count: 0, value: 0 };
      catMap[cat].count += m.totalQuantity;
      const catVal = m.batches.reduce((sum, b) => sum + b.quantity * b.salePrice, 0);
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
    staffMembers.forEach(sm => {
      staffMap[sm.id] = { name: sm.fullName, totalSales: 0, count: 0 };
    });

    sales.forEach(s => {
      if (staffMap[s.staffId]) {
        staffMap[s.staffId].totalSales += s.grandTotal;
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

      const daySales = sales
        .filter(s => s.date === dateStr)
        .reduce((sum, s) => sum + s.grandTotal, 0);

      const dayPurchases = purchases
        .filter(p => p.purchaseDate === dateStr)
        .reduce((sum, p) => sum + p.totalAmount, 0);

      days.push({ date: dateStr, label, sales: daySales, purchases: dayPurchases });
    }
    return days;
  }, [sales, purchases]);

  const maxTrendVal = Math.max(
    ...last7DaysTrend.map(d => Math.max(d.sales, d.purchases)),
    1000
  );

  return (
    <div className="space-y-6">
      {/* Top Banner Alert for Expired or Low Stock if any */}
      {(inventoryStats.expiredCount > 0 || inventoryStats.nearExpiryCount > 0) && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500 text-white shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-950">
                Action Required: Medicine Expiry Attention
              </h4>
              <p className="text-xs text-amber-800">
                {inventoryStats.expiredCount > 0 && (
                  <span className="font-semibold text-rose-700 mr-2">
                    • {inventoryStats.expiredCount} batch(es) expired (Locked from POS)
                  </span>
                )}
                {inventoryStats.nearExpiryCount > 0 && (
                  <span>
                    • {inventoryStats.nearExpiryCount} batch(es) expiring within {settings.expiryAlertDays} days
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('inventory')}
            className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors shrink-0 shadow-xs"
          >
            Review Batches
          </button>
        </div>
      )}

      {/* Row 1: Core Financial KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Sales */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Today's Sales
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">
              {formatPKR(salesStats.todaySales)}
            </h3>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
              <span className="font-medium text-emerald-600 flex items-center">
                <ArrowUpRight className="w-3.5 h-3.5" /> Gross Profit:
              </span>
              <span className="font-semibold text-slate-700">
                {formatPKR(salesStats.todayGrossProfit)}
              </span>
            </div>
          </div>
        </div>

        {/* Monthly Sales & Net Profit */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Monthly Sales (PKR)
            </span>
            <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">
              {formatPKR(salesStats.monthSales)}
            </h3>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
              <span>Gross: {formatPKR(salesStats.monthlyGrossProfit)}</span>
              <span>•</span>
              <span className="text-teal-700 font-medium">
                Net: {formatPKR(salesStats.monthlyNetProfit)}
              </span>
            </div>
          </div>
        </div>

        {/* Inventory Stock Value */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Stock Retail Value
            </span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">
              {formatPKR(inventoryStats.saleVal)}
            </h3>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
              <span>Cost Basis:</span>
              <span className="font-medium text-slate-700">
                {formatPKR(inventoryStats.purchaseVal)}
              </span>
            </div>
          </div>
        </div>

        {/* Total Stock Quantity & Medicines */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Catalog & Quantity
            </span>
            <div className="p-2 rounded-xl bg-cyan-50 text-cyan-600">
              <Pill className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                {inventoryStats.totalStockQty.toLocaleString()}
              </h3>
              <span className="text-xs text-slate-500">units in stock</span>
            </div>
            <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">{inventoryStats.totalMedicines}</span>
              <span>active medicine formulations</span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Secondary Operational Status Badges (Stock & Alert Grid) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <button
          onClick={() => onNavigate('inventory')}
          className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-yellow-400 text-left transition-all group"
        >
          <div className="flex items-center justify-between text-yellow-600 mb-1">
            <span className="text-xs font-semibold">Low Stock</span>
            <AlertTriangle className="w-4 h-4 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-xl font-bold text-slate-800">
            {inventoryStats.lowStockCount}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Below alert level</p>
        </button>

        <button
          onClick={() => onNavigate('inventory')}
          className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-rose-400 text-left transition-all group"
        >
          <div className="flex items-center justify-between text-rose-600 mb-1">
            <span className="text-xs font-semibold">Out of Stock</span>
            <AlertOctagon className="w-4 h-4 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-xl font-bold text-slate-800">
            {inventoryStats.outOfStockCount}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">0 units available</p>
        </button>

        <button
          onClick={() => onNavigate('inventory')}
          className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-amber-400 text-left transition-all group"
        >
          <div className="flex items-center justify-between text-amber-600 mb-1">
            <span className="text-xs font-semibold">Near Expiry</span>
            <Clock className="w-4 h-4 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-xl font-bold text-slate-800">
            {inventoryStats.nearExpiryCount}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Expiring &lt;90 days</p>
        </button>

        <button
          onClick={() => onNavigate('inventory')}
          className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-rose-950 text-left transition-all group"
        >
          <div className="flex items-center justify-between text-rose-900 mb-1">
            <span className="text-xs font-semibold">Expired</span>
            <AlertOctagon className="w-4 h-4 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-xl font-bold text-rose-900">
            {inventoryStats.expiredCount}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Locked & segregated</p>
        </button>

        <button
          onClick={() => onNavigate('suppliers')}
          className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-blue-400 text-left transition-all group"
        >
          <div className="flex items-center justify-between text-blue-600 mb-1">
            <span className="text-xs font-semibold">Suppliers</span>
            <Building2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-xl font-bold text-slate-800">
            {suppliers.length}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Pharma vendors</p>
        </button>

        <button
          onClick={() => onNavigate('customers')}
          className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-teal-400 text-left transition-all group"
        >
          <div className="flex items-center justify-between text-teal-600 mb-1">
            <span className="text-xs font-semibold">Customers</span>
            <Users className="w-4 h-4 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-xl font-bold text-slate-800">
            {customers.length}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Registered accounts</p>
        </button>
      </div>

      {/* Row 3: Interactive Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales & Purchases Weekly Trend Chart (2 columns) */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-teal-600" />
                Sales & Purchases Trend (Last 7 Days)
              </h3>
              <p className="text-xs text-slate-500">
                Daily turnover vs vendor stock purchases in PKR
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-slate-700">
                <span className="w-3 h-3 rounded-xs bg-teal-500"></span> Sales
              </span>
              <span className="flex items-center gap-1.5 text-slate-700">
                <span className="w-3 h-3 rounded-xs bg-indigo-400"></span> Purchases
              </span>
            </div>
          </div>

          {/* SVG Bar Chart with values */}
          <div className="h-64 flex items-end gap-2 sm:gap-4 pt-6 pb-2 px-2 border-b border-slate-100">
            {last7DaysTrend.map((d, index) => {
              const salesHeight = maxTrendVal > 0 ? (d.sales / maxTrendVal) * 180 : 0;
              const purchHeight = maxTrendVal > 0 ? (d.purchases / maxTrendVal) * 180 : 0;

              return (
                <div key={index} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
                  <div className="flex items-end gap-1 w-full justify-center">
                    {/* Sales Bar */}
                    <div
                      style={{ height: `${Math.max(salesHeight, 6)}px` }}
                      className="w-1/2 max-w-[20px] rounded-t-md bg-teal-500 group-hover:bg-teal-600 transition-all relative flex justify-center"
                      title={`Sales: Rs. ${d.sales.toLocaleString()}`}
                    >
                      {d.sales > 0 && (
                        <div className="opacity-0 group-hover:opacity-100 absolute -top-8 px-1.5 py-0.5 rounded bg-slate-900 text-white text-[10px] whitespace-nowrap z-10 transition-opacity">
                          Rs. {d.sales.toLocaleString()}
                        </div>
                      )}
                    </div>

                    {/* Purchases Bar */}
                    <div
                      style={{ height: `${Math.max(purchHeight, 6)}px` }}
                      className="w-1/2 max-w-[20px] rounded-t-md bg-indigo-300 group-hover:bg-indigo-400 transition-all relative flex justify-center"
                      title={`Purchases: Rs. ${d.purchases.toLocaleString()}`}
                    >
                      {d.purchases > 0 && (
                        <div className="opacity-0 group-hover:opacity-100 absolute -top-8 px-1.5 py-0.5 rounded bg-slate-900 text-white text-[10px] whitespace-nowrap z-10 transition-opacity">
                          Rs. {d.purchases.toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-[11px] font-medium text-slate-500 mt-2 truncate">
                    {d.label}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-3 flex items-center justify-between text-xs text-slate-500">
            <span>Peak Day Volume: {formatPKR(maxTrendVal)}</span>
            <button
              onClick={() => onNavigate('reports')}
              className="text-teal-600 hover:text-teal-700 font-semibold flex items-center gap-1"
            >
              Detailed Financial Report <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Top 7 Best-Selling Formulations */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                Best-Selling Medicines
              </h3>
              <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                Volume
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Highest turnover medicines dispensed at counter
            </p>

            <div className="space-y-3">
              {topSellingMedicines.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">No sales recorded yet</p>
              ) : (
                topSellingMedicines.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-bold text-[10px] flex items-center justify-center shrink-0">
                        #{idx + 1}
                      </span>
                      <span className="font-semibold text-slate-800 truncate">
                        {item.name}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-bold text-slate-900 block">
                        {item.quantity} sold
                      </span>
                      <span className="text-[10px] text-emerald-600">
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
              onClick={() => onNavigate('reports')}
              className="w-full text-center text-xs font-semibold text-teal-600 hover:text-teal-700"
            >
              Analyze All Formulation Sales →
            </button>
          </div>
        </div>
      </div>

      {/* Row 4: Category Distribution & Staff Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category-Wise Stock Breakdown */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <PieIcon className="w-5 h-5 text-indigo-600" />
                Category-Wise Stock Distribution
              </h3>
              <p className="text-xs text-slate-500">
                Inventory valuation by medical category
              </p>
            </div>
            <button
              onClick={() => onNavigate('inventory')}
              className="text-xs text-teal-600 font-medium hover:underline"
            >
              Manage Catalog
            </button>
          </div>

          <div className="space-y-3">
            {categoryDistribution.map((cat, idx) => {
              const totalVal = inventoryStats.saleVal || 1;
              const percent = Math.min(100, Math.round((cat.value / totalVal) * 100));

              return (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">{cat.name}</span>
                    <span className="text-slate-500">
                      {cat.count} units ({formatPKR(cat.value)})
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden flex">
                    <div
                      style={{ width: `${percent}%` }}
                      className={`h-full rounded-full ${
                        idx === 0
                          ? 'bg-teal-500'
                          : idx === 1
                          ? 'bg-indigo-500'
                          : idx === 2
                          ? 'bg-amber-500'
                          : idx === 3
                          ? 'bg-cyan-500'
                          : 'bg-emerald-500'
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Staff Sales Performance */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Users className="w-5 h-5 text-teal-600" />
                Staff Sales Performance
              </h3>
              <p className="text-xs text-slate-500">
                Revenue generated by dispensers & counter cashiers
              </p>
            </div>
            <button
              onClick={() => onNavigate('staff')}
              className="text-xs text-teal-600 font-medium hover:underline"
            >
              Staff Portal
            </button>
          </div>

          <div className="space-y-3">
            {staffPerformance.map((staff, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-800 font-bold text-xs flex items-center justify-center">
                    {staff.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">{staff.name}</h4>
                    <p className="text-[11px] text-slate-500">{staff.count} transactions completed</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-slate-900">
                    {formatPKR(staff.totalSales)}
                  </div>
                  <span className="text-[10px] text-emerald-600 font-medium">Recorded Volume</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 5: Recent Store Activities Audit Trail */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Layers className="w-5 h-5 text-slate-700" />
              Live Activity & Audit Log
            </h3>
            <p className="text-xs text-slate-500">
              Complete traceable record of sales, purchases, stock adjustments, and staff logins
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Real-time Sync
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold">
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Action Type</th>
                <th className="py-2.5 px-3">User</th>
                <th className="py-2.5 px-3">Description & Impact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {auditLogs.slice(0, 6).map(log => (
                <tr key={log.id} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                    {log.timestamp}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.action.includes('SALE')
                          ? 'bg-emerald-100 text-emerald-800'
                          : log.action.includes('PURCHASE')
                          ? 'bg-blue-100 text-blue-800'
                          : log.action.includes('ADJUST')
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-800'
                      }`}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap font-medium text-slate-800">
                    {log.userName}
                  </td>
                  <td className="py-2.5 px-3 text-slate-700">
                    {log.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

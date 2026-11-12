/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  WalletCards,
  Plus,
  Search,
  Download,
  Calendar,
  DollarSign,
  Edit2,
  Trash2,
  X,
  CreditCard,
  Building,
  Zap,
  Users,
  Wifi,
  Wrench,
  Truck,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { Expense, ExpenseCategory, PaymentMethod } from '../../types/pharmacy';
import { formatPKR, exportToCSV } from '../../utils/helpers';

export const ExpenseManagement: React.FC = () => {
  const { expenses, addExpense, updateExpense, deleteExpense } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Form State
  const [category, setCategory] = useState<ExpenseCategory>('Shop Rent');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number>(5000);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [receiptRef, setReceiptRef] = useState('');

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const currentMonthStr = useMemo(() => todayStr.substring(0, 7), [todayStr]);
  const currentYearStr = useMemo(() => todayStr.substring(0, 4), [todayStr]);

  // Aggregated totals: Daily, Monthly, Yearly
  const stats = useMemo(() => {
    let daily = 0;
    let monthly = 0;
    let yearly = 0;

    expenses.forEach(e => {
      if (!e) return;
      const eDate = String(e.date || '');
      const amt = Number(e.amount || 0);
      if (eDate === todayStr) daily += amt;
      if (eDate.startsWith(currentMonthStr)) monthly += amt;
      if (eDate.startsWith(currentYearStr)) yearly += amt;
    });

    return { daily, monthly, yearly };
  }, [expenses, todayStr, currentMonthStr, currentYearStr]);

  const filteredExpenses = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return expenses.filter(e => {
      if (selectedCategory !== 'All' && e.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        e.description.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        (e.receiptRef && e.receiptRef.toLowerCase().includes(q))
      );
    });
  }, [expenses, searchQuery, selectedCategory]);

  const handleOpenAdd = () => {
    setEditingExpense(null);
    setCategory('Shop Rent');
    setDescription('');
    setAmount(1000);
    setDate(new Date().toISOString().split('T')[0]);
    setPaymentMethod('Cash');
    setReceiptRef('');
    setShowAddModal(true);
  };

  const handleOpenEdit = (exp: Expense) => {
    setEditingExpense(exp);
    setCategory(exp.category);
    setDescription(exp.description);
    setAmount(exp.amount);
    setDate(exp.date);
    setPaymentMethod(exp.paymentMethod);
    setReceiptRef(exp.receiptRef || '');
    setShowAddModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || amount <= 0) {
      return;
    }

    if (editingExpense) {
      updateExpense(editingExpense.id, {
        category,
        description: description.trim(),
        amount: Number(amount),
        date,
        paymentMethod,
        receiptRef: receiptRef.trim() || undefined,
      });
    } else {
      addExpense({
        category,
        description: description.trim(),
        amount: Number(amount),
        date,
        paymentMethod,
        receiptRef: receiptRef.trim() || undefined,
      });
    }

    setShowAddModal(false);
    setEditingExpense(null);
    setDescription('');
    setAmount(1000);
    setReceiptRef('');
  };

  const handleExportCSV = () => {
    const rows = filteredExpenses.map(e => ({
      ExpenseID: e.id,
      Category: e.category,
      Description: e.description,
      Amount: e.amount,
      Date: e.date,
      PaymentMethod: e.paymentMethod,
      AddedBy: e.addedByName,
      ReceiptRef: e.receiptRef || 'N/A',
    }));
    exportToCSV(`Pharmacy_Expenses_${new Date().toISOString().split('T')[0]}`, rows);
  };

  const getCategoryIcon = (cat: ExpenseCategory) => {
    switch (cat) {
      case 'Shop Rent':
        return <Building className="w-4 h-4 text-indigo-600" />;
      case 'Electricity':
        return <Zap className="w-4 h-4 text-amber-500" />;
      case 'Employee Salaries':
        return <Users className="w-4 h-4 text-teal-600" />;
      case 'Internet':
        return <Wifi className="w-4 h-4 text-cyan-600" />;
      case 'Maintenance':
        return <Wrench className="w-4 h-4 text-orange-600" />;
      case 'Transportation':
        return <Truck className="w-4 h-4 text-blue-600" />;
      default:
        return <WalletCards className="w-4 h-4 text-slate-600" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <WalletCards className="w-5 h-5 text-teal-600" />
            Pharmacy Operational Expenses
          </h3>
          <p className="text-xs text-slate-500">
            Track daily operating costs, utilities, rent, and calculate true net store profit
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" /> Export CSV
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" /> Add New Expense
          </button>
        </div>
      </div>

      {/* KPI Cards: Daily, Monthly, Yearly Auto-Calculated */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Today's Daily Expenses
          </span>
          <h4 className="text-xl font-black text-slate-900 mt-1">
            {formatPKR(stats.daily)}
          </h4>
          <span className="text-[10px] text-slate-400">Current working day outgo</span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Current Month Expenses
          </span>
          <h4 className="text-xl font-black text-teal-800 mt-1">
            {formatPKR(stats.monthly)}
          </h4>
          <span className="text-[10px] text-slate-400">Rent, electricity, staff salaries, internet</span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Year-to-Date (YTD) Total
          </span>
          <h4 className="text-xl font-black text-slate-900 mt-1">
            {formatPKR(stats.yearly)}
          </h4>
          <span className="text-[10px] text-slate-400">Cumulative store operational overhead</span>
        </div>
      </div>

      {/* Search & Category Filter */}
      <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search expense description, receipt voucher..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div>
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:bg-white font-medium"
          >
            <option value="All">All Expense Categories</option>
            <option value="Shop Rent">Shop Rent</option>
            <option value="Electricity">Electricity (K-Electric / AC)</option>
            <option value="Employee Salaries">Employee Salaries</option>
            <option value="Internet">Internet / POS Backup</option>
            <option value="Transportation">Transportation & Couriers</option>
            <option value="Maintenance">Maintenance & Refrigeration</option>
            <option value="Licensing & Taxes">Licensing & Taxes</option>
            <option value="Other Expenses">Other Expenses</option>
          </select>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Expense Category</th>
                <th className="py-3 px-3">Description</th>
                <th className="py-3 px-3">Payment Mode</th>
                <th className="py-3 px-3">Recorded By</th>
                <th className="py-3 px-3">Voucher Ref</th>
                <th className="py-3 px-3 text-right">Amount (PKR)</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No expense records matching the selected filter.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map(exp => (
                  <tr key={exp.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                      {exp.date}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800">
                        {getCategoryIcon(exp.category)}
                        <span>{exp.category}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-700 font-medium max-w-sm">
                      {exp.description}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                        {exp.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {exp.addedByName}
                    </td>
                    <td className="py-3 px-3 font-mono text-[10px] text-slate-400">
                      {exp.receiptRef || '-'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-black text-rose-700 text-sm">
                      {formatPKR(exp.amount)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenEdit(exp)}
                          className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                          title="Edit Expense"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteExpense(exp.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded"
                          title="Delete Expense"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Expense Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 border border-slate-200 shadow-2xl space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h4 className="font-bold text-sm text-slate-900">
                {editingExpense ? 'Edit Pharmacy Operational Expense' : 'Record New Pharmacy Operational Expense'}
              </h4>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Expense Category *</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value as any)}
                  className="w-full p-2 border border-slate-200 rounded-lg font-bold"
                >
                  <option value="Shop Rent">Shop Rent</option>
                  <option value="Electricity">Electricity (K-Electric / AC / UPS)</option>
                  <option value="Employee Salaries">Employee Salaries</option>
                  <option value="Internet">Internet / POS Backup</option>
                  <option value="Transportation">Transportation & Fuel</option>
                  <option value="Maintenance">Maintenance & Cold Chain Repairs</option>
                  <option value="Licensing & Taxes">DRAP Licensing & Professional Taxes</option>
                  <option value="Other Expenses">Other Expenses</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Expense Amount (PKR) *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={amount}
                  onChange={e => setAmount(parseFloat(e.target.value) || 0)}
                  placeholder="e.g. 25000"
                  className="w-full p-2 border border-slate-200 rounded-lg font-mono font-bold text-base text-rose-700"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Description / Memo *</label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="e.g. Monthly Commercial Electricity Bill for Cold Chain"
                  className="w-full p-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Expense Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value as any)}
                    className="w-full p-2 border border-slate-200 rounded-lg"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Card">Card</option>
                    <option value="EasyPaisa">EasyPaisa</option>
                    <option value="JazzCash">JazzCash</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Bill / Voucher Reference Number (Optional)</label>
                <input
                  type="text"
                  value={receiptRef}
                  onChange={e => setReceiptRef(e.target.value)}
                  placeholder="e.g. KE-BILL-9921 / REC-104"
                  className="w-full p-2 border border-slate-200 rounded-lg font-mono"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 bg-slate-100 rounded-lg font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold"
                >
                  {editingExpense ? 'Save Updates' : 'Record Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

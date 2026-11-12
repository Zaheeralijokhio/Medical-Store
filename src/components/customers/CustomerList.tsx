/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Users,
  Plus,
  Search,
  Phone,
  MapPin,
  Calendar,
  Receipt,
  Download,
  Printer,
  Edit2,
  Trash2,
  X,
  UserCheck,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { Customer } from '../../types/pharmacy';
import { formatPKR, exportToCSV } from '../../utils/helpers';

export const CustomerList: React.FC = () => {
  const { customers, sales, addCustomer, updateCustomer, deleteCustomer, recordCustomerPayment, settings } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');

  // Customer Statement Modal
  const [selectedCustomerForStatement, setSelectedCustomerForStatement] = useState<Customer | null>(null);

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return customers.filter(c => {
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.address && c.address.toLowerCase().includes(q))
      );
    });
  }, [customers, searchQuery]);

  const totalPatients = customers.length;
  const totalCustomerVolume = customers.reduce((sum, c) => sum + c.totalPurchases, 0);

  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setShowAddEditModal(true);
  };

  const handleOpenEdit = (c: Customer) => {
    setEditingCustomer(c);
    setName(c.name);
    setPhone(c.phone);
    setEmail(c.email || '');
    setAddress(c.address || '');
    setShowAddEditModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      alert('Patient name and contact phone number are required.');
      return;
    }

    if (editingCustomer) {
      updateCustomer(editingCustomer.id, {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
      });
    } else {
      addCustomer({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
      });
    }

    setShowAddEditModal(false);
  };

  const handleExportCSV = () => {
    const rows = filteredCustomers.map(c => ({
      CustomerID: c.id,
      Name: c.name,
      Phone: c.phone,
      Email: c.email || 'N/A',
      Address: c.address || 'N/A',
      TotalPurchases: c.totalPurchases,
      OutstandingBalance: c.outstandingBalance,
      LastPurchaseDate: c.lastPurchaseDate || 'N/A',
    }));
    exportToCSV(`Customer_Directory_${new Date().toISOString().split('T')[0]}`, rows);
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <Users className="w-5 h-5 text-teal-600" />
            Customer & Patient Directory
          </h3>
          <p className="text-xs text-slate-500">
            Registered pharmacy patients, chronic medication accounts, and purchase histories
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
            <Plus className="w-4 h-4" /> Register Customer
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Registered Patient Profiles
          </span>
          <h4 className="text-xl font-black text-slate-900 mt-1">
            {totalPatients} Profiles
          </h4>
          <span className="text-[10px] text-slate-400">Regular clinic & walk-in customers</span>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Cumulative Dispensed Value
          </span>
          <h4 className="text-xl font-black text-teal-800 mt-1">
            {formatPKR(totalCustomerVolume)}
          </h4>
          <span className="text-[10px] text-slate-400">Lifetime purchases by registered patients</span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search patient name, phone number, address..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-500"
          />
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-3">Patient / Customer Name</th>
                <th className="py-3 px-3">Contact Phone</th>
                <th className="py-3 px-3">Residential Address</th>
                <th className="py-3 px-3 text-right">Lifetime Purchases</th>
                <th className="py-3 px-3 text-right">Credit Due (PKR)</th>
                <th className="py-3 px-3">Last Visited</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No customers found matching your search.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map(cust => (
                  <tr key={cust.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center text-xs">
                          {cust.name.charAt(0)}
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 block">{cust.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">ID: {cust.id}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono font-semibold text-slate-700">
                      {cust.phone}
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {cust.address || 'Walk-in (PECHS / Clifton)'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                      {formatPKR(cust.totalPurchases)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold">
                      {cust.outstandingBalance > 0 ? (
                        <span className="text-rose-700">{formatPKR(cust.outstandingBalance)}</span>
                      ) : (
                        <span className="text-emerald-700">Rs. 0</span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-500">
                      {cust.lastPurchaseDate || 'Recent'}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setSelectedCustomerForStatement(cust)}
                          className="px-2 py-1 rounded bg-teal-50 hover:bg-teal-100 text-teal-800 font-semibold text-[11px] inline-flex items-center gap-1"
                        >
                          <Receipt className="w-3.5 h-3.5 text-teal-600" /> Statement
                        </button>
                        <button
                          onClick={() => handleOpenEdit(cust)}
                          className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete customer record for ${cust.name}?`)) {
                              deleteCustomer(cust.id);
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded"
                          title="Delete"
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

      {/* Customer Statement & Ledger Modal */}
      {selectedCustomerForStatement && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-5 border border-slate-200 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h4 className="font-bold text-sm text-slate-900">
                  Patient Account Statement: {selectedCustomerForStatement.name}
                </h4>
                <p className="text-[11px] text-slate-500">
                  Phone: {selectedCustomerForStatement.phone} • {selectedCustomerForStatement.address}
                </p>
              </div>
              <button
                onClick={() => setSelectedCustomerForStatement(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Total Balance Card */}
            <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Total Lifetime Purchases</span>
                <span className="text-base font-black font-mono text-slate-900">
                  {formatPKR(selectedCustomerForStatement.totalPurchases)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-500 uppercase block">Current Credit Due</span>
                <span className="text-base font-black font-mono text-rose-700">
                  {formatPKR(
                    customers.find(c => c.id === selectedCustomerForStatement.id)?.outstandingBalance ??
                      selectedCustomerForStatement.outstandingBalance
                  )}
                </span>
              </div>
            </div>

            {/* Credit Payment Recovery Box */}
            {(customers.find(c => c.id === selectedCustomerForStatement.id)?.outstandingBalance ??
              selectedCustomerForStatement.outstandingBalance) > 0 && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-emerald-900 block">Settle Outstanding Patient Credit</span>
                  <span className="text-[10px] text-emerald-700">Record cash/transfer received against credit balance</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const currentCust =
                      customers.find(c => c.id === selectedCustomerForStatement.id) || selectedCustomerForStatement;
                    recordCustomerPayment(currentCust.id, currentCust.outstandingBalance);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shrink-0"
                >
                  Mark Full Balance Paid
                </button>
              </div>
            )}

            {/* Invoices History for this customer */}
            <div>
              <span className="font-bold text-slate-800 block mb-2">Prescription Cash Memos:</span>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-[11px] text-left">
                  <thead className="bg-slate-100 font-semibold text-slate-700">
                    <tr>
                      <th className="p-2">Invoice #</th>
                      <th className="p-2">Date</th>
                      <th className="p-2">Items</th>
                      <th className="p-2 text-right">Total (PKR)</th>
                      <th className="p-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sales.filter(s => s.customerId === selectedCustomerForStatement.id || s.customerName === selectedCustomerForStatement.name).map(s => (
                      <tr key={s.id}>
                        <td className="p-2 font-mono font-bold text-teal-800">{s.invoiceNumber}</td>
                        <td className="p-2 font-mono">{s.date}</td>
                        <td className="p-2">{s.items.length} item(s)</td>
                        <td className="p-2 text-right font-mono font-bold">{formatPKR(s.grandTotal)}</td>
                        <td className="p-2 text-center">
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800">
                            {s.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-200">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs"
              >
                <Printer className="w-3.5 h-3.5" /> Print Statement
              </button>
              <button
                onClick={() => setSelectedCustomerForStatement(null)}
                className="px-4 py-1.5 bg-slate-800 text-white rounded-lg font-bold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Customer Modal */}
      {showAddEditModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 border border-slate-200 shadow-2xl space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h4 className="font-bold text-sm text-slate-900">
                {editingCustomer ? 'Edit Customer Information' : 'Register New Patient / Customer'}
              </h4>
              <button onClick={() => setShowAddEditModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Dr. Kamran Qureshi / Muhammad Usman"
                  className="w-full p-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Mobile Phone Number *</label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+92 300 1234567"
                  className="w-full p-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Email Address (Optional)</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="patient@gmail.com"
                  className="w-full p-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Address / Clinic Location</label>
                <input
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="House #, Street, Block, Karachi"
                  className="w-full p-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddEditModal(false)}
                  className="flex-1 py-2 bg-slate-100 rounded-lg font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold"
                >
                  {editingCustomer ? 'Save Updates' : 'Save Patient Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

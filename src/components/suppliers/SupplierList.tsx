/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Building2,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  Edit2,
  Trash2,
  DollarSign,
  Receipt,
  Download,
  X,
  CreditCard,
  Layers,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { Supplier } from '../../types/pharmacy';
import { formatPKR, exportToCSV } from '../../utils/helpers';

export const SupplierList: React.FC = () => {
  const { suppliers, purchases, addSupplier, updateSupplier, deleteSupplier, recordSupplierPayment } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  // Form State
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [ntn, setNtn] = useState('');
  const [openingBalance, setOpeningBalance] = useState<number>(0);

  // Supplier Ledger Modal
  const [selectedSupplierForLedger, setSelectedSupplierForLedger] = useState<Supplier | null>(null);
  const [disburseAmount, setDisburseAmount] = useState<number>(0);

  const filteredSuppliers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return suppliers.filter(s => {
      if (!q) return true;
      return (
        s.companyName.toLowerCase().includes(q) ||
        s.contactPerson.toLowerCase().includes(q) ||
        s.phone.includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.ntn && s.ntn.includes(q))
      );
    });
  }, [suppliers, searchQuery]);

  // Aggregates
  const totalOutstanding = suppliers.reduce((sum, s) => sum + s.outstandingBalance, 0);
  const totalLifetimePurchases = suppliers.reduce((sum, s) => sum + s.totalPurchases, 0);

  const handleOpenAdd = () => {
    setEditingSupplier(null);
    setCompanyName('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setAddress('');
    setNtn('');
    setOpeningBalance(0);
    setShowAddEditModal(true);
  };

  const handleOpenEdit = (s: Supplier) => {
    setEditingSupplier(s);
    setCompanyName(s.companyName);
    setContactPerson(s.contactPerson);
    setPhone(s.phone);
    setEmail(s.email);
    setAddress(s.address);
    setNtn(s.ntn || '');
    setOpeningBalance(s.openingBalance);
    setShowAddEditModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !contactPerson.trim() || !phone.trim()) {
      alert('Company name, contact person, and phone number are required.');
      return;
    }

    if (editingSupplier) {
      updateSupplier(editingSupplier.id, {
        companyName: companyName.trim(),
        contactPerson: contactPerson.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        ntn: ntn.trim(),
      });
    } else {
      addSupplier({
        companyName: companyName.trim(),
        contactPerson: contactPerson.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        ntn: ntn.trim(),
        openingBalance: Number(openingBalance),
      });
    }

    setShowAddEditModal(false);
  };

  const handleDisbursePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierForLedger || disburseAmount <= 0) return;
    recordSupplierPayment(selectedSupplierForLedger.id, disburseAmount);
    // Refresh active supplier reference
    const updated = suppliers.find(s => s.id === selectedSupplierForLedger.id);
    if (updated) setSelectedSupplierForLedger({ ...updated, totalPaid: updated.totalPaid + disburseAmount, outstandingBalance: Math.max(0, updated.outstandingBalance - disburseAmount) });
    setDisburseAmount(0);
  };

  const handleExportCSV = () => {
    const rows = filteredSuppliers.map(s => ({
      CompanyName: s.companyName,
      ContactPerson: s.contactPerson,
      Phone: s.phone,
      Email: s.email,
      Address: s.address,
      NTN: s.ntn || 'N/A',
      TotalPurchases: s.totalPurchases,
      TotalPaid: s.totalPaid,
      OutstandingBalance: s.outstandingBalance,
    }));
    exportToCSV(`Suppliers_Ledger_${new Date().toISOString().split('T')[0]}`, rows);
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <Building2 className="w-5 h-5 text-teal-600" />
            Pharmaceutical Suppliers & Distributors
          </h3>
          <p className="text-xs text-slate-500">
            Vendor accounts, procurement ledger, and accounts payable balances
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" /> Export Ledger
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" /> Add New Supplier
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Total Active Vendors
          </span>
          <h4 className="text-xl font-black text-slate-900 mt-1">
            {suppliers.length} Companies
          </h4>
          <span className="text-[10px] text-slate-400">GSK, Getz, Abbott, Searle, Sami, etc.</span>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Cumulative Procurements
          </span>
          <h4 className="text-xl font-black text-slate-900 mt-1">
            {formatPKR(totalLifetimePurchases)}
          </h4>
          <span className="text-[10px] text-slate-400">Total goods delivered</span>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Outstanding Accounts Payable
          </span>
          <h4 className="text-xl font-black text-rose-700 mt-1">
            {formatPKR(totalOutstanding)}
          </h4>
          <span className="text-[10px] text-slate-400">Due vendor balances</span>
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
            placeholder="Search supplier company, contact person, phone, NTN..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-500"
          />
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-3">Company Name</th>
                <th className="py-3 px-3">Contact Person</th>
                <th className="py-3 px-3">Phone & Email</th>
                <th className="py-3 px-3">Address & NTN</th>
                <th className="py-3 px-3 text-right">Total Purchases</th>
                <th className="py-3 px-3 text-right">Total Paid</th>
                <th className="py-3 px-3 text-right">Outstanding (PKR)</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No suppliers found matching your query.
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map(sup => (
                  <tr key={sup.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3">
                      <span className="font-bold text-slate-900 block">{sup.companyName}</span>
                      <span className="text-[10px] text-slate-400 font-mono">ID: {sup.id}</span>
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-800">
                      {sup.contactPerson}
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      <div className="flex items-center gap-1 font-mono text-[11px]">
                        <Phone className="w-3 h-3 text-slate-400" /> {sup.phone}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-400">
                        <Mail className="w-3 h-3 text-slate-400" /> {sup.email}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      <span className="block truncate max-w-xs">{sup.address}</span>
                      {sup.ntn && (
                        <span className="text-[10px] text-teal-800 font-mono font-bold">NTN: {sup.ntn}</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">
                      {formatPKR(sup.totalPurchases)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-emerald-700 font-semibold">
                      {formatPKR(sup.totalPaid)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-sm">
                      {sup.outstandingBalance > 0 ? (
                        <span className="text-rose-700">{formatPKR(sup.outstandingBalance)}</span>
                      ) : (
                        <span className="text-emerald-700">Rs. 0 (Clear)</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setSelectedSupplierForLedger(sup)}
                          className="px-2 py-1 rounded bg-teal-50 hover:bg-teal-100 text-teal-800 font-semibold text-[11px] inline-flex items-center gap-1"
                        >
                          <Receipt className="w-3.5 h-3.5 text-teal-600" /> Ledger
                        </button>
                        <button
                          onClick={() => handleOpenEdit(sup)}
                          className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete supplier ${sup.companyName}?`)) {
                              deleteSupplier(sup.id);
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

      {/* Supplier Ledger / History Modal */}
      {selectedSupplierForLedger && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 border border-slate-200 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h4 className="font-bold text-sm text-slate-900">
                  Supplier Ledger: {selectedSupplierForLedger.companyName}
                </h4>
                <p className="text-[11px] text-slate-500">
                  Contact: {selectedSupplierForLedger.contactPerson} • {selectedSupplierForLedger.phone}
                </p>
              </div>
              <button
                onClick={() => setSelectedSupplierForLedger(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Financial Summary */}
            <div className="p-3 bg-slate-50 rounded-xl grid grid-cols-3 gap-2 text-center">
              <div>
                <span className="text-[10px] text-slate-500 uppercase">Total Purchases</span>
                <span className="font-mono font-bold block text-slate-900">
                  {formatPKR(selectedSupplierForLedger.totalPurchases)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase">Total Disbursed</span>
                <span className="font-mono font-bold block text-emerald-700">
                  {formatPKR(selectedSupplierForLedger.totalPaid)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase">Outstanding Due</span>
                <span className="font-mono font-bold block text-rose-700">
                  {formatPKR(selectedSupplierForLedger.outstandingBalance)}
                </span>
              </div>
            </div>

            {/* Disburse Payment Form */}
            {selectedSupplierForLedger.outstandingBalance > 0 && (
              <form onSubmit={handleDisbursePayment} className="p-3 bg-teal-50/60 border border-teal-200 rounded-xl space-y-2">
                <span className="font-bold text-teal-900 block">Disburse Vendor Payment:</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max={selectedSupplierForLedger.outstandingBalance}
                    value={disburseAmount || ''}
                    onChange={e => setDisburseAmount(parseFloat(e.target.value) || 0)}
                    placeholder="Enter amount to pay"
                    className="flex-1 p-2 bg-white border border-teal-300 rounded-lg text-xs font-mono font-bold"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg text-xs shadow-xs"
                  >
                    Record Payment
                  </button>
                </div>
              </form>
            )}

            {/* Purchases from this supplier */}
            <div>
              <span className="font-bold text-slate-800 block mb-2">Purchase Orders & Inflow Bills:</span>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-[11px] text-left">
                  <thead className="bg-slate-100 font-semibold text-slate-700">
                    <tr>
                      <th className="p-2">PO #</th>
                      <th className="p-2">Date</th>
                      <th className="p-2">Bill #</th>
                      <th className="p-2 text-right">Total</th>
                      <th className="p-2 text-right">Paid</th>
                      <th className="p-2 text-right">Balance</th>
                      <th className="p-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {purchases.filter(p => p.supplierId === selectedSupplierForLedger.id).map(p => (
                      <tr key={p.id}>
                        <td className="p-2 font-mono font-bold text-teal-800">{p.purchaseNumber}</td>
                        <td className="p-2 font-mono">{p.purchaseDate}</td>
                        <td className="p-2 font-mono">{p.invoiceNumber}</td>
                        <td className="p-2 text-right font-mono font-bold">{formatPKR(p.totalAmount)}</td>
                        <td className="p-2 text-right font-mono text-emerald-700">{formatPKR(p.paidAmount)}</td>
                        <td className="p-2 text-right font-mono font-bold text-rose-700">{formatPKR(p.balanceAmount)}</td>
                        <td className="p-2 text-center">
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100">
                            {p.paymentStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedSupplierForLedger(null)}
                className="px-4 py-2 bg-slate-800 text-white rounded-lg font-bold text-xs"
              >
                Close Ledger
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Supplier Modal */}
      {showAddEditModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 border border-slate-200 shadow-2xl space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h4 className="font-bold text-sm text-slate-900">
                {editingSupplier ? 'Edit Supplier Information' : 'Register New Pharmaceutical Supplier'}
              </h4>
              <button onClick={() => setShowAddEditModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Company / Manufacturer Name *</label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="e.g. GlaxoSmithKline Pakistan Ltd"
                  className="w-full p-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Contact Person *</label>
                  <input
                    type="text"
                    required
                    value={contactPerson}
                    onChange={e => setContactPerson(e.target.value)}
                    placeholder="e.g. Tariq Mansoor"
                    className="w-full p-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Phone Number *</label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+92 21 111-475-725"
                    className="w-full p-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="orders@supplier.com"
                    className="w-full p-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Tax NTN #</label>
                  <input
                    type="text"
                    value={ntn}
                    onChange={e => setNtn(e.target.value)}
                    placeholder="0711822-4"
                    className="w-full p-2 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Office / Distribution Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="Industrial Area, Karachi"
                  className="w-full p-2 border border-slate-200 rounded-lg"
                />
              </div>

              {!editingSupplier && (
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Opening Due Balance (PKR)</label>
                  <input
                    type="number"
                    value={openingBalance}
                    onChange={e => setOpeningBalance(parseFloat(e.target.value) || 0)}
                    className="w-full p-2 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
              )}

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
                  {editingSupplier ? 'Save Updates' : 'Add Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

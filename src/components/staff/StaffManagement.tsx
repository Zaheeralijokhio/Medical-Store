/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  UserCheck,
  Plus,
  ShieldCheck,
  User as UserIcon,
  Search,
  KeyRound,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  X,
  UserPlus,
  Users,
  LogIn,
  AlertTriangle,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { User, StaffPermission, UserRole } from '../../types/pharmacy';
import { OWNER_ACCOUNT } from '../../data/initialData';
import { formatPKR } from '../../utils/helpers';

export const StaffManagement: React.FC = () => {
  const {
    staffMembers,
    sales,
    addStaff,
    updateStaff,
    toggleStaffStatus,
    deleteStaff,
    removeAllOtherStaff,
  } = useStore();
  const { currentUser, switchUser } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<User | null>(null);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<User | null>(null);
  const [confirmRemoveAll, setConfirmRemoveAll] = useState(false);
  const [formError, setFormError] = useState('');
  const [statusBanner, setStatusBanner] = useState<{
    title: string;
    detail: string;
  } | null>(null);

  // Quick Inline Create State
  const [quickName, setQuickName] = useState('');
  const [quickUsername, setQuickUsername] = useState('');
  const [quickPassword, setQuickPassword] = useState('seller123');
  const [quickPin, setQuickPin] = useState('5678');
  const [quickRole, setQuickRole] = useState<UserRole>('staff');
  const [quickError, setQuickError] = useState('');

  // Form State
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [designation, setDesignation] = useState('Medicine Seller / Salesperson');
  const [role, setRole] = useState<UserRole>('staff');
  const [pin, setPin] = useState('5678');
  const [password, setPassword] = useState('seller123');
  const [permissions, setPermissions] = useState<StaffPermission>({
    canMakeSales: true,
    canViewInventory: true,
    canAddCustomer: true,
    canViewReports: false,
    canAdjustStock: true,
    canManagePurchases: true,
    canModifyPrices: true,
  });

  // Selected staff for detailed performance inspect
  const [selectedStaffPerf, setSelectedStaffPerf] = useState<User | null>(null);

  const otherStaffAccounts = useMemo(
    () => staffMembers.filter(s => s.id !== OWNER_ACCOUNT.id),
    [staffMembers]
  );

  const filteredStaff = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return staffMembers.filter(s => {
      if (!q) return true;
      return (
        String(s.fullName || '').toLowerCase().includes(q) ||
        String(s.username || '').toLowerCase().includes(q) ||
        String(s.email || '').toLowerCase().includes(q) ||
        String(s.designation || '').toLowerCase().includes(q)
      );
    });
  }, [staffMembers, searchQuery]);

  // Performance calculations per staff
  const staffStats = useMemo(() => {
    const map: Record<
      string,
      {
        totalSales: number;
        transactions: number;
        discounts: number;
      }
    > = {};

    staffMembers.forEach(s => {
      map[s.id] = { totalSales: 0, transactions: 0, discounts: 0 };
    });

    sales.forEach(sale => {
      if (map[sale.staffId]) {
        map[sale.staffId].totalSales += sale.grandTotal;
        map[sale.staffId].transactions += 1;
        map[sale.staffId].discounts += sale.discountTotal;
      }
    });

    return map;
  }, [staffMembers, sales]);

  const applyRolePreset = (preset: 'seller' | 'pharmacist' | 'cashier' | 'manager') => {
    if (preset === 'seller') {
      setDesignation('Medicine Seller & Inventory Staff');
      setRole('staff');
      setPermissions({
        canMakeSales: true,
        canViewInventory: true,
        canAddCustomer: true,
        canViewReports: false,
        canAdjustStock: true,
        canManagePurchases: true,
        canModifyPrices: true,
      });
    } else if (preset === 'pharmacist') {
      setDesignation('Registered Pharmacist / Dispenser');
      setRole('pharmacist');
      setPermissions({
        canMakeSales: true,
        canViewInventory: true,
        canAddCustomer: true,
        canViewReports: false,
        canAdjustStock: true,
        canManagePurchases: true,
        canModifyPrices: true,
      });
    } else if (preset === 'cashier') {
      setDesignation('POS Counter Cashier');
      setRole('cashier');
      setPermissions({
        canMakeSales: true,
        canViewInventory: true,
        canAddCustomer: true,
        canViewReports: false,
        canAdjustStock: false,
        canManagePurchases: false,
        canModifyPrices: false,
      });
    } else if (preset === 'manager') {
      setDesignation('Store Manager');
      setRole('admin');
      setPermissions({
        canMakeSales: true,
        canViewInventory: true,
        canAddCustomer: true,
        canViewReports: true,
        canAdjustStock: true,
        canManagePurchases: true,
        canModifyPrices: true,
      });
    }
  };

  const handleOpenAdd = () => {
    setEditingStaff(null);
    setFormError('');
    setFullName('');
    setUsername('');
    setEmail('');
    setPhone('');
    setDesignation('Medicine Seller & Inventory Staff');
    setRole('staff');
    setPin('5678');
    setPassword('seller123');
    setPermissions({
      canMakeSales: true,
      canViewInventory: true,
      canAddCustomer: true,
      canViewReports: false,
      canAdjustStock: true,
      canManagePurchases: true,
      canModifyPrices: true,
    });
    setShowAddEditModal(true);
  };

  const handleOpenEdit = (u: User) => {
    setEditingStaff(u);
    setFormError('');
    setFullName(u.fullName);
    setUsername(u.username);
    setEmail(u.email);
    setPhone(u.phone);
    setDesignation(u.designation);
    setRole(u.role);
    setPin(u.pin || '1234');
    setPassword(u.password || 'password123');
    setPermissions({
      ...u.permissions,
      canModifyPrices: u.permissions.canModifyPrices ?? false,
    });
    setShowAddEditModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const cleanName = fullName.trim();
    const fallbackUser = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 14);
    const cleanUser = (username.trim() || fallbackUser).toLowerCase().replace(/\s+/g, '');
    const digitsOnlyPin = pin.replace(/\D/g, '');
    const cleanPin = digitsOnlyPin.length === 4 ? digitsOnlyPin : '5678';
    const cleanPass = password.trim() || 'seller123';

    if (!cleanName || !cleanUser) {
      setFormError('Please enter the Staff Member Full Name.');
      return;
    }

    const duplicateUsername = staffMembers.some(
      s => s.username.toLowerCase() === cleanUser && s.id !== editingStaff?.id
    );
    if (duplicateUsername) {
      setFormError(`Username "@${cleanUser}" is already taken. Please choose another username.`);
      return;
    }

    const resolvedEmail = email.trim() || `${cleanUser}@pharmacare.pk`;

    if (editingStaff) {
      updateStaff(editingStaff.id, {
        fullName: cleanName,
        username: cleanUser,
        email: resolvedEmail,
        phone: phone.trim() || '+92 300 0000000',
        designation: designation.trim() || 'Medicine Seller',
        role: editingStaff.id === OWNER_ACCOUNT.id ? 'admin' : role,
        pin: cleanPin,
        password: cleanPass,
        permissions,
      });
      setStatusBanner({
        title: `Staff Account Updated & Saved to Database: ${cleanName}`,
        detail: `Login Username: @${cleanUser} • Password: ${cleanPass} • 4-Digit PIN: ${cleanPin}`,
      });
    } else {
      addStaff({
        fullName: cleanName,
        username: cleanUser,
        email: resolvedEmail,
        phone: phone.trim() || '+92 300 0000000',
        designation: designation.trim() || 'Medicine Seller',
        role,
        pin: cleanPin,
        password: cleanPass,
        status: 'active',
        permissions,
      });
      setStatusBanner({
        title: `New Staff Account Created & Saved to Hostinger Database: ${cleanName}`,
        detail: `Staff can now sign in on the Login Screen using Username: "${cleanUser}", Password: "${cleanPass}", or 4-Digit PIN: "${cleanPin}".`,
      });
    }

    setShowAddEditModal(false);
  };

  return (
    <div className="space-y-4">
      {/* Owner Authority Banner */}
      <div className="bg-gradient-to-r from-[#0B191E] via-[#0F2A30] to-[#0B191E] text-white p-4 sm:p-5 rounded-2xl border border-emerald-500/30 shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0 text-emerald-300 font-black text-lg">
            AR
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-bold uppercase tracking-wider">
                Sole Master Owner Account
              </span>
              <span className="text-xs text-emerald-200/90 font-mono">
                Username: admin • Password: admin • PIN: 1234
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black tracking-tight mt-1">
              Dr. Abdul Rehman (Owner) — Staff &amp; Role Access Control Center
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Create accounts for staff (Seller, Pharmacist, Cashier, Manager) so they can add medicines, stock, purchases, and sales according to their role. All accounts &amp; data auto-save to your Hostinger database.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {otherStaffAccounts.length > 0 && (
            <button
              type="button"
              onClick={() => setConfirmRemoveAll(true)}
              className="min-h-[42px] flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-200 hover:text-white border border-rose-500/40 font-bold text-xs transition-all"
            >
              <Trash2 className="w-4 h-4" />
              Remove All Other Accounts ({otherStaffAccounts.length})
            </button>
          )}
          <button
            type="button"
            onClick={handleOpenAdd}
            className="min-h-[42px] flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#0B191E] font-black text-xs shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            + Create Staff / Seller Account
          </button>
        </div>
      </div>

      {/* Confirmation Banner when Staff Account is Created / Updated */}
      {statusBanner && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 flex items-start justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-black text-emerald-950">{statusBanner.title}</h4>
              <p className="text-xs text-emerald-800 font-mono mt-0.5">{statusBanner.detail}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="text-emerald-600 hover:text-emerald-900 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Always-Visible 1-Click Quick Create Staff Account Card */}
      <form
        onSubmit={e => {
          e.preventDefault();
          setQuickError('');
          const cleanName = quickName.trim();
          const autoUser = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 14);
          const cleanUser = (quickUsername.trim() || autoUser).toLowerCase().replace(/^@/, '').replace(/\s+/g, '');
          const cleanPass = quickPassword.trim() || 'seller123';
          const digitsPin = quickPin.replace(/\D/g, '');
          const cleanPin = digitsPin.length === 4 ? digitsPin : '5678';

          if (!cleanName || !cleanUser) {
            setQuickError('Please enter Staff Name and Username.');
            return;
          }

          if (staffMembers.some(s => s.username.toLowerCase() === cleanUser)) {
            setQuickError(`Username "@${cleanUser}" already exists. Choose a different username.`);
            return;
          }

          const roleDesignation =
            quickRole === 'pharmacist'
              ? 'Registered Pharmacist / Dispenser'
              : quickRole === 'cashier'
              ? 'POS Counter Cashier'
              : quickRole === 'admin'
              ? 'Store Manager'
              : 'Medicine Seller & Inventory Staff';

          addStaff({
            fullName: cleanName,
            username: cleanUser,
            email: `${cleanUser}@pharmacare.pk`,
            phone: '+92 300 0000000',
            designation: roleDesignation,
            role: quickRole,
            pin: cleanPin,
            password: cleanPass,
            status: 'active',
            permissions: {
              canMakeSales: true,
              canViewInventory: true,
              canAddCustomer: true,
              canViewReports: quickRole === 'admin',
              canAdjustStock: quickRole !== 'cashier',
              canManagePurchases: quickRole !== 'cashier',
              canModifyPrices: quickRole !== 'cashier',
            },
          });

          setStatusBanner({
            title: `Staff Account Created & Automatically Saved to Database: ${cleanName}`,
            detail: `Username: "${cleanUser}" • Password: "${cleanPass}" • 4-Digit PIN: "${cleanPin}" (Ready to Sign In immediately)`,
          });
          setQuickName('');
          setQuickUsername('');
          setQuickPassword('seller123');
          setQuickPin('5678');
        }}
        className="pro-card border-2 border-[#0F766E]/25 p-4 space-y-3 text-xs"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-[#0F766E]" />
            <h3 className="font-black text-slate-900 text-sm">
              Quick Create Staff / Seller Account (Auto-Saves to Database)
            </h3>
          </div>
          <span className="text-[11px] text-slate-500">
            Staff can immediately log in using the Username &amp; Password below
          </span>
        </div>

        {quickError && (
          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-bold">
            {quickError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 items-end">
          <div className="lg:col-span-1">
            <label className="font-bold text-slate-700 block mb-1 text-[11px]">Staff Full Name *</label>
            <input
              type="text"
              required
              value={quickName}
              onChange={e => {
                const prevAuto = quickName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 14);
                const val = e.target.value;
                setQuickName(val);
                if (!quickUsername || quickUsername === prevAuto) {
                  setQuickUsername(val.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 14));
                }
              }}
              placeholder="e.g. Ali Raza"
              className="w-full min-h-[40px] px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl font-semibold"
            />
          </div>

          <div className="lg:col-span-1">
            <label className="font-bold text-slate-700 block mb-1 text-[11px]">Login Username *</label>
            <input
              type="text"
              required
              value={quickUsername}
              onChange={e => setQuickUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
              placeholder="e.g. aliraza"
              className="w-full min-h-[40px] px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl font-mono font-bold text-teal-900"
            />
          </div>

          <div className="lg:col-span-1">
            <label className="font-bold text-slate-700 block mb-1 text-[11px]">Login Password *</label>
            <input
              type="text"
              required
              value={quickPassword}
              onChange={e => setQuickPassword(e.target.value)}
              placeholder="seller123"
              className="w-full min-h-[40px] px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl font-mono font-bold"
            />
          </div>

          <div className="lg:col-span-1">
            <label className="font-bold text-slate-700 block mb-1 text-[11px]">4-Digit PIN *</label>
            <input
              type="text"
              maxLength={4}
              value={quickPin}
              onChange={e => setQuickPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="5678"
              className="w-full min-h-[40px] px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl font-mono font-bold tracking-widest"
            />
          </div>

          <div className="lg:col-span-1">
            <label className="font-bold text-slate-700 block mb-1 text-[11px]">Account Role</label>
            <select
              value={quickRole}
              onChange={e => setQuickRole(e.target.value as UserRole)}
              className="w-full min-h-[40px] px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl font-bold"
            >
              <option value="staff">Seller &amp; Inventory</option>
              <option value="pharmacist">Pharmacist</option>
              <option value="cashier">POS Cashier</option>
              <option value="admin">Store Manager</option>
            </select>
          </div>

          <div className="lg:col-span-1">
            <button
              type="submit"
              className="w-full min-h-[40px] py-2 px-3 rounded-xl bg-[#0F766E] hover:bg-[#0D655E] text-white font-black shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Save Staff Account</span>
            </button>
          </div>
        </div>
      </form>

      {/* Summary & Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="pro-card p-3.5 flex items-center justify-between gap-2">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 block">Master Owner Account</span>
            <span className="text-sm font-black text-slate-900">Dr. Abdul Rehman</span>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-[#0B191E] text-emerald-300 font-bold text-xs border border-emerald-500/30 shrink-0">
            Protected Owner
          </span>
        </div>

        <div className="pro-card p-3.5 flex items-center justify-between gap-2">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 block">Created Staff / Seller Accounts</span>
            <span className="text-sm font-black text-[#0F766E] tabular-nums">
              {otherStaffAccounts.length} {otherStaffAccounts.length === 1 ? 'Account' : 'Accounts'}
            </span>
          </div>
          <Users className="w-5 h-5 text-[#0F766E]" />
        </div>

        <div className="pro-card p-2.5 flex items-center">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search staff or seller by name, @username, role..."
              className="w-full min-h-[40px] pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-600"
            />
          </div>
        </div>
      </div>

      {/* Mobile Staff Cards */}
      <div className="lg:hidden space-y-2.5">
        {filteredStaff.map(staff => {
          const stats = staffStats[staff.id] || { totalSales: 0, transactions: 0, discounts: 0 };
          const isMasterOwner = staff.id === OWNER_ACCOUNT.id;
          const isCurrentActive = currentUser?.id === staff.id;

          return (
            <div
              key={staff.id}
              className={`pro-card p-3.5 space-y-3 text-xs ${
                isMasterOwner ? 'border-emerald-500/30 bg-emerald-50/20' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shrink-0 ${
                      isMasterOwner
                        ? 'bg-[#0B191E] text-emerald-300 border border-emerald-500/30'
                        : staff.role === 'pharmacist'
                        ? 'bg-[#0F766E] text-white'
                        : 'bg-emerald-600 text-white'
                    }`}
                  >
                    {(staff.fullName || staff.username || 'S').charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-bold text-slate-900 text-sm truncate">
                        {staff.fullName || staff.username}
                      </span>
                      {isCurrentActive && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                          Active
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500 block truncate">
                      {staff.designation}
                    </span>
                  </div>
                </div>

                {isMasterOwner ? (
                  <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-[#0B191E] text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-1 shrink-0">
                    <ShieldCheck className="w-3 h-3" /> Owner
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleStaffStatus(staff.id)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 shrink-0 ${
                      staff.status === 'active'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {staff.status === 'active' ? (
                      <>
                        <CheckCircle2 className="w-3 h-3" /> Active
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3" /> Off
                      </>
                    )}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-[11px] tabular-nums">
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-400 block">Credentials</span>
                  <span className="font-mono font-bold text-slate-900 block truncate">@{staff.username}</span>
                  <span className="font-mono text-slate-600 text-[10px] block truncate">
                    Pass: {staff.password || (isMasterOwner ? 'admin' : 'seller123')}
                  </span>
                  <span className="font-mono font-semibold text-[#0F766E] text-[10px]">
                    PIN: {staff.pin || '1234'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Invoices</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">{stats.transactions}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">Total Sales</span>
                  <span className="font-mono font-black text-[#0F766E] text-sm">{formatPKR(stats.totalSales)}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {!isMasterOwner && (
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        const encoded = window.btoa(
                          unescape(encodeURIComponent(JSON.stringify(staff)))
                        );
                        const url = `${window.location.origin}${window.location.pathname}?staff_token=${encodeURIComponent(encoded)}`;
                        navigator.clipboard.writeText(url);
                        setStatusBanner({
                          title: `Phone / WhatsApp Login Link Copied for ${staff.fullName} (@${staff.username})`,
                          detail: `Send this copied link on WhatsApp to ${staff.fullName} — opening it on any phone or browser automatically registers and logs in their account!`,
                        });
                      } catch {}
                    }}
                    className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-[#0F766E] hover:text-white text-[#0F766E] border border-emerald-200 font-bold text-[11px] inline-flex items-center gap-1 transition-colors"
                  >
                    Copy Phone Link
                  </button>
                )}
                {!isCurrentActive && staff.status === 'active' && (
                  <button
                    type="button"
                    onClick={() => switchUser(staff.id)}
                    className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-[#0F766E] hover:text-white text-slate-700 font-bold text-[11px] inline-flex items-center gap-1 transition-colors"
                  >
                    <LogIn className="w-3.5 h-3.5" /> Switch
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedStaffPerf(staff)}
                  className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold text-[11px]"
                >
                  Stats
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenEdit(staff)}
                  className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-[#0F766E] font-bold text-[11px] inline-flex items-center gap-1"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Edit
                </button>
                {!isMasterOwner && (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteUser(staff)}
                    className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white font-bold text-[11px] inline-flex items-center gap-1 ml-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {otherStaffAccounts.length === 0 && (
          <div className="pro-card p-4 bg-slate-50/70 flex flex-col gap-3">
            <div className="text-xs text-slate-600">
              Currently only <strong>Dr. Abdul Rehman (Owner)</strong> account exists. Tap below to add a seller, dispenser, or cashier login.
            </div>
            <button
              type="button"
              onClick={handleOpenAdd}
              className="min-h-[40px] w-full px-3.5 py-2 rounded-xl bg-[#0F766E] hover:bg-[#0D655E] text-white font-bold text-xs inline-flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Create First Seller Account
            </button>
          </div>
        )}
      </div>

      {/* Desktop Staff Table */}
      <div className="hidden lg:block pro-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Account Holder</th>
                <th className="py-3 px-3">Role &amp; Designation</th>
                <th className="py-3 px-3">Login Credentials</th>
                <th className="py-3 px-3">Last Active Login</th>
                <th className="py-3 px-3 text-right">Invoices</th>
                <th className="py-3 px-3 text-right">Total Sales</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-right">Owner Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStaff.map(staff => {
                const stats = staffStats[staff.id] || { totalSales: 0, transactions: 0, discounts: 0 };
                const isMasterOwner = staff.id === OWNER_ACCOUNT.id;
                const isCurrentActive = currentUser?.id === staff.id;

                return (
                  <tr
                    key={staff.id}
                    className={`transition-colors ${
                      isMasterOwner ? 'bg-emerald-50/30 hover:bg-emerald-50/50' : 'hover:bg-slate-50/70'
                    }`}
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                            isMasterOwner
                              ? 'bg-[#0B191E] text-emerald-300 border border-emerald-500/30 shadow-xs'
                              : staff.role === 'pharmacist'
                              ? 'bg-[#0F766E] text-white'
                              : 'bg-emerald-600 text-white'
                          }`}
                        >
                          {(staff.fullName || staff.username || 'S').charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900">{staff.fullName || staff.username}</span>
                            {isCurrentActive && (
                              <span className="px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 font-bold text-[10px]">
                                Active Session
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-500 block">{staff.phone || staff.email}</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {isMasterOwner ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#0B191E] text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" /> Master Owner
                          </span>
                        ) : staff.role === 'admin' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-[#0F766E] border border-emerald-200 inline-flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" /> Manager
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200 inline-flex items-center gap-1">
                            <UserIcon className="w-3 h-3" /> Seller / Staff
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-600 font-medium">{staff.designation}</span>
                    </td>

                    <td className="py-3.5 px-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-mono font-bold text-slate-900 text-xs">
                          @{staff.username}
                        </span>
                        <span className="text-[11px] text-slate-600 font-mono">
                          Pass: <strong className="text-slate-800">{staff.password || (isMasterOwner ? 'admin' : 'seller123')}</strong>
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] text-[#0F766E] font-mono font-semibold">
                          <KeyRound className="w-3 h-3" /> PIN: {staff.pin || '1234'}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-slate-500 font-mono text-[11px]">
                      {staff.lastLogin || 'Ready to Sign In'}
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-800 tabular-nums">
                      {stats.transactions}
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono font-black text-slate-900 text-sm tabular-nums">
                      {formatPKR(stats.totalSales)}
                    </td>

                    <td className="py-3.5 px-3 text-center">
                      {isMasterOwner ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#0B191E] text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Permanent Owner
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleStaffStatus(staff.id)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer ${
                            staff.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                          }`}
                        >
                          {staff.status === 'active' ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" /> Active
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3" /> Deactivated
                            </>
                          )}
                        </button>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {!isMasterOwner && (
                          <button
                            type="button"
                            onClick={() => {
                              try {
                                const encoded = window.btoa(
                                  unescape(encodeURIComponent(JSON.stringify(staff)))
                                );
                                const url = `${window.location.origin}${window.location.pathname}?staff_token=${encodeURIComponent(encoded)}`;
                                navigator.clipboard.writeText(url);
                                setStatusBanner({
                                  title: `Phone / WhatsApp Login Link Copied for ${staff.fullName} (@${staff.username})`,
                                  detail: `Send this copied link on WhatsApp to ${staff.fullName} — opening it on any phone or browser automatically registers and logs in their account!`,
                                });
                              } catch {}
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-[#0F766E] hover:text-white text-[#0F766E] border border-emerald-200 font-bold text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer"
                            title="Copy 1-Tap Phone / WhatsApp Login Link"
                          >
                            Copy Phone Link
                          </button>
                        )}
                        {!isCurrentActive && staff.status === 'active' && (
                          <button
                            type="button"
                            onClick={() => switchUser(staff.id)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-[#0F766E] hover:text-white text-slate-700 font-bold text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer"
                            title={`Switch portal to ${staff.fullName}`}
                          >
                            <LogIn className="w-3.5 h-3.5" />
                            Switch
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setSelectedStaffPerf(staff)}
                          className="px-2.5 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold text-[11px] cursor-pointer"
                        >
                          Stats
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(staff)}
                          className="p-1.5 text-slate-500 hover:text-[#0F766E] hover:bg-teal-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit Account & Permissions"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {!isMasterOwner && (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteUser(staff)}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white font-bold text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer"
                            title="Remove Staff Account"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Remove
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {otherStaffAccounts.length === 0 && (
          <div className="p-6 bg-slate-50/60 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-600">
              Currently only <strong>Dr. Abdul Rehman (Owner)</strong> account exists. Click{' '}
              <strong>&quot;+ Create Staff / Seller Account&quot;</strong> above to add a seller, dispenser, or cashier login.
            </div>
            <button
              type="button"
              onClick={handleOpenAdd}
              className="px-3.5 py-2 rounded-xl bg-[#0F766E] hover:bg-[#0D655E] text-white font-bold text-xs shrink-0 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Create First Seller Account
            </button>
          </div>
        )}
      </div>

      {/* Confirm Delete Single Staff Modal */}
      {confirmDeleteUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 border border-slate-200 shadow-2xl space-y-4 text-xs">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900">
                  Remove Staff Account?
                </h4>
                <p className="text-slate-600 mt-1 leading-relaxed">
                  Are you sure you want to permanently remove the account for{' '}
                  <strong>{confirmDeleteUser.fullName}</strong> (<code>@{confirmDeleteUser.username}</code>)? They will no longer be able to sign in.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmDeleteUser(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteStaff(confirmDeleteUser.id);
                  setConfirmDeleteUser(null);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold"
              >
                Yes, Remove Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Remove All Other Staff Modal */}
      {confirmRemoveAll && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 border border-slate-200 shadow-2xl space-y-4 text-xs">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900">
                  Remove All Other Staff Accounts?
                </h4>
                <p className="text-slate-600 mt-1 leading-relaxed">
                  This will remove all <strong>{otherStaffAccounts.length}</strong> staff/seller accounts and keep only{' '}
                  <strong>Dr. Abdul Rehman (Owner)</strong>.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmRemoveAll(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  removeAllOtherStaff();
                  setConfirmRemoveAll(false);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold"
              >
                Remove All Other Accounts
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Staff Performance Inspect Modal */}
      {selectedStaffPerf && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 border border-slate-200 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h4 className="font-bold text-sm text-slate-900">
                  Sales Performance: {selectedStaffPerf.fullName}
                </h4>
                <p className="text-[11px] text-slate-500">
                  {selectedStaffPerf.designation} • Login: @{selectedStaffPerf.username} (PIN: {selectedStaffPerf.pin || '1234'})
                </p>
              </div>
              <button onClick={() => setSelectedStaffPerf(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-[10px] text-slate-500 uppercase block">Total Sales</span>
                <span className="font-mono font-black text-slate-900 text-sm">
                  {formatPKR(staffStats[selectedStaffPerf.id]?.totalSales || 0)}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-[10px] text-slate-500 uppercase block">Invoices</span>
                <span className="font-mono font-black text-teal-800 text-sm">
                  {staffStats[selectedStaffPerf.id]?.transactions || 0}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-[10px] text-slate-500 uppercase block">Discounts</span>
                <span className="font-mono font-black text-emerald-700 text-sm">
                  {formatPKR(staffStats[selectedStaffPerf.id]?.discounts || 0)}
                </span>
              </div>
            </div>

            <div>
              <span className="font-bold text-slate-800 block mb-2">Granted RBAC Permissions:</span>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                {Object.entries(selectedStaffPerf.permissions).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="capitalize text-slate-700 font-medium">{key.replace(/([A-Z])/g, ' $1')}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${val ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-500'}`}>
                      {val ? 'Allowed' : 'Restricted'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-right pt-2 border-t border-slate-200">
              <button
                onClick={() => setSelectedStaffPerf(null)}
                className="px-4 py-2 bg-slate-800 text-white font-bold rounded-xl"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Staff Modal */}
      {showAddEditModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 border border-slate-200 shadow-2xl space-y-3.5 text-xs max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <div>
                <h4 className="font-bold text-sm text-slate-900">
                  {editingStaff
                    ? `Edit Account: ${editingStaff.fullName}`
                    : 'Create New Staff / Seller Account (Authorized by Dr. Abdul Rehman)'}
                </h4>
                <p className="text-[11px] text-slate-500">
                  Set login username, 4-digit PIN pad code, password, and counter permissions
                </p>
              </div>
              <button onClick={() => setShowAddEditModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold">
                {formError}
              </div>
            )}

            {/* Quick Role Preset Selector */}
            {editingStaff?.id !== OWNER_ACCOUNT.id && (
              <div>
                <label className="font-bold text-slate-700 block mb-1.5 text-[11px] uppercase tracking-wider">
                  Quick Account Type Preset:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => applyRolePreset('seller')}
                    className={`py-1.5 px-2 rounded-lg font-bold border text-[11px] transition-colors ${
                      designation.includes('Seller')
                        ? 'bg-teal-600 text-white border-teal-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Medicine Seller
                  </button>
                  <button
                    type="button"
                    onClick={() => applyRolePreset('pharmacist')}
                    className={`py-1.5 px-2 rounded-lg font-bold border text-[11px] transition-colors ${
                      role === 'pharmacist'
                        ? 'bg-teal-600 text-white border-teal-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Pharmacist
                  </button>
                  <button
                    type="button"
                    onClick={() => applyRolePreset('cashier')}
                    className={`py-1.5 px-2 rounded-lg font-bold border text-[11px] transition-colors ${
                      role === 'cashier'
                        ? 'bg-teal-600 text-white border-teal-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Cashier
                  </button>
                  <button
                    type="button"
                    onClick={() => applyRolePreset('manager')}
                    className={`min-h-[38px] py-1.5 px-2 rounded-lg font-bold border text-[11px] transition-colors ${
                      role === 'admin'
                        ? 'bg-[#0B191E] text-emerald-300 border-[#0B191E]'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Store Manager
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Staff / Seller Full Name *</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={e => {
                      const prevAuto = fullName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 14);
                      const nextName = e.target.value;
                      setFullName(nextName);
                      if (!editingStaff && (!username || username === prevAuto)) {
                        setUsername(nextName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 14));
                      }
                    }}
                    placeholder="e.g. Ali Raza (Seller)"
                    className="w-full p-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Login Username *</label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                    placeholder="e.g. aliraza"
                    className="w-full p-2 border border-slate-200 rounded-lg font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-teal-50/60 border border-teal-200 rounded-xl">
                <div>
                  <label className="font-bold text-teal-900 block mb-1">4-Digit Fast Login PIN *</label>
                  <input
                    type="text"
                    required
                    maxLength={4}
                    value={pin}
                    onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="5678"
                    className="w-full p-2 bg-white border border-teal-300 rounded-lg font-mono font-black text-sm tracking-widest text-teal-900"
                  />
                </div>
                <div>
                  <label className="font-bold text-teal-900 block mb-1">Login Password *</label>
                  <input
                    type="text"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="seller123"
                    className="w-full p-2 bg-white border border-teal-300 rounded-lg font-mono font-bold text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Job Designation / Role Title</label>
                  <input
                    type="text"
                    value={designation}
                    onChange={e => setDesignation(e.target.value)}
                    placeholder="Medicine Seller / Counter Salesperson"
                    className="w-full p-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Portal Access Level</label>
                  <select
                    value={role}
                    disabled={editingStaff?.id === OWNER_ACCOUNT.id}
                    onChange={e => setRole(e.target.value as UserRole)}
                    className="w-full p-2 border border-slate-200 rounded-lg font-bold"
                  >
                    <option value="staff">Seller / Dispenser (POS & Sales Portal)</option>
                    <option value="pharmacist">Pharmacist (POS, Inventory & Stock)</option>
                    <option value="cashier">Cashier (POS Billing Only)</option>
                    <option value="admin">Full Admin Co-Manager</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Phone Number (Optional)</label>
                  <input
                    type="text"
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
                    placeholder="seller@pharmacare.pk"
                    className="w-full p-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              {/* Permissions Checklist */}
              <div>
                <label className="font-bold text-slate-800 block mb-1.5 uppercase text-[10px] tracking-wider">
                  Assigned Counter & ERP Permissions:
                </label>
                <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  {Object.keys(permissions).map(key => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean((permissions as any)[key])}
                        onChange={e =>
                          setPermissions(prev => ({
                            ...prev,
                            [key]: e.target.checked,
                          }))
                        }
                        className="w-4 h-4 rounded text-teal-600"
                      />
                      <span className="text-[11px] capitalize text-slate-700 font-medium">
                        {key.replace(/([A-Z])/g, ' $1')}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddEditModal(false)}
                  className="flex-1 min-h-[42px] py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 min-h-[42px] py-2.5 bg-[#0F766E] hover:bg-[#0D655E] text-white rounded-xl font-bold shadow-sm"
                >
                  {editingStaff ? 'Save Account Changes' : 'Create Staff / Seller Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

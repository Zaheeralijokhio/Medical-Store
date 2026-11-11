/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Building,
  Save,
  RotateCcw,
  Download,
  Upload,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Percent,
  FileText,
  DollarSign,
  KeyRound,
  Database,
  RefreshCw,
  HardDrive,
  Users,
  Lock,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { StoreSettings, User, BackupSnapshot } from '../../types/pharmacy';

export const SystemSettingsView: React.FC = () => {
  const {
    settings,
    updateSettings,
    resetToDemoData,
    medicines,
    sales,
    purchases,
    suppliers,
    backupSnapshots,
    fetchBackupSnapshots,
    createInstantSnapshot,
    restoreSnapshot,
  } = useStore();

  const { availableUsers, syncStaffList, isAdmin } = useAuth();

  const [form, setForm] = useState<StoreSettings>({ ...settings });
  const [successSaved, setSuccessSaved] = useState(false);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotToast, setSnapshotToast] = useState('');
  const [dbStatus, setDbStatus] = useState<{
    storageEngine: string;
    mongoConfigured: boolean;
    mongoConnected: boolean;
    mongoDbName: string;
    lastMongoSyncAt: string | null;
    localFilePath: string;
    lastUpdated: string;
    counts?: {
      staffAccounts: number;
      medicines: number;
      sales: number;
      purchases: number;
      suppliers: number;
      customers: number;
      expenses: number;
    };
  } | null>(null);
  const [syncingDb, setSyncingDb] = useState(false);

  // Staff PINs editable state
  const [staffUsers, setStaffUsers] = useState<User[]>(availableUsers);

  const fetchDbStatus = async () => {
    try {
      const res = await fetch('/api/db-status');
      if (res.ok) {
        const data = await res.json();
        setDbStatus(data);
      }
    } catch {}
  };

  useEffect(() => {
    fetchBackupSnapshots();
    fetchDbStatus();
  }, []);

  const handleForceDatabaseSync = async () => {
    setSyncingDb(true);
    try {
      const res = await fetch('/api/db-sync-now', { method: 'POST' });
      if (res.ok) {
        await fetchDbStatus();
        setSnapshotToast('All store & staff data synced to database!');
        setTimeout(() => setSnapshotToast(''), 4000);
      }
    } catch {}
    setSyncingDb(false);
  };

  const handleChange = (field: keyof StoreSettings, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(form);
    syncStaffList(staffUsers);
    setSuccessSaved(true);
    setTimeout(() => setSuccessSaved(false), 3000);
  };

  const handleStaffPinChange = (userId: string, newPin: string) => {
    setStaffUsers(prev =>
      prev.map(u => (u.id === userId ? { ...u, pin: newPin.slice(0, 4) } : u))
    );
  };

  const handleStaffPricePermChange = (userId: string, canModify: boolean) => {
    setStaffUsers(prev =>
      prev.map(u =>
        u.id === userId
          ? {
              ...u,
              permissions: {
                ...u.permissions,
                canModifyPrices: canModify,
              },
            }
          : u
      )
    );
  };

  const handleCreateSnapshot = async () => {
    setSnapshotLoading(true);
    try {
      const success = await createInstantSnapshot();
      if (success) {
        setSnapshotToast('New snapshot created successfully on server disk!');
        await fetchBackupSnapshots();
      } else {
        alert('Failed to create snapshot');
      }
    } catch {
      alert('Error creating snapshot');
    } finally {
      setSnapshotLoading(false);
      setTimeout(() => setSnapshotToast(''), 4000);
    }
  };

  const handleRestore = async (filename: string) => {
    if (
      !confirm(
        `CAUTION: Restoring snapshot "${filename}" will overwrite active database records. Continue?`
      )
    ) {
      return;
    }
    setSnapshotLoading(true);
    try {
      const success = await restoreSnapshot(filename);
      if (success) {
        setSnapshotToast(`Snapshot restored successfully! Reloading data...`);
        setTimeout(() => window.location.reload(), 1500);
      } else {
        alert('Failed to restore snapshot');
      }
    } catch {
      alert('Error during restoration');
    } finally {
      setSnapshotLoading(false);
    }
  };

  // Export full JSON database backup
  const handleExportBackup = () => {
    const backupData = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      settings: form,
      staff: staffUsers,
      medicines,
      sales,
      purchases,
      suppliers,
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `PharmaCare_Backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <Settings className="w-5 h-5 text-teal-600" />
            Pharmacy Profile, Security & Disaster Recovery
          </h3>
          <p className="text-xs text-slate-500">
            DRAP Drug Licensing, NTN tax registrations, staff PIN security, and Hostinger / Server database sync
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleForceDatabaseSync}
            disabled={syncingDb}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncingDb ? 'animate-spin' : ''}`} />
            Sync Database Now
          </button>

          <button
            onClick={handleExportBackup}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" /> Export JSON
          </button>
        </div>
      </div>

      {/* Live Database Storage Architecture Status Card */}
      <div className="bg-slate-900 text-white rounded-2xl border border-slate-800 p-4 shadow-sm space-y-3 text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <Database className="w-5 h-5 text-teal-400 shrink-0" />
            <div>
              <h4 className="font-black text-sm text-white">
                Where Your Pharmacy Database Is Stored (Dual-Layer Persistence)
              </h4>
              <p className="text-[11px] text-slate-400">
                Every staff account, medicine, invoice, and supplier is automatically saved in real time
              </p>
            </div>
          </div>
          <span
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
              dbStatus?.mongoConnected
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
            }`}
          >
            {dbStatus?.mongoConnected
              ? 'Connected: Hostinger MongoDB Atlas + Server Disk'
              : 'Active: Server Disk (Auto-Connects MongoDB on Hostinger)'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-slate-800/70 border border-slate-700/70 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400 block">
              1. Hostinger Cloud Database (MongoDB Atlas)
            </span>
            <p className="text-xs font-bold text-white">
              Database: <code className="text-teal-300">{dbStatus?.mongoDbName || 'pharmacare_erp'}</code> (Collections: <code className="text-teal-300">pharmacy_store_state</code> &amp; <code className="text-teal-300">staff_accounts</code>)
            </p>
            <p className="text-[11px] text-slate-300">
              {dbStatus?.mongoConnected
                ? `Live synced with your Hostinger MongoDB Atlas cluster (${dbStatus.lastMongoSyncAt ? new Date(dbStatus.lastMongoSyncAt).toLocaleTimeString() : 'Active'}).`
                : 'When deployed on Hostinger (medicalstore.edulinker.online), Hostinger automatically injects MONGODB_URI and stores all records in your MongoDB Atlas Cluster0.'}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-800/70 border border-slate-700/70 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 block">
              2. Server Disk Database + Instant Browser Cache
            </span>
            <p className="text-xs font-bold text-white">
              Server File: <code className="text-indigo-300">{dbStatus?.localFilePath || 'data/pharmacy_database.json'}</code>
            </p>
            <p className="text-[11px] text-slate-300">
              Saved records: <strong>{dbStatus?.counts?.staffAccounts ?? availableUsers.length}</strong> Staff Accounts •{' '}
              <strong>{dbStatus?.counts?.medicines ?? medicines.length}</strong> Medicines •{' '}
              <strong>{dbStatus?.counts?.sales ?? sales.length}</strong> Sales
            </p>
          </div>
        </div>
      </div>

      {successSaved && (
        <div className="p-3 bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-200" />
          <span>System configuration and staff security settings saved successfully!</span>
        </div>
      )}

      {snapshotToast && (
        <div className="p-3 bg-teal-600 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2 animate-in fade-in">
          <Database className="w-4 h-4 text-teal-200" />
          <span>{snapshotToast}</span>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="space-y-4 text-xs">
        {/* Pharmacy Identity Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-2">
            <Building className="w-4 h-4 text-teal-600" /> 1. Store Legal Profile & Contact Details
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Medical Store Name *</label>
              <input
                type="text"
                required
                value={form.storeName}
                onChange={e => handleChange('storeName', e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg font-bold text-sm"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Tagline / Motto</label>
              <input
                type="text"
                value={form.storeTagline}
                onChange={e => handleChange('storeTagline', e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Drug License # (DRAP Registered) *</label>
              <input
                type="text"
                required
                value={form.drugLicenseNumber}
                onChange={e => handleChange('drugLicenseNumber', e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg font-mono font-bold text-teal-800"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Tax Registration (NTN / STRN) *</label>
              <input
                type="text"
                required
                value={form.taxRegistrationNumber}
                onChange={e => handleChange('taxRegistrationNumber', e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg font-mono"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Official Contact Phones *</label>
              <input
                type="text"
                required
                value={form.phone}
                onChange={e => handleChange('phone', e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Official Email Address</label>
              <input
                type="email"
                value={form.email}
                onChange={e => handleChange('email', e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="font-semibold text-slate-700 block mb-1">Physical Store Address *</label>
              <input
                type="text"
                required
                value={form.storeAddress}
                onChange={e => handleChange('storeAddress', e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* Currency & Operating Regional Parameters */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-2">
            <DollarSign className="w-4 h-4 text-emerald-600" /> 2. Currency, Timezone & Sales Tax (Pakistan Standard)
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Operating Currency</label>
              <input
                type="text"
                disabled
                value={`${form.currency} (${form.currencySymbol})`}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-slate-600"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Default: Pakistani Rupee (PKR / Rs.)</span>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Regional Timezone</label>
              <input
                type="text"
                disabled
                value={form.timezone}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-slate-600"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Default: Asia/Karachi (PKT GMT+5)</span>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Retail Sales Tax Rate (%)</label>
              <div className="relative">
                <Percent className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                <input
                  type="number"
                  min="0"
                  max="25"
                  step="0.5"
                  value={form.taxRatePercentage}
                  onChange={e => handleChange('taxRatePercentage', parseFloat(e.target.value) || 0)}
                  className="w-full p-2 border border-slate-200 rounded-lg font-mono font-bold text-slate-900"
                />
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">Essential medicines in Pakistan are zero-rated (0%).</span>
            </div>
          </div>
        </div>

        {/* Staff PIN & Role Access Control */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-indigo-600" /> 3. Employee 4-Digit Security PINs & Price Permissions
            </h4>
            <span className="text-[11px] text-slate-500">
              Used for touch keypad login and cashier price alteration locks
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {staffUsers.map(user => (
              <div key={user.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                      user.role === 'admin'
                        ? 'bg-indigo-600'
                        : user.role === 'pharmacist'
                        ? 'bg-teal-600'
                        : 'bg-amber-600'
                    }`}
                  >
                    {user.fullName.charAt(0)}
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 block text-xs">{user.fullName}</span>
                    <span className="text-[11px] text-slate-500 block">
                      Username: <code className="text-teal-700 font-mono font-semibold">{user.username}</code> • Role: <strong className="capitalize">{user.role}</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* PIN Input */}
                  <div>
                    <label className="text-[10px] text-slate-400 block font-semibold">4-Digit Security PIN</label>
                    <input
                      type="text"
                      maxLength={4}
                      value={user.pin || '1234'}
                      onChange={e => handleStaffPinChange(user.id, e.target.value)}
                      className="w-20 p-1.5 border border-slate-200 rounded-lg font-mono font-bold text-center text-xs tracking-widest bg-slate-50 focus:bg-white"
                    />
                  </div>

                  {/* Can Modify Prices Checkbox */}
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-700 pt-3">
                    <input
                      type="checkbox"
                      checked={user.role === 'admin' || !!user.permissions?.canModifyPrices}
                      disabled={user.role === 'admin'}
                      onChange={e => handleStaffPricePermChange(user.id, e.target.checked)}
                      className="rounded text-teal-600"
                    />
                    <span>Modify Official Prices</span>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Rolling Backups & Disaster Recovery */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div>
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-teal-600" /> 4. Local Disk Rolling Snapshots & Disaster Recovery
              </h4>
              <p className="text-[11px] text-slate-500">
                Server snapshots stored in <code className="font-mono text-teal-700">data/backups/</code> with 1-click restore
              </p>
            </div>

            <button
              type="button"
              disabled={snapshotLoading}
              onClick={handleCreateSnapshot}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${snapshotLoading ? 'animate-spin' : ''}`} />
              <span>Create Snapshot Now</span>
            </button>
          </div>

          <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
            {backupSnapshots.length === 0 ? (
              <div className="p-6 text-center text-slate-400">
                <Database className="w-8 h-8 mx-auto mb-1 opacity-30" />
                <p className="text-xs">No snapshot backups found. Click &quot;Create Snapshot Now&quot; to generate a fresh snapshot.</p>
              </div>
            ) : (
              backupSnapshots.map(snap => (
                <div key={snap.filename} className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-xs text-slate-900 font-mono truncate">{snap.filename}</p>
                    <p className="text-[10px] text-slate-500">
                      {new Date(snap.timestamp).toLocaleString()} • Size: {(snap.sizeBytes / 1024).toFixed(1)} KB
                      {snap.recordsCount && (
                        <span> • {snap.recordsCount.medicines} meds, {snap.recordsCount.sales} sales</span>
                      )}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={snapshotLoading}
                    onClick={() => handleRestore(snap.filename)}
                    className="px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold transition-colors"
                  >
                    Restore
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-md shadow-teal-700/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            <Save className="w-4 h-4" /> Save System Settings & Security
          </button>
        </div>
      </form>
    </div>
  );
};

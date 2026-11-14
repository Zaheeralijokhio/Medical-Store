/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Pill,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  Receipt,
  PackageCheck,
  ShieldCheck,
  MapPin,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { sanitizeStaffAccounts } from '../../data/initialData';

interface LoginPageProps {
  onLoginSuccess?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { login, syncStaffList } = useAuth();
  const { settings } = useStore();

  // Fetch latest staff list from backend database whenever LoginPage mounts
  useEffect(() => {
    let active = true;
    fetch('/api/staff', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!active || !Array.isArray(data?.staffMembers)) return;
        const clean = sanitizeStaffAccounts(data.staffMembers);
        try {
          localStorage.setItem('pharmacare_staff', JSON.stringify(clean));
        } catch {}
        syncStaffList(clean);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      const result = await login(username, password);
      if (result.success) {
        onLoginSuccess?.();
      } else {
        setErrorMessage(result.error || 'Invalid username or password.');
      }
    } catch {
      setErrorMessage('Unexpected login error. Please retry.');
    } finally {
      setIsLoading(false);
    }
  };

  const storeTitle = settings?.storeName || 'PharmaCare Medical & General Store';
  const storeAddress = settings?.storeAddress || 'Main Commercial Market, Pakistan';
  const storeLicense = settings?.drugLicenseNumber || 'DRAP-LIC-0001';

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#071519] via-[#0B2228] to-[#0E3532] flex items-center justify-center p-4 sm:p-6 lg:p-10 relative overflow-hidden">
      {/* Subtle architectural background lines */}
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="w-full max-w-[960px] bg-white rounded-3xl shadow-2xl shadow-black/40 border border-white/15 overflow-hidden grid grid-cols-1 md:grid-cols-12 relative z-10">
        {/* Left Showcase Panel */}
        <div className="md:col-span-6 bg-gradient-to-br from-[#081A1F] via-[#0C2930] to-[#0F6B63] text-white p-7 sm:p-9 lg:p-11 flex flex-col justify-between relative overflow-hidden">
          {/* Subtle decorative radial highlight */}
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              backgroundImage:
                'radial-gradient(circle at 85% 15%, rgba(45, 212, 191, 0.35), transparent 55%)',
            }}
          />

          <div className="relative z-10">
            {/* Brand Lockup */}
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-slate-950 shadow-md shadow-teal-950/40 shrink-0">
                <Pill className="w-5 h-5 stroke-[2.4]" />
              </div>
              <div>
                <span className="text-base font-extrabold tracking-tight text-white block leading-none">
                  PharmaCare Pro
                </span>
                <span className="text-[11px] text-teal-200/80 font-medium block mt-1">
                  Pharmacy Management Suite
                </span>
              </div>
            </div>

            {/* Store Title & Description */}
            <div className="mt-8 sm:mt-10">
              <h1 className="text-2xl sm:text-[26px] font-extrabold text-white leading-tight tracking-tight text-balance">
                {storeTitle}
              </h1>
              <p className="mt-2.5 text-xs sm:text-sm text-teal-100/80 leading-relaxed">
                Complete point-of-sale counter billing, FEFO batch inventory tracking, and real-time financial accounts.
              </p>
            </div>

            {/* 3 Structured Capability Highlights */}
            <div className="mt-7 space-y-2.5 hidden sm:block">
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/[0.06] border border-white/10">
                <div className="w-8 h-8 rounded-xl bg-teal-400/15 text-teal-300 flex items-center justify-center shrink-0 mt-0.5">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white">Fast POS &amp; Cash Memo Billing</h3>
                  <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                    Instant barcode lookup, fixed retail pricing, and thermal / A4 invoice printing.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/[0.06] border border-white/10">
                <div className="w-8 h-8 rounded-xl bg-emerald-400/15 text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
                  <PackageCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white">FEFO Batch &amp; Expiry Control</h3>
                  <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                    Automatic first-expiry stock deduction with low-stock and near-expiry alerts.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Store Location & License Footer */}
          <div className="mt-8 pt-5 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs text-teal-100/75 relative z-10">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-teal-300 shrink-0" />
              <span className="font-medium text-white/90">{storeAddress}</span>
            </div>
            <span className="font-mono text-[11px] text-teal-200/80">
              Lic: {storeLicense}
            </span>
          </div>
        </div>

        {/* Right Sign-In Form Panel */}
        <div className="md:col-span-6 p-7 sm:p-10 lg:p-12 flex flex-col justify-center bg-white">
          <div className="max-w-sm mx-auto w-full">
            {/* Form Header */}
            <div className="mb-7">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0F766E] mb-2">
                <ShieldCheck className="w-4 h-4" />
                <span>Authorized Store Access</span>
              </div>
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Sign in to your account
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1.5">
                Enter your username and password to open the pharmacy workspace.
              </p>
            </div>

            {errorMessage && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    autoComplete="username"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="block w-full pl-10 pr-4 py-3 bg-slate-50/80 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-4 focus:ring-[#0F766E]/12 focus:border-[#0F766E] transition-all"
                    placeholder="Enter your username"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-11 py-3 bg-slate-50/80 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-4 focus:ring-[#0F766E]/12 focus:border-[#0F766E] transition-all"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-1">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full min-h-[46px] flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-gradient-to-r from-[#0F766E] via-teal-600 to-emerald-600 hover:from-[#0D655E] hover:to-emerald-500 text-white text-sm font-bold shadow-md shadow-teal-700/20 focus:outline-hidden focus:ring-4 focus:ring-[#0F766E]/25 transition-all disabled:opacity-60 cursor-pointer"
                >
                  {isLoading ? (
                    <span>Signing in...</span>
                  ) : (
                    <>
                      <span>Sign In to Workspace</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>

            <div className="mt-8 pt-5 border-t border-slate-100 text-center">
              <p className="text-[11px] text-slate-400">
                Protected pharmacy terminal · Owner &amp; Staff accounts supported
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

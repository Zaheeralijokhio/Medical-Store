/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Pill,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  KeyRound,
  Delete,
  RotateCcw,
  Users,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { sanitizeStaffAccounts } from '../../data/initialData';
import { User } from '../../types/pharmacy';

interface LoginPageProps {
  onLoginSuccess?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { login, loginWithPin, availableUsers, syncStaffList } = useAuth();
  const { settings, staffMembers } = useStore();

  const [authMode, setAuthMode] = useState<'password' | 'pin'>('password');
  const [portalType, setPortalType] = useState<'admin' | 'staff'>('admin');

  // Always merge AuthContext availableUsers + StoreContext staffMembers so newly created staff show up immediately
  const allUsers = useMemo(() => {
    return sanitizeStaffAccounts([...availableUsers, ...staffMembers]);
  }, [availableUsers, staffMembers]);

  // Also fetch latest staff list from backend database whenever LoginPage mounts
  useEffect(() => {
    let active = true;
    fetch('/api/staff')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!active || !Array.isArray(data?.staffMembers)) return;
        const merged = sanitizeStaffAccounts([...allUsers, ...data.staffMembers]);
        syncStaffList(merged);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // PIN mode state
  const [selectedUserId, setSelectedUserId] = useState<string>(
    allUsers[0]?.id || 'usr-owner-1'
  );
  const [pinDigits, setPinDigits] = useState<string>('');
  const [pinLoading, setPinLoading] = useState(false);

  // Password mode state
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const staffAccounts: User[] = allUsers.filter(u => u.id !== 'usr-owner-1');

  // Handle PIN input
  const handlePinDigit = async (digit: string) => {
    if (pinDigits.length >= 4) return;
    const nextPin = pinDigits + digit;
    setPinDigits(nextPin);
    setErrorMessage('');

    if (nextPin.length === 4) {
      setPinLoading(true);
      try {
        const result = await loginWithPin(nextPin, selectedUserId);
        if (result.success) {
          onLoginSuccess?.();
        } else {
          setErrorMessage(result.error || 'Invalid 4-digit PIN. Please try again.');
          setPinDigits('');
        }
      } catch {
        setErrorMessage('Authentication error. Please try again.');
        setPinDigits('');
      } finally {
        setPinLoading(false);
      }
    }
  };

  const handlePinBackspace = () => {
    setPinDigits(prev => prev.slice(0, -1));
  };

  const handlePinClear = () => {
    setPinDigits('');
    setErrorMessage('');
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      const result = await login(username, password);
      if (result.success) {
        onLoginSuccess?.();
      } else {
        setErrorMessage(result.error || 'Authentication failed. Please verify username and password.');
      }
    } catch {
      setErrorMessage('Unexpected login error. Please retry.');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedUser = allUsers.find(u => u.id === selectedUserId) || allUsers[0];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Subtle medical grid background accents */}
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#0d9488_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />
      <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center">
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center text-white shadow-lg shadow-teal-500/30">
            <Pill className="w-7 h-7 transform -rotate-12" />
          </div>
          <div className="text-left">
            <h1 className="text-2xl font-black text-white tracking-tight">
              {settings.storeName.split(' ')[0]} <span className="text-teal-400">Pro</span>
            </h1>
            <p className="text-xs text-teal-200/80 font-medium">
              Medical Store & Pharmacy ERP System
            </p>
          </div>
        </div>

        <h2 className="text-lg font-bold text-slate-100">
          System Login Portal
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Sign in as Store Owner (`admin`) or Staff / Seller Account
        </p>

        {/* Auth Method Switcher (Username/Password vs 4-Digit PIN) */}
        <div className="mt-4 bg-slate-900 p-1 rounded-xl flex items-center max-w-xs mx-auto border border-slate-800">
          <button
            type="button"
            onClick={() => {
              setAuthMode('password');
              setErrorMessage('');
            }}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              authMode === 'password'
                ? 'bg-teal-500 text-slate-950 shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Username & Password</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('pin');
              setErrorMessage('');
            }}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              authMode === 'pin'
                ? 'bg-teal-500 text-slate-950 shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>4-Digit PIN Pad</span>
          </button>
        </div>
      </div>

      <div className="mt-5 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-slate-900/95 backdrop-blur-xl py-6 px-6 sm:px-8 shadow-2xl rounded-2xl border border-slate-800">
          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {authMode === 'password' ? (
            <div className="space-y-4">
              {/* Role Tabs: Owner/Admin vs Staff/Seller */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPortalType('admin');
                    setUsername('admin');
                    setPassword('');
                    setErrorMessage('');
                  }}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                    portalType === 'admin'
                      ? 'bg-indigo-500/20 border-indigo-500 text-white'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold block text-white">Owner / Admin</span>
                    <span className="text-[10px] text-indigo-300 block truncate">Full System Control</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPortalType('staff');
                    setUsername(staffAccounts[0]?.username || '');
                    setPassword('');
                    setErrorMessage('');
                  }}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                    portalType === 'staff'
                      ? 'bg-teal-500/20 border-teal-500 text-white'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold block text-white">Staff / Seller</span>
                    <span className="text-[10px] text-teal-300 block truncate">
                      {staffAccounts.length} Staff Account{staffAccounts.length === 1 ? '' : 's'}
                    </span>
                  </div>
                </button>
              </div>

              {/* Always show available Staff Accounts when any exist so user can click to select immediately */}
              {staffAccounts.length > 0 && (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Available Staff Accounts (Click to select):
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {staffAccounts.map(staff => (
                      <button
                        key={staff.id}
                        type="button"
                        onClick={() => {
                          setPortalType('staff');
                          setUsername(staff.username);
                          setErrorMessage('');
                        }}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                          username.toLowerCase() === staff.username.toLowerCase()
                            ? 'bg-teal-500/25 border-teal-400 text-teal-200'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {staff.fullName} (@{staff.username})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {portalType === 'staff' && staffAccounts.length === 0 && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs">
                  No staff accounts have been created yet. Sign in as <strong>Owner / Admin</strong> (username: <code>admin</code>, password: <code>admin</code>) and go to <strong>Staff Accounts</strong> to create accounts for sellers or staff.
                </div>
              )}

              {/* Username & Password Form */}
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Username
                  </label>
                  <div className="relative rounded-xl shadow-xs">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <UserIcon className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      className="block w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:border-teal-500 font-mono"
                      placeholder={portalType === 'admin' ? 'admin' : 'Enter staff username'}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Password
                  </label>
                  <div className="relative rounded-xl shadow-xs">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="block w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:border-teal-500 font-mono"
                      placeholder={portalType === 'admin' ? 'Enter admin password' : 'Enter staff password'}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={e => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 bg-slate-950 border-slate-700"
                    />
                    <span>Keep me signed in on this tab</span>
                  </label>
                  {portalType === 'admin' && (
                    <span className="text-[11px] text-slate-400 font-mono">
                      Default: <strong className="text-teal-300">admin / admin</strong>
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-sm font-black shadow-lg shadow-teal-500/20 focus:outline-hidden focus:ring-2 focus:ring-teal-400 transition-all active:scale-[0.99] disabled:opacity-70 cursor-pointer"
                >
                  {isLoading ? (
                    <span>Signing In...</span>
                  ) : (
                    <>
                      <span>
                        {portalType === 'admin' ? 'Sign In as Owner / Admin' : 'Sign In as Staff'}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          ) : (
            /* 4-Digit Fast PIN Keypad Mode */
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2 text-center">
                  Select Account for PIN Sign-In:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {allUsers.map(user => {
                    const isSelected = user.id === selectedUserId;
                    return (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => {
                          setSelectedUserId(user.id);
                          setPinDigits('');
                          setErrorMessage('');
                        }}
                        className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-teal-500/20 border-teal-500 text-white shadow-xs shadow-teal-500/20'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                              user.role === 'admin' ? 'bg-indigo-600' : 'bg-teal-600'
                            }`}
                          >
                            {user.fullName.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">
                              {user.fullName}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">
                              @{user.username} • {user.role === 'admin' ? 'Owner' : user.designation}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4 PIN Dots */}
              <div className="py-2 text-center">
                <p className="text-xs text-slate-400 mb-2">
                  Enter 4-digit security PIN for <strong className="text-teal-300">{selectedUser?.fullName}</strong>:
                </p>
                <div className="flex items-center justify-center gap-3">
                  {[0, 1, 2, 3].map(idx => (
                    <div
                      key={idx}
                      className={`w-4 h-4 rounded-full border-2 transition-all ${
                        pinDigits.length > idx
                          ? 'bg-teal-400 border-teal-400 scale-110 shadow-xs shadow-teal-400/50'
                          : 'bg-slate-950 border-slate-700'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Touch Numeric Keypad */}
              <div className="grid grid-cols-3 gap-2.5 max-w-xs mx-auto">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                  <button
                    key={num}
                    type="button"
                    disabled={pinLoading}
                    onClick={() => handlePinDigit(num)}
                    className="h-12 rounded-xl bg-slate-950 hover:bg-slate-800 active:bg-teal-600 active:text-white border border-slate-800 text-white font-bold text-lg transition-colors flex items-center justify-center focus:outline-hidden cursor-pointer"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handlePinClear}
                  className="h-12 rounded-xl bg-slate-950/60 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white font-semibold text-xs transition-colors flex items-center justify-center cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={pinLoading}
                  onClick={() => handlePinDigit('0')}
                  className="h-12 rounded-xl bg-slate-950 hover:bg-slate-800 active:bg-teal-600 active:text-white border border-slate-800 text-white font-bold text-lg transition-colors flex items-center justify-center focus:outline-hidden cursor-pointer"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handlePinBackspace}
                  className="h-12 rounded-xl bg-slate-950/60 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white font-semibold text-xs transition-colors flex items-center justify-center cursor-pointer"
                >
                  <Delete className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs text-slate-500">
            Dr. Abdul Rehman (Owner) • Pharmacy ERP & POS System
          </p>
        </div>
      </div>
    </div>
  );
};

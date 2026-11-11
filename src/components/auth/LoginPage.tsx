/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Pill,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  KeyRound,
  Delete,
  RotateCcw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';

interface LoginPageProps {
  onLoginSuccess?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { login, loginWithPin, availableUsers } = useAuth();
  const { settings } = useStore();

  const [authMode, setAuthMode] = useState<'pin' | 'password'>('pin');

  // PIN mode state — default to Dr. Abdul Rehman (Owner)
  const [selectedUserId, setSelectedUserId] = useState<string>(
    availableUsers[0]?.id || 'usr-owner-1'
  );
  const [pinDigits, setPinDigits] = useState<string>('');
  const [pinLoading, setPinLoading] = useState(false);

  // Password mode state
  const [username, setUsername] = useState('abdulrehman');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

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
        setErrorMessage(result.error || 'Authentication failed. Please verify credentials.');
      }
    } catch {
      setErrorMessage('Unexpected login error. Please retry.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = async (userHandle: string) => {
    setUsername(userHandle);
    setIsLoading(true);
    setErrorMessage('');
    const result = await login(userHandle);
    setIsLoading(false);
    if (result.success) {
      onLoginSuccess?.();
    }
  };

  const selectedUser = availableUsers.find(u => u.id === selectedUserId) || availableUsers[0];

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
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
              Medical Store & Pharmacy ERP
            </p>
          </div>
        </div>
        <h2 className="text-lg font-bold text-slate-100">
          Terminal & Dispensing Counter Login
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          DRAP License: {settings.drugLicenseNumber} • Pakistan Standard
        </p>

        {/* Mode Switcher Tabs */}
        <div className="mt-4 bg-slate-800/80 p-1 rounded-xl flex items-center max-w-xs mx-auto border border-slate-700">
          <button
            type="button"
            onClick={() => {
              setAuthMode('pin');
              setErrorMessage('');
            }}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              authMode === 'pin'
                ? 'bg-teal-500 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Fast PIN Pad</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('password');
              setErrorMessage('');
            }}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              authMode === 'password'
                ? 'bg-teal-500 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Password</span>
          </button>
        </div>
      </div>

      <div className="mt-5 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-slate-800/90 backdrop-blur-xl py-6 px-6 sm:px-8 shadow-2xl rounded-2xl border border-slate-700/80">
          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {authMode === 'pin' ? (
            /* PIN Keypad Mode */
            <div className="space-y-4">
              {/* Employee Selection Carousel */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2 text-center">
                  Select Dispensing Personnel:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {availableUsers.map(user => {
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
                        className={`p-2.5 rounded-xl text-left border transition-all ${
                          isSelected
                            ? 'bg-teal-500/20 border-teal-500 text-white shadow-xs shadow-teal-500/20'
                            : 'bg-slate-900/60 border-slate-700/70 text-slate-400 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                              user.role === 'admin'
                                ? 'bg-indigo-600'
                                : user.role === 'pharmacist'
                                ? 'bg-teal-600'
                                : 'bg-amber-600'
                            }`}
                          >
                            {user.fullName.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">
                              {user.fullName.split(' ')[0]}
                            </p>
                            <p className="text-[10px] text-slate-400 capitalize truncate">
                              {user.role}
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
                          : 'bg-slate-900 border-slate-600'
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
                    className="h-12 rounded-xl bg-slate-900/80 hover:bg-slate-700 active:bg-teal-600 active:text-white border border-slate-700 text-white font-bold text-lg transition-colors flex items-center justify-center focus:outline-hidden"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handlePinClear}
                  className="h-12 rounded-xl bg-slate-900/40 hover:bg-slate-700/60 border border-slate-700/60 text-slate-400 hover:text-white font-semibold text-xs transition-colors flex items-center justify-center"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={pinLoading}
                  onClick={() => handlePinDigit('0')}
                  className="h-12 rounded-xl bg-slate-900/80 hover:bg-slate-700 active:bg-teal-600 active:text-white border border-slate-700 text-white font-bold text-lg transition-colors flex items-center justify-center focus:outline-hidden"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handlePinBackspace}
                  className="h-12 rounded-xl bg-slate-900/40 hover:bg-slate-700/60 border border-slate-700/60 text-slate-400 hover:text-white font-semibold text-xs transition-colors flex items-center justify-center"
                >
                  <Delete className="w-5 h-5" />
                </button>
              </div>

              <div className="pt-2 text-center">
                <span className="text-[11px] text-slate-400">
                  Owner PIN for Dr. Abdul Rehman: <code className="text-teal-300 font-mono">1234</code>
                </span>
              </div>
            </div>
          ) : (
            /* Username & Password Form */
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Username or Staff Email
                </label>
                <div className="relative rounded-lg shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-900/80 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    placeholder="abdulrehman or seller username"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Security Password
                </label>
                <div className="relative rounded-lg shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-10 py-2.5 bg-slate-900/80 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    placeholder="••••••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200"
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
                    className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 bg-slate-900 border-slate-700"
                  />
                  <span>Remember this terminal</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-teal-400 hover:text-teal-300 font-semibold"
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold shadow-md shadow-teal-500/20 focus:outline-hidden focus:ring-2 focus:ring-teal-400 transition-all active:scale-[0.99] disabled:opacity-70"
              >
                {isLoading ? (
                  <span>Authenticating...</span>
                ) : (
                  <>
                    <span>Sign In to Terminal</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Quick Account Sign-In */}
          <div className="mt-5 pt-4 border-t border-slate-700/60">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 text-center">
              Active Accounts ({availableUsers.length}):
            </p>
            <div className="grid grid-cols-1 gap-2">
              {availableUsers.map(u => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handleQuickLogin(u.username)}
                  className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border text-left transition-colors ${
                    u.role === 'admin'
                      ? 'bg-indigo-500/15 hover:bg-indigo-500/25 border-indigo-500/30 text-indigo-200'
                      : 'bg-teal-500/10 hover:bg-teal-500/20 border-teal-500/20 text-teal-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {u.role === 'admin' ? (
                      <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
                    ) : (
                      <Pill className="w-4 h-4 text-teal-400 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">{u.fullName}</div>
                      <div className="text-[10px] text-slate-400 truncate">
                        @{u.username} • {u.designation} • PIN {u.pin || '1234'}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900/70 text-teal-300 shrink-0">
                    1-Click Sign In
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs text-slate-500">
            Operating Currency: <span className="text-slate-400 font-medium">Pakistani Rupee (PKR)</span> • Asia/Karachi Timezone
          </p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-sm w-full text-slate-200 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-teal-400" />
              Password Recovery
            </h3>
            {resetSent ? (
              <div className="space-y-4">
                <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    A secure password reset link has been dispatched to <strong>{resetEmail}</strong>. Please check your inbox or notify your store owner.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setResetSent(false);
                  }}
                  className="w-full py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-semibold text-white"
                >
                  Return to Sign In
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-400">
                  Enter your registered pharmacy staff email address to receive authorization reset instructions.
                </p>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={e => setResetEmail(e.target.value)}
                  placeholder="pharmacist@pharmacare.pk"
                  className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                />
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(false)}
                    className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (resetEmail) setResetSent(true);
                      else alert('Please enter your email.');
                    }}
                    className="flex-1 py-2 bg-teal-500 hover:bg-teal-600 rounded-lg text-xs font-bold text-white"
                  >
                    Send Instructions
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

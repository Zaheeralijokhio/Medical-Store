/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types/pharmacy';
import {
  INITIAL_USERS,
  OWNER_ACCOUNT,
  LEGACY_DEMO_USER_IDS,
  sanitizeStaffAccounts,
} from '../data/initialData';

interface AuthContextType {
  currentUser: User | null;
  isAdmin: boolean;
  isOwner: boolean;
  isPharmacist: boolean;
  isCashier: boolean;
  isStaff: boolean;
  login: (username: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  loginWithPin: (pin: string, usernameOrId?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  switchUser: (userId: string) => void;
  availableUsers: User[];
  updateCurrentUser: (updated: Partial<User>) => void;
  syncStaffList: (staff: User[]) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'pharmacare_auth_session_v2';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [availableUsers, setAvailableUsers] = useState<User[]>(() => {
    try {
      const savedStaff = localStorage.getItem('pharmacare_staff');
      if (savedStaff) {
        const parsed = JSON.parse(savedStaff);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const clean = sanitizeStaffAccounts(parsed);
          localStorage.setItem('pharmacare_staff', JSON.stringify(clean));
          return clean;
        }
      }
    } catch {}
    return INITIAL_USERS;
  });

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      // Clear legacy auto-login key so users see the Login Screen
      localStorage.removeItem('pharmacare_active_user');
      const saved = sessionStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as User;
        if (
          parsed &&
          parsed.id &&
          !LEGACY_DEMO_USER_IDS.has(parsed.id)
        ) {
          if (parsed.id === OWNER_ACCOUNT.id) {
            return {
              ...OWNER_ACCOUNT,
              ...parsed,
              username: 'admin',
              password: parsed.password || 'admin',
              role: 'admin',
              permissions: OWNER_ACCOUNT.permissions,
            };
          }
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    // Start unauthenticated so the Login Screen is displayed
    return null;
  });

  // Fetch latest staff accounts from Hostinger / Backend Database on startup
  useEffect(() => {
    let active = true;
    fetch('/api/staff')
      .then(res => (res.ok ? res.json() : null))
      .then(json => {
        if (!active || !json?.staffMembers || !Array.isArray(json.staffMembers)) return;
        setAvailableUsers(prev => {
          const mergedMap = new Map<string, User>();
          prev.forEach(u => mergedMap.set(u.id, u));
          json.staffMembers.forEach((u: User) => {
            if (u && u.id) mergedMap.set(u.id, u);
          });
          const clean = sanitizeStaffAccounts(Array.from(mergedMap.values()));
          try {
            localStorage.setItem('pharmacare_staff', JSON.stringify(clean));
          } catch {}
          return clean;
        });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (currentUser) {
      sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(currentUser));
    } else {
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }, [currentUser]);

  // Support direct URL query login (e.g. ?u=admin&pin=1234)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const uParam = params.get('u');
    const pinParam = params.get('pin');
    const roleParam = params.get('role');

    if (uParam && pinParam) {
      const targetUser = availableUsers.find(
        u =>
          (u.username.toLowerCase() === uParam.toLowerCase() ||
           u.fullName.toLowerCase().includes(uParam.toLowerCase())) &&
          (u.pin === pinParam || (!u.pin && pinParam === '1234')) &&
          (!roleParam || u.role.toLowerCase() === roleParam.toLowerCase() || (roleParam.toLowerCase() === 'pharmacist' && u.role === 'staff'))
      );

      if (targetUser && targetUser.status === 'active') {
        setCurrentUser({
          ...targetUser,
          lastLogin: new Date().toLocaleDateString('en-PK', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
        });
      }

      // Security requirement: Never leave credentials exposed in browser URL bar
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }, [availableUsers]);

  const login = async (username: string, password?: string): Promise<{ success: boolean; error?: string }> => {
    const rawInput = username.trim().toLowerCase();
    const cleanUsername = rawInput.replace(/^@/, '').trim();
    const cleanCompact = cleanUsername.replace(/\s+/g, '');
    const cleanPass = (password || '').trim();

    if (!cleanUsername) {
      return { success: false, error: 'Please enter your username.' };
    }

    // Also check latest localStorage staff list in case it was just updated
    let currentList = availableUsers;
    try {
      const savedStaff = localStorage.getItem('pharmacare_staff');
      if (savedStaff) {
        const parsed = JSON.parse(savedStaff);
        if (Array.isArray(parsed) && parsed.length > 0) {
          currentList = sanitizeStaffAccounts([...availableUsers, ...parsed]);
        }
      }
    } catch {}

    const findMatchingUser = (list: User[]) =>
      list.find(u => {
        const uName = (u.username || '').trim().toLowerCase().replace(/^@/, '');
        const uFull = (u.fullName || '').trim().toLowerCase();
        const uCompact = uFull.replace(/[^a-z0-9]/g, '');
        const uEmail = (u.email || '').trim().toLowerCase();
        return (
          uName === cleanUsername ||
          uName === cleanCompact ||
          uFull === cleanUsername ||
          uCompact === cleanCompact ||
          uEmail === cleanUsername ||
          (u.id === OWNER_ACCOUNT.id && ['admin', 'owner', 'abdulrehman'].includes(cleanCompact))
        );
      });

    let user = findMatchingUser(currentList);

    // Always check backend database if not found locally or if password doesn't match local cache
    const localExpectedPass = user
      ? user.id === OWNER_ACCOUNT.id
        ? (user.password || 'admin').trim()
        : (user.password || '').trim()
      : null;

    if (!user || (localExpectedPass && cleanPass !== localExpectedPass)) {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: cleanUsername, password: cleanPass }),
        });
        const data = await res.json();
        if (res.ok && data?.success && data?.user) {
          user = data.user as User;
          const serverList = Array.isArray(data.staffMembers) ? data.staffMembers : [user];
          setAvailableUsers(prev => {
            const next = sanitizeStaffAccounts([...prev, ...serverList]);
            try {
              localStorage.setItem('pharmacare_staff', JSON.stringify(next));
            } catch {}
            return next;
          });
          setCurrentUser(user);
          return { success: true };
        } else if (!user && data?.error) {
          return { success: false, error: data.error };
        }
      } catch {
        // fallback to local check below
      }
    }

    if (!user) {
      return {
        success: false,
        error: 'Account not found. Enter "admin" for Owner or a valid staff username created by the Owner.',
      };
    }

    if (user.status !== 'active') {
      return { success: false, error: 'This staff account has been deactivated by the Owner.' };
    }

    const expectedPassword =
      user.id === OWNER_ACCOUNT.id ? (user.password || 'admin').trim() : (user.password || '').trim();
    if (expectedPassword && cleanPass !== expectedPassword) {
      return {
        success: false,
        error:
          user.id === OWNER_ACCOUNT.id
            ? 'Invalid password for Owner account (Default: username "admin", password "admin").'
            : `Incorrect password for staff account @${user.username}.`,
      };
    }

    const updatedUser: User = {
      ...user,
      lastLogin: new Date().toLocaleDateString('en-PK', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    setCurrentUser(updatedUser);
    return { success: true };
  };

  const loginWithPin = async (pin: string, usernameOrId?: string): Promise<{ success: boolean; error?: string }> => {
    // Support flexible argument order in case caller passed (userId, pin)
    let actualPin = pin.trim();
    let actualIdent = usernameOrId?.trim();
    if (actualPin.length > 4 && actualIdent && actualIdent.length === 4) {
      const temp = actualPin;
      actualPin = actualIdent;
      actualIdent = temp;
    }

    if (!actualPin || actualPin.length < 4) {
      return { success: false, error: 'Please enter a 4-digit security PIN.' };
    }

    let user: User | undefined;

    if (actualIdent) {
      const cleanIdent = actualIdent.toLowerCase();
      user = availableUsers.find(
        u =>
          (u.id.toLowerCase() === cleanIdent || u.username.toLowerCase() === cleanIdent) &&
          (u.pin === actualPin || (!u.pin && actualPin === '1234'))
      );
    } else {
      user = availableUsers.find(u => u.pin === actualPin || (!u.pin && actualPin === '1234'));
    }

    if (!user) {
      try {
        const res = await fetch('/api/auth/pin-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: actualPin, username: actualIdent }),
        });
        const data = await res.json();
        if (res.ok && data?.success && data?.user) {
          user = data.user as User;
          setAvailableUsers(prev => {
            const next = sanitizeStaffAccounts([...prev.filter(u => u.id !== user!.id), user!]);
            try {
              localStorage.setItem('pharmacare_staff', JSON.stringify(next));
            } catch {}
            return next;
          });
          setCurrentUser(user);
          return { success: true };
        }
      } catch {
        // ignore network error and show message below
      }
    }

    if (!user) {
      return {
        success: false,
        error: 'Invalid 4-digit PIN for selected account. Default PIN for Dr. Abdul Rehman (Owner) is 1234.',
      };
    }

    if (user.status !== 'active') {
      return { success: false, error: 'This staff account has been deactivated by Dr. Abdul Rehman (Owner).' };
    }

    const updatedUser: User = {
      ...user,
      lastLogin: new Date().toLocaleDateString('en-PK', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    setCurrentUser(updatedUser);
    return { success: true };
  };

  const logout = () => {
    setCurrentUser(null);
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem('pharmacare_active_user');
  };

  const switchUser = (userId: string) => {
    const target = availableUsers.find(u => u.id === userId);
    if (target) {
      if (target.status !== 'active') {
        alert('Cannot switch to a deactivated staff account.');
        return;
      }
      setCurrentUser(target);
    }
  };

  const updateCurrentUser = (updated: Partial<User>) => {
    if (!currentUser) return;
    setCurrentUser(prev => (prev ? { ...prev, ...updated } : null));
  };

  const syncStaffList = (staff: User[]) => {
    const clean = sanitizeStaffAccounts(staff);
    setAvailableUsers(clean);
    setCurrentUser(prev => {
      if (!prev) return null;
      const stillExists = clean.find(u => u.id === prev.id);
      if (!stillExists || stillExists.status !== 'active') {
        return clean[0] || OWNER_ACCOUNT;
      }
      return stillExists;
    });
  };

  const isOwner = currentUser?.role === 'admin';
  const isAdmin = isOwner;
  const isPharmacist = currentUser?.role === 'pharmacist' || currentUser?.role === 'staff';
  const isCashier = currentUser?.role === 'cashier';
  const isStaff = isPharmacist || isCashier;

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAdmin,
        isOwner,
        isPharmacist,
        isCashier,
        isStaff,
        login,
        loginWithPin,
        logout,
        switchUser,
        availableUsers,
        updateCurrentUser,
        syncStaffList,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

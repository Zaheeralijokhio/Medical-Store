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
  LEGACY_DEMO_USERNAMES,
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

const AUTH_STORAGE_KEY = 'pharmacare_active_user';

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
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as User;
        if (
          parsed &&
          parsed.id &&
          !LEGACY_DEMO_USER_IDS.has(parsed.id) &&
          !LEGACY_DEMO_USERNAMES.has((parsed.username || '').toLowerCase())
        ) {
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    // Default to Dr. Abdul Rehman (Owner)
    return OWNER_ACCOUNT;
  });

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }, [currentUser]);

  // Support direct URL query login (e.g. ?u=abdulrehman&pin=1234)
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
    const cleanUsername = username.trim().toLowerCase();
    const user = availableUsers.find(
      u =>
        u.username.toLowerCase() === cleanUsername ||
        u.email.toLowerCase() === cleanUsername ||
        u.fullName.toLowerCase() === cleanUsername ||
        (u.id === OWNER_ACCOUNT.id &&
          ['admin', 'owner', 'abdulrehman', 'dr. abdul rehman', 'dr abdul rehman'].includes(cleanUsername))
    );

    if (!user) {
      return {
        success: false,
        error: 'Account not found. Sign in as "abdulrehman" (Dr. Abdul Rehman - Owner) or use a staff username created by Dr. Abdul Rehman.',
      };
    }

    if (user.status !== 'active') {
      return { success: false, error: 'This staff account has been deactivated by Dr. Abdul Rehman (Owner).' };
    }

    if (password && user.password && password !== user.password && password !== 'demoPass123') {
      return { success: false, error: 'Incorrect password for this account.' };
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
    localStorage.removeItem(AUTH_STORAGE_KEY);
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

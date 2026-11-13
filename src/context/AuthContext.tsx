/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { User } from '../types/pharmacy';
import {
  INITIAL_USERS,
  OWNER_ACCOUNT,
  LEGACY_DEMO_USER_IDS,
  sanitizeStaffAccounts,
} from '../data/initialData';
import { pushCloudStaff } from '../services/cloudSync';
import { normalizePermissions, normalizeStaffList } from '../utils/normalizers';

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
  syncStaffList: (staff: User[], options?: { forceReplace?: boolean }) => void;
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

  const availableUsersRef = useRef<User[]>(availableUsers);
  useEffect(() => {
    availableUsersRef.current = availableUsers;
  }, [availableUsers]);

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
          return {
            ...parsed,
            permissions: normalizePermissions(parsed.permissions, parsed.role),
          };
        }
      }
    } catch {
      // fallback
    }
    // Start unauthenticated so the Login Screen is displayed
    return null;
  });

  // Merge helper for incoming staff lists
  const mergeAndSaveStaff = (incoming: User[]) => {
    if (!Array.isArray(incoming) || incoming.length === 0) return;
    setAvailableUsers(prev => {
      const mergedMap = new Map<string, User>();
      prev.forEach(u => {
        if (u && u.username) mergedMap.set(u.username.toLowerCase(), u);
      });
      incoming.forEach((u: User) => {
        if (u && u.username) mergedMap.set(u.username.toLowerCase(), u);
      });
      const clean = sanitizeStaffAccounts(Array.from(mergedMap.values()));
      try {
        localStorage.setItem('pharmacare_staff', JSON.stringify(clean));
      } catch {}
      return clean;
    });
  };

  // Fetch latest staff accounts from Backend SQL Database on startup
  useEffect(() => {
    let active = true;
    fetch('/api/staff', { cache: 'no-store' })
      .then(res => (res.ok ? res.json() : null))
      .then(json => {
        if (!active || !json?.staffMembers || !Array.isArray(json.staffMembers)) return;
        const clean = normalizeStaffList(json.staffMembers);
        try {
          localStorage.setItem('pharmacare_staff', JSON.stringify(clean));
        } catch {}
        setAvailableUsers(clean);
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

  // Support direct URL query login (e.g. ?u=admin&pin=1234 or ?staff_token=<base64>)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const staffToken = params.get('staff_token');
    const uParam = params.get('u');
    const pinParam = params.get('pin');
    const roleParam = params.get('role');

    if (staffToken) {
      try {
        const decoded = JSON.parse(decodeURIComponent(escape(window.atob(staffToken)))) as User;
        if (decoded && decoded.id && decoded.username) {
          setAvailableUsers(prev => {
            const next = sanitizeStaffAccounts([...prev.filter(u => u.id !== decoded.id), decoded]);
            try {
              localStorage.setItem('pharmacare_staff', JSON.stringify(next));
            } catch {}
            pushCloudStaff(next).catch(() => {});
            return next;
          });
          fetch('/api/staff', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(decoded),
          }).catch(() => {});
          setCurrentUser({
            ...decoded,
            lastLogin: new Date().toLocaleDateString('en-PK', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }),
          });
        }
      } catch {}
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
      return;
    }

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

    // 1. Always verify against live server SQLite database first when online so Incognito & all devices stay 100% synced
    if (typeof navigator === 'undefined' || navigator.onLine) {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({ username: cleanUsername, password: cleanPass }),
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.success && data?.user) {
          const serverUser: User = {
            ...(data.user as User),
            permissions: normalizePermissions(data.user.permissions, data.user.role),
          };
          const serverList = normalizeStaffList(
            Array.isArray(data.staffMembers) ? data.staffMembers : [serverUser]
          );
          try {
            localStorage.setItem('pharmacare_staff', JSON.stringify(serverList));
          } catch {}
          setAvailableUsers(serverList);
          setCurrentUser(serverUser);
          return { success: true };
        }
        if (res.status === 401 || res.status === 403) {
          return {
            success: false,
            error: data?.error || 'Invalid username or password.',
          };
        }
      } catch {
        // Offline / network fallback handled below
      }
    }

    // 2. Offline / fallback check against cached staff list
    let currentList = availableUsers;
    try {
      const savedStaff = localStorage.getItem('pharmacare_staff');
      if (savedStaff) {
        const parsed = JSON.parse(savedStaff);
        if (Array.isArray(parsed) && parsed.length > 0) {
          currentList = normalizeStaffList([...availableUsers, ...parsed]);
        }
      }
    } catch {}

    const user = currentList.find(u => {
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
            ? 'Invalid password for Owner account.'
            : `Incorrect password for staff account @${user.username}.`,
      };
    }

    const updatedUser: User = {
      ...user,
      permissions: normalizePermissions(user.permissions, user.role),
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

    // 1. Always verify against live server SQLite database first when online
    if (typeof navigator === 'undefined' || navigator.onLine) {
      try {
        const res = await fetch('/api/auth/pin-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({ pin: actualPin, username: actualIdent }),
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.success && data?.user) {
          const serverUser: User = {
            ...(data.user as User),
            permissions: normalizePermissions(data.user.permissions, data.user.role),
          };
          const serverList = normalizeStaffList(
            Array.isArray(data.staffMembers) ? data.staffMembers : [serverUser]
          );
          try {
            localStorage.setItem('pharmacare_staff', JSON.stringify(serverList));
          } catch {}
          setAvailableUsers(serverList);
          setCurrentUser(serverUser);
          return { success: true };
        }
        if (res.status === 401 || res.status === 403) {
          return {
            success: false,
            error: data?.error || 'Invalid 4-digit PIN for selected account.',
          };
        }
      } catch {
        // Offline fallback handled below
      }
    }

    const matchByPin = (list: User[]) => {
      const staffOnly = list.filter(u => u.id !== OWNER_ACCOUNT.id);
      if (actualIdent) {
        const cleanIdent = actualIdent.toLowerCase();
        return staffOnly.find(
          u =>
            (u.id.toLowerCase() === cleanIdent || u.username.toLowerCase() === cleanIdent) &&
            u.pin === actualPin
        );
      }
      return staffOnly.find(u => u.pin === actualPin);
    };

    const user = matchByPin(availableUsers);

    if (!user) {
      return {
        success: false,
        error: 'Invalid 4-digit PIN for selected account.',
      };
    }

    if (user.status !== 'active') {
      return { success: false, error: 'This staff account has been deactivated by the Owner.' };
    }

    const updatedUser: User = {
      ...user,
      permissions: normalizePermissions(user.permissions, user.role),
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
    // STRICT SECURITY RESTRICTION: Only the Master Owner (usr-owner-1) can switch accounts.
    // Staff members are strictly prohibited from switching to the Owner account or any other account.
    if (!currentUser || currentUser.id !== OWNER_ACCOUNT.id) {
      return;
    }
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

  const syncStaffList = (staff: User[], options?: { forceReplace?: boolean }) => {
    const clean = normalizeStaffList(staff);
    if (options?.forceReplace) {
      availableUsersRef.current = clean;
      try {
        localStorage.setItem('pharmacare_staff', JSON.stringify(clean));
      } catch {}
      setAvailableUsers(clean);
      setCurrentUser(prev => {
        if (!prev) return null;
        const stillExists = clean.find(u => u.id === prev.id);
        if (stillExists) {
          return stillExists.status !== 'active' ? null : stillExists;
        }
        if (prev.id === OWNER_ACCOUNT.id) {
          return clean.find(u => u.id === OWNER_ACCOUNT.id) || OWNER_ACCOUNT;
        }
        return prev;
      });
      return;
    }

    const mergedMap = new Map<string, User>();
    availableUsersRef.current.forEach(u => {
      if (u && u.username) mergedMap.set(u.username.toLowerCase(), u);
    });
    clean.forEach(u => {
      if (u && u.username) mergedMap.set(u.username.toLowerCase(), u);
    });
    const mergedList = normalizeStaffList(Array.from(mergedMap.values()));
    availableUsersRef.current = mergedList;
    try {
      localStorage.setItem('pharmacare_staff', JSON.stringify(mergedList));
    } catch {}
    setAvailableUsers(mergedList);
    setCurrentUser(curr => {
      if (!curr) return null;
      const stillExists = mergedList.find(u => u.id === curr.id);
      if (stillExists) {
        return stillExists.status !== 'active' ? null : stillExists;
      }
      return curr;
    });
  };

  // Master Owner is usr-owner-1; Store Manager (role: 'admin') also gets managerial dashboard/report visibility
  const isOwner = currentUser?.id === OWNER_ACCOUNT.id;
  const isAdmin = isOwner || currentUser?.role === 'admin';
  const isPharmacist = !isAdmin && (currentUser?.role === 'pharmacist' || currentUser?.role === 'staff');
  const isCashier = !isAdmin && currentUser?.role === 'cashier';
  const isStaff = Boolean(currentUser && !isOwner);

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

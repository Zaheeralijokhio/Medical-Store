/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Pill,
  Receipt,
  Menu,
} from 'lucide-react';
import { NavTab } from './Sidebar';

interface MobileBottomBarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenMenu: () => void;
}

export const MobileBottomBar: React.FC<MobileBottomBarProps> = ({
  currentTab,
  onSelectTab,
  onOpenMenu,
}) => {
  const tabs = [
    { id: 'dashboard' as NavTab, label: 'Overview', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'pos' as NavTab, label: 'POS Sale', icon: <ShoppingCart className="w-5 h-5" />, highlight: true },
    { id: 'inventory' as NavTab, label: 'Medicines', icon: <Pill className="w-5 h-5" /> },
    { id: 'sales' as NavTab, label: 'Invoices', icon: <Receipt className="w-5 h-5" /> },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-2 py-1 flex items-center justify-around shadow-2xl safe-area-pb">
      {tabs.map((tab) => {
        const isActive = currentTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 px-2 rounded-xl transition-all ${
              isActive
                ? 'text-teal-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div
              className={`p-1 rounded-lg transition-colors ${
                isActive
                  ? 'bg-teal-500/20 text-teal-300'
                  : tab.highlight
                  ? 'text-teal-400'
                  : ''
              }`}
            >
              {tab.icon}
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight font-medium">
              {tab.label}
            </span>
          </button>
        );
      })}

      {/* Menu / Drawer button */}
      <button
        onClick={onOpenMenu}
        className="flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 px-2 rounded-xl text-slate-400 hover:text-slate-200 transition-colors"
      >
        <div className="p-1 rounded-lg">
          <Menu className="w-5 h-5" />
        </div>
        <span className="text-[10px] mt-0.5 tracking-tight font-medium">
          More
        </span>
      </button>
    </nav>
  );
};

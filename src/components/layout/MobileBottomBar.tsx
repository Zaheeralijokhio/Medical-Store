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
    { id: 'dashboard' as NavTab, label: 'Overview', icon: LayoutDashboard },
    { id: 'pos' as NavTab, label: 'POS', icon: ShoppingCart },
    { id: 'inventory' as NavTab, label: 'Catalog', icon: Pill },
    { id: 'sales' as NavTab, label: 'Invoices', icon: Receipt },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0B191E]/95 backdrop-blur-md border-t border-white/[0.08] px-1.5 pt-1 safe-area-pb grid grid-cols-5 items-center shadow-[0_-8px_24px_rgba(11,25,30,0.18)]">
      {tabs.map(tab => {
        const isActive = currentTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelectTab(tab.id)}
            className={`flex flex-col items-center justify-center min-h-[48px] py-1 rounded-xl transition-colors ${
              isActive ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                isActive ? 'bg-emerald-500/20 text-emerald-300' : ''
              }`}
            >
              <Icon className="w-[19px] h-[19px]" />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight leading-none">{tab.label}</span>
          </button>
        );
      })}

      <button
        type="button"
        onClick={onOpenMenu}
        className="flex flex-col items-center justify-center min-h-[48px] py-1 rounded-xl text-slate-400 hover:text-slate-200 transition-colors"
      >
        <div className="px-2.5 py-1 rounded-lg">
          <Menu className="w-[19px] h-[19px]" />
        </div>
        <span className="text-[10px] mt-0.5 tracking-tight leading-none">More</span>
      </button>
    </nav>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import {
  Car,
  MapPin,
  Heart,
  History,
  CreditCard,
  PlusCircle,
  LayoutDashboard,
  Building2,
  Bell,
  User,
  LogOut,
  Menu,
  X,
  Compass,
  AlertCircle,
  Star,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import NotificationDropdown from './NotificationDropdown';

export default function Navbar({ currentTab, setCurrentTab }) {
  const { user, logout, isOperator, isAdmin } = useAuth();
  const canManageParkings = isOperator || isAdmin;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const notifRef = useRef(null);
  const userMenuRef = useRef(null);

  // Poll notifications count
  useEffect(() => {
    if (!user) return;
    const checkUnread = async () => {
      try {
        const res = await api.getNotifications();
        setUnreadCount(res.unreadCount || 0);
      } catch (err) {
        // silent fail
      }
    };
    checkUnread();
    const interval = setInterval(checkUnread, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Click outside to close menus
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setIsNotificationOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNavClick = (tab) => {
    setCurrentTab(tab);
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleNavClick(canManageParkings ? 'operator-dashboard' : 'search')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-700 to-brand-500 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
              <Car className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 to-brand-900 bg-clip-text text-transparent">
                  Easy<span className="text-brand-600">Park</span>
                </span>
                <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${
                  canManageParkings 
                    ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                    : 'bg-brand-50 text-brand-700 border border-brand-200'
                }`}>
                  {isAdmin ? 'Admin' : isOperator ? 'Operator' : 'Driver'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium hidden sm:block">Smart Parking Finder & Management</p>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {!canManageParkings ? (
              <>
                <button
                  onClick={() => handleNavClick('search')}
                  className={`px-3.5 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
                    currentTab === 'search'
                      ? 'bg-brand-50 text-brand-700 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Compass className="w-4 h-4" />
                  <span>Search & Near Me</span>
                </button>
                <button
                  onClick={() => handleNavClick('map-view')}
                  className={`px-3.5 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
                    currentTab === 'map-view'
                      ? 'bg-brand-50 text-brand-700 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <MapPin className="w-4 h-4" />
                  <span>Map View</span>
                </button>
                <button
                  onClick={() => handleNavClick('favourites')}
                  className={`px-3.5 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
                    currentTab === 'favourites'
                      ? 'bg-brand-50 text-brand-700 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Heart className="w-4 h-4" />
                  <span>Favourites</span>
                </button>
                <button
                  onClick={() => handleNavClick('history')}
                  className={`px-3.5 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
                    currentTab === 'history'
                      ? 'bg-brand-50 text-brand-700 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <History className="w-4 h-4" />
                  <span>History</span>
                </button>
                <button
                  onClick={() => handleNavClick('payments')}
                  className={`px-3.5 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
                    currentTab === 'payments'
                      ? 'bg-brand-50 text-brand-700 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Payments</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => handleNavClick('operator-dashboard')}
                  className={`px-3.5 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
                    currentTab === 'operator-dashboard'
                      ? 'bg-brand-50 text-brand-700 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Dashboard</span>
                </button>
                <button
                  onClick={() => handleNavClick('operator-parkings')}
                  className={`px-3.5 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
                    currentTab === 'operator-parkings'
                      ? 'bg-brand-50 text-brand-700 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  <span>My Locations</span>
                </button>
                <button
                  onClick={() => handleNavClick('operator-add')}
                  className="px-3.5 py-2 rounded-xl text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 shadow-sm transition flex items-center gap-2"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>+ Add Parking</span>
                </button>
                <button
                  onClick={() => handleNavClick('operator-reviews')}
                  className={`px-3.5 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
                    currentTab === 'operator-reviews'
                      ? 'bg-brand-50 text-brand-700 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Star className="w-4 h-4" />
                  <span>Reviews</span>
                </button>
                <button
                  onClick={() => handleNavClick('operator-reports')}
                  className={`px-3.5 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
                    currentTab === 'operator-reports'
                      ? 'bg-brand-50 text-brand-700 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <AlertCircle className="w-4 h-4" />
                  <span>Reports</span>
                </button>
              </>
            )}
          </nav>

          {/* Right Action Icons & User Dropdown */}
          <div className="flex items-center gap-2">
            {/* Notifications Bell */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                className="relative p-2.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
                aria-label="View notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white font-bold text-[10px] rounded-full flex items-center justify-center ring-2 ring-white animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              <NotificationDropdown
                isOpen={isNotificationOpen}
                onClose={() => setIsNotificationOpen(false)}
              />
            </div>

            {/* User Profile & Menu */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 transition"
              >
                <img
                  src={user?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80'}
                  alt={user?.name}
                  className="w-8 h-8 rounded-xl object-cover ring-1 ring-slate-200"
                />
                <span className="hidden sm:block text-xs font-semibold text-slate-800 max-w-[100px] truncate">
                  {user?.name?.split(' ')[0]}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
              </button>

              {/* User Menu Dropdown */}
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-900 truncate">{user?.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
                    <div className="mt-1.5">
                      <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-brand-50 text-brand-700">
                        {user?.role} Account
                      </span>
                    </div>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => {
                        setCurrentTab('profile');
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 text-left"
                    >
                      <User className="w-4 h-4 text-slate-400" />
                      <span>Edit Profile & Password</span>
                    </button>
                  </div>

                  <div className="pt-1 border-t border-slate-100">
                    <button
                      onClick={() => {
                        logout();
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2.5 text-left"
                    >
                      <LogOut className="w-4 h-4 text-red-500" />
                      <span>Log Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition"
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-slate-100 bg-white px-4 pt-3 pb-6 space-y-2 animate-in slide-in-from-top-4 duration-200">
          <div className="flex items-center pb-2 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Navigation</span>
          </div>

          {!canManageParkings ? (
            <>
              <button
                onClick={() => handleNavClick('search')}
                className={`w-full px-3 py-2.5 rounded-xl text-sm font-medium flex items-center gap-3 ${
                  currentTab === 'search' ? 'bg-brand-50 text-brand-700 font-bold' : 'text-slate-700'
                }`}
              >
                <Compass className="w-5 h-5 text-brand-500" />
                <span>Search Parking & Near Me</span>
              </button>
              <button
                onClick={() => handleNavClick('map-view')}
                className={`w-full px-3 py-2.5 rounded-xl text-sm font-medium flex items-center gap-3 ${
                  currentTab === 'map-view' ? 'bg-brand-50 text-brand-700 font-bold' : 'text-slate-700'
                }`}
              >
                <MapPin className="w-5 h-5 text-brand-500" />
                <span>Interactive Map View</span>
              </button>
              <button
                onClick={() => handleNavClick('favourites')}
                className={`w-full px-3 py-2.5 rounded-xl text-sm font-medium flex items-center gap-3 ${
                  currentTab === 'favourites' ? 'bg-brand-50 text-brand-700 font-bold' : 'text-slate-700'
                }`}
              >
                <Heart className="w-5 h-5 text-red-500" />
                <span>Favourite Parkings</span>
              </button>
              <button
                onClick={() => handleNavClick('history')}
                className={`w-full px-3 py-2.5 rounded-xl text-sm font-medium flex items-center gap-3 ${
                  currentTab === 'history' ? 'bg-brand-50 text-brand-700 font-bold' : 'text-slate-700'
                }`}
              >
                <History className="w-5 h-5 text-slate-500" />
                <span>Parking History</span>
              </button>
              <button
                onClick={() => handleNavClick('payments')}
                className={`w-full px-3 py-2.5 rounded-xl text-sm font-medium flex items-center gap-3 ${
                  currentTab === 'payments' ? 'bg-brand-50 text-brand-700 font-bold' : 'text-slate-700'
                }`}
              >
                <CreditCard className="w-5 h-5 text-emerald-500" />
                <span>Payment Receipts</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => handleNavClick('operator-dashboard')}
                className={`w-full px-3 py-2.5 rounded-xl text-sm font-medium flex items-center gap-3 ${
                  currentTab === 'operator-dashboard' ? 'bg-brand-50 text-brand-700 font-bold' : 'text-slate-700'
                }`}
              >
                <LayoutDashboard className="w-5 h-5 text-brand-500" />
                <span>Admin Dashboard</span>
              </button>
              <button
                onClick={() => handleNavClick('operator-parkings')}
                className={`w-full px-3 py-2.5 rounded-xl text-sm font-medium flex items-center gap-3 ${
                  currentTab === 'operator-parkings' ? 'bg-brand-50 text-brand-700 font-bold' : 'text-slate-700'
                }`}
              >
                <Building2 className="w-5 h-5 text-brand-500" />
                <span>My Parking Locations</span>
              </button>
              <button
                onClick={() => handleNavClick('operator-add')}
                className="w-full px-3 py-2.5 rounded-xl text-sm font-bold bg-brand-600 text-white flex items-center gap-3"
              >
                <PlusCircle className="w-5 h-5" />
                <span>+ Add New Parking</span>
              </button>
              <button
                onClick={() => handleNavClick('operator-reviews')}
                className={`w-full px-3 py-2.5 rounded-xl text-sm font-medium flex items-center gap-3 ${
                  currentTab === 'operator-reviews' ? 'bg-brand-50 text-brand-700 font-bold' : 'text-slate-700'
                }`}
              >
                <Star className="w-5 h-5 text-amber-500" />
                <span>Customer Reviews</span>
              </button>
              <button
                onClick={() => handleNavClick('operator-reports')}
                className={`w-full px-3 py-2.5 rounded-xl text-sm font-medium flex items-center gap-3 ${
                  currentTab === 'operator-reports' ? 'bg-brand-50 text-brand-700 font-bold' : 'text-slate-700'
                }`}
              >
                <AlertCircle className="w-5 h-5 text-red-500" />
                <span>Issue Reports</span>
              </button>
            </>
          )}

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={() => handleNavClick('profile')}
              className="text-xs font-semibold text-slate-700 flex items-center gap-2"
            >
              <User className="w-4 h-4 text-slate-500" />
              <span>Profile Settings</span>
            </button>
            <button
              onClick={logout}
              className="text-xs font-semibold text-red-600 flex items-center gap-1.5"
            >
              <LogOut className="w-4 h-4" />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

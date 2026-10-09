import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import Register from './pages/Register';
import DriverDashboard from './pages/DriverDashboard';
import MapViewPage from './pages/MapViewPage';
import ParkingDetails from './pages/ParkingDetails';
import FavouritesPage from './pages/FavouritesPage';
import HistoryPage from './pages/HistoryPage';
import PaymentsHistoryPage from './pages/PaymentsHistoryPage';
import OperatorDashboard from './pages/OperatorDashboard';
import OperatorAddParking from './pages/OperatorAddParking';
import OperatorEditParking from './pages/OperatorEditParking';
import OperatorReports from './pages/OperatorReports';
import OperatorReviews from './pages/OperatorReviews';
import ProfilePage from './pages/ProfilePage';

export default function App() {
  const { user, loading, authError, restoreSession, logout, isAuthenticated, isDriver, isOperator, isAdmin } = useAuth();
  const canManageParkings = isOperator || isAdmin;
  const savedNavigation = window.history.state?.easyparkApp ? window.history.state : {};
  
  // Auth view mode
  const [authView, setAuthView] = useState('login'); // 'login' or 'register'
  
  // App navigation state
  const [currentTab, setCurrentTabState] = useState(savedNavigation.currentTab || 'search');
  const [selectedParkingId, setSelectedParkingId] = useState(savedNavigation.selectedParkingId || null);
  const [editingParkingId, setEditingParkingId] = useState(savedNavigation.editingParkingId || null);

  const navigateToTab = (tab, updates = {}) => {
    const nextNavigation = {
      easyparkApp: true,
      currentTab: tab,
      selectedParkingId: updates.selectedParkingId ?? selectedParkingId,
      editingParkingId: updates.editingParkingId ?? editingParkingId
    };
    setCurrentTabState(tab);
    if (updates.selectedParkingId !== undefined) setSelectedParkingId(updates.selectedParkingId);
    if (updates.editingParkingId !== undefined) setEditingParkingId(updates.editingParkingId);
    window.history.pushState(
      nextNavigation,
      '',
      `${window.location.pathname}${window.location.search}${window.location.hash}`
    );
  };

  // Set default tab on role switch
  useEffect(() => {
    if (isAuthenticated) {
      if (canManageParkings && currentTab === 'search') {
        setCurrentTabState('operator-dashboard');
        window.history.replaceState({
          ...window.history.state,
          easyparkApp: true,
          currentTab: 'operator-dashboard',
          selectedParkingId,
          editingParkingId
        }, '');
      } else if (!canManageParkings && currentTab.startsWith('operator')) {
        setCurrentTabState('search');
        window.history.replaceState({
          ...window.history.state,
          easyparkApp: true,
          currentTab: 'search',
          selectedParkingId,
          editingParkingId
        }, '');
      }
    }
  }, [user?.role, isAuthenticated, canManageParkings, currentTab, selectedParkingId, editingParkingId]);

  useEffect(() => {
    const syncNavigation = (event) => {
      if (!event.state?.easyparkApp) return;
      setCurrentTabState(event.state.currentTab || 'search');
      setSelectedParkingId(event.state.selectedParkingId || null);
      setEditingParkingId(event.state.editingParkingId || null);
    };
    window.history.replaceState({
      ...window.history.state,
      easyparkApp: true,
      currentTab,
      selectedParkingId,
      editingParkingId
    }, '', `${window.location.pathname}${window.location.search}${window.location.hash}`);
    window.addEventListener('popstate', syncNavigation);
    return () => window.removeEventListener('popstate', syncNavigation);
  }, []);

  const resetToken = new URLSearchParams(window.location.hash.slice(1)).get('reset_token');
  if (resetToken) {
    return <ResetPassword token={resetToken} onNavigateLogin={() => {
      window.history.replaceState({}, '', window.location.pathname);
      setAuthView('login');
    }} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-white font-extrabold text-lg">Launching EasyPark...</h2>
        </div>
      </div>
    );
  }

  // If not logged in, show Login or Register
  if (!isAuthenticated) {
    if (authError) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
          <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
            <h1 className="text-xl font-bold text-slate-900">Could not restore your session</h1>
            <p className="mt-3 text-sm text-slate-600">{authError}</p>
            <button onClick={restoreSession} className="mt-6 rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white">
              Try again
            </button>
            <button onClick={logout} className="ml-3 mt-6 rounded-xl px-5 py-3 text-sm font-bold text-slate-600">
              Sign in instead
            </button>
          </div>
        </div>
      );
    }
    return authView === 'register' ? (
      <Register onNavigateLogin={() => setAuthView('login')} />
    ) : (
      <Login onNavigateRegister={() => setAuthView('register')} />
    );
  }

  const handleSelectParking = (id) => {
    navigateToTab('details', { selectedParkingId: id });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEditParking = (id) => {
    navigateToTab('operator-edit', { editingParkingId: id });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackFromDetails = () => {
    if (window.history.state?.easyparkApp && window.history.state.currentTab === 'details') {
      window.history.back();
    } else {
      navigateToTab(canManageParkings ? 'operator-dashboard' : 'search');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar currentTab={currentTab} setCurrentTab={navigateToTab} />

      <div className="flex-1">
        {/* Driver Views */}
        {currentTab === 'search' && (
          <DriverDashboard
            onSelectParking={handleSelectParking}
            onNavigateTab={navigateToTab}
          />
        )}

        {currentTab === 'map-view' && (
          <MapViewPage
            onSelectParking={handleSelectParking}
          />
        )}

        {currentTab === 'favourites' && (
          <FavouritesPage
            onSelectParking={handleSelectParking}
            onNavigateSearch={() => navigateToTab('search')}
          />
        )}

        {currentTab === 'history' && (
          <HistoryPage
            onSelectParking={handleSelectParking}
          />
        )}

        {currentTab === 'payments' && (
          <PaymentsHistoryPage
            onSelectParking={handleSelectParking}
          />
        )}

        {/* Parking Details Page */}
        {currentTab === 'details' && (
          <ParkingDetails
            parkingId={selectedParkingId}
            onBack={handleBackFromDetails}
            onNavigateTab={navigateToTab}
          />
        )}

        {/* Admin-only management views */}
        {canManageParkings && (currentTab === 'operator-dashboard' || currentTab === 'operator-parkings') && (
          <OperatorDashboard
            onNavigateTab={navigateToTab}
            onEditParking={handleEditParking}
            onSelectParking={handleSelectParking}
          />
        )}

        {canManageParkings && currentTab === 'operator-add' && (
          <OperatorAddParking
            onCancel={() => navigateToTab('operator-dashboard')}
            onSuccess={(newParking) => {
              navigateToTab('details', { selectedParkingId: newParking.id });
            }}
          />
        )}

        {canManageParkings && currentTab === 'operator-edit' && (
          <OperatorEditParking
            parkingId={editingParkingId}
            onCancel={() => navigateToTab('operator-dashboard')}
            onSuccess={(updatedParking) => {
              navigateToTab('details', { selectedParkingId: updatedParking.id });
            }}
          />
        )}

        {canManageParkings && currentTab === 'operator-reports' && (
          <OperatorReports />
        )}

        {canManageParkings && currentTab === 'operator-reviews' && (
          <OperatorReviews />
        )}

        {/* Common Profile Page */}
        {currentTab === 'profile' && (
          <ProfilePage />
        )}
      </div>

      {/* Modern Footer */}
      <footer className="bg-slate-900 text-slate-400 py-8 border-t border-slate-800 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-white font-extrabold text-sm">
            <span className="bg-brand-600 px-2 py-0.5 rounded-lg text-white">EP</span>
            <span>EasyPark Smart Navigation</span>
          </div>

          <div className="flex items-center gap-6 text-[11px]">
            <span>🟢 Live Slot Availability</span>
            <span>📍 Haversine Real-Time Distance</span>
            <span>💳 Safe Mock Payments</span>
            <span>⚡ Instant Operator Publishing</span>
          </div>

          <p className="text-[11px] text-slate-500">
            &copy; {new Date().getFullYear()} EasyPark Systems. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

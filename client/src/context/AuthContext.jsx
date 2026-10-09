import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  const restoreSession = useCallback(async () => {
    const savedToken = localStorage.getItem('easypark_token');
    if (!savedToken) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setAuthError(null);
    try {
      const res = await api.getProfile();
      setToken(savedToken);
      setUser(res.user);
    } catch (err) {
      if ([401, 403, 404].includes(err.status)) {
        localStorage.removeItem('easypark_token');
        setToken(null);
        setUser(null);
      } else {
        setAuthError('EasyPark could not verify your session. Check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  const login = async (identifier, password) => {
    const res = await api.login({ username: identifier, password });
    localStorage.setItem('easypark_token', res.token);
    setToken(res.token);
    setUser(res.user);
    setAuthError(null);
    return res.user;
  };

  const register = async (userData) => {
    const res = await api.register(userData);
    localStorage.setItem('easypark_token', res.token);
    setToken(res.token);
    setUser(res.user);
    setAuthError(null);
    return res.user;
  };

  const logout = () => {
    localStorage.removeItem('easypark_token');
    setToken(null);
    setUser(null);
    setAuthError(null);
  };

  const updateUser = (updatedFields) => {
    setUser(prev => ({ ...prev, ...updatedFields }));
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      authError,
      restoreSession,
      login,
      register,
      logout,
      updateUser,
      isAuthenticated: !!user,
      isDriver: user?.role === 'driver',
      isOperator: user?.role === 'operator',
      isAdmin: user?.role === 'admin'
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

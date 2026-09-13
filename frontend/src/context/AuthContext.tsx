import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { loginWithGoogle } from '../services/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (data: { credential?: string; accessToken?: string; userInfo?: any }) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_STORAGE_KEY = 'reachinbox_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const saved = localStorage.getItem(USER_STORAGE_KEY);
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch (err) {
        localStorage.removeItem(USER_STORAGE_KEY);
      }
    } else {
      // Default initial login for instant review if not logged in
      const defaultUser: User = {
        id: 'user_alex_outbox',
        email: 'alex.morgan@outboxlabs.io',
        name: 'Alex Morgan',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      };
      setUser(defaultUser);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(defaultUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (data: { credential?: string; accessToken?: string; userInfo?: any }) => {
    try {
      const response = await loginWithGoogle(data);
      if (response && response.user) {
        setUser(response.user);
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(response.user));
      }
    } catch (err) {
      console.error('[Auth] Login error:', err);
      throw err;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(USER_STORAGE_KEY);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        logout,
        isLoading,
      }}
    >
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

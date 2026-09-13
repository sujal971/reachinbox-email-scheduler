import React from 'react';
import { X, LogIn } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { login } = useAuth();

  if (!isOpen) return null;

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const handleGoogleSuccess = async (credentialResponse: any) => {
    try {
      await login({ credential: credentialResponse.credential });
      onClose();
    } catch (err) {
      console.error('Google OAuth failed:', err);
    }
  };

  const handleQuickDemoLogin = async (role: 'alex' | 'sarah') => {
    const profiles = {
      alex: {
        email: 'alex.morgan@outboxlabs.io',
        name: 'Alex Morgan',
        picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      },
      sarah: {
        email: 'sarah.growth@reachinbox.ai',
        name: 'Sarah Connor',
        picture: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      },
    };

    await login({ userInfo: profiles[role] });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-dark-850 rounded-2xl border border-dark-700 w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-dark-700 flex items-center justify-between bg-dark-900/50">
          <div className="flex items-center gap-2">
            <LogIn className="w-4 h-4 text-brand-accent" />
            <h2 className="text-sm font-bold text-white">Sign In to ReachInbox</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-dark-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-center">
          <p className="text-xs text-slate-300">
            Sign in with Google to schedule and manage your cold email outreach campaigns.
          </p>

          {/* Real Google OAuth Button */}
          <div className="flex justify-center my-4">
            {googleClientId ? (
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => console.error('Google Login Error')}
                theme="filled_black"
                shape="pill"
                size="large"
              />
            ) : (
              <div className="w-full">
                <button
                  type="button"
                  onClick={() => handleQuickDemoLogin('alex')}
                  className="w-full flex items-center justify-center gap-2 bg-white hover:bg-slate-100 text-slate-800 font-semibold text-xs py-2.5 px-4 rounded-full shadow transition"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Sign in with Google (Alex Morgan)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDemoLogin('sarah')}
                  className="w-full mt-2 text-slate-400 hover:text-white text-xs py-1.5 transition"
                >
                  or sign in as Sarah Connor (Growth Lead)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;

import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { User, Lock, Eye, EyeOff } from 'lucide-react';

type Screen = 'login' | 'forgot' | 'forgot_sent';

export const Login: React.FC = () => {
  const [screen, setScreen] = useState<Screen>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState(() => {
    const msg = sessionStorage.getItem('auth_message');
    if (msg) sessionStorage.removeItem('auth_message');
    return msg ?? '';
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      if (msg.includes('Invalid login credentials')) setError('Email o contraseña incorrectos.');
      else setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      setScreen('forgot_sent');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#EDEBE6] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-[420px] bg-white rounded-2xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] p-8 md:p-10 mb-8 relative">
        
        {/* Logo Section */}
        <div className="-mt-8 -mb-2 text-center flex justify-center">
          <img
            src="/logo.png"
            alt="Sentinel Core"
            className="w-full max-w-[380px] h-auto object-contain transform scale-110 mix-blend-multiply"
          />
        </div>

        {/* Login Form */}
        {screen === 'login' && (
          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            {error && (
              <div className="bg-[#B23A3A]/10 border border-[#B23A3A]/30 text-[#B23A3A] px-4 py-3 rounded-lg text-xs font-semibold text-center uppercase tracking-wide">
                {error}
              </div>
            )}
            
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold tracking-wider text-[#6B7177] uppercase ml-1">Email</label>
              <div className="relative flex items-center">
                <User className="absolute left-3.5 text-[#6B7177] w-4 h-4" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="VALENTINO@ZAZU-ORG.COM"
                  className="w-full bg-transparent border border-gray-200 rounded-lg pl-10 pr-4 py-3.5 text-sm font-medium text-[#3F444A] placeholder:text-gray-300 focus:outline-none focus:border-[#C89B5E] focus:ring-1 focus:ring-[#C89B5E] transition-all uppercase"
                  autoComplete="email"
                  required
                />
              </div>
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold tracking-wider text-[#6B7177] uppercase ml-1">Contraseña</label>
              <div className="relative flex items-center">
                <Lock className="absolute left-3.5 text-[#6B7177] w-4 h-4" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-transparent border border-gray-200 rounded-lg pl-10 pr-10 py-3.5 text-sm font-medium text-[#3F444A] placeholder:text-gray-300 focus:outline-none focus:border-[#C89B5E] focus:ring-1 focus:ring-[#C89B5E] transition-all tracking-[0.2em]"
                  autoComplete="current-password"
                  required
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 text-[#6B7177] hover:text-[#3F444A] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="mt-4 w-full bg-[#3F444A] text-[#C89B5E] py-4 rounded-lg text-xs font-bold tracking-widest uppercase hover:bg-[#34383d] active:scale-[0.99] disabled:opacity-50 transition-all"
            >
              {loading ? 'VERIFICANDO...' : 'INGRESAR'}
            </button>

            <div className="text-center mt-2">
              <button
                type="button"
                onClick={() => setScreen('forgot')}
                className="text-[10px] font-medium text-[#6B7177] hover:text-[#3F444A] uppercase transition-colors"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          </form>
        )}

        {/* Forgot Password Form */}
        {screen === 'forgot' && (
          <form onSubmit={handleForgot} className="flex flex-col gap-5">
            {error && (
              <div className="bg-[#B23A3A]/10 border border-[#B23A3A]/30 text-[#B23A3A] px-4 py-3 rounded-lg text-xs font-semibold text-center uppercase tracking-wide">
                {error}
              </div>
            )}
            
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold tracking-wider text-[#6B7177] uppercase ml-1">Email de recuperación</label>
              <div className="relative flex items-center">
                <User className="absolute left-3.5 text-[#6B7177] w-4 h-4" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="USUARIO@EJEMPLO.COM"
                  className="w-full bg-transparent border border-gray-200 rounded-lg pl-10 pr-4 py-3.5 text-sm font-medium text-[#3F444A] placeholder:text-gray-300 focus:outline-none focus:border-[#C89B5E] focus:ring-1 focus:ring-[#C89B5E] transition-all uppercase"
                  autoComplete="email"
                  required
                />
              </div>
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="mt-4 w-full bg-[#3F444A] text-[#C89B5E] py-4 rounded-lg text-xs font-bold tracking-widest uppercase hover:bg-[#34383d] active:scale-[0.99] disabled:opacity-50 transition-all"
            >
              {loading ? 'ENVIANDO...' : 'ENVIAR ENLACE'}
            </button>

            <div className="text-center mt-2">
              <button
                type="button"
                onClick={() => setScreen('login')}
                className="text-[10px] font-medium text-[#6B7177] hover:text-[#3F444A] uppercase transition-colors"
              >
                Volver al inicio de sesión
              </button>
            </div>
          </form>
        )}

        {/* Success Form */}
        {screen === 'forgot_sent' && (
          <div className="flex flex-col gap-5 text-center py-4">
            <div className="text-[#C89B5E] mx-auto bg-[#C89B5E]/10 p-4 rounded-full">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
            </div>
            <div>
              <p className="text-[11px] tracking-wider uppercase text-[#6B7177] font-semibold">
                Hemos enviado las instrucciones a:
              </p>
              <p className="text-sm text-[#3F444A] font-bold mt-2 uppercase">{email}</p>
            </div>
            
            <button
              type="button"
              onClick={() => setScreen('login')}
              className="mt-6 w-full bg-gray-100 text-[#3F444A] py-4 rounded-lg text-xs font-bold tracking-widest uppercase hover:bg-gray-200 transition-all"
            >
              VOLVER AL INICIO
            </button>
          </div>
        )}
      </div>

      <div className="text-center">
        <p className="font-mono text-[9px] text-[#6B7177]/80 tracking-[0.3em] uppercase font-semibold">
          SENTINEL CORE V3.0 // ACCESO RESTRINGIDO
        </p>
      </div>
    </div>
  );
};

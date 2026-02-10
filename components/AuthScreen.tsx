
import React, { useState } from 'react';
import { authService, User, ALLOWED_DOMAIN, SPREADSHEET_ID } from '../services/authService.ts';
import { otpService } from '../services/otpService.ts';
import { hashPassword, generateSessionId } from '../utils/crypto.ts';
import { ShieldCheck, Lock, Mail, Smartphone, User as UserIcon, Loader2, ArrowRight, ShieldAlert, KeyRound, Fingerprint, RefreshCcw } from 'lucide-react';

interface AuthScreenProps {
  onAuthenticated: (user: User, sessionId: string) => void;
}

type AuthMode = 'login' | 'signup' | 'verify';

const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userName, setUserName] = useState('');
  const [mobile, setMobile] = useState('');
  const [error, setError] = useState('');
  
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [userOtpInput, setUserOtpInput] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const normalizedEmail = email.toLowerCase().trim();

    try {
      if (mode === 'login') {
        const hashedPassword = await hashPassword(password);
        const cloudUser = await authService.fetchUserFromCloud(normalizedEmail);
        
        if (cloudUser && cloudUser.success && cloudUser.user.password === hashedPassword) {
          const sid = generateSessionId();
          await authService.syncSessionToCloud(cloudUser.user.email, cloudUser.user.userName, sid);
          onAuthenticated(cloudUser.user, sid);
        } else {
          const localUsers = JSON.parse(localStorage.getItem('osm_users') || '[]');
          const localUser = localUsers.find((u: any) => u.email === normalizedEmail && u.password === hashedPassword);
          
          if (localUser) {
            const sid = generateSessionId();
            await authService.syncSessionToCloud(localUser.email, localUser.userName, sid);
            onAuthenticated(localUser, sid);
          } else {
            setError('Access Denied: Invalid operator credentials.');
          }
        }
      } else if (mode === 'signup') {
        if (!normalizedEmail.endsWith(ALLOWED_DOMAIN)) {
          setError(`Access Limited: Use ${ALLOWED_DOMAIN}`);
          setLoading(false);
          return;
        }

        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        setGeneratedOtp(otp);

        await otpService.dispatchOtp(normalizedEmail, otp, userName, mobile);
        setMode('verify');
      } else if (mode === 'verify') {
        if (userOtpInput === generatedOtp) {
          const hashedPassword = await hashPassword(password);
          const newUser = { email: normalizedEmail, userName, mobile, password: hashedPassword };
          
          await authService.registerUserInCloud(newUser);
          
          const localUsers = JSON.parse(localStorage.getItem('osm_users') || '[]');
          localUsers.push(newUser);
          localStorage.setItem('osm_users', JSON.stringify(localUsers));
          
          alert('VERIFIED: Please use your credentials to login.');
          setMode('login');
        } else {
          setError('Mismatch: Invalid Access Code.');
        }
      }
    } catch (err: any) {
      setError(`Signal Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-white overflow-hidden relative">
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-5 flex flex-wrap gap-20 p-20">
         {Array.from({length: 12}).map((_, i) => <ShieldCheck key={i} size={120} />)}
      </div>

      <div className="w-full max-w-md z-10">
        <div className="text-center mb-12">
          <div className="inline-flex p-4 bg-indigo-600 text-white rounded-[24px] shadow-2xl mb-6 relative">
            {mode === 'verify' ? <KeyRound size={40} /> : <Fingerprint size={40} />}
            {loading && <div className="absolute -inset-2 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>}
          </div>
          <h1 className="text-4xl font-orbitron font-black text-slate-900 uppercase tracking-tighter">OSM <span className="text-indigo-600">Secure</span></h1>
        </div>

        <form onSubmit={handleAuth} className="glass-panel p-8 rounded-[40px] border border-slate-200 shadow-2xl transition-all relative">
          <div className="space-y-4">
            {mode === 'signup' && (
              <>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" placeholder="USER NAME" value={userName} onChange={e => setUserName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 py-4 pl-12 pr-4 rounded-2xl text-[11px] font-bold uppercase tracking-widest focus:ring-2 ring-indigo-500/20 outline-none" required 
                  />
                </div>
                <div className="relative">
                  <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" placeholder="MOBILE NUMBER" value={mobile} onChange={e => setMobile(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 py-4 pl-12 pr-4 rounded-2xl text-[11px] font-bold uppercase tracking-widest focus:ring-2 ring-indigo-500/20 outline-none" required 
                  />
                </div>
              </>
            )}
            
            {(mode === 'login' || mode === 'signup') && (
              <>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="email" placeholder="REGISTER MAIL" value={email} onChange={e => setEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 py-4 pl-12 pr-4 rounded-2xl text-[11px] font-bold uppercase tracking-widest focus:ring-2 ring-indigo-500/20 outline-none" required 
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="password" placeholder="PASSWORD" value={password} onChange={e => setPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 py-4 pl-12 pr-4 rounded-2xl text-[11px] font-bold uppercase tracking-widest focus:ring-2 ring-indigo-500/20 outline-none" required 
                  />
                </div>
              </>
            )}

            {mode === 'verify' && (
              <div className="py-2 text-center">
                <p className="text-[10px] text-slate-500 font-bold uppercase mb-4">Enter 4-Digit Gateway Code</p>
                <div className="relative inline-block w-48">
                  <input 
                    type="text" maxLength={4} placeholder="0000" 
                    value={userOtpInput} 
                    onChange={e => setUserOtpInput(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-slate-50 border border-slate-200 py-5 px-4 rounded-2xl text-4xl font-orbitron font-black tracking-[0.5em] focus:ring-2 ring-indigo-500/20 outline-none text-center" 
                    required 
                  />
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="text-red-500" size={14} />
                  <p className="text-red-600 text-[9px] font-black uppercase">Technical Fault</p>
                </div>
                <p className="text-red-500 text-[8px] font-mono break-words">{error}</p>
            </div>
          )}

          <button 
            type="submit" disabled={loading}
            className="w-full mt-8 py-5 bg-indigo-600 text-white rounded-3xl font-orbitron font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" /> : 
             mode === 'login' ? 'LOGIN' : 
             mode === 'signup' ? 'DISPATCH OTP' : 'Finalize Registry'}
            <ArrowRight size={18} />
          </button>

          <button 
            type="button" onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setError('');
            }}
            className="w-full mt-4 text-[9px] text-slate-400 font-bold uppercase tracking-widest hover:text-indigo-600 transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCcw size={10} />
            {mode === 'login' ? 'REGISTER USER' : 'Authorized Personnel? Access'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AuthScreen;

import { Lock, LogOut, Shield, Truck, User } from 'lucide-react';
import { useState } from 'react';
import { ENV_CONFIG } from '../../config/env';
import { registerLocalCitizen } from '../../mocks/mockApi';
import { useAuth } from '../../app/AuthContext';
import { ErrorBanner } from '../../components/ErrorBanner';
import type { Role } from '../../types/api';

interface RoleLoginPanelProps {
  requiredRole?: Role;
  onAuthenticated?: () => void;
}

const ROLE_COPY: Record<
  Role | 'ANY',
  {
    title: string;
    subtitle: string;
    emailPlaceholder: string;
  }
> = {
  ANY: {
    title: 'Sign in to GreenTrack',
    subtitle: 'Enter your Citizen, Collector, or Admin account credentials to access your workspace.',
    emailPlaceholder: 'name@organization.org',
  },
  CITIZEN: {
    title: 'Citizen Account Sign In',
    subtitle: 'Sign in with your citizen credentials to access your personal participation history.',
    emailPlaceholder: 'citizen@organization.org',
  },
  COLLECTOR: {
    title: 'Collector Authentication',
    subtitle:
      'Sign in with an authorized Collector account to view assigned collection tasks, log physical bin inspections, and report field incidents.',
    emailPlaceholder: 'collector@organization.org',
  },
  ADMIN: {
    title: 'Admin Operations Authentication',
    subtitle:
      'Sign in with an Administrator account to manage zones, bins, QR credentials, collector assignments, monthly analytics, and route optimization.',
    emailPlaceholder: 'admin@organization.org',
  },
};

function RoleIcon({ role }: { role?: Role }) {
  const cls = 'h-6 w-6 text-[#047857]';
  if (role === 'ADMIN') return <Shield className={cls} aria-hidden="true" />;
  if (role === 'COLLECTOR') return <Truck className={cls} aria-hidden="true" />;
  return <User className={cls} aria-hidden="true" />;
}

export function RoleLoginPanel({ requiredRole, onAuthenticated }: RoleLoginPanelProps) {
  const { user, login, logout } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [registering, setRegistering] = useState(false);
  const [visible, setVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const copy = ROLE_COPY[requiredRole ?? 'ANY'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      if (registering) await registerLocalCitizen(email, password);
      const signedInUser = await login({ email: email.trim(), password });
      if (requiredRole && signedInUser.role !== requiredRole) {
        setError(
          new Error(
            `Authenticated as ${signedInUser.display_name} (${signedInUser.role}), but this workspace requires ${requiredRole} credentials.`,
          ),
        );
      } else {
        setEmail('');
        setPassword('');
        onAuthenticated?.();
      }
    } catch (err) {
      setError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (user && requiredRole && user.role !== requiredRole) {
    return (
      <div className="mx-auto max-w-md space-y-5 rounded-lg border border-slate-200 bg-white p-7">
        <div className="flex items-start gap-3">
          <Lock className="mt-0.5 h-5 w-5 shrink-0 text-[#D97706]" aria-hidden="true" />
          <div className="space-y-1">
            <h1 className="text-lg font-semibold text-slate-900">Role Access Restricted</h1>
            <p className="text-sm text-slate-600">
              You are currently signed in as <strong className="text-slate-900">{user.display_name}</strong> ({user.role}). Access to this area is restricted to <strong className="font-mono text-slate-900">{requiredRole}</strong> accounts.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={logout}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Sign out and switch account</span>
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md rounded-lg border border-slate-200 bg-white p-7">
      <div className="mb-6 space-y-2 border-b border-slate-100 pb-5">
        <div className="flex items-center gap-2.5">
          <RoleIcon role={requiredRole} />
          <h1 className="text-lg font-semibold text-slate-900">{registering ? 'Create citizen account' : copy.title}</h1>
        </div>
        <p className="text-xs leading-relaxed text-slate-600">{registering ? 'Your GreenTrack ID is generated at registration. Save your password to sign in again on this browser.' : copy.subtitle}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor={`role-email-${requiredRole ?? 'any'}`} className="block text-xs font-medium text-slate-700">
            Email address
          </label>
          <input
            id={`role-email-${requiredRole ?? 'any'}`}
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={copy.emailPlaceholder}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#047857] focus:ring-2 focus:ring-emerald-600/20 focus:outline-none"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor={`role-password-${requiredRole ?? 'any'}`} className="block text-xs font-medium text-slate-700">
            Password
          </label>
          <input
            id={`role-password-${requiredRole ?? 'any'}`}
            type={registering && visible ? 'text' : 'password'}
            required
            autoComplete={registering ? 'new-password' : 'current-password'}
            minLength={registering ? 8 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#047857] focus:ring-2 focus:ring-emerald-600/20 focus:outline-none"
          />
        </div>

        {registering && <div className="flex gap-4 text-sm text-emerald-700">
          <button type="button" onClick={() => { setPassword(crypto.randomUUID().replaceAll('-', '')); setVisible(true); }}>Generate password</button>
          <button type="button" onClick={() => setVisible(!visible)}>{visible ? 'Hide password' : 'Show password'}</button>
        </div>}
        <ErrorBanner
          error={error}
          onDismiss={() => setError(null)}
          title="Authentication required"
        />

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-md bg-[#047857] px-4 py-2.5 text-xs font-medium text-white transition-colors hover:bg-[#065F46] disabled:opacity-50"
        >
          {isSubmitting
            ? 'Authenticating…'
            : registering ? 'Create citizen account' : requiredRole
              ? `Sign in as ${requiredRole.charAt(0) + requiredRole.slice(1).toLowerCase()}`
              : 'Sign in'}
        </button>
      </form>
      {ENV_CONFIG.defaultUseMockApi && (!requiredRole || requiredRole === 'CITIZEN') &&
        <button type="button" disabled={isSubmitting} className="mt-4 text-sm font-semibold text-emerald-700" onClick={() => {
          setRegistering(!registering); setPassword(''); setVisible(false); setError(null);
        }}>{registering ? 'Back to sign in' : 'Create new citizen account'}</button>}
    </div>
  );
}

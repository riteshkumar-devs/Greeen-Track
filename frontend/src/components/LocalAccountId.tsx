import { useState } from 'react';

export function saveLocalAccountId(accountId: string, value: string) {
  const key = 'greentrack_profile_id_' + accountId;
  if (value) localStorage.setItem(key, value);
  else localStorage.removeItem(key);
}

export function AccountIdField({ value, change }: { value: string; change: (value: string) => void }) {
  return <label className="block text-xs font-medium text-slate-700">
    GreenTrack ID (optional, local demo)
    <input value={value} onChange={e => change(e.target.value.toUpperCase())}
      placeholder="GT-CAMPUS01" pattern="GT-[A-Z0-9]{2,24}" maxLength={27}
      title="Enter GT- followed by 2 to 24 letters or digits" autoComplete="off"
      className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono" />
  </label>;
}

export function LocalAccountId({ accountId }: { accountId: string }) {
  const [value, setValue] = useState(() => {
    try { return localStorage.getItem('greentrack_profile_id_' + accountId) ?? ''; }
    catch { return ''; }
  });
  const [status, setStatus] = useState('');
  return <form className="space-y-2 rounded-lg border border-slate-200 bg-white p-4" onSubmit={e => {
    e.preventDefault();
    try { saveLocalAccountId(accountId, value); setStatus('Saved on this browser.'); }
    catch { setStatus('Browser storage is unavailable.'); }
  }}>
    <AccountIdField value={value} change={v => { setValue(v); setStatus(''); }} />
    <button className="rounded bg-emerald-700 px-3 py-2 text-xs text-white">Save ID</button>
    <span role="status" className="ml-2 text-xs">{status}</span>
  </form>;
}

import { useEffect, useState } from 'react';
import { ENV_CONFIG } from '../../config/env';

interface Report {
  bin: string;
  id: string;
  condition: string;
  photo?: Blob;
  time: number;
}

async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('greentrack-feedback', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('reports', { keyPath: 'time' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function BinFeedback({ bin, id }: { bin: string; id: string }) {
  const [message, setMessage] = useState('');
  if (!ENV_CONFIG.defaultUseMockApi) return null;
  return <form className="space-y-3 rounded-lg border border-slate-200 p-4" onSubmit={async e => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const image = data.get('photo') as File;
    try {
      if (image.size > 5000000 || (image.size && !image.type.startsWith('image/'))) throw Error();
      const db = await database();
      const tx = db.transaction('reports', 'readwrite');
      tx.objectStore('reports').add({ bin, id, condition: data.get('condition'), photo: image.size ? image : undefined, time: Date.now() });
      tx.oncomplete = () => { db.close(); form.reset(); setMessage('Report saved for local admin review.'); window.dispatchEvent(new Event('bin-feedback')); };
      tx.onabort = () => { db.close(); setMessage('Could not save report. Try again.'); };
    } catch { setMessage('Could not save. Choose an image under 5 MB or submit without a photo.'); }
  }}>
    <h3 className="font-semibold">Report bin condition</h3>
    <select name="condition" aria-label="Observed bin condition" required defaultValue=""><option value="" disabled>Select condition</option><option>Full</option><option>Empty</option></select>
    <label className="block text-sm">Optional photo for admin review (up to 5 MB)
      <input className="block" type="file" name="photo" accept="image/*" capture="environment" />
    </label>
    <button className="rounded bg-emerald-700 px-3 py-2 text-white">Submit report</button>
    <p role="status">{message}</p>
  </form>;
}

function Photo({ image }: { image: Blob }) {
  const [src, setSrc] = useState('');
  useEffect(() => { const url = URL.createObjectURL(image); setSrc(url); return () => URL.revokeObjectURL(url); }, [image]);
  return src ? <img src={src} className="max-h-40" alt="Citizen-submitted bin condition" /> : null;
}

export function FeedbackInbox() {
  const [reports, setReports] = useState<Report[]>([]);
  useEffect(() => {
    if (!ENV_CONFIG.defaultUseMockApi) return;
    let active = true;
    async function refresh() {
      const db = await database();
      const req = db.transaction('reports').objectStore('reports').openCursor(null, 'prev');
      const rows: Report[] = [];
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor && rows.length < 30) { rows.push(cursor.value); cursor.continue(); }
        else { db.close(); if (active) setReports(rows); }
      };
    }
    const update = () => { void refresh().catch(() => {}); };
    update();
    const timer = window.setInterval(update, 5000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  if (!reports.length) return null;
  return <section className="space-y-3 rounded-xl bg-white p-5"><h2 className="font-semibold">Citizen bin reports</h2>
    {reports.map(r => <details key={r.time}><summary>{r.bin} · Reported {r.condition.toLowerCase()} · {new Date(r.time).toLocaleString()}</summary>
      <p className="text-sm">Bin ID {r.id}</p>{r.photo && <Photo image={r.photo} />}</details>)}</section>;
}

import { useState } from 'react';
import { localTaskStops } from '../../mocks/mockApi';
import { ENV_CONFIG } from '../../config/env';
import { getStoredAccessToken } from '../../services/apiClient';

export function NextPickup() {
  const [message, setMessage] = useState('');
  const [route, setRoute] = useState('');
  const [busy, setBusy] = useState(false);
  if (!ENV_CONFIG.defaultUseMockApi) return null;
  async function find() {
    setRoute(''); setBusy(true); setMessage('Finding the nearest assigned pickup…');
    try {
      const stops = localTaskStops({ Authorization: 'Bearer ' + getStoredAccessToken() });
      if (!stops.length) throw Error('No pending pickups assigned to you.');
      const position = await new Promise<GeolocationPosition>((ok, fail) => navigator.geolocation.getCurrentPosition(ok, fail, {timeout: 15000}));
      const start = position.coords;
      const coords = [[start.longitude, start.latitude], ...stops.map(s => [s.point.longitude,s.point.latitude])];
      const params = new URLSearchParams({sources:'0', destinations:stops.map((_, i) => i+1).join(';'), annotations:'distance'});
      const response = await fetch('https://router.project-osrm.org/table/v1/driving/' + coords.map(c => c.join(',')).join(';') + '?' + params, {signal: AbortSignal.timeout(15000)});
      if (!response.ok) throw Error('Road routing is unavailable. Try again.');
      const result = await response.json();
      const distances: (number|null)[] = result.distances?.[0] ?? [];
      const choices = stops.map((stop,i) => ({stop, distance: distances[i]})).filter(c => Number.isFinite(c.distance)).sort((a,b) => a.distance! - b.distance!);
      const next = choices[0];
      if (!next) throw Error('No reachable pickup found.');
      setMessage(next.stop.code + ' · ' + (next.distance!/1000).toFixed(1) + ' km by road');
      setRoute('https://www.google.com/maps/dir/?api=1&travelmode=driving&dir_action=navigate&destination=' + next.stop.point.latitude + ',' + next.stop.point.longitude);
    } catch(e) { setMessage(e instanceof Error ? e.message : 'Location unavailable. Allow location access and try again.'); }
    finally { setBusy(false); }
  }
  return <section className="space-y-2 rounded-xl bg-white p-4"><h2 className="font-semibold">Next pickup</h2>
    <p className="text-sm">Use your location and send assigned bin coordinates to the OSRM routing service to compare driving distances.</p>
    <button disabled={busy} onClick={find} className="rounded bg-emerald-700 px-3 py-2 text-white">Find nearest assigned bin</button>
    <p role="status">{message}</p>{route && <a href={route} target="_blank" rel="noreferrer" className="underline">Navigate with Google Maps</a>}</section>;
}

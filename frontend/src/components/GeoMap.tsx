import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import type { Bin, Coordinate, Route, Zone } from '../types/api';

// Center of the campus map published at https://www.sunderdeep.ac.in/ContactUs.html
const CAMPUS_CENTER: [number, number] = [28.685176, 77.536808];

interface GeoMapProps {
  zones?: Zone[];
  bins?: Bin[];
  route?: Route | null;
  depot?: Coordinate | null;
  selectedBinId?: string | null;
  onSelectBin?: (bin: Bin) => void;
  onMapClick?: (coord: Coordinate) => void;
  heightClass?: string;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getBinMarkerColor(bin: Bin, isAffected: boolean, isUnreachable: boolean): string {
  if (isUnreachable || bin.status === 'DAMAGED' || bin.status === 'DECOMMISSIONED') return '#DC2626';
  if (isAffected) return '#D97706';
  const fill = bin.latest_observed_fill_percent;
  if (fill !== null && fill !== undefined) {
    if (fill >= 90) return '#DC2626';
    if (fill >= 75) return '#D97706';
    return '#16A34A';
  }
  return '#047857';
}

export function GeoMap({
  zones = [],
  bins = [],
  route = null,
  depot = null,
  selectedBinId = null,
  onSelectBin,
  onMapClick,
  heightClass = 'h-96',
}: GeoMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const recordBounds = useRef<[number, number][]>([]);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: CAMPUS_CENTER,
      zoom: 16,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    L.circleMarker(CAMPUS_CENTER, { radius: 5, color: '#334155', fillOpacity: 1 })
      .bindTooltip('SDGI Global University', { direction: 'top' }).addTo(map);
    const group = L.layerGroup().addTo(map);
    mapRef.current = map;
    layerGroupRef.current = group;

    return () => {
      recordBounds.current = [];
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleClick = (e: L.LeafletMouseEvent) => {
      onMapClick?.({
        latitude: Number(e.latlng.lat.toFixed(6)),
        longitude: Number(e.latlng.lng.toFixed(6)),
      });
    };

    if (onMapClick) {
      map.on('click', handleClick);
      map.getContainer().style.cursor = 'crosshair';
    } else {
      map.getContainer().style.cursor = '';
    }

    return () => {
      map.off('click', handleClick);
    };
  }, [onMapClick]);

  useEffect(() => {
    const map = mapRef.current;
    const group = layerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();
    const bounds: [number, number][] = [];

    // Draw zone rings
    zones.forEach((z) => {
      if (!z.center) return;
      L.circle([z.center.latitude, z.center.longitude], {
        radius: 190,
        color: '#64748B',
        weight: 1,
        dashArray: '4 4',
        fillColor: '#94A3B8',
        fillOpacity: 0.08,
      })
        .bindTooltip(escapeHtml(z.name), { direction: 'top', opacity: 0.9 })
        .addTo(group);
      bounds.push([z.center.latitude, z.center.longitude]);
    });

    // Draw depot marker
    if (depot) {
      const depotIcon = L.divIcon({
        className: 'gt-depot-marker',
        html: `<div style="width:26px;height:26px;border-radius:6px;background:#0F172A;color:#FFF;display:flex;align-items:center;justify-content:center;font-family:JetBrains Mono,monospace;font-size:11px;font-weight:700;border:2px solid #FFF;box-shadow:0 2px 6px rgba(15,23,42,0.35);">D</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      L.marker([depot.latitude, depot.longitude], { icon: depotIcon })
        .bindPopup('<strong>Dispatch Depot</strong>')
        .addTo(group);
      bounds.push([depot.latitude, depot.longitude]);
    }

    // Draw route polyline & sequence markers if route is active
    const affectedSet = new Set(route?.affected_bin_ids ?? []);
    const stopByBin = new Map(route?.stops.map((s) => [s.bin_id, s]) ?? []);

    if (route && route.stops.length > 0) {
      const linePoints: [number, number][] = [];
      if (depot) linePoints.push([depot.latitude, depot.longitude]);
      route.stops.forEach((stop) => {
        const bin = bins.find((b) => b.id === stop.bin_id);
        if (bin && stop.status !== 'UNREACHABLE') {
          linePoints.push([bin.location.latitude, bin.location.longitude]);
        }
      });
      if (linePoints.length > 1) {
        L.polyline(linePoints, {
          color: route.status === 'FAILED' ? '#DC2626' : '#047857',
          weight: 3.5,
          opacity: 0.85,
          dashArray: route.estimates_source === 'SIMULATED' ? '6 5' : undefined,
        }).addTo(group);
      }
    }

    // Draw bin markers
    bins.forEach((bin) => {
      const stop = stopByBin.get(bin.id);
      const isAffected = affectedSet.has(bin.id);
      const isUnreachable = stop?.status === 'UNREACHABLE';
      const color = getBinMarkerColor(bin, isAffected, isUnreachable);
      const isSelected = bin.id === selectedBinId;

      if (stop) {
        const seqIcon = L.divIcon({
          className: 'gt-stop-marker',
          html: `<div style="width:26px;height:26px;border-radius:9999px;background:${color};color:#FFF;display:flex;align-items:center;justify-content:center;font-family:JetBrains Mono,monospace;font-size:11px;font-weight:700;border:${isSelected ? '3px solid #0F172A' : '2px solid #FFF'};box-shadow:0 2px 6px rgba(15,23,42,0.3);">${isUnreachable ? '!' : stop.sequence}</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });
        const marker = L.marker([bin.location.latitude, bin.location.longitude], { icon: seqIcon });
        marker.bindPopup(
          `<div style="font-size:12px;line-height:1.4">
            <strong style="font-family:JetBrains Mono,monospace">${escapeHtml(bin.bin_code)}</strong><br/>
            Stop #${stop.sequence} · ${escapeHtml(stop.status)}<br/>
            ${bin.latest_observed_fill_percent !== null && bin.latest_observed_fill_percent !== undefined ? `Observed fill: ${bin.latest_observed_fill_percent}%` : 'No inspection yet'}
          </div>`,
        );
        marker.on('click', () => onSelectBin?.(bin));
        marker.addTo(group);
      } else {
        const circle = L.circleMarker([bin.location.latitude, bin.location.longitude], {
          radius: isSelected ? 9 : 7,
          color: isSelected ? '#0F172A' : '#FFFFFF',
          weight: isSelected ? 2.5 : 2,
          fillColor: color,
          fillOpacity: 0.95,
        });
        circle.bindPopup(
          `<div style="font-size:12px;line-height:1.4">
            <strong style="font-family:JetBrains Mono,monospace">${escapeHtml(bin.bin_code)}</strong><br/>
            Category: ${escapeHtml(bin.category_code)} · ${bin.capacity_litres} L<br/>
            Status: ${escapeHtml(bin.status)}<br/>
            ${bin.latest_observed_fill_percent !== null && bin.latest_observed_fill_percent !== undefined ? `Observed fill: ${bin.latest_observed_fill_percent}%` : 'No inspection recorded'}
          </div>`,
        );
        circle.on('click', () => onSelectBin?.(bin));
        circle.addTo(group);
      }
      bounds.push([bin.location.latitude, bin.location.longitude]);
    });

    recordBounds.current = bounds;
  }, [zones, bins, route, depot, selectedBinId, onSelectBin]);

  return (
    <div className={`relative w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100 ${heightClass}`}>
      <div ref={containerRef} aria-label="SDGI Global University campus map" className="h-full w-full" />
      <div className="absolute right-2 top-2 z-[500] flex gap-2">
        <button type="button" onClick={() => mapRef.current?.setView(CAMPUS_CENTER, 16)}
          className="rounded bg-white px-3 py-2 text-xs font-semibold shadow">
          Center on SDGI
        </button>
        {(bins.length > 0 || zones.some(zone => zone.center) || depot) && (
          <button type="button" onClick={() => {
            if (recordBounds.current.length) mapRef.current?.fitBounds(recordBounds.current, { padding: [36, 36], maxZoom: 16 });
          }} className="rounded bg-white px-3 py-2 text-xs font-semibold shadow">
            Show all locations
          </button>
        )}
      </div>
    </div>
  );
}

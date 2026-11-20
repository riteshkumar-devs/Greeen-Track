import { MapPin, Plus, RefreshCw, RotateCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { ErrorBanner } from '../../components/ErrorBanner';
import { GeoMap } from '../../components/GeoMap';
import { QrCodeCard } from '../../components/QrCodeCard';
import { BinStatusText } from '../../components/StatusText';
import { CATEGORY_LABELS } from '../../constants/waste';
import { adminService } from '../../services/adminService';
import type {
  Bin,
  BinCreated,
  BinStatus,
  CategoryCode,
  Coordinate,
  QrRotation,
  Zone,
  ZoneStatus,
} from '../../types/api';

const CATEGORIES: CategoryCode[] = ['WET', 'PLASTIC', 'PAPER', 'METAL_GLASS', 'OTHER'];
const BIN_STATUSES: BinStatus[] = ['ACTIVE', 'INACTIVE', 'DAMAGED', 'RELOCATED', 'DECOMMISSIONED'];

type IssuedCard = Pick<BinCreated, 'qr_token' | 'qr_payload'>;

interface Props {
  adminId: string;
  issuedCards: Record<string, IssuedCard>;
  onIssue: (id: string, card: IssuedCard) => void;
}

export function ZonesAndBinsView({ adminId, issuedCards, onIssue }: Props) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [bins, setBins] = useState<Bin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);

  // Filters
  const [filterZoneId, setFilterZoneId] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<CategoryCode | ''>('');
  const [filterStatus, setFilterStatus] = useState<BinStatus | ''>('');

  // Selection & QR credential state
  const selectionKey = `greentrack_selected_bin_${adminId}`;
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    try { return window.localStorage.getItem(selectionKey); } catch { return null; }
  });
  const selectedBin = bins.find(bin => bin.id === selectedId);
  const latestQr = selectedBin && (adminService.localQr(selectedBin.id) ?? issuedCards[selectedBin.id]);
  const selectBin = (bin: Bin) => {
    setSelectedId(bin.id);
    try { window.localStorage.setItem(selectionKey, bin.id); } catch { /* Selection still works in memory. */ }
  };
  const [actionError, setActionError] = useState<unknown>(null);
  const [isMutating, setIsMutating] = useState(false);

  // Create Zone form
  const [zoneName, setZoneName] = useState('');
  const [zoneDesc, setZoneDesc] = useState('');
  const [zoneLat, setZoneLat] = useState('');
  const [zoneLon, setZoneLon] = useState('');

  // Create Bin form
  const [binCode, setBinCode] = useState('');
  const [binZoneId, setBinZoneId] = useState('');
  const [binCategory, setBinCategory] = useState<CategoryCode>('PLASTIC');
  const [binCapacity, setBinCapacity] = useState('120');
  const [binLat, setBinLat] = useState('');
  const [binLon, setBinLon] = useState('');
  const [pickTarget, setPickTarget] = useState<'none' | 'bin' | 'zone'>('bin');

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [zRes, bRes] = await Promise.all([
        adminService.listZones(),
        adminService.listBins({
          ...(filterZoneId ? { zone_id: filterZoneId } : {}),
          ...(filterCategory ? { category_code: filterCategory } : {}),
          ...(filterStatus ? { status: filterStatus } : {}),
        }),
      ]);
      setZones(zRes.items);
      setBins(bRes.items);
      if (!binZoneId && zRes.items.length > 0) {
        setBinZoneId(zRes.items[0].id);
      }
    } catch (err) {
      setLoadError(err);
    } finally {
      setIsLoading(false);
    }
  }, [filterZoneId, filterCategory, filterStatus, binZoneId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleMapClick = (coord: Coordinate) => {
    if (pickTarget === 'bin') {
      setBinLat(String(coord.latitude));
      setBinLon(String(coord.longitude));
    } else if (pickTarget === 'zone') {
      setZoneLat(String(coord.latitude));
      setZoneLon(String(coord.longitude));
    }
  };

  const handleCreateZone = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setIsMutating(true);
    try {
      const created = await adminService.createZone({
        name: zoneName.trim(),
        description: zoneDesc.trim() || undefined,
        center: zoneLat && zoneLon ? { latitude: Number(zoneLat), longitude: Number(zoneLon) } : undefined,
      });
      setZoneName('');
      setZoneDesc('');
      setZoneLat('');
      setZoneLon('');
      setBinZoneId(created.id);
      await loadAll();
    } catch (err) {
      setActionError(err);
    } finally {
      setIsMutating(false);
    }
  };

  const handleToggleZoneStatus = async (zone: Zone) => {
    setActionError(null);
    setIsMutating(true);
    try {
      const nextStatus: ZoneStatus = zone.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await adminService.updateZone(zone.id, { status: nextStatus });
      await loadAll();
    } catch (err) {
      setActionError(err);
    } finally {
      setIsMutating(false);
    }
  };

  const handleCreateBin = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setIsMutating(true);
    try {
      const created: BinCreated = await adminService.createBin({
        bin_code: binCode.trim(),
        zone_id: binZoneId,
        category_code: binCategory,
        capacity_litres: Number(binCapacity),
        location: {
          latitude: Number(binLat),
          longitude: Number(binLon),
        },
      });
      setBinCode('');
      setBinLat('');
      setBinLon('');
      selectBin(created.bin);
      onIssue(created.bin.id, {
        qr_token: created.qr_token,
        qr_payload: created.qr_payload,
      });
      await loadAll();
    } catch (err) {
      setActionError(err);
    } finally {
      setIsMutating(false);
    }
  };

  const handleUpdateBinStatus = async (binId: string, status: BinStatus) => {
    setActionError(null);
    setIsMutating(true);
    try {
      await adminService.updateBin(binId, { status });
      await loadAll();
    } catch (err) {
      setActionError(err);
    } finally {
      setIsMutating(false);
    }
  };

  const handleRotateQr = async (bin: Bin) => {
    setActionError(null);
    setIsMutating(true);
    try {
      const rotated: QrRotation = await adminService.rotateBinQr(bin.id);
      onIssue(bin.id, {
        qr_token: rotated.qr_token,
        qr_payload: rotated.qr_payload,
      });
    } catch (err) {
      setActionError(err);
    } finally {
      setIsMutating(false);
    }
  };

  const zoneNameById = new Map(zones.map((z) => [z.id, z.name]));

  return (
    <div className="space-y-8">
      <ErrorBanner error={loadError} onDismiss={() => setLoadError(null)} />
      <ErrorBanner error={actionError} onDismiss={() => setActionError(null)} />

      {selectedBin && latestQr && (
        <QrCodeCard
          key={latestQr.qr_token}
          binCode={selectedBin.bin_code}
          qrToken={latestQr.qr_token}
          qrPayload={latestQr.qr_payload}
        />
      )}

      {/* Map + Click Coordinate Picker */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <MapPin className="h-4 w-4 text-[#047857]" aria-hidden="true" />
            <span>
              Click map to set coordinates for{' '}
              <strong className="text-slate-900">
                {pickTarget === 'bin' ? 'New Bin' : pickTarget === 'zone' ? 'New Zone' : 'Inspect Only'}
              </strong>
            </span>
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            {(['bin', 'zone', 'none'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setPickTarget(mode)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  pickTarget === mode
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {mode === 'bin' ? 'Pick Bin Location' : mode === 'zone' ? 'Pick Zone Center' : 'View Only'}
              </button>
            ))}
          </div>
        </div>
        <GeoMap
          zones={zones}
          bins={bins}
          selectedBinId={selectedBin?.id ?? null}
          onSelectBin={selectBin}
          onMapClick={pickTarget === 'none' ? undefined : handleMapClick}
          heightClass="h-80"
        />
      </div>

      {/* Bin Inventory Table + Selected Bin Controls */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900">
              Bin Registry <span className="font-mono text-xs text-slate-500 tabular-nums">({bins.length})</span>
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Filter by zone"
                value={filterZoneId}
                onChange={(e) => setFilterZoneId(e.target.value)}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700"
              >
                <option value="">All zones</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filter by category"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value as CategoryCode | '')}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700"
              >
                <option value="">All streams</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filter by status"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as BinStatus | '')}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700"
              >
                <option value="">All statuses</option>
                {BIN_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void loadAll()}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            {isLoading ? (
              <div className="space-y-2 p-4">
                <div className="h-9 animate-pulse rounded bg-slate-100" />
                <div className="h-9 animate-pulse rounded bg-slate-100" />
              </div>
            ) : bins.length === 0 ? (
              <p className="p-6 text-center text-xs text-slate-500">{zones.length === 0 ? 'Create your first campus zone below, then register a bin.' : 'No bins match the active filters.'}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3.5 py-2.5 font-medium">Bin Code</th>
                      <th className="px-3.5 py-2.5 font-medium">Zone</th>
                      <th className="px-3.5 py-2.5 font-medium">Stream</th>
                      <th className="px-3.5 py-2.5 text-right font-medium">Cap (L)</th>
                      <th className="px-3.5 py-2.5 text-right font-medium">Observed Fill</th>
                      <th className="px-3.5 py-2.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bins.map((bin) => {
                      const isSelected = selectedBin?.id === bin.id;
                      return (
                        <tr
                          key={bin.id}
                          onClick={() => selectBin(bin)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-emerald-50/60' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="px-3.5 py-2.5 font-mono font-medium text-slate-900">
                            {bin.bin_code}
                          </td>
                          <td className="px-3.5 py-2.5 text-slate-700">
                            {zoneNameById.get(bin.zone_id) ?? 'Unknown'}
                          </td>
                          <td className="px-3.5 py-2.5 text-slate-600">
                            {CATEGORY_LABELS[bin.category_code]}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-mono text-slate-600 tabular-nums">
                            {bin.capacity_litres}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-mono text-slate-900 tabular-nums">
                            {bin.latest_observed_fill_percent !== null &&
                            bin.latest_observed_fill_percent !== undefined
                              ? `${bin.latest_observed_fill_percent}%`
                              : '—'}
                          </td>
                          <td className="px-3.5 py-2.5">
                            <BinStatusText status={bin.status} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {selectedBin && (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-5">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-mono font-semibold text-slate-900">{selectedBin.bin_code}</span>
                  <span aria-hidden="true">·</span>
                  <span>{zoneNameById.get(selectedBin.zone_id) ?? selectedBin.zone_id}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {selectedBin.location.latitude}, {selectedBin.location.longitude}
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  Latest observed fill:{' '}
                  <strong className="font-mono text-slate-900 tabular-nums">
                    {selectedBin.latest_observed_fill_percent !== null &&
                    selectedBin.latest_observed_fill_percent !== undefined
                      ? `${selectedBin.latest_observed_fill_percent}%`
                      : 'Not yet inspected'}
                  </strong>
                  {selectedBin.latest_inspected_at &&
                    ` (${new Date(selectedBin.latest_inspected_at).toLocaleString()})`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Update selected bin status"
                  value={selectedBin.status}
                  disabled={isMutating}
                  onChange={(e) => void handleUpdateBinStatus(selectedBin.id, e.target.value as BinStatus)}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800"
                >
                  {BIN_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      Set status: {s}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={isMutating}
                  onClick={() => void handleRotateQr(selectedBin)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  <span>Rotate QR</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Forms Column: Register Bin + Manage Zones */}
        <div className="space-y-6 lg:col-span-4">
          <form
            onSubmit={handleCreateBin}
            className="space-y-3.5 rounded-lg border border-slate-200 bg-white p-5"
          >
            <h3 className="text-sm font-semibold text-slate-900">Register Bin &amp; Issue QR</h3>
            <div className="space-y-1">
              <label htmlFor="new-bin-code" className="block text-xs font-medium text-slate-700">
                Bin Code
              </label>
              <input
                id="new-bin-code"
                required
                minLength={3}
                maxLength={40}
                value={binCode}
                onChange={(e) => setBinCode(e.target.value)}
                placeholder="Enter bin code"
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 font-mono text-xs text-slate-900"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="new-bin-zone" className="block text-xs font-medium text-slate-700">
                Zone
              </label>
              <select
                id="new-bin-zone"
                required
                value={binZoneId}
                onChange={(e) => setBinZoneId(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
              >
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label htmlFor="new-bin-cat" className="block text-xs font-medium text-slate-700">
                  Stream
                </label>
                <select
                  id="new-bin-cat"
                  value={binCategory}
                  onChange={(e) => setBinCategory(e.target.value as CategoryCode)}
                  className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="new-bin-cap" className="block text-xs font-medium text-slate-700">
                  Capacity (L)
                </label>
                <input
                  id="new-bin-cap"
                  type="number"
                  min={1}
                  required
                  value={binCapacity}
                  onChange={(e) => setBinCapacity(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono text-xs text-slate-900 tabular-nums"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label htmlFor="new-bin-lat" className="block text-xs font-medium text-slate-700">
                  Latitude
                </label>
                <input
                  id="new-bin-lat"
                  type="number"
                  step="any"
                  required
                  value={binLat}
                  onChange={(e) => setBinLat(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono text-xs text-slate-900 tabular-nums"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="new-bin-lon" className="block text-xs font-medium text-slate-700">
                  Longitude
                </label>
                <input
                  id="new-bin-lon"
                  type="number"
                  step="any"
                  required
                  value={binLon}
                  onChange={(e) => setBinLon(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono text-xs text-slate-900 tabular-nums"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isMutating || !binZoneId}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-[#047857] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#065F46] disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Register bin &amp; issue QR</span>
            </button>
          </form>

          <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900">Zones</h3>
            <ul className="divide-y divide-slate-100 text-xs">
              {zones.map((z) => (
                <li key={z.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{z.name}</p>
                    {z.description && <p className="truncate text-slate-500">{z.description}</p>}
                  </div>
                  <button
                    type="button"
                    disabled={isMutating}
                    onClick={() => void handleToggleZoneStatus(z)}
                    className={`rounded border px-2 py-1 text-[11px] font-medium whitespace-nowrap shrink-0 ${
                      z.status === 'ACTIVE'
                        ? 'border-emerald-200 bg-emerald-50 text-[#16A34A]'
                        : 'border-slate-200 bg-slate-50 text-slate-600'
                    }`}
                  >
                    {z.status}
                  </button>
                </li>
              ))}
            </ul>

            <form onSubmit={handleCreateZone} className="space-y-2.5 border-t border-slate-100 pt-3">
              <div className="text-xs font-medium text-slate-700">Create Zone</div>
              <p className="text-xs text-slate-500">
                {zoneLat && zoneLon ? `Selected center: ${zoneLat}, ${zoneLon}` : 'To add a center, select Pick Zone Center and click the map.'}
              </p>
              <input
                type="text"
                required
                minLength={2}
                maxLength={100}
                value={zoneName}
                onChange={(e) => setZoneName(e.target.value)}
                placeholder="Zone name"
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900"
              />
              <input
                type="text"
                maxLength={500}
                value={zoneDesc}
                onChange={(e) => setZoneDesc(e.target.value)}
                placeholder="Description (optional)"
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900"
              />
              <button
                type="submit"
                disabled={isMutating}
                className="w-full rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                Create zone
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

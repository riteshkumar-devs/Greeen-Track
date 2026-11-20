import type { Role, Task, Incident } from '../types/api';

export interface DemoUserRecord {
  id: string;
  email: string;
  password?: string;
  passwordHash?: string;
  passwordSalt?: string;
  role: Role;
  display_name: string;
}

export const DEMO_USERS: DemoUserRecord[] = [
  {
    id: '11111111-1111-4111-8111-111111111101',
    email: 'citizen@greentrack.org',
    password: 'password123',
    role: 'CITIZEN',
    display_name: 'Maya Lin',
  },
  {
    id: '11111111-1111-4111-8111-111111111102',
    email: 'collector@greentrack.org',
    password: 'password123',
    role: 'COLLECTOR',
    display_name: 'Carlos Mendez',
  },
  {
    id: '11111111-1111-4111-8111-111111111103',
    email: 'admin@greentrack.org',
    password: 'password123',
    role: 'ADMIN',
    display_name: 'Priya Nair',
  },
];

export interface QrCredentialRecord {
  bin_id: string;
  qr_token: string;
  qr_payload: string;
  active: boolean;
  issued_at: string;
  revoked_at?: string;
}

export interface InternalTaskRecord extends Task {
  assigned_collector_id: string | null;
  reason?: string;
}

export interface InternalIncidentRecord extends Incident {
  bin_id?: string | null;
  road_edge_id?: string | null;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
}

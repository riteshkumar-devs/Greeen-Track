/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppShell } from './app/AppShell';
import { AuthProvider } from './app/AuthContext';

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

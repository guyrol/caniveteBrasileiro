'use client';

import I18nProvider from '@/components/I18nProvider';
import { AuthProvider } from '@/components/AuthProvider';
import Dashboard from '@/components/Dashboard';

export default function Home() {
  return (
    <I18nProvider>
      <AuthProvider>
        <Dashboard />
      </AuthProvider>
    </I18nProvider>
  );
}

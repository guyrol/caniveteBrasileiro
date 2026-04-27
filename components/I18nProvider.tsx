'use client';

import { initI18n } from '../i18n';
import { useEffect } from 'react';

export default function I18nProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initI18n();
  }, []);

  return <>{children}</>;
}
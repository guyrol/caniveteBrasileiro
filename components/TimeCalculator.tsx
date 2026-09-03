'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from './AuthProvider';

interface TimeItem {
  id: string;
  timeInput: string;
  hours: number;
  minutes: number;
  description: string;
  isValid: boolean;
}

interface TimeCalculatorProps {
  defaultHourlyRate?: number;
  loadedData?: any;
  onClearLoadedData?: () => void;
}

// Helper to parse any time string into hours and minutes
function parseTimeString(str: string): { hours: number, minutes: number } | null {
  const trimmed = str.trim();
  if (!trimmed) return null;

  // Case 1: H:MM or HH:MM format (e.g. 1:37, 05:48, 12:05)
  const colonMatch = trimmed.match(/^(\d+):([0-5]\d)$/);
  if (colonMatch) {
    return {
      hours: parseInt(colonMatch[1], 10),
      minutes: parseInt(colonMatch[2], 10)
    };
  }

  // Case 2: Hours & Minutes explicit, like 2h 15m or 2h15m or 90m
  const hMatch = trimmed.match(/(\d+)\s*h/i);
  const mMatch = trimmed.match(/(\d+)\s*m/i);
  if (hMatch || mMatch) {
    const hours = hMatch ? parseInt(hMatch[1], 10) : 0;
    const minutes = mMatch ? parseInt(mMatch[1], 10) : 0;
    return { hours, minutes };
  }

  // Case 3: Decimal format (e.g. 1.5 or 1,5 or 0.75)
  const normalizedDecimal = trimmed.replace(',', '.');
  if (/^\d+(\.\d+)?$/.test(normalizedDecimal) && normalizedDecimal.includes('.')) {
    const decimalVal = parseFloat(normalizedDecimal);
    const hours = Math.floor(decimalVal);
    const minutes = Math.round((decimalVal - hours) * 60);
    return { hours, minutes };
  }

  // Case 4: Pure integer minutes (e.g., 90 -> 1h 30m, 2 -> 2h 0m depending on value)
  if (/^\d+$/.test(trimmed)) {
    const val = parseInt(trimmed, 10);
    if (val < 24) {
      // Treat single digits < 24 as hours
      return { hours: val, minutes: 0 };
    } else {
      // Treat > 24 as minutes
      return { hours: Math.floor(val / 60), minutes: val % 60 };
    }
  }

  return null;
}

// Helper to format hours/minutes back to standard string H:MM
function formatTimeItem(hours: number, minutes: number): string {
  return `${hours}:${minutes.toString().padStart(2, '0')}`;
}

export default function TimeCalculator({ 
  defaultHourlyRate = 50,
  loadedData,
  onClearLoadedData
}: TimeCalculatorProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  
  // Structured table state - initialized with the user's example values formatted in the new structure
  const [items, setItems] = useState<TimeItem[]>([
    { id: '1', timeInput: '1:37', hours: 1, minutes: 37, description: 'Task A', isValid: true },
    { id: '2', timeInput: '5:48', hours: 5, minutes: 48, description: 'Task B', isValid: true },
    { id: '3', timeInput: '4:47', hours: 4, minutes: 47, description: 'Task C', isValid: true }
  ]);

  // Smart input bar state (at the top of the table)
  const [smartInput, setSmartInput] = useState('');

  // Working day hours for "equivalent days" calculation
  const [dayHours, setDayHours] = useState(8);

  // Billing integration
  const [billingRate, setBillingRate] = useState(defaultHourlyRate);

  // Update billing rate if defaultHourlyRate changes
  useEffect(() => {
    setBillingRate(defaultHourlyRate);
  }, [defaultHourlyRate]);

  // Load history item states
  useEffect(() => {
    if (loadedData) {
      if (loadedData.items && Array.isArray(loadedData.items)) {
        // Map old items or new items safely
        const formattedItems = loadedData.items.map((item: any) => {
          const hours = item.hours ?? 0;
          const minutes = item.minutes ?? 0;
          return {
            id: item.id || ('item_' + Date.now() + Math.random().toString(36).substr(2, 5)),
            timeInput: item.timeInput || formatTimeItem(hours, minutes),
            hours,
            minutes,
            description: item.description || '',
            isValid: true
          };
        });
        setItems(formattedItems);
      } else if (loadedData.bulkText) {
        // Handle loading from a raw text format
        const regex = /(\d+):([0-5]\d)/g;
        let match;
        const newItems: TimeItem[] = [];
        while ((match = regex.exec(loadedData.bulkText)) !== null) {
          const hrs = parseInt(match[1], 10);
          const mins = parseInt(match[2], 10);
          newItems.push({
            id: 'item_' + Date.now() + Math.random().toString(36).substr(2, 5),
            timeInput: formatTimeItem(hrs, mins),
            hours: hrs,
            minutes: mins,
            description: '',
            isValid: true
          });
        }
        if (newItems.length > 0) setItems(newItems);
      }
      
      if (loadedData.dayHours) setDayHours(loadedData.dayHours);
      if (loadedData.billingRate) setBillingRate(loadedData.billingRate);
      
      if (onClearLoadedData) {
        onClearLoadedData();
      }
    }
  }, [loadedData, onClearLoadedData]);

  // Run Calculations
  const totals = useMemo(() => {
    let totalHours = 0;
    let totalMinutes = 0;

    items.forEach(item => {
      if (item.isValid) {
        totalHours += item.hours || 0;
        totalMinutes += item.minutes || 0;
      }
    });

    const extraHours = Math.floor(totalMinutes / 60);
    const finalMinutes = totalMinutes % 60;
    const finalHours = totalHours + extraHours;
    const decimalHours = finalHours + finalMinutes / 60;
    const workDaysEquivalent = decimalHours / (dayHours || 8);
    const estimatedEarnings = decimalHours * billingRate;

    return {
      hours: finalHours,
      minutes: finalMinutes,
      decimal: decimalHours,
      days: workDaysEquivalent,
      earnings: estimatedEarnings
    };
  }, [items, dayHours, billingRate]);

  // Smart Add handler (takes type or paste)
  const handleSmartAddSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!smartInput.trim()) return;

    // Check if the input is multi-line (e.g. copied column from Excel)
    if (smartInput.includes('\n') || smartInput.includes('\r')) {
      const lines = smartInput.split(/\r?\n/);
      const newItems: TimeItem[] = [];

      lines.forEach(line => {
        const cleanedLine = line.trim();
        if (!cleanedLine) return;
        const parsed = parseTimeString(cleanedLine);
        if (parsed) {
          newItems.push({
            id: 'item_' + Date.now() + Math.random().toString(36).substr(2, 5),
            timeInput: formatTimeItem(parsed.hours, parsed.minutes),
            hours: parsed.hours,
            minutes: parsed.minutes,
            description: '',
            isValid: true
          });
        }
      });

      if (newItems.length > 0) {
        setItems(prev => [...prev, ...newItems]);
      }
      setSmartInput('');
      return;
    }

    // Otherwise, parse it as a single timeframe
    const parsed = parseTimeString(smartInput);
    if (parsed) {
      const newItem: TimeItem = {
        id: 'item_' + Date.now() + Math.random().toString(36).substr(2, 5),
        timeInput: formatTimeItem(parsed.hours, parsed.minutes),
        hours: parsed.hours,
        minutes: parsed.minutes,
        description: '',
        isValid: true
      };
      setItems(prev => [...prev, newItem]);
      setSmartInput('');
    } else {
      alert(t('SmartAddHelp'));
    }
  };

  // Split paste event specifically to add immediately
  const handleSmartAddPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasteData = e.clipboardData.getData('Text');
    if (pasteData.includes('\n') || pasteData.includes('\r') || pasteData.includes('\t')) {
      e.preventDefault();
      
      // Split by newlines or tabs
      const lines = pasteData.split(/[\r\n\t]+/);
      const newItems: TimeItem[] = [];

      lines.forEach(line => {
        const cleaned = line.trim();
        if (!cleaned) return;
        const parsed = parseTimeString(cleaned);
        if (parsed) {
          newItems.push({
            id: 'item_' + Date.now() + Math.random().toString(36).substr(2, 5),
            timeInput: formatTimeItem(parsed.hours, parsed.minutes),
            hours: parsed.hours,
            minutes: parsed.minutes,
            description: '',
            isValid: true
          });
        }
      });

      if (newItems.length > 0) {
        setItems(prev => [...prev, ...newItems]);
      }
      setSmartInput('');
    }
  };

  // Inline row input edit
  const handleRowTimeChange = (id: string, value: string) => {
    setItems(items.map(item => {
      if (item.id !== id) return item;
      return { ...item, timeInput: value };
    }));
  };

  // Parse row value on blur
  const handleRowTimeBlur = (id: string) => {
    setItems(items.map(item => {
      if (item.id !== id) return item;
      
      const parsed = parseTimeString(item.timeInput);
      if (parsed) {
        return {
          ...item,
          hours: parsed.hours,
          minutes: parsed.minutes,
          timeInput: formatTimeItem(parsed.hours, parsed.minutes),
          isValid: true
        };
      } else {
        if (!item.timeInput.trim()) {
          return {
            ...item,
            hours: 0,
            minutes: 0,
            timeInput: '0:00',
            isValid: true
          };
        }
        // Mark as invalid if unparseable
        return { ...item, isValid: false };
      }
    }));
  };

  const handleRowDescriptionChange = (id: string, value: string) => {
    setItems(items.map(item => {
      if (item.id !== id) return item;
      return { ...item, description: value };
    }));
  };

  const handleRemoveRow = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleClearAll = () => {
    setItems([]);
  };

  // Helper to format currency
  const formatCurrency = (amount: number) => {
    const locale = typeof window !== 'undefined' && localStorage.getItem('i18nextLng') === 'en' ? 'en-US' : 'pt-BR';
    const currency = locale === 'en-US' ? 'USD' : 'BRL';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const handleSave = async () => {
    const history = JSON.parse(localStorage.getItem('canivete_calc_history') || '[]');
    const timeFormatted = `${totals.hours.toString().padStart(2, '0')}:${totals.minutes.toString().padStart(2, '0')}`;
    
    const label = t('TimeSavedWithName', {
      time: timeFormatted,
      hours: totals.decimal.toFixed(2)
    });

    const dataObj = {
      items,
      dayHours,
      billingRate,
      totals
    };

    const newEntry = {
      id: 'time_' + Date.now(),
      type: 'time',
      timestamp: new Date().toISOString(),
      label,
      data: dataObj
    };
    
    if (user) {
      try {
        await fetch('/api/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'time',
            label,
            data: dataObj
          })
        });
      } catch (e) {
        console.error('Failed to sync to database', e);
      }
    }

    localStorage.setItem('canivete_calc_history', JSON.stringify([newEntry, ...history]));
    window.dispatchEvent(new Event('storage'));
    alert(t('TimeSaved'));
  };

  return (
    <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
      
      {/* Title & Desc Card */}
      <div className="glass-card">
        <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          {t('TimeTitle')}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
          {t('TimeDesc')}
        </p>

        {/* Smart Add Bar */}
        <form onSubmit={handleSmartAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
          <label htmlFor="smart-add-input" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>
            {t('SmartAddPlaceholder')}
          </label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                id="smart-add-input"
                type="text"
                value={smartInput}
                onChange={(e) => setSmartInput(e.target.value)}
                onPaste={handleSmartAddPaste}
                placeholder="ex: 1:37, 1.5, 90m, or paste cells from Excel..."
                style={{
                  paddingRight: '40px',
                  border: '1px solid var(--input-border)',
                  background: 'var(--input-bg)',
                  borderRadius: 'var(--border-radius-sm)',
                  fontSize: '15px'
                }}
              />
              <svg 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="var(--text-muted)" 
                strokeWidth="2" 
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
              >
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              </svg>
            </div>
            <button
              id="smart-add-submit-btn"
              type="submit"
              style={{
                padding: '0 20px',
                borderRadius: 'var(--border-radius-sm)',
                border: 'none',
                background: 'linear-gradient(135deg, var(--secondary), var(--secondary-hover))',
                color: 'white',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 8px var(--secondary-glow)',
                transition: 'all var(--transition-fast)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {t('TableAddRow')}
            </button>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {t('SmartAddHelp')}
          </span>
        </form>

        {/* Structured Log Table */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
          
          {/* Table Headers */}
          {items.length > 0 && (
            <div style={{
              display: 'flex',
              gap: '12px',
              alignItems: 'center',
              padding: '6px 12px 6px 36px',
              color: 'var(--text-muted)',
              fontSize: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontWeight: 600
            }}>
              <span style={{ width: '130px' }}>{t('TimeFieldLabel')}</span>
              <span style={{ flex: 1 }}>{t('DescriptionLabel')}</span>
              <span style={{ width: '32px', textAlign: 'center' }}></span>
            </div>
          )}

          {items.map((item, index) => (
            <div 
              key={item.id} 
              style={{ 
                display: 'flex', 
                gap: '12px', 
                alignItems: 'center',
                background: 'rgba(255, 255, 255, 0.01)',
                padding: '8px 12px',
                borderRadius: 'var(--border-radius-sm)',
                border: item.isValid ? '1px solid var(--input-border)' : '1px solid var(--danger)',
                boxShadow: item.isValid ? 'none' : '0 0 8px rgba(239, 68, 68, 0.15)',
                transition: 'all var(--transition-fast)'
              }}
            >
              {/* Index indicator */}
              <span style={{ 
                fontSize: '11px', 
                fontWeight: 600, 
                color: item.isValid ? 'var(--text-muted)' : 'var(--danger)', 
                width: '24px', 
                height: '24px', 
                borderRadius: '50%',
                background: item.isValid ? 'var(--input-bg)' : 'rgba(239, 68, 68, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {index + 1}
              </span>
              
              {/* Smart Time Input per row */}
              <div style={{ width: '130px' }}>
                <input
                  type="text"
                  id={`item-time-input-${item.id}`}
                  value={item.timeInput}
                  onChange={(e) => handleRowTimeChange(item.id, e.target.value)}
                  onBlur={() => handleRowTimeBlur(item.id)}
                  placeholder="e.g. 1:30"
                  style={{ 
                    textAlign: 'center', 
                    fontWeight: 600,
                    fontFamily: 'var(--font-mono)',
                    borderColor: item.isValid ? 'var(--input-border)' : 'var(--danger)'
                  }}
                />
              </div>

              {/* Description Input */}
              <div style={{ flex: 1 }}>
                <input
                  type="text"
                  id={`item-desc-input-${item.id}`}
                  value={item.description}
                  onChange={(e) => handleRowDescriptionChange(item.id, e.target.value)}
                  placeholder={t('DescriptionLabel')}
                />
              </div>

              {/* Delete Button */}
              <button
                id={`remove-row-btn-${item.id}`}
                onClick={() => handleRemoveRow(item.id)}
                aria-label={t('RemoveItem')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: '50%',
                  transition: 'all var(--transition-fast)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.color = 'var(--danger)';
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.color = 'var(--text-muted)';
                  e.currentTarget.style.background = 'none';
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        {items.length === 0 && (
          <div style={{ 
            color: 'var(--text-muted)', 
            fontSize: '14px', 
            textAlign: 'center', 
            padding: '40px 16px', 
            border: '1px dashed var(--input-border)', 
            borderRadius: 'var(--border-radius-sm)', 
            marginBottom: '16px',
            background: 'var(--input-bg)'
          }}>
            <p style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
              {t('NoHistory')}
            </p>
            <p style={{ fontSize: '12px' }}>
              {t('EmptyTableWarning')}
            </p>
          </div>
        )}

        {/* Action Bar (Clear List) */}
        {items.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
            <button
              id="clear-all-time-btn"
              onClick={handleClearAll}
              style={{
                padding: '10px 20px',
                borderRadius: 'var(--border-radius-sm)',
                border: '1px solid var(--input-border)',
                background: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '13px',
                transition: 'all var(--transition-fast)'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = 'var(--input-bg)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'none'}
            >
              {t('ClearList')}
            </button>
          </div>
        )}
      </div>

      {/* Results & Integration Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        
        {/* Accumulation Summary Card */}
        <div className="glass-card" style={{ borderLeft: '3px solid var(--secondary)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, borderBottom: '1px solid var(--card-border)', paddingBottom: '10px', color: 'var(--text-primary)' }}>
            {t('ResultTitle')}
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flexGrow: 1, justifyContent: 'center' }}>
            {/* Formatted Hours Sum */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px dashed var(--card-border)' }}>
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{t('TotalHoursMinutes')}</span>
              <span style={{ fontSize: '24px', fontWeight: 800, color: 'var(--secondary)', fontFamily: 'var(--font-mono)' }}>
                {totals.hours.toString().padStart(2, '0')}:{totals.minutes.toString().padStart(2, '0')}
              </span>
            </div>

            {/* Decimal Hours */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px dashed var(--card-border)' }}>
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{t('TotalDecimal')}</span>
              <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                {totals.decimal.toFixed(3)} h
              </span>
            </div>

            {/* Equivalent Work Days */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{t('TotalDays')}</span>
                <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  {totals.days.toFixed(2)} {totals.days === 1 ? 'day' : 'days'}
                </span>
              </div>
              
              {/* Custom day-hours slider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {t('BasedOnXHourDay', { hours: dayHours })}
                </span>
                <input
                  type="range"
                  id="day-hours-range-slider"
                  min="4"
                  max="12"
                  step="0.5"
                  value={dayHours}
                  onChange={(e) => setDayHours(parseFloat(e.target.value))}
                  style={{ height: '4px' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Billing Integration Card */}
        <div className="glass-card" style={{ borderLeft: '3px solid var(--accent)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, borderBottom: '1px solid var(--card-border)', paddingBottom: '10px', color: 'var(--text-primary)' }}>
            {t('HourlyRateBilling')}
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flexGrow: 1 }}>
            {/* Input Billing Rate */}
            <div>
              <label htmlFor="billing-rate-input" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                {t('HourlyRate')}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="billing-rate-input"
                  type="number"
                  value={billingRate}
                  onChange={(e) => setBillingRate(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  style={{ paddingLeft: '32px' }}
                />
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '14px', fontWeight: 600 }}>
                  {typeof window !== 'undefined' && localStorage.getItem('i18nextLng') === 'en' ? '$' : 'R$'}
                </span>
              </div>
            </div>

            {/* Estimated Earnings */}
            <div style={{ 
              background: 'rgba(16, 185, 129, 0.05)', 
              border: '1px solid rgba(16, 185, 129, 0.15)', 
              borderRadius: 'var(--border-radius-sm)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              marginTop: 'auto'
            }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{t('EstimatedRevenue')}</span>
              <span style={{ fontSize: '26px', fontWeight: 800, color: 'var(--accent)' }}>
                {formatCurrency(totals.earnings)}
              </span>
            </div>

            {/* Save Button */}
            <button
              id="save-time-calc-btn"
              onClick={handleSave}
              style={{
                padding: '12px',
                borderRadius: 'var(--border-radius-sm)',
                border: 'none',
                background: 'linear-gradient(135deg, var(--secondary), var(--secondary-hover))',
                color: 'white',
                cursor: 'pointer',
                fontWeight: 600,
                boxShadow: '0 4px 14px var(--secondary-glow)',
                transition: 'all var(--transition-fast)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseOut={(e) => e.currentTarget.style.transform = 'none'}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              {t('SaveCalculation')}
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}

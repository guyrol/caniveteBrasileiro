'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from './AuthProvider';

interface SalaryCalculatorProps {
  onHourlyRateChange?: (rate: number) => void;
  initialHourlyRate?: number;
  loadedData?: any;
  onClearLoadedData?: () => void;
}

export default function SalaryCalculator({ 
  onHourlyRateChange,
  initialHourlyRate = 50,
  loadedData,
  onClearLoadedData
}: SalaryCalculatorProps) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  
  // Schedule settings
  const [hoursPerDay, setHoursPerDay] = useState(8.8); // Set default to BR CLT values to match initial preset
  const [daysPerWeek, setDaysPerWeek] = useState(5);
  const [weeksPerYear, setWeeksPerYear] = useState(52);
  const [vacationWeeks, setVacationWeeks] = useState(4);
  const [preset, setPreset] = useState<'us' | 'br' | 'freelance' | 'custom'>('br');
  
  // Base annual rate to drive all other values
  const [annualBase, setAnnualBase] = useState(0);

  // Initialize base rate on mount
  useEffect(() => {
    const initialAnnual = initialHourlyRate * (8.8 * 5 * 52);
    setAnnualBase(initialAnnual);
  }, []);

  // Load history item states
  useEffect(() => {
    if (loadedData) {
      if (loadedData.hoursPerDay) setHoursPerDay(loadedData.hoursPerDay);
      if (loadedData.daysPerWeek) setDaysPerWeek(loadedData.daysPerWeek);
      if (loadedData.weeksPerYear) setWeeksPerYear(loadedData.weeksPerYear);
      if (loadedData.vacationWeeks) setVacationWeeks(loadedData.vacationWeeks);
      if (loadedData.preset) setPreset(loadedData.preset);
      if (loadedData.annualBase) setAnnualBase(loadedData.annualBase);
      
      if (onClearLoadedData) {
        onClearLoadedData();
      }
    }
  }, [loadedData, onClearLoadedData]);

  // Handle Preset changes
  useEffect(() => {
    if (preset === 'us') {
      setHoursPerDay(8);
      setDaysPerWeek(5);
      setWeeksPerYear(52);
      setVacationWeeks(2);
    } else if (preset === 'br') {
      // Brazil CLT: standard is 44 hrs per week. We can model this as 8.8 hours per day, 5 days per week.
      setHoursPerDay(8.8);
      setDaysPerWeek(5);
      setWeeksPerYear(52);
      setVacationWeeks(4); // Standard 30 days vacation (approx. 4 weeks)
    } else if (preset === 'freelance') {
      setHoursPerDay(6);
      setDaysPerWeek(5);
      setWeeksPerYear(48); // Working 48 weeks, 4 weeks off (unpaid)
      setVacationWeeks(4);
    }
  }, [preset]);

  // Derived weekly hours and annual hours
  const weeklyHours = hoursPerDay * daysPerWeek;
  // Paid vs Unpaid Vacation adjustment.
  // Standard salaried models: vacation is paid, so we divide annual by total weeks (52).
  // If user wants to calculate strictly on active working weeks:
  const activeWeeks = Math.max(1, weeksPerYear - (preset === 'freelance' ? vacationWeeks : 0));
  const annualWorkHours = weeklyHours * activeWeeks;

  // Derive values for inputs
  const hourlyVal = annualBase / (weeklyHours * weeksPerYear);
  const dailyVal = hourlyVal * hoursPerDay;
  const weeklyVal = hourlyVal * weeklyHours;
  const monthlyVal = annualBase / 12;
  const yearlyVal = annualBase;

  // Let parent component know hourly rate changed
  useEffect(() => {
    if (onHourlyRateChange) {
      onHourlyRateChange(hourlyVal);
    }
  }, [hourlyVal, onHourlyRateChange]);

  // Input handlers - update the base annual amount
  const handleHourlyChange = (val: number) => {
    if (isNaN(val)) return;
    setAnnualBase(val * (weeklyHours * weeksPerYear));
  };

  const handleDailyChange = (val: number) => {
    if (isNaN(val)) return;
    const hourly = val / hoursPerDay;
    setAnnualBase(hourly * (weeklyHours * weeksPerYear));
  };

  const handleMonthlyChange = (val: number) => {
    if (isNaN(val)) return;
    setAnnualBase(val * 12);
  };

  const handleYearlyChange = (val: number) => {
    if (isNaN(val)) return;
    setAnnualBase(val);
  };

  // Helper to format currency
  const formatCurrency = (amount: number) => {
    const locale = i18n.language === 'pt' ? 'pt-BR' : 'en-US';
    const currency = i18n.language === 'pt' ? 'BRL' : 'USD';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      maximumFractionDigits: 2
    }).format(amount);
  };

  // Save current calculation to localStorage history
  const handleSave = async () => {
    const history = JSON.parse(localStorage.getItem('canivete_calc_history') || '[]');
    const locale = i18n.language === 'pt' ? 'pt-BR' : 'en-US';
    const formatter = new Intl.NumberFormat(locale, { style: 'currency', currency: i18n.language === 'pt' ? 'BRL' : 'USD' });
    
    const label = t('SalarySavedWithName', {
      hourly: formatter.format(hourlyVal),
      monthly: formatter.format(monthlyVal)
    });

    const dataObj = {
      annualBase,
      hoursPerDay,
      daysPerWeek,
      weeksPerYear,
      vacationWeeks,
      preset
    };

    const newEntry = {
      id: 'salary_' + Date.now(),
      type: 'salary',
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
            type: 'salary',
            label,
            data: dataObj
          })
        });
      } catch (e) {
        console.error('Failed to sync to database', e);
      }
    }

    localStorage.setItem('canivete_calc_history', JSON.stringify([newEntry, ...history]));
    window.dispatchEvent(new Event('storage')); // Notify dashboard history list
    alert(t('SalarySaved'));
  };

  return (
    <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
      
      {/* Configuration Header Card */}
      <div className="glass-card">
        <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
          {t('SalaryTitle')}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
          {t('SalaryDesc')}
        </p>

        {/* Presets Grid */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
            {t('Presets')}
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
            {[
              { id: 'br', label: t('PresetBR') },
              { id: 'us', label: t('PresetUS') },
              { id: 'freelance', label: t('PresetFreelance') },
              { id: 'custom', label: t('PresetCustom') }
            ].map((p) => (
              <button
                key={p.id}
                id={`preset-btn-${p.id}`}
                onClick={() => setPreset(p.id as any)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--border-radius-sm)',
                  border: '1px solid',
                  borderColor: preset === p.id ? 'var(--primary)' : 'var(--input-border)',
                  background: preset === p.id ? 'rgba(99, 102, 241, 0.15)' : 'var(--input-bg)',
                  color: preset === p.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: preset === p.id ? 600 : 400,
                  transition: 'all var(--transition-fast)',
                  fontSize: '13px'
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Schedule Inputs Accordion/Section */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--input-border)',
          borderRadius: 'var(--border-radius-sm)',
          padding: '16px',
          marginBottom: '8px'
        }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'var(--text-secondary)' }}>
            {t('WorkingHoursSetup')}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            {/* Hours per Day */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{t('WorkHoursPerDay')}</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary)' }}>{hoursPerDay}h</span>
              </div>
              <input
                type="range"
                id="hours-per-day-range"
                min="1"
                max="24"
                step="0.1"
                value={hoursPerDay}
                onChange={(e) => {
                  setHoursPerDay(parseFloat(e.target.value));
                  setPreset('custom');
                }}
              />
            </div>

            {/* Days per Week */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{t('WorkDaysPerWeek')}</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary)' }}>{daysPerWeek}</span>
              </div>
              <input
                type="range"
                id="days-per-week-range"
                min="1"
                max="7"
                step="1"
                value={daysPerWeek}
                onChange={(e) => {
                  setDaysPerWeek(parseInt(e.target.value));
                  setPreset('custom');
                }}
              />
            </div>

            {/* Weeks per Year */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{t('WorkWeeksPerYear')}</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary)' }}>{weeksPerYear}</span>
              </div>
              <input
                type="range"
                id="weeks-per-year-range"
                min="12"
                max="52"
                step="1"
                value={weeksPerYear}
                onChange={(e) => {
                  setWeeksPerYear(parseInt(e.target.value));
                  setPreset('custom');
                }}
              />
            </div>

            {/* Vacation Weeks */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{t('PaidVacationWeeks')}</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary)' }}>{vacationWeeks}</span>
              </div>
              <input
                type="range"
                id="vacation-weeks-range"
                min="0"
                max="10"
                step="1"
                value={vacationWeeks}
                onChange={(e) => {
                  setVacationWeeks(parseInt(e.target.value));
                  setPreset('custom');
                }}
              />
            </div>
          </div>
          <div style={{ marginTop: '14px', fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            {t('WorkingHoursInfo', { hours: weeklyHours, weeks: activeWeeks, vacation: vacationWeeks })}
          </div>
        </div>
      </div>

      {/* Main Calculator Inputs and Breakdown Display */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        
        {/* Input Cards Container */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, borderBottom: '1px solid var(--card-border)', paddingBottom: '10px', color: 'var(--text-primary)' }}>
            {t('Welcome')} - {t('SalaryTitle')}
          </h3>
          
          {/* Hourly Rate Input */}
          <div>
            <label htmlFor="input-hourly" style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block', fontWeight: 500 }}>
              {t('HourlyRate')}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                id="input-hourly"
                value={hourlyVal ? Number(hourlyVal.toFixed(2)) : ''}
                onChange={(e) => handleHourlyChange(parseFloat(e.target.value))}
                placeholder="0.00"
                step="0.5"
                style={{ paddingLeft: '32px' }}
              />
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '14px', fontWeight: 600 }}>
                {i18n.language === 'pt' ? 'R$' : '$'}
              </span>
            </div>
          </div>

          {/* Daily Rate Input */}
          <div>
            <label htmlFor="input-daily" style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block', fontWeight: 500 }}>
              {t('DailySalary')}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                id="input-daily"
                value={dailyVal ? Number(dailyVal.toFixed(2)) : ''}
                onChange={(e) => handleDailyChange(parseFloat(e.target.value))}
                placeholder="0.00"
                step="5"
                style={{ paddingLeft: '32px' }}
              />
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '14px', fontWeight: 600 }}>
                {i18n.language === 'pt' ? 'R$' : '$'}
              </span>
            </div>
          </div>

          {/* Monthly Rate Input */}
          <div>
            <label htmlFor="input-monthly" style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block', fontWeight: 500 }}>
              {t('MonthlySalary')}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                id="input-monthly"
                value={monthlyVal ? Number(monthlyVal.toFixed(0)) : ''}
                onChange={(e) => handleMonthlyChange(parseFloat(e.target.value))}
                placeholder="0"
                step="50"
                style={{ paddingLeft: '32px' }}
              />
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '14px', fontWeight: 600 }}>
                {i18n.language === 'pt' ? 'R$' : '$'}
              </span>
            </div>
          </div>

          {/* Yearly Rate Input */}
          <div>
            <label htmlFor="input-yearly" style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block', fontWeight: 500 }}>
              {t('YearlySalary')}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                id="input-yearly"
                value={yearlyVal ? Number(yearlyVal.toFixed(0)) : ''}
                onChange={(e) => handleYearlyChange(parseFloat(e.target.value))}
                placeholder="0"
                step="1000"
                style={{ paddingLeft: '32px' }}
              />
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '14px', fontWeight: 600 }}>
                {i18n.language === 'pt' ? 'R$' : '$'}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <button
            id="save-salary-btn"
            onClick={handleSave}
            style={{
              marginTop: '10px',
              padding: '12px',
              borderRadius: 'var(--border-radius-sm)',
              border: 'none',
              background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
              color: 'white',
              cursor: 'pointer',
              fontWeight: 600,
              boxShadow: '0 4px 14px var(--primary-glow)',
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

        {/* Display Breakdown Card */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', borderLeft: '3px solid var(--accent)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, borderBottom: '1px solid var(--card-border)', paddingBottom: '10px', color: 'var(--text-primary)' }}>
            {t('BreakdownTitle')}
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flexGrow: 1, justifyContent: 'center' }}>
            {/* Hourly breakdown */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px dashed var(--card-border)' }}>
              <div>
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)', display: 'block' }}>{t('HourlyRate')}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>1h</span>
              </div>
              <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(hourlyVal)}</span>
            </div>

            {/* Daily breakdown */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px dashed var(--card-border)' }}>
              <div>
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)', display: 'block' }}>{t('DailySalary')}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{hoursPerDay}h</span>
              </div>
              <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(dailyVal)}</span>
            </div>

            {/* Weekly breakdown */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px dashed var(--card-border)' }}>
              <div>
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)', display: 'block' }}>{t('WeeklyEquivalent')}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t('BasedOnHours', { hours: weeklyHours })}</span>
              </div>
              <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(weeklyVal)}</span>
            </div>

            {/* Monthly breakdown */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px dashed var(--card-border)' }}>
              <div>
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)', display: 'block' }}>{t('MonthlySalary')}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>1/12 {t('YearlySalary')}</span>
              </div>
              <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent)' }}>{formatCurrency(monthlyVal)}</span>
            </div>

            {/* Yearly breakdown */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
              <div>
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)', display: 'block' }}>{t('YearlySalary')}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{weeksPerYear} {t('WeeklyEquivalent').toLowerCase()}</span>
              </div>
              <span style={{ fontSize: '22px', fontWeight: 800, color: 'var(--primary)' }}>{formatCurrency(yearlyVal)}</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}

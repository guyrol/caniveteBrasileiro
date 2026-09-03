'use client';

import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

export default function CompoundInterest() {
  const { t } = useTranslation();

  const [initialDeposit, setInitialDeposit] = useState(10000);
  const [monthlyDeposit, setMonthlyDeposit] = useState(500);
  const [rateAnnual, setRateAnnual] = useState(10);
  const [yearsCount, setYearsCount] = useState(10);

  const simulation = useMemo(() => {
    const principal = Math.max(0, initialDeposit);
    const pmt = Math.max(0, monthlyDeposit);
    const annualRate = Math.max(0, rateAnnual) / 100;
    const months = Math.max(1, yearsCount) * 12;
    
    // Monthly nominal interest rate
    const r = annualRate / 12;

    const data: { month: number; year: number; invested: number; total: number; interest: number }[] = [];
    let currentBalance = principal;
    let currentInvested = principal;

    // Add initial state
    data.push({
      month: 0,
      year: 0,
      invested: currentInvested,
      total: currentBalance,
      interest: 0
    });

    for (let m = 1; m <= months; m++) {
      const interestEarned = currentBalance * r;
      currentBalance = currentBalance + interestEarned + pmt;
      currentInvested = currentInvested + pmt;
      
      // Save data points for yearly increments or intermediate points to draw clean lines
      // Let's save points for every year, and the final month
      if (m % 12 === 0 || m === months) {
        data.push({
          month: m,
          year: Math.ceil(m / 12),
          invested: Math.round(currentInvested),
          total: Math.round(currentBalance),
          interest: Math.max(0, Math.round(currentBalance - currentInvested))
        });
      }
    }

    const finalValue = data[data.length - 1];

    return {
      points: data,
      totalWealth: finalValue.total,
      totalInvested: finalValue.invested,
      totalInterest: finalValue.interest
    };
  }, [initialDeposit, monthlyDeposit, rateAnnual, yearsCount]);

  // Format currency helper
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0
    }).format(amount);
  };

  // SVG Chart points generator
  const svgChartPath = useMemo(() => {
    const width = 350;
    const height = 150;
    const padding = 10;
    
    const maxVal = Math.max(simulation.totalWealth, 1);
    const totalPoints = simulation.points.length;
    
    if (totalPoints < 2) return { invested: '', total: '' };

    let investedPath = '';
    let totalPath = '';

    simulation.points.forEach((p, idx) => {
      const x = padding + (idx / (totalPoints - 1)) * (width - 2 * padding);
      const yInvested = height - padding - (p.invested / maxVal) * (height - 2 * padding);
      const yTotal = height - padding - (p.total / maxVal) * (height - 2 * padding);

      if (idx === 0) {
        investedPath = `M ${x} ${yInvested}`;
        totalPath = `M ${x} ${yTotal}`;
      } else {
        investedPath += ` L ${x} ${yInvested}`;
        totalPath += ` L ${x} ${yTotal}`;
      }
    });

    return {
      invested: investedPath,
      total: totalPath
    };
  }, [simulation]);

  return (
    <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
      
      {/* Title Header Card */}
      <div className="glass-card">
        <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          {t('CompTitle')}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>
          {t('CompDesc')}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        
        {/* Input Parameters */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, borderBottom: '1px solid var(--card-border)', paddingBottom: '10px', color: 'var(--text-primary)' }}>
            Parâmetros do Investimento
          </h3>

          {/* Initial Deposit */}
          <div>
            <label htmlFor="initial-deposit-input" style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
              {t('InitDeposit')}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="initial-deposit-input"
                type="number"
                value={initialDeposit}
                onChange={(e) => setInitialDeposit(parseFloat(e.target.value) || 0)}
                style={{ paddingLeft: '32px' }}
                step="1000"
              />
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '14px', fontWeight: 600 }}>R$</span>
            </div>
          </div>

          {/* Monthly Contribution */}
          <div>
            <label htmlFor="monthly-deposit-input" style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
              {t('MonthlyDeposit')}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="monthly-deposit-input"
                type="number"
                value={monthlyDeposit}
                onChange={(e) => setMonthlyDeposit(parseFloat(e.target.value) || 0)}
                style={{ paddingLeft: '32px' }}
                step="100"
              />
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '14px', fontWeight: 600 }}>R$</span>
            </div>
          </div>

          {/* Annual Interest Rate */}
          <div>
            <label htmlFor="rate-annual-input" style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
              {t('RateAnnual')}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="rate-annual-input"
                type="number"
                value={rateAnnual}
                onChange={(e) => setRateAnnual(parseFloat(e.target.value) || 0)}
                style={{ paddingRight: '32px' }}
                step="0.5"
              />
              <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '14px', fontWeight: 600 }}>%</span>
            </div>
          </div>

          {/* Years Count Slider */}
          <div>
            <label htmlFor="years-count-slider" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              <span>{t('YearsCount')}</span>
              <strong style={{ color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>{yearsCount} {yearsCount === 1 ? 'ano' : 'anos'}</strong>
            </label>
            <input
              id="years-count-slider"
              type="range"
              min="1"
              max="40"
              step="1"
              value={yearsCount}
              onChange={(e) => setYearsCount(parseInt(e.target.value) || 1)}
            />
          </div>
        </div>

        {/* Results Card */}
        <div className="glass-card" style={{ borderLeft: '3px solid var(--accent)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, borderBottom: '1px solid var(--card-border)', paddingBottom: '10px', color: 'var(--text-primary)' }}>
            Projeção Final
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flexGrow: 1, justifyContent: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px dashed var(--card-border)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{t('TotalInvested')}</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatCurrency(simulation.totalInvested)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px dashed var(--card-border)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{t('TotalInterest')}</span>
              <span style={{ color: 'var(--accent)', fontWeight: 600 }}>+{formatCurrency(simulation.totalInterest)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--card-border)', marginTop: '8px', fontSize: '16px' }}>
              <strong style={{ color: 'var(--text-primary)' }}>{t('TotalWealth')}</strong>
              <strong style={{ color: 'var(--primary)', fontSize: '22px' }}>{formatCurrency(simulation.totalWealth)}</strong>
            </div>
          </div>
        </div>

      </div>

      {/* SVG Chart Card */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, borderBottom: '1px solid var(--card-border)', paddingBottom: '10px', color: 'var(--text-primary)' }}>
          {t('CompChartTitle')}
        </h3>
        
        {/* Draw Line Chart */}
        <div style={{ width: '100%', height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <svg 
            viewBox="0 0 350 150" 
            width="100%" 
            height="100%" 
            style={{ overflow: 'visible', maxWidth: '600px' }}
          >
            {/* Grid Line lines */}
            <line x1="10" y1="140" x2="340" y2="140" stroke="var(--card-border)" strokeWidth="1" />
            <line x1="10" y1="75" x2="340" y2="75" stroke="var(--card-border)" strokeWidth="1" strokeDasharray="4 4" />
            <line x1="10" y1="10" x2="340" y2="10" stroke="var(--card-border)" strokeWidth="1" />

            {/* Total Wealth line (Indigo) */}
            <path 
              d={svgChartPath.total} 
              fill="none" 
              stroke="var(--primary)" 
              strokeWidth="3.5" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              style={{ filter: 'drop-shadow(0px 2px 4px var(--primary-glow))' }}
            />

            {/* Total Invested line (Pink) */}
            <path 
              d={svgChartPath.invested} 
              fill="none" 
              stroke="var(--secondary)" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              style={{ filter: 'drop-shadow(0px 2px 4px var(--secondary-glow))' }}
            />
          </svg>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', fontSize: '12px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
            <span style={{ width: '12px', height: '12px', background: 'var(--secondary)', borderRadius: '3px' }} />
            {t('TotalInvested')}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
            <span style={{ width: '12px', height: '12px', background: 'var(--primary)', borderRadius: '3px' }} />
            {t('TotalWealth')}
          </span>
        </div>
      </div>

    </div>
  );
}

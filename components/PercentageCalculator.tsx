'use client';

import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

export default function PercentageCalculator() {
  const { t } = useTranslation();

  // Card 1: What is X% of Y?
  const [pct1, setPct1] = useState(15);
  const [val1, setVal1] = useState(200);

  const result1 = useMemo(() => {
    return (pct1 / 100) * val1;
  }, [pct1, val1]);

  // Card 2: X is what % of Y?
  const [val2a, setVal2a] = useState(50);
  const [val2b, setVal2b] = useState(250);

  const result2 = useMemo(() => {
    if (val2b === 0) return 0;
    return (val2a / val2b) * 100;
  }, [val2a, val2b]);

  // Card 3: % Increase/Decrease from X to Y
  const [val3a, setVal3a] = useState(80);
  const [val3b, setVal3b] = useState(120);

  const result3 = useMemo(() => {
    if (val3a === 0) return 0;
    return ((val3b - val3a) / val3a) * 100;
  }, [val3a, val3b]);

  // Card 4: Y plus/minus X%
  const [val4, setVal4] = useState(150);
  const [pct4, setPct4] = useState(10);
  const [op4, setOp4] = useState<'plus' | 'minus'>('plus');

  const result4 = useMemo(() => {
    const factor = pct4 / 100;
    return op4 === 'plus' ? val4 * (1 + factor) : val4 * (1 - factor);
  }, [val4, pct4, op4]);

  return (
    <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
      
      {/* Title Header Card */}
      <div className="glass-card">
        <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
            <line x1="19" y1="5" x2="5" y2="19" />
            <circle cx="6.5" cy="6.5" r="2.5" />
            <circle cx="17.5" cy="17.5" r="2.5" />
          </svg>
          {t('TabPercentage')}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>
          {t('PctDesc') || 'Get quick answers to common percentage questions.'}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: '20px' }}>
        
        {/* Card 1: What is X% of Y? */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', borderBottom: '1px solid var(--card-border)', paddingBottom: '8px' }}>
            Quanto é X% de Y?
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
            <div style={{ width: '80px' }}>
              <input
                type="number"
                value={pct1}
                onChange={(e) => setPct1(parseFloat(e.target.value) || 0)}
                style={{ textAlign: 'center' }}
              />
            </div>
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>% de</span>
            <div style={{ flex: 1 }}>
              <input
                type="number"
                value={val1}
                onChange={(e) => setVal1(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
          <div style={{ 
            marginTop: 'auto', 
            background: 'var(--input-bg)', 
            padding: '12px', 
            borderRadius: 'var(--border-radius-sm)', 
            textAlign: 'center', 
            fontSize: '18px', 
            fontWeight: 800, 
            color: 'var(--primary)' 
          }}>
            {result1.toFixed(2).replace(/\.00$/, '')}
          </div>
        </div>

        {/* Card 2: X is what % of Y? */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', borderBottom: '1px solid var(--card-border)', paddingBottom: '8px' }}>
            X é qual % de Y?
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
            <div style={{ width: '80px' }}>
              <input
                type="number"
                value={val2a}
                onChange={(e) => setVal2a(parseFloat(e.target.value) || 0)}
                style={{ textAlign: 'center' }}
              />
            </div>
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>é qual % de</span>
            <div style={{ flex: 1 }}>
              <input
                type="number"
                value={val2b}
                onChange={(e) => setVal2b(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
          <div style={{ 
            marginTop: 'auto', 
            background: 'var(--input-bg)', 
            padding: '12px', 
            borderRadius: 'var(--border-radius-sm)', 
            textAlign: 'center', 
            fontSize: '18px', 
            fontWeight: 800, 
            color: 'var(--primary)' 
          }}>
            {result2.toFixed(2).replace(/\.00$/, '')}%
          </div>
        </div>

        {/* Card 3: % Increase/Decrease from X to Y */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', borderBottom: '1px solid var(--card-border)', paddingBottom: '8px' }}>
            Variação % de X para Y
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <input
                type="number"
                value={val3a}
                onChange={(e) => setVal3a(parseFloat(e.target.value) || 0)}
              />
            </div>
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>para</span>
            <div style={{ flex: 1 }}>
              <input
                type="number"
                value={val3b}
                onChange={(e) => setVal3b(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
          <div style={{ 
            marginTop: 'auto', 
            background: 'var(--input-bg)', 
            padding: '12px', 
            borderRadius: 'var(--border-radius-sm)', 
            textAlign: 'center', 
            fontSize: '18px', 
            fontWeight: 800, 
            color: result3 >= 0 ? 'var(--accent)' : 'var(--danger)' 
          }}>
            {result3 >= 0 ? '+' : ''}{result3.toFixed(2).replace(/\.00$/, '')}%
          </div>
        </div>

        {/* Card 4: Y plus/minus X% */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', borderBottom: '1px solid var(--card-border)', paddingBottom: '8px' }}>
            X mais/menos Y%
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <input
                type="number"
                value={val4}
                onChange={(e) => setVal4(parseFloat(e.target.value) || 0)}
              />
            </div>
            {/* Operator select dropdown */}
            <div style={{ width: '60px' }}>
              <select
                value={op4}
                onChange={(e) => setOp4(e.target.value as any)}
                style={{ padding: '8px', textAlign: 'center' }}
              >
                <option value="plus">+</option>
                <option value="minus">-</option>
              </select>
            </div>
            <div style={{ width: '80px' }}>
              <input
                type="number"
                value={pct4}
                onChange={(e) => setPct4(parseFloat(e.target.value) || 0)}
                style={{ textAlign: 'center' }}
              />
            </div>
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>%</span>
          </div>
          <div style={{ 
            marginTop: 'auto', 
            background: 'var(--input-bg)', 
            padding: '12px', 
            borderRadius: 'var(--border-radius-sm)', 
            textAlign: 'center', 
            fontSize: '18px', 
            fontWeight: 800, 
            color: 'var(--primary)' 
          }}>
            {result4.toFixed(2).replace(/\.00$/, '')}
          </div>
        </div>

      </div>

    </div>
  );
}

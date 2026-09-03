'use client';

import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

// Binary search solver for implicit interest rate
function solveInterestRate(pv: number, pmt: number, n: number): number {
  if (pv >= pmt * n) return 0; // Cash price is equal or higher than total payments (no interest)
  if (pv <= 0 || pmt <= 0 || n <= 0) return 0;

  let low = 0.0;
  let high = 2.0; // Max 200% interest per month
  let mid = 0.0;
  const tolerance = 0.00001;

  for (let iter = 0; iter < 100; iter++) {
    mid = (low + high) / 2;
    if (mid === 0) return 0;
    
    // Present value of annuity: PV = PMT * [1 - (1+r)^-n] / r
    const estimatedPV = pmt * ((1 - Math.pow(1 + mid, -n)) / mid);
    
    if (Math.abs(estimatedPV - pv) < tolerance) {
      return mid;
    }
    
    if (estimatedPV > pv) {
      // Interest rate is too low (annuity value is higher than cash price)
      low = mid;
    } else {
      // Interest rate is too high (annuity value is lower than cash price)
      high = mid;
    }
  }
  return mid;
}

export default function InstallmentsCalculator() {
  const { t } = useTranslation();

  const [cashPrice, setCashPrice] = useState(900);
  const [fullPrice, setFullPrice] = useState(1000);
  const [paymentsCount, setPaymentsCount] = useState(10);

  const results = useMemo(() => {
    const pmt = fullPrice / Math.max(paymentsCount, 1);
    const monthlyRate = solveInterestRate(cashPrice, pmt, paymentsCount);
    const annualRate = Math.pow(1 + monthlyRate, 12) - 1;
    const savingsAmount = fullPrice - cashPrice;
    const savingsPercent = fullPrice > 0 ? (savingsAmount / fullPrice) * 100 : 0;

    return {
      pmt,
      monthlyRatePercent: monthlyRate * 100,
      annualRatePercent: annualRate * 100,
      savingsAmount,
      savingsPercent,
      hasInterest: monthlyRate > 0.0001
    };
  }, [cashPrice, fullPrice, paymentsCount]);

  // Format currency helper
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 2
    }).format(amount);
  };

  // Determine recommendation advice
  const advice = useMemo(() => {
    if (!results.hasInterest) {
      return {
        text: "Sem juros embutidos! O preço parcelado é igual ou menor que à vista. É mais vantajoso parcelar e deixar o dinheiro rendendo na poupança ou CDI.",
        color: 'var(--accent)',
        icon: '💡'
      };
    }
    
    if (results.monthlyRatePercent > 2.5) {
      return {
        text: `Juros altíssimos (${results.monthlyRatePercent.toFixed(2)}% a.m.)! Comprar à vista poupará ${formatCurrency(results.savingsAmount)} (${results.savingsPercent.toFixed(1)}% de desconto). Evite parcelar a todo custo.`,
        color: 'var(--danger)',
        icon: '⚠️'
      };
    }

    return {
      text: `Há juros embutidos de ${results.monthlyRatePercent.toFixed(2)}% a.m. Pagar à vista equivale a um investimento de renda fixa rendendo ${results.annualRatePercent.toFixed(1)}% ao ano! Se você tem o saldo, pague à vista.`,
      color: 'var(--primary)',
      icon: 'ℹ️'
    };
  }, [results, t]);

  return (
    <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
      
      {/* Title Header Card */}
      <div className="glass-card">
        <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
            <line x1="1" y1="10" x2="23" y2="10" />
          </svg>
          {t('InstTitle')}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>
          {t('InstDesc')}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        
        {/* Inputs Card */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, borderBottom: '1px solid var(--card-border)', paddingBottom: '10px', color: 'var(--text-primary)' }}>
            Parâmetros do Financiamento
          </h3>

          {/* Cash Price (PV) */}
          <div>
            <label htmlFor="cash-price-input" style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
              {t('CashPrice')}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="cash-price-input"
                type="number"
                value={cashPrice}
                onChange={(e) => setCashPrice(parseFloat(e.target.value) || 0)}
                style={{ paddingLeft: '32px' }}
              />
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '14px', fontWeight: 600 }}>R$</span>
            </div>
          </div>

          {/* Full Price (FV) */}
          <div>
            <label htmlFor="full-price-input" style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
              {t('FullPrice')}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="full-price-input"
                type="number"
                value={fullPrice}
                onChange={(e) => setFullPrice(parseFloat(e.target.value) || 0)}
                style={{ paddingLeft: '32px' }}
              />
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '14px', fontWeight: 600 }}>R$</span>
            </div>
          </div>

          {/* Payments Count */}
          <div>
            <label htmlFor="payments-count-slider" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              <span>{t('PaymentsCount')}</span>
              <strong style={{ color: 'var(--primary)' }}>{paymentsCount}x</strong>
            </label>
            <input
              type="range"
              id="payments-count-slider"
              min="2"
              max="48"
              step="1"
              value={paymentsCount}
              onChange={(e) => setPaymentsCount(parseInt(e.target.value) || 1)}
            />
          </div>
        </div>

        {/* Results Card */}
        <div className="glass-card" style={{ borderLeft: '3px solid var(--secondary)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, borderBottom: '1px solid var(--card-border)', paddingBottom: '10px', color: 'var(--text-primary)' }}>
            Taxas Embutidas Calculadas
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flexGrow: 1, justifyContent: 'center' }}>
            {/* Installment PMT */}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px dashed var(--card-border)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Valor da Parcela (mensal)</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatCurrency(results.pmt)}</span>
            </div>

            {/* Monthly rate */}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px dashed var(--card-border)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{t('MonthlyRate')}</span>
              <strong style={{ color: results.monthlyRatePercent > 0 ? 'var(--secondary)' : 'var(--accent)', fontSize: '16px' }}>
                {results.monthlyRatePercent.toFixed(2)}% a.m.
              </strong>
            </div>

            {/* Annual rate */}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px dashed var(--card-border)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{t('AnnualRate')}</span>
              <strong style={{ color: results.annualRatePercent > 0 ? 'var(--secondary)' : 'var(--accent)', fontSize: '16px' }}>
                {results.annualRatePercent.toFixed(1)}% a.a.
              </strong>
            </div>

            {/* Savings */}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '4px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Desconto à Vista</span>
              <span style={{ color: 'var(--accent)', fontWeight: 700 }}>
                {formatCurrency(results.savingsAmount)} ({results.savingsPercent.toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* Advice Recommendation Banner */}
      <div className="glass-card animate-pulse-border" style={{ 
        background: 'rgba(255, 255, 255, 0.02)',
        borderLeft: `4px solid ${advice.color}`,
        padding: '20px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px'
      }}>
        <span style={{ fontSize: '24px' }}>{advice.icon}</span>
        <div>
          <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
            {t('AdviceTitle')}
          </h4>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.6' }}>
            {advice.text}
          </p>
        </div>
      </div>

    </div>
  );
}

'use client';

import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

// 2026 progressive INSS calculator
function calculateINSS(gross: number): { contribution: number; effectiveRate: number } {
  const brackets = [
    { limit: 1518.00, rate: 0.075 },
    { limit: 2793.88, rate: 0.09 },
    { limit: 4190.83, rate: 0.12 },
    { limit: 8157.41, rate: 0.14 } // Ceiling limit
  ];

  let contribution = 0;
  let remaining = Math.min(gross, 8157.41);
  let previousLimit = 0;

  for (let i = 0; i < brackets.length; i++) {
    const currentBracket = brackets[i];
    const range = currentBracket.limit - previousLimit;
    
    if (remaining > range) {
      contribution += range * currentBracket.rate;
      remaining -= range;
    } else {
      contribution += remaining * currentBracket.rate;
      remaining = 0;
      break;
    }
    previousLimit = currentBracket.limit;
  }

  // If gross is above ceiling limit, cap it
  if (gross >= 8157.41) {
    contribution = 997.13; // Max INSS contribution
  }

  return {
    contribution,
    effectiveRate: gross > 0 ? (contribution / gross) * 100 : 0
  };
}

// 2026 progressive IRPF calculator (simplified monthly model)
function calculateIRPF(grossMinusINSS: number): { tax: number; effectiveRate: number } {
  // Simplified discount of R$ 564.80 is standard if it is more advantageous
  const simplifiedBasis = Math.max(0, grossMinusINSS - 564.80);
  
  const brackets = [
    { limit: 2259.20, rate: 0.00, deduction: 0 },
    { limit: 2826.65, rate: 0.075, deduction: 169.44 },
    { limit: 3751.05, rate: 0.15, deduction: 381.44 },
    { limit: 4664.68, rate: 0.225, deduction: 662.77 },
    { limit: Infinity, rate: 0.275, deduction: 896.00 }
  ];

  // Determine standard progressive tax
  let standardTax = 0;
  for (let i = 0; i < brackets.length; i++) {
    const b = brackets[i];
    if (grossMinusINSS <= b.limit) {
      standardTax = Math.max(0, (grossMinusINSS * b.rate) - b.deduction);
      break;
    }
  }

  // Determine simplified tax
  let simplifiedTax = 0;
  for (let i = 0; i < brackets.length; i++) {
    const b = brackets[i];
    if (simplifiedBasis <= b.limit) {
      simplifiedTax = Math.max(0, (simplifiedBasis * b.rate) - b.deduction);
      break;
    }
  }

  const finalTax = Math.min(standardTax, simplifiedTax);

  return {
    tax: finalTax,
    effectiveRate: grossMinusINSS > 0 ? (finalTax / grossMinusINSS) * 100 : 0
  };
}

export default function CltPjCalculator() {
  const { t } = useTranslation();

  // CLT States
  const [cltGross, setCltGross] = useState(5000);
  const [cltVr, setCltVr] = useState(600);
  const [cltHealth, setCltHealth] = useState(300);
  const [cltBenefits, setCltBenefits] = useState(100);

  // PJ States
  const [pjBilling, setPjBilling] = useState(8000);
  const [pjTaxRate, setPjTaxRate] = useState(6); // Default simples nacional annex III is 6%
  const [pjAccounting, setPjAccounting] = useState(200);

  const results = useMemo(() => {
    // 1. CLT Math
    const inssResult = calculateINSS(cltGross);
    const inssVal = inssResult.contribution;
    const irpfVal = calculateIRPF(Math.max(0, cltGross - inssVal)).tax;
    
    const cltNetSalary = Math.max(0, cltGross - inssVal - irpfVal);

    // CLT Proportions (Monthly equivalence)
    const monthly13th = cltGross / 12;
    const monthlyVacation = (cltGross / 12) * 1.3333; // salary/12 + 1/3 vacation
    const monthlyFGTS = cltGross * 0.08;

    const cltNetTotal = cltNetSalary + cltVr + cltHealth + cltBenefits + monthly13th + monthlyVacation + monthlyFGTS;

    // 2. PJ Math
    const pjTaxVal = pjBilling * (pjTaxRate / 100);
    const pjNetTotal = Math.max(0, pjBilling - pjTaxVal - pjAccounting);

    return {
      clt: {
        netSalary: cltNetSalary,
        inss: inssVal,
        irpf: irpfVal,
        proportions: {
          thirteenth: monthly13th,
          vacation: monthlyVacation,
          fgts: monthlyFGTS
        },
        netTotal: cltNetTotal
      },
      pj: {
        tax: pjTaxVal,
        netTotal: pjNetTotal
      }
    };
  }, [cltGross, cltVr, cltHealth, cltBenefits, pjBilling, pjTaxRate, pjAccounting]);

  // Format currency helper
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 2
    }).format(amount);
  };

  // SVG Chart Dimensions
  const chartHeight = 220;
  const maxVal = Math.max(results.clt.netTotal, results.pj.netTotal, 1);
  const cltHeight = (results.clt.netTotal / maxVal) * 150;
  const pjHeight = (results.pj.netTotal / maxVal) * 150;

  return (
    <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
      
      {/* Title Header Card */}
      <div className="glass-card">
        <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
          {t('CltPjTitle')}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>
          {t('CltPjDesc')}
        </p>
      </div>

      {/* Main Grid: Inputs and Comparison Graph */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        
        {/* CLT Input Card */}
        <div className="glass-card" style={{ borderLeft: '3px solid var(--primary)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, borderBottom: '1px solid var(--card-border)', paddingBottom: '10px', color: 'var(--text-primary)', marginBottom: '16px' }}>
            CLT (Carteira Assinada)
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* CLT Gross */}
            <div>
              <label htmlFor="clt-gross-input" style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                {t('CltGross')}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="clt-gross-input"
                  type="number"
                  value={cltGross}
                  onChange={(e) => setCltGross(parseFloat(e.target.value) || 0)}
                  style={{ paddingLeft: '32px' }}
                />
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '14px', fontWeight: 600 }}>R$</span>
              </div>
            </div>

            {/* CLT VR/VA */}
            <div>
              <label htmlFor="clt-vr-input" style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                {t('CltVr')}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="clt-vr-input"
                  type="number"
                  value={cltVr}
                  onChange={(e) => setCltVr(parseFloat(e.target.value) || 0)}
                  style={{ paddingLeft: '32px' }}
                />
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '14px', fontWeight: 600 }}>R$</span>
              </div>
            </div>

            {/* CLT Health */}
            <div>
              <label htmlFor="clt-health-input" style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                {t('CltHealth')}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="clt-health-input"
                  type="number"
                  value={cltHealth}
                  onChange={(e) => setCltHealth(parseFloat(e.target.value) || 0)}
                  style={{ paddingLeft: '32px' }}
                />
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '14px', fontWeight: 600 }}>R$</span>
              </div>
            </div>

            {/* CLT Benefits */}
            <div>
              <label htmlFor="clt-benefits-input" style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                {t('CltBenefits')}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="clt-benefits-input"
                  type="number"
                  value={cltBenefits}
                  onChange={(e) => setCltBenefits(parseFloat(e.target.value) || 0)}
                  style={{ paddingLeft: '32px' }}
                />
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '14px', fontWeight: 600 }}>R$</span>
              </div>
            </div>
          </div>
        </div>

        {/* PJ Input Card */}
        <div className="glass-card" style={{ borderLeft: '3px solid var(--secondary)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, borderBottom: '1px solid var(--card-border)', paddingBottom: '10px', color: 'var(--text-primary)', marginBottom: '16px' }}>
            PJ (Pessoa Jurídica)
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* PJ Billing */}
            <div>
              <label htmlFor="pj-billing-input" style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                {t('PjBilling')}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="pj-billing-input"
                  type="number"
                  value={pjBilling}
                  onChange={(e) => setPjBilling(parseFloat(e.target.value) || 0)}
                  style={{ paddingLeft: '32px' }}
                />
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '14px', fontWeight: 600 }}>R$</span>
              </div>
            </div>

            {/* PJ Tax */}
            <div>
              <label htmlFor="pj-tax-input" style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                {t('PjTaxRate')}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="pj-tax-input"
                  type="number"
                  value={pjTaxRate}
                  onChange={(e) => setPjTaxRate(parseFloat(e.target.value) || 0)}
                  style={{ paddingRight: '32px' }}
                  step="0.1"
                />
                <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '14px', fontWeight: 600 }}>%</span>
              </div>
            </div>

            {/* PJ Accounting */}
            <div>
              <label htmlFor="pj-accounting-input" style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                {t('PjAccounting')}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="pj-accounting-input"
                  type="number"
                  value={pjAccounting}
                  onChange={(e) => setPjAccounting(parseFloat(e.target.value) || 0)}
                  style={{ paddingLeft: '32px' }}
                />
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '14px', fontWeight: 600 }}>R$</span>
              </div>
            </div>
          </div>
        </div>

        {/* Visual Comparison Chart Card */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, borderBottom: '1px solid var(--card-border)', paddingBottom: '10px', color: 'var(--text-primary)' }}>
            {t('ResultComparison')}
          </h3>
          
          <div style={{ display: 'flex', flexGrow: 1, justifyContent: 'space-around', alignItems: 'flex-end', height: '180px', paddingBottom: '10px' }}>
            {/* CLT Bar */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', width: '80px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)' }}>
                {cltHeight > 20 ? formatCurrency(results.clt.netTotal).split(',')[0] : ''}
              </span>
              <div style={{
                width: '40px',
                height: `${cltHeight}px`,
                background: 'linear-gradient(to top, var(--primary), var(--primary-glow))',
                borderRadius: '6px 6px 0 0',
                boxShadow: '0 4px 12px var(--primary-glow)',
                transition: 'height var(--transition-normal)'
              }} />
              <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>CLT</strong>
            </div>

            {/* PJ Bar */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', width: '80px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--secondary)' }}>
                {pjHeight > 20 ? formatCurrency(results.pj.netTotal).split(',')[0] : ''}
              </span>
              <div style={{
                width: '40px',
                height: `${pjHeight}px`,
                background: 'linear-gradient(to top, var(--secondary), var(--secondary-glow))',
                borderRadius: '6px 6px 0 0',
                boxShadow: '0 4px 12px var(--secondary-glow)',
                transition: 'height var(--transition-normal)'
              }} />
              <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>PJ</strong>
            </div>
          </div>
        </div>

      </div>

      {/* Breakdown Details Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        
        {/* CLT Detailed Breakdown */}
        <div className="glass-card">
          <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }} />
            CLT Net Monthly Composition
          </h4>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px dashed var(--card-border)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Net Base Salary (Gross minus INSS & IRPF)</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatCurrency(results.clt.netSalary)}</span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px dashed var(--card-border)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>INSS Tax Deducted</span>
              <span style={{ color: 'var(--danger)', fontWeight: 600 }}>-{formatCurrency(results.clt.inss)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px dashed var(--card-border)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>IRPF Tax Deducted</span>
              <span style={{ color: 'var(--danger)', fontWeight: 600 }}>-{formatCurrency(results.clt.irpf)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px dashed var(--card-border)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Direct Benefits (VR/VA + Health + Others)</span>
              <span style={{ color: 'var(--accent)', fontWeight: 600 }}>+{formatCurrency(cltVr + cltHealth + cltBenefits)}</span>
            </div>

            {/* Proportions Card inside */}
            <div style={{ background: 'var(--input-bg)', padding: '10px', borderRadius: 'var(--border-radius-sm)', marginTop: '6px' }}>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                {t('CltBenefitTitle')}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>13th Salary (Monthly equiv.)</span>
                  <span style={{ color: 'var(--text-primary)' }}>{formatCurrency(results.clt.proportions.thirteenth)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Vacation + 1/3 (Monthly equiv.)</span>
                  <span style={{ color: 'var(--text-primary)' }}>{formatCurrency(results.clt.proportions.vacation)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>FGTS (Monthly deposit)</span>
                  <span style={{ color: 'var(--text-primary)' }}>{formatCurrency(results.clt.proportions.fgts)}</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--card-border)', marginTop: '8px', fontSize: '15px' }}>
              <strong style={{ color: 'var(--text-primary)' }}>{t('ResultCLTNet')}</strong>
              <strong style={{ color: 'var(--primary)' }}>{formatCurrency(results.clt.netTotal)}</strong>
            </div>
          </div>
        </div>

        {/* PJ Detailed Breakdown */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--secondary)' }} />
            PJ Net Monthly Composition
          </h4>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', flexGrow: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px dashed var(--card-border)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Monthly Gross Billing</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatCurrency(pjBilling)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px dashed var(--card-border)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Corporate Tax ({pjTaxRate}%)</span>
              <span style={{ color: 'var(--danger)', fontWeight: 600 }}>-{formatCurrency(results.pj.tax)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px dashed var(--card-border)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Accounting / Corporate Costs</span>
              <span style={{ color: 'var(--danger)', fontWeight: 600 }}>-{formatCurrency(pjAccounting)}</span>
            </div>

            <div style={{ 
              background: 'rgba(236, 72, 153, 0.03)', 
              border: '1px dashed rgba(236, 72, 153, 0.15)', 
              borderRadius: 'var(--border-radius-sm)', 
              padding: '12px', 
              fontSize: '12px', 
              color: 'var(--text-secondary)',
              marginTop: 'auto',
              lineHeight: '1.5'
            }}>
              💡 <strong>Simples Nacional:</strong> Para contratos PJ de TI, verifique se você pode se enquadrar no <strong>Fator R</strong> para reduzir sua alíquota tributária de 15,5% (Anexo V) para 6% (Anexo III).
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--card-border)', marginTop: '12px', fontSize: '15px' }}>
              <strong style={{ color: 'var(--text-primary)' }}>{t('ResultPJNet')}</strong>
              <strong style={{ color: 'var(--secondary)' }}>{formatCurrency(results.pj.netTotal)}</strong>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}

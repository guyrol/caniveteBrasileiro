'use client';

import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

export default function FuelCalculator() {
  const { t } = useTranslation();

  // Ethanol x Gasoline states
  const [ethanolPrice, setEthanolPrice] = useState(3.59);
  const [gasolinePrice, setGasolinePrice] = useState(5.39);
  const [ethanolKml, setEthanolKml] = useState('');
  const [gasolineKml, setGasolineKml] = useState('');

  // Trip Cost states
  const [tripDistance, setTripDistance] = useState(100);
  const [carConsumption, setCarConsumption] = useState(10);
  const [literPrice, setLiterPrice] = useState(5.39);
  const [passengers, setPassengers] = useState(1);

  // Ethanol vs Gasoline math
  const fuelAnalysis = useMemo(() => {
    const ethKmlNum = parseFloat(ethanolKml);
    const gasKmlNum = parseFloat(gasolineKml);

    // Calculate ratio
    const efficiencyRatio = (ethKmlNum > 0 && gasKmlNum > 0) 
      ? ethKmlNum / gasKmlNum 
      : 0.70; // Standard 70% threshold

    const actualRatio = ethanolPrice / Math.max(gasolinePrice, 0.01);
    const isEthanolCheaper = actualRatio < efficiencyRatio;

    // Calculate percent savings of the cheaper one compared to the other
    let percentageSavings = 0;
    if (isEthanolCheaper) {
      // cost per km of ethanol vs gasoline
      // ethanol cost per km = ethanolPrice / ethKml; gasoline cost per km = gasolinePrice / gasKml
      // if using standard 70% ratio, gas is equivalent to (gasolinePrice * ratio)
      const equivalentEthPrice = gasolinePrice * efficiencyRatio;
      percentageSavings = ((equivalentEthPrice - ethanolPrice) / equivalentEthPrice) * 100;
    } else {
      const equivalentEthPrice = gasolinePrice * efficiencyRatio;
      percentageSavings = ((ethanolPrice - equivalentEthPrice) / equivalentEthPrice) * 100;
    }

    return {
      isEthanolCheaper,
      ratioPercent: efficiencyRatio * 100,
      currentRatioPercent: actualRatio * 100,
      savings: Math.max(0, percentageSavings)
    };
  }, [ethanolPrice, gasolinePrice, ethanolKml, gasolineKml]);

  // Trip Cost math
  const tripResults = useMemo(() => {
    const distance = Math.max(0, tripDistance);
    const consumption = Math.max(0.1, carConsumption);
    const price = Math.max(0, literPrice);
    const passengersCount = Math.max(1, passengers);

    const liters = distance / consumption;
    const totalCost = liters * price;
    const costPerPerson = totalCost / passengersCount;

    return {
      liters,
      totalCost,
      costPerPerson
    };
  }, [tripDistance, carConsumption, literPrice, passengers]);

  // Format currency helper
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 2
    }).format(amount);
  };

  return (
    <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
      
      {/* Title Header Card */}
      <div className="glass-card">
        <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
          {t('FuelTitle')}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>
          {t('FuelDesc')}
        </p>
      </div>

      {/* Grid: Ethanol x Gas vs Trip Cost */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        
        {/* Ethanol vs Gas inputs and decisions */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderLeft: '3px solid var(--primary)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, borderBottom: '1px solid var(--card-border)', paddingBottom: '10px', color: 'var(--text-primary)' }}>
            Álcool ou Gasolina?
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {/* Ethanol Price */}
            <div>
              <label htmlFor="ethanol-price-input" style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                {t('EthanolPrice')}
              </label>
              <input
                id="ethanol-price-input"
                type="number"
                value={ethanolPrice}
                onChange={(e) => setEthanolPrice(parseFloat(e.target.value) || 0)}
                step="0.01"
              />
            </div>
            
            {/* Gasoline Price */}
            <div>
              <label htmlFor="gasoline-price-input" style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                {t('GasolinePrice')}
              </label>
              <input
                id="gasoline-price-input"
                type="number"
                value={gasolinePrice}
                onChange={(e) => setGasolinePrice(parseFloat(e.target.value) || 0)}
                step="0.01"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {/* Optional Ethanol km/l */}
            <div>
              <label htmlFor="ethanol-kml-input" style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                {t('EthanolKml')}
              </label>
              <input
                id="ethanol-kml-input"
                type="number"
                value={ethanolKml}
                onChange={(e) => setEthanolKml(e.target.value)}
                placeholder="ex: 7.5"
                step="0.1"
              />
            </div>
            
            {/* Optional Gasoline km/l */}
            <div>
              <label htmlFor="gasoline-kml-input" style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                {t('GasolineKml')}
              </label>
              <input
                id="gasoline-kml-input"
                type="number"
                value={gasolineKml}
                onChange={(e) => setGasolineKml(e.target.value)}
                placeholder="ex: 11"
                step="0.1"
              />
            </div>
          </div>

          <span style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
            {t('FuelRatioDesc')} (Rendimento ideal do Álcool: <strong>{fuelAnalysis.ratioPercent.toFixed(0)}%</strong> da Gasolina. Proporção atual de preços: <strong>{fuelAnalysis.currentRatioPercent.toFixed(1)}%</strong>).
          </span>

          {/* Decision result */}
          <div style={{ 
            marginTop: 'auto',
            background: fuelAnalysis.isEthanolCheaper ? 'rgba(16, 185, 129, 0.08)' : 'rgba(99, 102, 241, 0.08)',
            border: fuelAnalysis.isEthanolCheaper ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(99, 102, 241, 0.2)',
            borderRadius: 'var(--border-radius-sm)',
            padding: '16px',
            textAlign: 'center',
            fontWeight: 700,
            fontSize: '15px',
            color: fuelAnalysis.isEthanolCheaper ? 'var(--accent)' : 'var(--primary)'
          }}>
            {fuelAnalysis.isEthanolCheaper 
              ? t('FuelResultCheaper', { pct: fuelAnalysis.savings.toFixed(1) })
              : t('FuelResultGasCheaper', { pct: fuelAnalysis.savings.toFixed(1) })}
          </div>
        </div>

        {/* Trip Cost Calculator */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderLeft: '3px solid var(--secondary)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, borderBottom: '1px solid var(--card-border)', paddingBottom: '10px', color: 'var(--text-primary)' }}>
            {t('TripTitle')}
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {/* Distance */}
            <div>
              <label htmlFor="trip-distance-input" style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                {t('TripDistance')}
              </label>
              <input
                id="trip-distance-input"
                type="number"
                value={tripDistance}
                onChange={(e) => setTripDistance(parseFloat(e.target.value) || 0)}
              />
            </div>
            
            {/* Car consumption */}
            <div>
              <label htmlFor="car-consumption-input" style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                {t('CarConsumption')}
              </label>
              <input
                id="car-consumption-input"
                type="number"
                value={carConsumption}
                onChange={(e) => setCarConsumption(parseFloat(e.target.value) || 0)}
                step="0.1"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {/* Fuel liter price */}
            <div>
              <label htmlFor="liter-price-input" style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                {t('LiterPrice')}
              </label>
              <input
                id="liter-price-input"
                type="number"
                value={literPrice}
                onChange={(e) => setLiterPrice(parseFloat(e.target.value) || 0)}
                step="0.01"
              />
            </div>

            {/* Passengers count slider */}
            <div>
              <label htmlFor="passengers-slider" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                <span>{t('Passengers')}</span>
                <strong style={{ color: 'var(--secondary)' }}>{passengers}</strong>
              </label>
              <input
                id="passengers-slider"
                type="range"
                min="1"
                max="8"
                step="1"
                value={passengers}
                onChange={(e) => setPassengers(parseInt(e.target.value) || 1)}
              />
            </div>
          </div>

          {/* Trip Cost Outputs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--input-bg)', padding: '14px', borderRadius: 'var(--border-radius-sm)', marginTop: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{t('LitersNeeded')}</span>
              <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{tripResults.liters.toFixed(1)} L</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderTop: '1px dashed var(--card-border)', paddingTop: '8px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Custo Total</span>
              <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(tripResults.totalCost)}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', borderTop: '1px solid var(--card-border)', paddingTop: '8px' }}>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{t('CostPerPassenger')}</span>
              <strong style={{ color: 'var(--secondary)', fontSize: '18px' }}>{formatCurrency(tripResults.costPerPerson)}</strong>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}

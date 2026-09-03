'use client';

import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

// EMV standard field formatter
function formatEMVField(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

// Clean accents and special characters for EMV compliance
function cleanText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^A-Z0-9 ]/gi, '') // Remove special characters
    .trim()
    .toUpperCase();
}

// CRC16 CCITT Checksum (polynomial 0x1021, initial 0xFFFF)
function calculateCRC16(str: string): string {
  let crc = 0xFFFF;
  const polynomial = 0x1021;
  
  for (let i = 0; i < str.length; i++) {
    const b = str.charCodeAt(i);
    for (let j = 0; j < 8; j++) {
      const bit = ((b >> (7 - j)) & 1) === 1;
      const c15 = ((crc >> 15) & 1) === 1;
      crc <<= 1;
      if (c15 !== bit) {
        crc ^= polynomial;
      }
    }
  }
  
  crc &= 0xFFFF;
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export default function PixGenerator() {
  const { t } = useTranslation();

  const [pixKey, setPixKey] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientCity, setRecipientCity] = useState('');
  const [amount, setAmount] = useState('');
  const [txId, setTxId] = useState('');
  const [copied, setCopied] = useState(false);

  // Generate EMV Pix Copy and Paste string
  const pixCode = useMemo(() => {
    if (!pixKey.trim() || !recipientName.trim() || !recipientCity.trim()) {
      return '';
    }

    try {
      const cleanName = cleanText(recipientName).substring(0, 25);
      const cleanCity = cleanText(recipientCity).substring(0, 15);
      const cleanTxId = cleanText(txId || '***').substring(0, 25);

      // 1. Format Indicator
      let payload = formatEMVField('00', '01');

      // 2. Merchant Account Info (Pix Key)
      const gui = formatEMVField('00', 'br.gov.bcb.pix');
      const key = formatEMVField('01', pixKey.trim());
      payload += formatEMVField('26', `${gui}${key}`);

      // 3. Category Code
      payload += formatEMVField('52', '0000');

      // 4. Currency (BRL = 986)
      payload += formatEMVField('53', '986');

      // 5. Amount (optional)
      const parsedAmount = parseFloat(amount);
      if (parsedAmount > 0) {
        payload += formatEMVField('54', parsedAmount.toFixed(2));
      }

      // 6. Country Code (BR)
      payload += formatEMVField('58', 'BR');

      // 7. Merchant Name & City
      payload += formatEMVField('59', cleanName);
      payload += formatEMVField('60', cleanCity);

      // 8. Additional Data (TxID)
      const additionalInfo = formatEMVField('05', cleanTxId);
      payload += formatEMVField('62', additionalInfo);

      // 9. Add CRC16 placeholders
      payload += '6304';

      // 10. Calculate checksum
      const crc = calculateCRC16(payload);

      return `${payload}${crc}`;
    } catch (e) {
      console.error(e);
      return '';
    }
  }, [pixKey, recipientName, recipientCity, amount, txId]);

  const handleCopy = () => {
    if (!pixCode) return;
    navigator.clipboard.writeText(pixCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Generate QR Code URL via public API
  const qrCodeUrl = useMemo(() => {
    if (!pixCode) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixCode)}`;
  }, [pixCode]);

  return (
    <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
      
      {/* Title Header Card */}
      <div className="glass-card">
        <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <rect x="7" y="7" width="3" height="3" />
            <rect x="14" y="7" width="3" height="3" />
            <rect x="7" y="14" width="3" height="3" />
            <rect x="14" y="14" width="3" height="3" />
          </svg>
          {t('PixTitle')}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>
          {t('PixDesc')}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        
        {/* Form Inputs */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, borderBottom: '1px solid var(--card-border)', paddingBottom: '10px', color: 'var(--text-primary)' }}>
            Configurar Cobrança Pix
          </h3>

          {/* Pix Key */}
          <div>
            <label htmlFor="pix-key-input" style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
              {t('PixKey')}
            </label>
            <input
              id="pix-key-input"
              type="text"
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
              placeholder="ex: pix@empresa.com ou CPF"
            />
          </div>

          {/* Recipient Name */}
          <div>
            <label htmlFor="pix-name-input" style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
              {t('RecipientName')}
            </label>
            <input
              id="pix-name-input"
              type="text"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="ex: JOAO SILVA"
            />
          </div>

          {/* Recipient City */}
          <div>
            <label htmlFor="pix-city-input" style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
              {t('RecipientCity')}
            </label>
            <input
              id="pix-city-input"
              type="text"
              value={recipientCity}
              onChange={(e) => setRecipientCity(e.target.value)}
              placeholder="ex: SAO PAULO"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {/* Amount */}
            <div>
              <label htmlFor="pix-amount-input" style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                {t('TxAmount')}
              </label>
              <input
                id="pix-amount-input"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                step="0.01"
              />
            </div>

            {/* Reference TxID */}
            <div>
              <label htmlFor="pix-txid-input" style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                {t('TxId')}
              </label>
              <input
                id="pix-txid-input"
                type="text"
                value={txId}
                onChange={(e) => setTxId(e.target.value)}
                placeholder="ex: FATURA123"
              />
            </div>
          </div>
        </div>

        {/* Output Card */}
        <div className="glass-card" style={{ borderLeft: '3px solid var(--secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
          
          {pixCode ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', width: '100%' }}>
              
              {/* QR Code Frame */}
              <div style={{ 
                background: 'white', 
                padding: '16px', 
                borderRadius: 'var(--border-radius-md)', 
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '180px',
                height: '180px'
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={qrCodeUrl} 
                  alt="Pix QR Code" 
                  style={{ width: '100%', height: '100%' }}
                />
              </div>

              {/* Text Payload Copy box */}
              <div style={{ 
                width: '100%',
                maxHeight: '70px',
                overflow: 'hidden',
                background: 'var(--input-bg)',
                border: '1px solid var(--input-border)',
                borderRadius: 'var(--border-radius-sm)',
                padding: '10px',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                wordBreak: 'break-all',
                color: 'var(--text-secondary)',
                lineHeight: '1.4',
                position: 'relative'
              }}>
                {pixCode}
              </div>

              {/* Copy button */}
              <button
                id="copy-pix-payload-btn"
                onClick={handleCopy}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: 'var(--border-radius-sm)',
                  border: 'none',
                  background: copied ? 'var(--accent)' : 'linear-gradient(135deg, var(--secondary), var(--secondary-hover))',
                  color: 'white',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: copied ? 'none' : '0 4px 12px var(--secondary-glow)',
                  transition: 'all var(--transition-fast)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {copied ? (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {t('PixCopied')}
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    {t('CopyCode')}
                  </>
                )}
              </button>
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '40px 10px' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '12px', opacity: 0.5 }}>
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="9" x2="15" y2="15" />
                <line x1="15" y1="9" x2="9" y2="15" />
              </svg>
              <p>Preencha os campos obrigatórios para gerar o código Pix copia e cola com QR Code.</p>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}

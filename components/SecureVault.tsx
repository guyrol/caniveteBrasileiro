'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

// Generator pools
const UPPERCASE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWERCASE_CHARS = 'abcdefghijklmnopqrstuvwxyz';
const NUMBER_CHARS = '0123456789';
const SYMBOL_CHARS = '!@#$%^&*()_+-=[]{}|;:,.<>?';
const SIMILAR_CHARS = /[il1Io0O]/g;

// Helper to format hours/minutes back to standard string H:MM
function formatTimeItem(hours: number, minutes: number): string {
  return `${hours}:${minutes.toString().padStart(2, '0')}`;
}

export default function SecureVault() {
  const { t } = useTranslation();

  // Vault Sub-tab: 'vault' (keys & notes) or 'devutils' (developer utilities)
  const [vaultTab, setVaultTab] = useState<'keys_notes' | 'devutils'>('keys_notes');

  // Generator states
  const [length, setLength] = useState(16);
  const [useUppercase, setUseUppercase] = useState(true);
  const [useLowercase, setUseLowercase] = useState(true);
  const [useNumbers, setUseNumbers] = useState(true);
  const [useSymbols, setUseSymbols] = useState(true);
  const [excludeSimilar, setExcludeSimilar] = useState(true);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [copied, setCopied] = useState(false);

  // Secure Notes states
  const [noteContent, setNoteContent] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Dev Utils: JSON Formatter states
  const [jsonInput, setJsonInput] = useState('');
  const [jsonOutput, setJsonOutput] = useState('');
  const [jsonError, setJsonError] = useState('');

  // Dev Utils: Base64 states
  const [b64Input, setB64Input] = useState('');
  const [b64Output, setB64Output] = useState('');
  const [b64Error, setB64Error] = useState('');
  const [b64Mode, setB64Mode] = useState<'encode' | 'decode' | 'json_prettify' | 'json_minify'>('encode');

  // Dev Utils: Epoch states
  const [epochInput, setEpochInput] = useState(() => Math.floor(Date.now() / 1000).toString());
  const [dateInput, setDateInput] = useState(() => new Date().toISOString());
  const [epochResult, setEpochResult] = useState('');

  // Generator logic
  const generatePassword = useCallback(() => {
    let charPool = '';
    if (useUppercase) charPool += UPPERCASE_CHARS;
    if (useLowercase) charPool += LOWERCASE_CHARS;
    if (useNumbers) charPool += NUMBER_CHARS;
    if (useSymbols) charPool += SYMBOL_CHARS;

    if (excludeSimilar) {
      charPool = charPool.replace(SIMILAR_CHARS, '');
    }

    if (!charPool) {
      setGeneratedPassword('');
      return;
    }

    let result = '';
    const array = new Uint32Array(length);
    if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(array);
      for (let i = 0; i < length; i++) {
        result += charPool[array[i] % charPool.length];
      }
    } else {
      for (let i = 0; i < length; i++) {
        result += charPool[Math.floor(Math.random() * charPool.length)];
      }
    }

    setGeneratedPassword(result);
    setCopied(false);
  }, [length, useUppercase, useLowercase, useNumbers, useSymbols, excludeSimilar]);

  // Generate on load or settings change
  useEffect(() => {
    generatePassword();
  }, [generatePassword]);

  // Calculate entropy
  const entropy = useMemo(() => {
    let poolSize = 0;
    if (useUppercase) poolSize += 26;
    if (useLowercase) poolSize += 26;
    if (useNumbers) poolSize += 10;
    if (useSymbols) poolSize += 26;
    if (excludeSimilar) poolSize -= 7;

    if (poolSize === 0 || length === 0) return 0;
    return Math.round(length * Math.log2(poolSize));
  }, [length, useUppercase, useLowercase, useNumbers, useSymbols, excludeSimilar]);

  // Strength details based on entropy
  const strength = useMemo(() => {
    if (entropy < 40) return { label: t('StrengthWeak') || 'Weak', color: 'var(--danger)', width: '25%' };
    if (entropy < 75) return { label: t('StrengthMedium') || 'Medium', color: '#f59e0b', width: '50%' };
    if (entropy < 100) return { label: t('StrengthStrong') || 'Strong', color: 'var(--primary)', width: '75%' };
    return { label: t('StrengthBulletproof') || 'Bulletproof', color: 'var(--accent)', width: '100%' };
  }, [entropy, t]);

  const handleCopy = () => {
    if (!generatedPassword) return;
    navigator.clipboard.writeText(generatedPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Load notes on mount
  useEffect(() => {
    const fetchNote = async () => {
      try {
        const res = await fetch('/api/history');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.history) {
            const noteRecord = data.history.find((item: any) => item.type === 'notes');
            if (noteRecord && noteRecord.data) {
              setNoteContent(noteRecord.data.content || '');
            }
          }
        }
      } catch (e) {
        console.error('Failed to load secure notes', e);
      }
    };
    
    fetchNote();
  }, []);

  // Save notes to database
  const handleSaveNote = async () => {
    setSaveStatus('saving');
    try {
      const res = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'notes',
          label: 'Secure Note Scratchpad',
          data: { content: noteContent }
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus('idle'), 2000);
        } else {
          setSaveStatus('error');
        }
      } else {
        setSaveStatus('error');
      }
    } catch (e) {
      setSaveStatus('error');
    }
  };

  // Dev Utils: JSON Operations
  const handleJSONFormat = (minify = false) => {
    setJsonError('');
    if (!jsonInput.trim()) return;

    try {
      const parsed = JSON.parse(jsonInput);
      const output = minify ? JSON.stringify(parsed) : JSON.stringify(parsed, null, 2);
      setJsonOutput(output);
    } catch (e: any) {
      setJsonError(e.message || 'Invalid JSON');
    }
  };

  // Dev Utils: Base64 Operations
  const handleBase64Convert = () => {
    setB64Error('');
    if (!b64Input.trim()) return;

    try {
      if (b64Mode === 'encode') {
        setB64Output(btoa(unescape(encodeURIComponent(b64Input))));
      } else {
        setB64Output(decodeURIComponent(escape(atob(b64Input))));
      }
    } catch (e: any) {
      setB64Error('Encoding/Decoding failed. Make sure the input format is valid.');
    }
  };

  // Dev Utils: Epoch Operations
  const handleEpochConvert = (direction: 'to_date' | 'to_epoch' | 'now') => {
    if (direction === 'now') {
      const nowMs = Date.now();
      setEpochInput(Math.floor(nowMs / 1000).toString());
      setDateInput(new Date(nowMs).toISOString());
      runEpochConvert(Math.floor(nowMs / 1000).toString());
      return;
    }

    if (direction === 'to_date') {
      runEpochConvert(epochInput);
    } else {
      try {
        const dateObj = new Date(dateInput);
        if (isNaN(dateObj.getTime())) {
          setEpochResult('Invalid Date');
          return;
        }
        const epoch = Math.floor(dateObj.getTime() / 1000);
        setEpochInput(epoch.toString());
        setEpochResult(`Epoch Timestamp: ${epoch}\nMilliseconds: ${dateObj.getTime()}`);
      } catch (e) {
        setEpochResult('Invalid Date');
      }
    }
  };

  const runEpochConvert = (input: string) => {
    try {
      let num = parseInt(input, 10);
      if (isNaN(num)) {
        setEpochResult('Invalid Timestamp');
        return;
      }
      // If 13 digits, treat as milliseconds
      const isMs = input.length >= 13;
      const date = new Date(isMs ? num : num * 1000);
      if (isNaN(date.getTime())) {
        setEpochResult('Invalid Timestamp');
        return;
      }
      setEpochResult(`Local Time: ${date.toLocaleString()}\nUTC: ${date.toUTCString()}\nISO: ${date.toISOString()}`);
    } catch (e) {
      setEpochResult('Invalid Timestamp');
    }
  };

  // Trigger initial epoch convert on mount
  useEffect(() => {
    runEpochConvert(epochInput);
  }, []);

  return (
    <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
      
      {/* Title Header Card */}
      <div className="glass-card">
        <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          {t('VaultTitle')}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '20px' }}>
          {t('VaultDesc')}
        </p>

        {/* Sub-tab selection inside Vault */}
        <div style={{ display: 'flex', background: 'var(--input-bg)', borderRadius: 'var(--border-radius-sm)', padding: '4px', gap: '4px', border: '1px solid var(--input-border)', maxWidth: '340px' }}>
          <button
            id="subtab-keys-notes"
            onClick={() => setVaultTab('keys_notes')}
            style={{
              flex: 1,
              padding: '6px 12px',
              borderRadius: '4px',
              border: 'none',
              background: vaultTab === 'keys_notes' ? 'var(--bg-color)' : 'transparent',
              color: vaultTab === 'keys_notes' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: vaultTab === 'keys_notes' ? 600 : 400,
              cursor: 'pointer',
              fontSize: '12.5px',
              transition: 'all var(--transition-fast)'
            }}
          >
            Chaves & Notas
          </button>
          <button
            id="subtab-devutils"
            onClick={() => setVaultTab('devutils')}
            style={{
              flex: 1,
              padding: '6px 12px',
              borderRadius: '4px',
              border: 'none',
              background: vaultTab === 'devutils' ? 'var(--bg-color)' : 'transparent',
              color: vaultTab === 'devutils' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: vaultTab === 'devutils' ? 600 : 400,
              cursor: 'pointer',
              fontSize: '12.5px',
              transition: 'all var(--transition-fast)'
            }}
          >
            {t('TabDevUtils')}
          </button>
        </div>
      </div>

      {/* RENDER ACTIVE SUB-TAB */}
      {vaultTab === 'keys_notes' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
          
          {/* Key Generator */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, borderBottom: '1px solid var(--card-border)', paddingBottom: '10px', color: 'var(--text-primary)' }}>
              {t('GeneratorTitle')}
            </h3>

            <div style={{ 
              background: 'var(--input-bg)', 
              border: '1px solid var(--input-border)',
              borderRadius: 'var(--border-radius-sm)',
              padding: '16px',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              minHeight: '56px',
              marginBottom: '4px'
            }}>
              <span style={{ 
                fontFamily: 'var(--font-mono)', 
                fontSize: '15px', 
                color: generatedPassword ? 'var(--text-primary)' : 'var(--text-muted)',
                wordBreak: 'break-all',
                paddingRight: '36px'
              }}>
                {generatedPassword || t('GeneratorEmpty')}
              </span>
              <button
                id="vault-copy-pwd-btn"
                onClick={handleCopy}
                disabled={!generatedPassword}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: copied ? 'var(--accent)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all var(--transition-fast)'
                }}
              >
                {copied ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                )}
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {t('GeneratorEntropy')}: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{entropy} bits</strong>
                </span>
                <span style={{ fontWeight: 600, color: strength.color }}>{strength.label}</span>
              </div>
              <div style={{ width: '100%', height: '4px', background: 'var(--input-border)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: strength.width, height: '100%', background: strength.color, transition: 'all var(--transition-normal)' }} />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{t('GeneratorLength')}</span>
                  <strong style={{ color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>{length}</strong>
                </div>
                <input
                  type="range"
                  id="vault-key-length-slider"
                  min="8"
                  max="64"
                  step="1"
                  value={length}
                  onChange={(e) => setLength(parseInt(e.target.value))}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '8px' }}>
                {[
                  { id: 'opt-uppercase', label: t('GenOptUppercase'), val: useUppercase, setter: setUseUppercase },
                  { id: 'opt-lowercase', label: t('GenOptLowercase'), val: useLowercase, setter: setUseLowercase },
                  { id: 'opt-numbers', label: t('GenOptNumbers'), val: useNumbers, setter: setUseNumbers },
                  { id: 'opt-symbols', label: t('GenOptSymbols'), val: useSymbols, setter: setUseSymbols }
                ].map((opt) => (
                  <label key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <input
                      id={opt.id}
                      type="checkbox"
                      checked={opt.val}
                      onChange={(e) => opt.setter(e.target.checked)}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer', marginTop: '4px' }}>
                <input
                  id="opt-exclude-similar"
                  type="checkbox"
                  checked={excludeSimilar}
                  onChange={(e) => setExcludeSimilar(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                />
                <span>{t('GenOptExcludeSimilar')}</span>
              </label>

              <button
                id="vault-regen-key-btn"
                onClick={generatePassword}
                style={{
                  padding: '10px',
                  borderRadius: 'var(--border-radius-sm)',
                  border: '1px solid var(--input-border)',
                  background: 'var(--input-bg)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all var(--transition-fast)'
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
                {t('GenRegenerateBtn')}
              </button>
            </div>
          </div>

          {/* Secure Notes */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderLeft: '3px solid var(--primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--card-border)', paddingBottom: '10px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {t('NotesTitle')}
              </h3>
              <span style={{ 
                fontSize: '12px', 
                color: saveStatus === 'saved' ? 'var(--accent)' : saveStatus === 'saving' ? 'var(--primary)' : saveStatus === 'error' ? 'var(--danger)' : 'var(--text-muted)'
              }}>
                {saveStatus === 'saved' ? t('NotesSaved') : saveStatus === 'saving' ? t('NotesSaving') : saveStatus === 'error' ? t('NotesError') : ''}
              </span>
            </div>

            <textarea
              id="vault-notes-textarea"
              rows={10}
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              onBlur={handleSaveNote}
              placeholder={t('NotesPlaceholder')}
              style={{
                flexGrow: 1,
                fontFamily: 'var(--font-mono)',
                fontSize: '14px',
                lineHeight: '1.6',
                resize: 'none',
                border: '1px solid var(--input-border)',
                background: 'rgba(0,0,0,0.1)'
              }}
            />

            <button
              id="vault-save-notes-btn"
              onClick={handleSaveNote}
              disabled={saveStatus === 'saving'}
              style={{
                padding: '12px',
                borderRadius: 'var(--border-radius-sm)',
                border: 'none',
                background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
                color: 'white',
                cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                boxShadow: '0 4px 14px var(--primary-glow)',
                transition: 'all var(--transition-fast)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
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
      ) : (
        /* DEVELOPER UTILITIES SUB-TAB */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
          
          {/* JSON Formatter & Base64 Converter */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Format selection */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--card-border)', paddingBottom: '1px', marginBottom: '8px' }}>
              <button
                id="dev-btn-json"
                onClick={() => {
                  setB64Error('');
                  setJsonError('');
                }}
                style={{
                  padding: '8px 16px',
                  background: 'none',
                  border: 'none',
                  borderBottom: '2px solid var(--primary)',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  fontSize: '13px'
                }}
              >
                JSON / Base64
              </button>
            </div>

            {/* Sub-Layout inputs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Selector Mode */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <select
                  value={b64Mode}
                  onChange={(e) => setB64Mode(e.target.value as any)}
                  style={{ flex: 1, padding: '10px' }}
                >
                  <option value="encode">Base64 Encode (Text &rarr; B64)</option>
                  <option value="decode">Base64 Decode (B64 &rarr; Text)</option>
                  <option value="json_prettify">JSON Prettify (Format)</option>
                  <option value="json_minify">JSON Minify (Compress)</option>
                </select>
              </div>

              {/* Input Textarea */}
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>INPUT</label>
                <textarea
                  id="dev-input-textarea"
                  rows={4}
                  value={b64Mode.startsWith('json') ? jsonInput : b64Input}
                  onChange={(e) => b64Mode.startsWith('json') ? setJsonInput(e.target.value) : setB64Input(e.target.value)}
                  placeholder="Paste raw string or JSON code here..."
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}
                />
              </div>

              {/* Action Trigger */}
              <button
                id="dev-utils-process-btn"
                onClick={() => b64Mode.startsWith('json') ? handleJSONFormat(b64Mode === 'json_minify') : handleBase64Convert()}
                style={{
                  padding: '10px',
                  borderRadius: 'var(--border-radius-sm)',
                  border: 'none',
                  background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '13px'
                }}
              >
                Process Output
              </button>

              {/* Output & Error */}
              {(jsonError || b64Error) && (
                <div style={{ fontSize: '12px', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239,68,68,0.2)', padding: '10px', borderRadius: 'var(--border-radius-sm)' }}>
                  {jsonError || b64Error}
                </div>
              )}

              {/* Output Display */}
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>OUTPUT</label>
                <textarea
                  id="dev-output-textarea"
                  rows={5}
                  value={b64Mode.startsWith('json') ? jsonOutput : b64Output}
                  readOnly
                  placeholder="Processed output will display here..."
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', background: 'var(--input-bg)' }}
                />
              </div>

            </div>
          </div>

          {/* Epoch Timestamp Converter */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderLeft: '3px solid var(--secondary)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, borderBottom: '1px solid var(--card-border)', paddingBottom: '10px', color: 'var(--text-primary)' }}>
              {t('DevEpoch') || 'Unix Epoch Converter'}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Epoch input */}
              <div>
                <label htmlFor="epoch-val-input" style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                  Unix Timestamp (seconds or ms)
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    id="epoch-val-input"
                    type="text"
                    value={epochInput}
                    onChange={(e) => setEpochInput(e.target.value)}
                    style={{ fontFamily: 'var(--font-mono)' }}
                  />
                  <button
                    id="convert-epoch-btn"
                    onClick={() => handleEpochConvert('to_date')}
                    style={{
                      padding: '0 14px',
                      borderRadius: 'var(--border-radius-sm)',
                      border: '1px solid var(--input-border)',
                      background: 'var(--input-bg)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 600
                    }}
                  >
                    &rarr; Date
                  </button>
                </div>
              </div>

              {/* Date Input */}
              <div>
                <label htmlFor="epoch-date-input" style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                  ISO Date String / Calendar Date
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    id="epoch-date-input"
                    type="text"
                    value={dateInput}
                    onChange={(e) => setDateInput(e.target.value)}
                    style={{ fontFamily: 'var(--font-mono)' }}
                  />
                  <button
                    id="convert-date-btn"
                    onClick={() => handleEpochConvert('to_epoch')}
                    style={{
                      padding: '0 14px',
                      borderRadius: 'var(--border-radius-sm)',
                      border: '1px solid var(--input-border)',
                      background: 'var(--input-bg)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 600
                    }}
                  >
                    &rarr; Epoch
                  </button>
                </div>
              </div>

              {/* Current Time shortcut */}
              <button
                id="epoch-now-btn"
                onClick={() => handleEpochConvert('now')}
                style={{
                  padding: '10px',
                  borderRadius: 'var(--border-radius-sm)',
                  border: '1px dashed var(--secondary)',
                  background: 'rgba(236, 72, 153, 0.05)',
                  color: 'var(--secondary)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600
                }}
              >
                Set Current Timestamp
              </button>

              {/* Result display */}
              <div style={{ 
                marginTop: '10px',
                background: 'var(--input-bg)', 
                border: '1px solid var(--input-border)',
                borderRadius: 'var(--border-radius-sm)',
                padding: '14px',
                minHeight: '80px',
                fontSize: '12.5px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-primary)',
                whiteSpace: 'pre-line',
                lineHeight: '1.6'
              }}>
                {epochResult}
              </div>

            </div>
          </div>

        </div>
      )}

    </div>
  );
}

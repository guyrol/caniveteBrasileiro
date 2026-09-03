'use client';

import React, { useState } from 'react';
import { useAuth } from './AuthProvider';
import { useTranslation } from 'react-i18next';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const { t } = useTranslation();
  const { login, register } = useAuth();
  
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    
    if (!username.trim() || !password.trim()) {
      setErrorMsg(t('Missing fields') || 'Please fill in all fields');
      return;
    }

    if (isRegister && !name.trim()) {
      setErrorMsg(t('Missing fields') || 'Please fill in all fields');
      return;
    }

    setSubmitting(true);
    try {
      if (isRegister) {
        const res = await register(name, username, password);
        if (res.success) {
          onClose();
        } else {
          setErrorMsg(res.error || 'Registration failed');
        }
      } else {
        const res = await login(username, password);
        if (res.success) {
          onClose();
        } else {
          setErrorMsg(res.error || 'Login failed');
        }
      }
    } catch (err) {
      setErrorMsg('An unexpected error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSwitchMode = () => {
    setIsRegister(!isRegister);
    setErrorMsg('');
    setName('');
    setUsername('');
    setPassword('');
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: 'rgba(0, 0, 0, 0.6)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      animation: 'fadeIn var(--transition-fast) forwards'
    }} onClick={onClose}>
      
      {/* Modal Card Content */}
      <div className="glass-card" style={{
        maxWidth: '420px',
        width: '100%',
        margin: '16px',
        padding: '32px',
        border: '1px solid var(--card-hover-border)',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
        animation: 'fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        position: 'relative'
      }} onClick={(e) => e.stopPropagation()}>
        
        {/* Close Button */}
        <button
          id="auth-modal-close"
          onClick={onClose}
          style={{
            position: 'absolute',
            right: '16px',
            top: '16px',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all var(--transition-fast)'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.color = 'var(--text-primary)';
            e.currentTarget.style.background = 'var(--input-bg)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.color = 'var(--text-muted)';
            e.currentTarget.style.background = 'none';
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Modal Title */}
        <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)', textAlign: 'center' }}>
          {isRegister ? t('AuthRegisterTitle') || 'Create Account' : t('AuthLoginTitle') || 'Access Account'}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'center', marginBottom: '24px' }}>
          {isRegister ? t('AuthRegisterDesc') || 'Register to unlock secret tools and sync history.' : t('AuthLoginDesc') || 'Sign in to access your tools and sync logs.'}
        </p>

        {/* Error Alert */}
        {errorMsg && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: 'var(--border-radius-sm)',
            padding: '10px 12px',
            marginBottom: '16px',
            color: 'var(--danger)',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Name field (Only register) */}
          {isRegister && (
            <div>
              <label htmlFor="auth-name-input" style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block', fontWeight: 500 }}>
                {t('AuthNameLabel') || 'Name'}
              </label>
              <input
                id="auth-name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. John Doe"
                required
              />
            </div>
          )}

          {/* Username field */}
          <div>
            <label htmlFor="auth-username-input" style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block', fontWeight: 500 }}>
              {t('AuthUsernameLabel') || 'Username'}
            </label>
            <input
              id="auth-username-input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. johndoe"
              required
              autoCapitalize="none"
            />
          </div>

          {/* Password field */}
          <div>
            <label htmlFor="auth-password-input" style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block', fontWeight: 500 }}>
              {t('AuthPasswordLabel') || 'Password'}
            </label>
            <input
              id="auth-password-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {/* Submit Button */}
          <button
            id="auth-submit-btn"
            type="submit"
            disabled={submitting}
            style={{
              marginTop: '8px',
              padding: '12px',
              borderRadius: 'var(--border-radius-sm)',
              border: 'none',
              background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
              color: 'white',
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              boxShadow: submitting ? 'none' : '0 4px 14px var(--primary-glow)',
              transition: 'all var(--transition-fast)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              opacity: submitting ? 0.7 : 1
            }}
          >
            {submitting ? (
              <span style={{ border: '2px solid transparent', borderTopColor: 'white', borderRadius: '50%', width: '16px', height: '16px', animation: 'fadeIn 1s infinite linear' }} />
            ) : (
              isRegister ? t('AuthRegisterBtn') || 'Register' : t('AuthLoginBtn') || 'Login'
            )}
          </button>

          {/* Toggle form link */}
          <div style={{ marginTop: '8px', textAlign: 'center' }}>
            <button
              id="auth-toggle-mode"
              type="button"
              onClick={handleSwitchMode}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                transition: 'color var(--transition-fast)'
              }}
              onMouseOver={(e) => e.currentTarget.style.color = 'var(--primary-hover)'}
              onMouseOut={(e) => e.currentTarget.style.color = 'var(--primary)'}
            >
              {isRegister ? t('AuthHaveAccount') || 'Already have an account? Login' : t('AuthNeedAccount') || "Don't have an account? Sign up"}
            </button>
          </div>

        </form>

      </div>

    </div>
  );
}

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import SalaryCalculator from './SalaryCalculator';
import TimeCalculator from './TimeCalculator';
import CltPjCalculator from './CltPjCalculator';
import InstallmentsCalculator from './InstallmentsCalculator';
import FuelCalculator from './FuelCalculator';
import PixGenerator from './PixGenerator';
import CompoundInterest from './CompoundInterest';
import PercentageCalculator from './PercentageCalculator';
import PdfSplitter from './PdfSplitter';
import PdfToImage from './PdfToImage';
import SecureVault from './SecureVault';
import { useAuth } from './AuthProvider';
import LoginModal from './LoginModal';

interface HistoryItem {
  id: string;
  type: 'salary' | 'time' | 'notes';
  timestamp: string;
  label: string;
  data: any;
}

type CategoryType = 'dashboard' | 'finance' | 'files' | 'utils' | 'vault';
type TabType = 'dashboard' | 'salary' | 'cltpj' | 'installments' | 'compound' | 'time' | 'fuel' | 'pix' | 'percentage' | 'pdf' | 'pdf-split' | 'pdf-to-image' | 'vault';

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  
  // Navigation states
  const [activeCategory, setActiveCategory] = useState<CategoryType>('dashboard');
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [greeting, setGreeting] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  
  // Shared state
  const [sharedHourlyRate, setSharedHourlyRate] = useState(50);
  const [loadedSalaryData, setLoadedSalaryData] = useState<any | null>(null);
  const [loadedTimeData, setLoadedTimeData] = useState<any | null>(null);

  // Sync theme with HTML attribute
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
  }, [theme]);

  // Load history from DB (if logged in) or LocalStorage (if logged out)
  const loadHistory = async () => {
    if (user) {
      try {
        const res = await fetch('/api/history');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.history) {
            setHistory(data.history);
            return;
          }
        }
      } catch (e) {
        console.error('Failed to load database history', e);
      }
    }

    // Local storage fallback
    const saved = localStorage.getItem('canivete_calc_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    } else {
      setHistory([]);
    }
  };

  // Sync history when user changes, and listen for updates
  useEffect(() => {
    loadHistory();
    window.addEventListener('storage', loadHistory);
    return () => {
      window.removeEventListener('storage', loadHistory);
    };
  }, [user]);

  // Determine greeting based on time of day
  useEffect(() => {
    const hr = new Date().getHours();
    let key = '';
    if (hr < 12) {
      key = i18n.language === 'pt' ? 'Bom dia' : 'Good morning';
    } else if (hr < 18) {
      key = i18n.language === 'pt' ? 'Boa tarde' : 'Good afternoon';
    } else {
      key = i18n.language === 'pt' ? 'Boa noite' : 'Good evening';
    }
    setGreeting(key);
  }, [activeTab, i18n.language]);

  // Handle switching language
  const toggleLanguage = () => {
    const nextLang = i18n.language === 'pt' ? 'en' : 'pt';
    i18n.changeLanguage(nextLang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('i18nextLng', nextLang);
    }
  };

  // Handle history item action: delete
  const handleDeleteHistory = async (id: string) => {
    if (user) {
      try {
        await fetch(`/api/history?id=${id}`, { method: 'DELETE' });
      } catch (e) {
        console.error('Failed to delete history item', e);
      }
    }
    
    const updated = history.filter(item => item.id !== id);
    setHistory(updated);
    localStorage.setItem('canivete_calc_history', JSON.stringify(updated));
  };

  // Handle history item action: load
  const handleLoadHistory = (item: HistoryItem) => {
    if (item.type === 'salary') {
      const { annualBase, hoursPerDay, daysPerWeek, weeksPerYear } = item.data;
      const weeklyHours = hoursPerDay * daysPerWeek;
      const hourly = annualBase / (weeklyHours * weeksPerYear);
      
      setSharedHourlyRate(hourly);
      setLoadedSalaryData(item.data);
      setActiveCategory('finance');
      setActiveTab('salary');
    } else if (item.type === 'time') {
      if (item.data.billingRate) {
        setSharedHourlyRate(item.data.billingRate);
      }
      setLoadedTimeData(item.data);
      setActiveCategory('utils');
      setActiveTab('time');
    }
  };

  // Clear all history
  const handleClearHistory = async () => {
    if (confirm(i18n.language === 'pt' ? 'Deseja limpar todo o histórico?' : 'Clear all history?')) {
      if (user) {
        try {
          await fetch('/api/history?clearAll=true', { method: 'DELETE' });
        } catch (e) {
          console.error('Failed to clear history database', e);
        }
      }
      setHistory([]);
      localStorage.removeItem('canivete_calc_history');
    }
  };

  // Helper to format date
  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    const locale = i18n.language === 'pt' ? 'pt-BR' : 'en-US';
    return date.toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Filter history to hide private notes
  const visibleHistory = useMemo(() => {
    return history.filter(item => item.type !== 'notes');
  }, [history]);

  // Handle Category click
  const handleCategorySelect = (category: CategoryType) => {
    setActiveCategory(category);
    if (category === 'dashboard') {
      setActiveTab('dashboard');
    } else if (category === 'finance') {
      setActiveTab('salary'); // default sub-tab
    } else if (category === 'files') {
      setActiveTab('pdf-split'); // default sub-tab
    } else if (category === 'utils') {
      setActiveTab('time'); // default sub-tab
    } else if (category === 'vault') {
      setActiveTab('vault');
    }
  };

  return (
    <div style={{ maxWidth: '1200px', width: '100%', margin: '0 auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '24px', flexGrow: 1 }}>
      
      {/* Top Header Navigation Bar */}
      <header className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', flexWrap: 'wrap', gap: '16px' }}>
        
        {/* Brand logo & title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => handleCategorySelect('dashboard')}>
          <div style={{
            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px var(--primary-glow)',
            color: 'white',
            fontWeight: 800,
            fontSize: '20px'
          }}>
            CB
          </div>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 700, background: 'linear-gradient(135deg, var(--text-primary), var(--text-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {t('AppName')}
            </h1>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>
              v2.0.0
            </span>
          </div>
        </div>

        {/* Category Navigation (Bar 1) */}
        <nav style={{ display: 'flex', background: 'var(--input-bg)', borderRadius: 'var(--border-radius-sm)', padding: '4px', gap: '4px', border: '1px solid var(--input-border)' }}>
          {[
            { id: 'dashboard', label: t('TabDashboard') },
            { id: 'finance', label: i18n.language === 'pt' ? 'Finanças' : 'Finance' },
            { id: 'files', label: i18n.language === 'pt' ? 'Arquivos' : 'Files' },
            { id: 'utils', label: i18n.language === 'pt' ? 'Utilidades' : 'Utilities' },
            ...(user ? [{ id: 'vault', label: i18n.language === 'pt' ? 'Cofre' : 'Vault' }] : [])
          ].map((cat) => (
            <button
              key={cat.id}
              id={`cat-nav-${cat.id}`}
              onClick={() => handleCategorySelect(cat.id as CategoryType)}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                background: activeCategory === cat.id ? 'var(--bg-color)' : 'transparent',
                color: activeCategory === cat.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: activeCategory === cat.id ? 600 : 400,
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                fontSize: '13px'
              }}
            >
              {cat.label}
            </button>
          ))}
        </nav>

        {/* Settings, Language, Login & Theme */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          
          {/* User auth panel */}
          {user ? (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              padding: '6px 12px', 
              background: 'var(--input-bg)', 
              border: '1px solid var(--input-border)', 
              borderRadius: 'var(--border-radius-sm)' 
            }}>
              <span style={{ 
                width: '22px', 
                height: '22px', 
                borderRadius: '50%', 
                background: 'linear-gradient(135deg, var(--primary), var(--secondary))', 
                color: 'white', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                fontSize: '11px', 
                fontWeight: 800 
              }}>
                {user.name.charAt(0).toUpperCase()}
              </span>
              <span style={{ fontSize: '12.5px', color: 'var(--text-primary)', fontWeight: 600, display: 'inline-block', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.username}
              </span>
              <button 
                id="header-logout-btn"
                onClick={() => {
                  logout();
                  handleCategorySelect('dashboard');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 600,
                  transition: 'color var(--transition-fast)'
                }}
                onMouseOver={(e) => e.currentTarget.style.color = 'var(--danger)'}
                onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                Exit
              </button>
            </div>
          ) : (
            <button
              id="header-login-btn"
              onClick={() => setIsLoginOpen(true)}
              style={{
                padding: '8px 14px',
                borderRadius: 'var(--border-radius-sm)',
                border: 'none',
                background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
                color: 'white',
                cursor: 'pointer',
                fontSize: '12.5px',
                fontWeight: 600,
                boxShadow: '0 2px 8px var(--primary-glow)',
                transition: 'all var(--transition-fast)'
              }}
            >
              Login
            </button>
          )}

          {/* Language Selector */}
          <button
            id="lang-toggle-btn"
            onClick={toggleLanguage}
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--border-radius-sm)',
              border: '1px solid var(--input-border)',
              background: 'var(--input-bg)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {i18n.language === 'pt' ? 'EN' : 'PT'}
          </button>

          {/* Theme Selector */}
          <button
            id="theme-toggle-btn"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            style={{
              padding: '8px',
              borderRadius: 'var(--border-radius-sm)',
              border: '1px solid var(--input-border)',
              background: 'var(--input-bg)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {theme === 'dark' ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Sub-Header Navigation Bar (Bar 2 - only shown for categories with multiple tools) */}
      {activeCategory !== 'dashboard' && activeCategory !== 'vault' && (
        <div className="glass-card animate-fade-in" style={{ padding: '10px 24px', display: 'flex', gap: '10px', flexWrap: 'wrap', background: 'rgba(255, 255, 255, 0.02)' }}>
          {activeCategory === 'finance' && [
            { id: 'salary', label: t('TabSalary') },
            { id: 'cltpj', label: t('TabCltPj') },
            { id: 'installments', label: t('TabInstallments') },
            { id: 'compound', label: t('TabCompound') }
          ].map((tab) => (
            <button
              key={tab.id}
              id={`sub-tab-btn-${tab.id}`}
              onClick={() => setActiveTab(tab.id as TabType)}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--border-radius-sm)',
                border: '1px solid',
                borderColor: activeTab === tab.id ? 'var(--primary)' : 'var(--input-border)',
                background: activeTab === tab.id ? 'rgba(99, 102, 241, 0.12)' : 'var(--input-bg)',
                color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: activeTab === tab.id ? 600 : 400,
                cursor: 'pointer',
                fontSize: '12.5px',
                transition: 'all var(--transition-fast)'
              }}
            >
              {tab.label}
            </button>
          ))}

          {activeCategory === 'files' && [
            { id: 'pdf-split', label: t('TabPdfSplit') },
            { id: 'pdf-to-image', label: t('TabPdfToImage') }
          ].map((tab) => (
            <button
              key={tab.id}
              id={`sub-tab-btn-${tab.id}`}
              onClick={() => setActiveTab(tab.id as TabType)}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--border-radius-sm)',
                border: '1px solid',
                borderColor: (activeTab === tab.id || (activeTab === 'pdf' && tab.id === 'pdf-split')) ? 'var(--accent)' : 'var(--input-border)',
                background: (activeTab === tab.id || (activeTab === 'pdf' && tab.id === 'pdf-split')) ? 'rgba(16, 185, 129, 0.12)' : 'var(--input-bg)',
                color: (activeTab === tab.id || (activeTab === 'pdf' && tab.id === 'pdf-split')) ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: (activeTab === tab.id || (activeTab === 'pdf' && tab.id === 'pdf-split')) ? 600 : 400,
                cursor: 'pointer',
                fontSize: '12.5px',
                transition: 'all var(--transition-fast)'
              }}
            >
              {tab.label}
            </button>
          ))}

          {activeCategory === 'utils' && [
            { id: 'time', label: t('TabTime') },
            { id: 'fuel', label: t('TabFuel') },
            { id: 'pix', label: t('TabPix') },
            { id: 'percentage', label: i18n.language === 'pt' ? 'Porcentagem' : 'Percentage' }
          ].map((tab) => (
            <button
              key={tab.id}
              id={`sub-tab-btn-${tab.id}`}
              onClick={() => setActiveTab(tab.id as TabType)}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--border-radius-sm)',
                border: '1px solid',
                borderColor: activeTab === tab.id ? 'var(--secondary)' : 'var(--input-border)',
                background: activeTab === tab.id ? 'rgba(236, 72, 153, 0.12)' : 'var(--input-bg)',
                color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: activeTab === tab.id ? 600 : 400,
                cursor: 'pointer',
                fontSize: '12.5px',
                transition: 'all var(--transition-fast)'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Main Content Area */}
      <main style={{ minHeight: '400px' }}>
        
        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Hero Greeting card */}
            <div className="glass-card animate-pulse-border" style={{ 
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(236, 72, 153, 0.05))',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '24px 32px',
              flexWrap: 'wrap',
              gap: '16px'
            }}>
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '6px', color: 'var(--text-primary)' }}>
                  {greeting}, {user ? user.name : (i18n.language === 'pt' ? 'Visitante' : 'Guest')}!
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '600px', lineHeight: '1.6' }}>
                  {t('AppSubtitle')}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  id="hero-pdf-to-img-btn"
                  onClick={() => {
                    setActiveCategory('files');
                    setActiveTab('pdf-to-image');
                  }}
                  style={{
                    padding: '10px 18px',
                    borderRadius: 'var(--border-radius-sm)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(99, 102, 241, 0.15))',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.15)'
                  }}
                >
                  <span style={{ fontSize: '15px' }}>🖼️</span>
                  {t('TabPdfToImage')}
                  <span style={{ fontSize: '10px', background: 'var(--accent)', color: 'white', padding: '1px 6px', borderRadius: '10px', fontWeight: 700 }}>
                    NEW
                  </span>
                </button>
                <button
                  type="button"
                  id="hero-pdf-splitter-btn"
                  onClick={() => {
                    setActiveCategory('files');
                    setActiveTab('pdf-split');
                  }}
                  style={{
                    padding: '10px 18px',
                    borderRadius: 'var(--border-radius-sm)',
                    border: '1px solid rgba(236, 72, 153, 0.3)',
                    background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.15), rgba(99, 102, 241, 0.15))',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <span style={{ fontSize: '15px' }}>✂️</span>
                  {t('TabPdfSplit')}
                </button>
              </div>
            </div>

            {/* Showcase Quick Navigation Cards by category */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
              
              {/* Finance Category Card */}
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', cursor: 'pointer' }} onClick={() => handleCategorySelect('finance')}>
                <div style={{ background: 'rgba(99, 102, 241, 0.1)', width: '38px', height: '38px', borderRadius: '10px', display: 'flex', alignItems: 'center', color: 'var(--primary)', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {i18n.language === 'pt' ? 'Finanças & Ganhos' : 'Finance & Earnings'}
                  </h3>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    {i18n.language === 'pt' 
                      ? 'Calculadora de salário, comparativo CLT x PJ, juros de parcelas e simulador de juros compostos.'
                      : 'Salary converter, CLT vs PJ comparison, installment interest, and compound interest.'}
                  </p>
                </div>
              </div>

              {/* Files Category Card (NEW) */}
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', cursor: 'pointer' }} onClick={() => handleCategorySelect('files')}>
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', width: '38px', height: '38px', borderRadius: '10px', display: 'flex', alignItems: 'center', color: 'var(--accent)', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <circle cx="10" cy="13" r="1.5" />
                    <path d="M14 17l-3-3-3 3" />
                  </svg>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                      {i18n.language === 'pt' ? 'Arquivos & PDFs' : 'Files & PDFs'}
                    </h3>
                    <span style={{ fontSize: '10px', background: 'rgba(16, 185, 129, 0.2)', color: 'var(--accent)', padding: '1px 6px', borderRadius: '8px', fontWeight: 700 }}>
                      NEW
                    </span>
                  </div>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    {i18n.language === 'pt'
                      ? 'Studio PDF para Imagem/Wallpaper em Ultra HD 4K e Divisor de PDFs em pedaços.'
                      : 'PDF to Image/Wallpaper studio in Ultra HD 4K and PDF chunk splitter.'}
                  </p>
                </div>
              </div>

              {/* Utilities Category Card */}
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', cursor: 'pointer' }} onClick={() => handleCategorySelect('utils')}>
                <div style={{ background: 'rgba(236, 72, 153, 0.1)', width: '38px', height: '38px', borderRadius: '10px', display: 'flex', alignItems: 'center', color: 'var(--secondary)', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {i18n.language === 'pt' ? 'Utilidades Diárias' : 'Daily Utilities'}
                  </h3>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    {i18n.language === 'pt' 
                      ? 'Somador de horas, calculadora de combustível, gerador de Pix e porcentagem rápida.'
                      : 'Time accumulator, fuel & trip cost, Pix generator, and quick percentage.'}
                  </p>
                </div>
              </div>

              {/* Secure Vault Card */}
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', cursor: 'pointer' }} onClick={() => user ? handleCategorySelect('vault') : setIsLoginOpen(true)}>
                <div style={{ 
                  background: user ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.05)', 
                  width: '38px', 
                  height: '38px', 
                  borderRadius: '10px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  color: user ? 'var(--accent)' : 'var(--text-muted)',
                  justifyContent: 'center'
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {t('VaultTitle')}
                  </h3>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    {user ? 'Seu cofre está liberado. Acesse geradores de senhas, notas e conversores Epoch/Base64.' : 'Bloqueado. Faça login para guardar anotações seguras, gerar chaves e usar utilitários dev.'}
                  </p>
                </div>
              </div>

            </div>

            {/* Calculations History Logs List */}
            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--card-border)', paddingBottom: '14px', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 8v4l3 3" /><path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5" />
                  </svg>
                  {t('CalculationHistory')}
                  {user && (
                    <span style={{ fontSize: '11px', color: 'var(--accent)', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '12px', fontWeight: 500 }}>
                      Cloud Sync
                    </span>
                  )}
                </h3>
                {visibleHistory.length > 0 && (
                  <button
                    id="clear-history-btn"
                    onClick={handleClearHistory}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--danger)',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 600
                    }}
                  >
                    {t('ClearHistory')}
                  </button>
                )}
              </div>

              {visibleHistory.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '32px 0' }}>
                  {t('NoHistory')}
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {visibleHistory.map((item) => (
                    <div 
                      key={item.id} 
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'rgba(255, 255, 255, 0.01)',
                        border: '1px solid var(--input-border)',
                        borderRadius: 'var(--border-radius-sm)',
                        padding: '12px 16px',
                        flexWrap: 'wrap',
                        gap: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          background: item.type === 'salary' ? 'rgba(99, 102, 241, 0.1)' : 'rgba(236, 72, 153, 0.1)',
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: item.type === 'salary' ? 'var(--primary)' : 'var(--secondary)'
                        }}>
                          {item.type === 'salary' ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                            </svg>
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10" />
                              <polyline points="12 6 12 12 16 14" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                            {item.label}
                          </p>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {formatDate(item.timestamp)}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          id={`history-load-${item.id}`}
                          onClick={() => handleLoadHistory(item)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '4px',
                            border: '1px solid var(--input-border)',
                            background: 'var(--input-bg)',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 600,
                            transition: 'all var(--transition-fast)'
                          }}
                        >
                          {t('Load')}
                        </button>
                        <button
                          id={`history-delete-${item.id}`}
                          onClick={() => handleDeleteHistory(item.id)}
                          style={{
                            padding: '6px 8px',
                            borderRadius: '4px',
                            border: 'none',
                            background: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            transition: 'all var(--transition-fast)'
                          }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* FINANCE CALCULATORS RENDERING */}
        {activeCategory === 'finance' && (
          <div>
            {activeTab === 'salary' && (
              <SalaryCalculator 
                onHourlyRateChange={(rate) => setSharedHourlyRate(rate)} 
                initialHourlyRate={sharedHourlyRate}
                loadedData={loadedSalaryData}
                onClearLoadedData={() => setLoadedSalaryData(null)}
              />
            )}
            {activeTab === 'cltpj' && <CltPjCalculator />}
            {activeTab === 'installments' && <InstallmentsCalculator />}
            {activeTab === 'compound' && <CompoundInterest />}
          </div>
        )}

        {/* FILES CATEGORY TOOLS RENDERING */}
        {activeCategory === 'files' && (
          <div>
            {(activeTab === 'pdf-split' || activeTab === 'pdf') && <PdfSplitter />}
            {activeTab === 'pdf-to-image' && <PdfToImage />}
          </div>
        )}

        {/* UTILITY TOOLS RENDERING */}
        {activeCategory === 'utils' && (
          <div>
            {activeTab === 'time' && (
              <TimeCalculator 
                defaultHourlyRate={sharedHourlyRate}
                loadedData={loadedTimeData}
                onClearLoadedData={() => setLoadedTimeData(null)}
              />
            )}
            {activeTab === 'fuel' && <FuelCalculator />}
            {activeTab === 'pix' && <PixGenerator />}
            {activeTab === 'percentage' && <PercentageCalculator />}
            {activeTab === 'pdf' && <PdfSplitter />}
          </div>
        )}

        {/* SECURE DEV VAULT TAB */}
        {activeCategory === 'vault' && activeTab === 'vault' && user && (
          <SecureVault />
        )}

      </main>

      {/* Footer */}
      <footer style={{ marginTop: 'auto', borderTop: '1px solid var(--card-border)', paddingTop: '24px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
          &copy; {new Date().getFullYear()} {t('AppName')}. {i18n.language === 'pt' ? 'Ferramentas rápidas para o dia a dia.' : 'Essential everyday utilities.'}
        </p>
      </footer>

      {/* Glassmorphic Login/Register modal */}
      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />

    </div>
  );
}

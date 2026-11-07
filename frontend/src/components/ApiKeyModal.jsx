import React, { useState, useEffect } from 'react';
import { Key, X, CheckCircle, Sparkles, ShieldCheck } from 'lucide-react';

export default function ApiKeyModal({ isOpen, onClose, apiKey, onSaveKey }) {
  const [inputVal, setInputVal] = useState(apiKey || '');
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    setInputVal(apiKey || '');
  }, [apiKey, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSave = (e) => {
    e.preventDefault();
    onSaveKey(inputVal.trim());
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  const handleClear = () => {
    setInputVal('');
    onSaveKey('');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: '#eef2ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#4f46e5'
            }}>
              <Key size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>Gemini API Settings</h3>
              <p style={{ fontSize: '0.78rem', color: '#64748b' }}>Unlock deep AI architecture explanations and Q&A</p>
            </div>
          </div>
          <button className="control-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave}>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.5rem' }}>
              Gemini API Key
            </label>
            <input
              type="password"
              placeholder="AIzaSy..."
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              className="chat-input"
              style={{ width: '100%', fontFamily: 'monospace', background: '#f8fafc', border: '1px solid var(--border-subtle)', color: '#0f172a' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', marginTop: '0.6rem', fontSize: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#16a34a' }}>
                <ShieldCheck size={14} color="#16a34a" />
                <span>In-memory only: Never saved to disk or localStorage.</span>
              </div>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#4f46e5', textDecoration: 'none', fontWeight: 500 }}
              >
                Get a free key from Google AI Studio &rarr;
              </a>
            </div>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid var(--border-subtle)', padding: '0.85rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.8rem', color: '#475569', lineHeight: 1.5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#4f46e5', fontWeight: 600, marginBottom: '0.3rem' }}>
              <Sparkles size={14} /> Zero-Storage Ephemeral Policy
            </div>
            Your Gemini API Key is held strictly in volatile RAM memory for this tab session. It is never logged, never stored on disk, and is instantly cleared as soon as you close or reload this page.
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            {apiKey && (
              <button type="button" onClick={handleClear} className="btn-secondary" style={{ color: '#f43f5e' }}>
                Clear Key
              </button>
            )}
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              {savedSuccess ? (
                <>
                  <CheckCircle size={16} /> Applied!
                </>
              ) : (
                'Apply Key (In-Memory)'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

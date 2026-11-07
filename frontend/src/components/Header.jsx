import React, { useState, useEffect } from 'react';
import {
  Layers,
  Sparkles,
  FolderCode,
  Key,
  ArrowRight,
  Loader2,
  FolderUp,
  X,
  Database,
  Shield,
  BookOpen
} from 'lucide-react';

export default function Header({
  repoPath,
  repoName,
  onScan,
  onCloneGit,
  onOpenSourceModal,
  onOpenSavedProjectsModal,
  onCloseWorkspace,
  loading,
  apiKey,
  onOpenApiKeyModal,
  onOpenSupabaseModal,
  supabaseUser
}) {
  const [localInput, setLocalInput] = useState(repoPath || '');

  useEffect(() => {
    if (repoPath) {
      setLocalInput(repoPath);
    }
  }, [repoPath]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const val = localInput.trim();
    if (!val) return;

    // Smart detect: if user pastes a git URL (http://, https://, or git@)
    if (val.startsWith('http://') || val.startsWith('https://') || val.startsWith('git@') || val.includes('github.com')) {
      onCloneGit(val);
    } else {
      onScan(val);
    }
  };

  return (
    <header className="app-header">
      {/* Brand Section */}
      <div className="brand-section">
        <div className="brand-logo-badge">
          <Layers size={22} />
        </div>
        <div>
          <div className="brand-title">Project Explainer</div>
          <div className="brand-subtitle">Architecture & Code Intelligence</div>
        </div>
      </div>

      {/* Main Action Bar */}
      <div className="header-center-actions">
        {/* Open Project Modal Trigger */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button
            type="button"
            onClick={onOpenSourceModal}
            className="btn-open-project"
            title="Upload folder, clone Git repo, or unpack ZIP"
          >
            <FolderUp size={16} color="#4f46e5" />
            <span className="open-project-btn-label">Open / Ingest</span>
            {repoName && <span className="active-repo-badge">{repoName}</span>}
          </button>

          <button
            type="button"
            onClick={onOpenSavedProjectsModal}
            className="btn-study-saved"
            title="Access and study previously uploaded documents and projects from your Supabase database"
          >
            <BookOpen size={16} color="#16a34a" />
            <span className="open-project-btn-label">Study Saved</span>
          </button>

          {repoName && onCloseWorkspace && (
            <button
              type="button"
              onClick={onCloseWorkspace}
              className="btn-study-saved"
              title="Remove / Close active workspace"
              style={{
                padding: '0.45rem',
                minWidth: 'unset',
                color: '#16a34a',
                borderColor: '#bbf7d0'
              }}
            >
              <X size={14} color="#16a34a" />
            </button>
          )}
        </div>

        {/* Quick input bar (supports local paths or Git URLs) */}
        <form className="repo-scan-bar" onSubmit={handleSubmit}>
          <FolderCode size={17} color="#94a3b8" />
          <input
            type="text"
            className="repo-input"
            placeholder="Paste local folder path or Git repo link (https://github.com/...)..."
            value={localInput}
            onChange={(e) => setLocalInput(e.target.value)}
            disabled={loading}
          />

          <button type="submit" className="btn-primary" disabled={loading || !localInput.trim()}>
            {loading ? (
              <>
                <Loader2 size={15} className="spin-animation" />
                <span>Scanning...</span>
              </>
            ) : (
              <>
                <span>Scan</span>
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>
      </div>

      {/* Right Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {/* Supabase Cloud Connect Pill */}
        <button
          type="button"
          onClick={onOpenSupabaseModal}
          className={`api-key-badge ${supabaseUser ? 'connected' : 'heuristic'}`}
          title={supabaseUser ? `Private Supabase Active (${supabaseUser.email})` : 'Connect Your Private Supabase Database'}
          style={{ cursor: 'pointer', fontFamily: 'inherit' }}
        >
          {supabaseUser ? <Shield size={13} color="#16a34a" /> : <Database size={13} color="#d97706" />}
          <span>{supabaseUser ? 'Private DB Active' : 'Connect Your Supabase'}</span>
        </button>

        <button
          type="button"
          onClick={onOpenApiKeyModal}
          className={`api-key-badge ${apiKey ? 'connected' : 'heuristic'}`}
          title={apiKey ? 'Gemini API Key active (Click to manage key)' : 'Click to provide your own Gemini API Key for AI reasoning'}
          style={{ cursor: 'pointer', fontFamily: 'inherit' }}
        >
          {apiKey ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
              <Sparkles size={13} color="#16a34a" />
            </div>
          ) : (
            <Key size={13} color="#d97706" />
          )}
          <span>{apiKey ? 'Gemini AI Active' : 'Enter Gemini Key'}</span>
        </button>
      </div>
    </header>
  );
}

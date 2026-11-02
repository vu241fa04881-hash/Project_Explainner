import React, { useState, useEffect } from 'react';
import {
  Database,
  Cloud,
  CheckCircle2,
  AlertCircle,
  X,
  LogIn,
  UserPlus,
  LogOut,
  Loader2,
  KeyRound,
  ShieldCheck,
  Shield,
  UploadCloud,
  Copy,
  Check,
  RotateCcw,
  ExternalLink,
  Lock
} from 'lucide-react';
import {
  getSupabaseCredentials,
  isSupabaseConfigured,
  normalizeSupabaseUrl,
  saveCustomSupabaseCredentials,
  resetSupabaseCredentials,
  testSupabaseConnection,
  signInWithEmail,
  signUpWithEmail,
  signOut,
  getCurrentUser,
  saveProjectScan
} from '../lib/supabaseClient';

export default function SupabaseAuthModal({
  isOpen,
  onClose,
  activeScanData,
  onSyncSuccess
}) {
  const [supabaseUrlInput, setSupabaseUrlInput] = useState('');
  const [anonKeyInput, setAnonKeyInput] = useState('');
  const [isCustomDatabase, setIsCustomDatabase] = useState(false);
  const [authMode, setAuthMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(null);
  const [syncIncludeFiles, setSyncIncludeFiles] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [copiedSql, setCopiedSql] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const creds = getSupabaseCredentials();
      setSupabaseUrlInput(creds.url);
      setAnonKeyInput(creds.key || '');
      setIsCustomDatabase(creds.isCustom);
      setErrorMsg('');
      setSuccessMsg('');
      setSyncProgress(null);
      checkUser();
    }
  }, [isOpen]);

  const checkUser = async () => {
    try {
      const user = await getCurrentUser();
      setCurrentUser(user);
    } catch {
      setCurrentUser(null);
    }
  };

  if (!isOpen) return null;

  const handleSaveConnection = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanUrl = normalizeSupabaseUrl(supabaseUrlInput);
    const cleanKey = anonKeyInput.trim();

    if (!cleanUrl) {
      setErrorMsg('Please enter a valid Supabase project URL (e.g. https://your-project.supabase.co).');
      return;
    }
    if (!cleanKey) {
      setErrorMsg('Please enter your Supabase public Anon Key.');
      return;
    }

    setTestingConnection(true);
    try {
      await testSupabaseConnection(cleanUrl, cleanKey);
      saveCustomSupabaseCredentials(cleanUrl, cleanKey);
      setSupabaseUrlInput(cleanUrl);
      setIsCustomDatabase(true);
      setSuccessMsg(`Successfully connected to your private Supabase database at ${cleanUrl}!`);
      await checkUser();
    } catch (err) {
      setErrorMsg(err.message || 'Connection test failed. Please verify URL and Anon Key.');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleResetDefault = () => {
    resetSupabaseCredentials();
    const creds = getSupabaseCredentials();
    setSupabaseUrlInput(creds.url);
    setAnonKeyInput(creds.key || '');
    setIsCustomDatabase(false);
    setCurrentUser(null);
    setSuccessMsg('Reset to default configuration.');
    setErrorMsg('');
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (authMode === 'signin') {
        const data = await signInWithEmail(email, password);
        setCurrentUser(data.user);
        setSuccessMsg(`Welcome back, ${data.user.email}! Connected to your personal database.`);
      } else {
        const data = await signUpWithEmail(email, password, fullName);
        if (data.session) {
          setCurrentUser(data.user);
          setSuccessMsg('Account created and signed into your personal database!');
        } else {
          setSuccessMsg('Account registered in your Supabase project! Please check your email to verify.');
        }
      }
    } catch (err) {
      setErrorMsg(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await signOut();
      setCurrentUser(null);
      setSuccessMsg('Signed out successfully.');
      setErrorMsg('');
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCloudSync = async () => {
    if (!activeScanData) {
      setErrorMsg('No active project scan loaded. Please scan a project first.');
      return;
    }
    setSyncing(true);
    setSyncProgress(null);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const result = await saveProjectScan({
        projectName: activeScanData.summary?.repo_name || activeScanData.repo_name || 'Project Scan',
        sourceType: activeScanData.summary?.source_type || 'folder',
        sourceUrl: activeScanData.summary?.repo_path || activeScanData.repo_path || '',
        scanData: activeScanData,
        syncFiles: syncIncludeFiles,
        onProgress: (current, total) => {
          setSyncProgress({ current, total });
        }
      });

      const filesMsg = result.syncedFilesCount
        ? ` and ${result.syncedFilesCount.toLocaleString()} project & data files persisted in your private Supabase!`
        : '!';

      setSuccessMsg(`Successfully stored "${result.project.name}"${filesMsg}`);
      if (onSyncSuccess) onSyncSuccess(result);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to sync scan to Supabase. Check if database tables are created.');
    } finally {
      setSyncing(false);
    }
  };

  const handleCopySchemaSql = () => {
    const sqlCode = `-- Run this in your Supabase Project SQL Editor to setup tables and RLS:
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    source_type TEXT NOT NULL DEFAULT 'folder',
    source_url TEXT,
    loc INTEGER DEFAULT 0,
    files_count INTEGER DEFAULT 0,
    data_files_count INTEGER DEFAULT 0,
    languages JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.project_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    summary TEXT,
    architecture_layers JSONB DEFAULT '{}'::jsonb,
    diagrams JSONB DEFAULT '{}'::jsonb,
    high_coupling_modules JSONB DEFAULT '[]'::jsonb,
    circular_dependencies JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.project_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    extension TEXT,
    file_category TEXT NOT NULL DEFAULT 'code',
    language TEXT,
    size_bytes BIGINT DEFAULT 0,
    loc INTEGER DEFAULT 0,
    content TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Enable Row-Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;

-- Baseline Policies
CREATE POLICY "Users view own profile" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users own projects" ON public.projects FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users own scans" ON public.project_scans FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users own files" ON public.project_files FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
`;
    navigator.clipboard.writeText(sqlCode);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const configured = isSupabaseConfigured();
  const totalFiles = activeScanData?.total_files || Object.keys(activeScanData?.files || {}).length;
  const dataFilesCount = activeScanData?.data_files_count || 0;
  const codeFilesCount = activeScanData?.code_files_count || (totalFiles - dataFilesCount);

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal-container"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '620px', width: '92%' }}
      >
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              backgroundColor: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38bdf8'
            }}>
              <Shield size={19} />
            </div>
            <div>
              <h2 className="modal-title" style={{ fontSize: '1.1rem', margin: 0 }}>
                Connect Your Personal Supabase
              </h2>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                Store projects &amp; data files exclusively in your own private database
              </div>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Feedback Messages */}
        {errorMsg && (
          <div style={{
            margin: '0.8rem 1.25rem 0',
            padding: '0.6rem 0.85rem',
            borderRadius: '6px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <AlertCircle size={15} />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div style={{
            margin: '0.8rem 1.25rem 0',
            padding: '0.6rem 0.85rem',
            borderRadius: '6px',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#34d399',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <CheckCircle2 size={15} />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="modal-body" style={{ padding: '1.25rem' }}>
          {/* Privacy & Zero-Storage Guarantee Banner */}
          <div style={{
            backgroundColor: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: '8px',
            padding: '0.75rem 0.95rem',
            marginBottom: '1.2rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.65rem'
          }}>
            <Lock size={16} color="#34d399" style={{ marginTop: '2px', flexShrink: 0 }} />
            <div style={{ fontSize: '0.78rem', color: '#cbd5e1', lineHeight: '1.45' }}>
              <strong style={{ color: '#34d399' }}>Zero-Storage Ephemeral Policy: </strong>
              Your Supabase Project URL and Anon Key are kept <strong>strictly in volatile browser RAM</strong>. They are <strong>never written to localStorage, cookies, or any server disk</strong>. All your codebase files and data are sent directly from your browser to your private database and are immediately cleared from memory when you close or reload this page.
            </div>
          </div>

          {/* Form to enter User's Custom Supabase URL & Key */}
          <form onSubmit={handleSaveConnection} style={{ marginBottom: '1.2rem' }}>
            <div style={{ marginBottom: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f1f5f9' }}>
                  Your Supabase Project URL or REST URL
                </label>
                {isCustomDatabase && (
                  <button
                    type="button"
                    onClick={handleResetDefault}
                    style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.72rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                    title="Clear in-memory credentials"
                  >
                    <RotateCcw size={11} /> Clear Credentials
                  </button>
                )}
              </div>
              <input
                type="text"
                required
                className="repo-input"
                placeholder="https://your-project-id.supabase.co"
                value={supabaseUrlInput}
                onChange={(e) => setSupabaseUrlInput(e.target.value)}
                style={{ width: '100%', fontSize: '0.85rem' }}
              />
              <div style={{ fontSize: '0.73rem', color: '#64748b', marginTop: '0.3rem' }}>
                Paste your project URL or REST endpoint (e.g. <code>https://xyz.supabase.co</code> or <code>https://xyz.supabase.co/rest/v1/</code>).
              </div>
            </div>

            <div style={{ marginBottom: '0.85rem' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#f1f5f9', marginBottom: '0.35rem' }}>
                Your Supabase Public Anon Key (anon public)
              </label>
              <input
                type="password"
                required
                className="repo-input"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={anonKeyInput}
                onChange={(e) => setAnonKeyInput(e.target.value)}
                style={{ width: '100%', fontSize: '0.85rem' }}
              />
              <div style={{ fontSize: '0.73rem', color: '#64748b', marginTop: '0.3rem' }}>
                From your Supabase Dashboard: <strong>Project Settings → API → Project API Keys (anon public)</strong>.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                type="submit"
                disabled={testingConnection}
                className="btn-primary"
                style={{ flex: 1, padding: '0.5rem 1rem', fontSize: '0.84rem' }}
              >
                {testingConnection ? (
                  <>
                    <Loader2 size={14} className="spin-animation" />
                    <span>Connecting &amp; Verifying...</span>
                  </>
                ) : (
                  <>
                    <Database size={14} />
                    <span>Apply &amp; Connect (In-Memory)</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleCopySchemaSql}
                className="btn-secondary"
                style={{ padding: '0.5rem 0.85rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                title="Copy SQL code to run in your Supabase SQL Editor"
              >
                {copiedSql ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
                <span>{copiedSql ? 'SQL Copied!' : 'Copy SQL Schema'}</span>
              </button>
            </div>
          </form>

          {/* User Authentication Status on Connected Database */}
          {currentUser ? (
            <div style={{
              backgroundColor: 'rgba(30, 41, 59, 0.7)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '8px',
              padding: '1rem',
              marginTop: '1rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ShieldCheck size={18} color="#34d399" />
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f8fafc' }}>
                    Authenticated to Your Private Supabase
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="control-btn"
                  disabled={loading || syncing}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', color: '#f87171' }}
                >
                  <LogOut size={13} />
                  <span>Sign Out</span>
                </button>
              </div>

              <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '0.85rem' }}>
                Signed in as: <strong style={{ color: '#38bdf8' }}>{currentUser.email}</strong>
              </div>

              {/* Active Project Details Badge */}
              {activeScanData && (
                <div style={{
                  backgroundColor: 'rgba(15, 23, 42, 0.5)',
                  borderRadius: '6px',
                  padding: '0.65rem 0.85rem',
                  marginBottom: '1rem',
                  fontSize: '0.8rem',
                  border: '1px solid rgba(255, 255, 255, 0.06)'
                }}>
                  <div style={{ fontWeight: 600, color: '#f1f5f9', marginBottom: '0.3rem' }}>
                    Active Project: <span style={{ color: '#38bdf8' }}>{activeScanData.repo_name || 'Codebase'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', color: '#94a3b8', fontSize: '0.75rem' }}>
                    <span>Total Files: <strong style={{ color: '#f8fafc' }}>{totalFiles.toLocaleString()}</strong></span>
                    <span>Code Files: <strong style={{ color: '#38bdf8' }}>{codeFilesCount.toLocaleString()}</strong></span>
                    <span>Data Files: <strong style={{ color: '#34d399' }}>{dataFilesCount.toLocaleString()}</strong></span>
                  </div>
                </div>
              )}

              {/* Sync Options Checkbox */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.8rem',
                color: '#cbd5e1',
                marginBottom: '1rem',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={syncIncludeFiles}
                  onChange={(e) => setSyncIncludeFiles(e.target.checked)}
                  style={{ accentColor: '#38bdf8', cursor: 'pointer' }}
                />
                <span>Store full data files &amp; code files in your private database (1,000+ files supported)</span>
              </label>

              {/* Progress bar if syncing files */}
              {syncProgress && (
                <div style={{ marginBottom: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.3rem' }}>
                    <span>Syncing files to your private Supabase...</span>
                    <span>{syncProgress.current} / {syncProgress.total} ({Math.round((syncProgress.current / syncProgress.total) * 100)}%)</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(51, 65, 85, 0.6)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${(syncProgress.current / syncProgress.total) * 100}%`,
                      height: '100%',
                      backgroundColor: '#38bdf8',
                      transition: 'width 0.2s ease'
                    }} />
                  </div>
                </div>
              )}

              {/* Cloud Sync Active Project Action */}
              <div style={{
                borderTop: '1px solid rgba(51, 65, 85, 0.5)',
                paddingTop: '0.85rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f1f5f9' }}>
                    Store in Your Database
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Persist AST analysis, diagrams &amp; data files to your Supabase
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCloudSync}
                  disabled={syncing || !activeScanData}
                  className="btn-primary"
                  style={{ padding: '0.45rem 0.9rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  {syncing ? (
                    <>
                      <Loader2 size={14} className="spin-animation" />
                      <span>{syncProgress ? 'Uploading Files...' : 'Syncing...'}</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud size={14} />
                      <span>Sync to My Database</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div style={{
              backgroundColor: 'rgba(30, 41, 59, 0.45)',
              border: '1px solid rgba(51, 65, 85, 0.5)',
              borderRadius: '8px',
              padding: '1rem',
              marginTop: '1rem'
            }}>
              {/* Tab Selector: Sign In vs Sign Up */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.85rem' }}>
                <button
                  type="button"
                  onClick={() => setAuthMode('signin')}
                  className={`btn-tab ${authMode === 'signin' ? 'active' : ''}`}
                  style={{ flex: 1, padding: '0.4rem', fontSize: '0.82rem', textAlign: 'center' }}
                >
                  <LogIn size={13} style={{ display: 'inline', marginRight: '4px' }} />
                  Sign In to My Supabase
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('signup')}
                  className={`btn-tab ${authMode === 'signup' ? 'active' : ''}`}
                  style={{ flex: 1, padding: '0.4rem', fontSize: '0.82rem', textAlign: 'center' }}
                >
                  <UserPlus size={13} style={{ display: 'inline', marginRight: '4px' }} />
                  Create User in My Project
                </button>
              </div>

              {/* Auth Form */}
              <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {authMode === 'signup' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.2rem' }}>
                      Full Name
                    </label>
                    <input
                      type="text"
                      className="repo-input"
                      placeholder="Jane Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      style={{ width: '100%', fontSize: '0.85rem' }}
                    />
                  </div>
                )}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.2rem' }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    className="repo-input"
                    placeholder="developer@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.2rem' }}>
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    className="repo-input"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                  style={{ marginTop: '0.5rem', width: '100%', padding: '0.55rem', fontSize: '0.85rem' }}
                >
                  {loading ? (
                    <Loader2 size={16} className="spin-animation" style={{ margin: '0 auto' }} />
                  ) : authMode === 'signin' ? (
                    'Sign In to My Supabase'
                  ) : (
                    'Register in My Supabase'
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

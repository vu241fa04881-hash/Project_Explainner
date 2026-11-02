import React, { useState, useEffect, useMemo } from 'react';
import {
  Database,
  Shield,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  X,
  LogIn,
  UserPlus,
  LogOut,
  Loader2,
  Lock,
  ExternalLink,
  RotateCcw,
  Copy,
  Check,
  UploadCloud,
  Eye,
  EyeOff,
  Wand2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Globe,
  KeyRound,
  HelpCircle,
  Layers,
  Activity,
  FileText
} from 'lucide-react';
import {
  getSupabaseCredentials,
  isSupabaseConfigured,
  normalizeSupabaseUrl,
  extractSupabaseProjectId,
  rectifySupabaseCredentials,
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
  const [activeTab, setActiveTab] = useState('credentials'); // 'credentials' | 'auth' | 'sync' | 'schema'
  const [supabaseUrlInput, setSupabaseUrlInput] = useState('');
  const [anonKeyInput, setAnonKeyInput] = useState('');
  const [showAnonKey, setShowAnonKey] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  // Auth State
  const [authMode, setAuthMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  // Async States
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionDetails, setConnectionDetails] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(null);
  const [syncIncludeFiles, setSyncIncludeFiles] = useState(true);

  // Status & Feedback
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [copiedSql, setCopiedSql] = useState(false);

  // Load in-memory credentials on open
  useEffect(() => {
    if (isOpen) {
      const creds = getSupabaseCredentials();
      setSupabaseUrlInput(creds.url || '');
      setAnonKeyInput(creds.key || '');
      setErrorMsg('');
      setSuccessMsg('');
      setSyncProgress(null);
      checkUser();

      if (creds.url && creds.key) {
        const projectId = extractSupabaseProjectId(creds.url);
        setConnectionDetails({ url: creds.url, projectId });
      } else {
        setConnectionDetails(null);
      }
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

  // Live Real-Time Credential Rectification
  const rectified = useMemo(() => {
    return rectifySupabaseCredentials(supabaseUrlInput, anonKeyInput);
  }, [supabaseUrlInput, anonKeyInput]);

  if (!isOpen) return null;

  // Handle Form Submission: Verify & Connect to Supabase
  const handleSaveConnection = async (e) => {
    e?.preventDefault?.();
    setErrorMsg('');
    setSuccessMsg('');

    if (!rectified.url) {
      setErrorMsg('Please enter your Supabase project URL or 20-character project reference.');
      return;
    }
    if (!rectified.key) {
      setErrorMsg('Please enter your Supabase public Anon Key.');
      return;
    }

    if (rectified.isServiceRole) {
      setErrorMsg('Security Alert: You entered a secret service_role key! Never expose your service role key in a frontend app. Please provide your public anon key.');
      return;
    }

    setTestingConnection(true);
    try {
      const result = await testSupabaseConnection(rectified.url, rectified.key);
      saveCustomSupabaseCredentials(rectified.url, rectified.key);

      // Update input fields with rectified clean values
      setSupabaseUrlInput(rectified.url);
      setAnonKeyInput(rectified.key);
      setConnectionDetails({
        url: rectified.url,
        projectId: rectified.projectId || result.projectId,
        latency: result.latency
      });

      setSuccessMsg(`Connected successfully to Supabase (${result.latency}ms latency). Credentials held strictly in-memory.`);
      await checkUser();
    } catch (err) {
      setErrorMsg(err.message || 'Connection test failed. Please verify your Project URL and Anon Key.');
    } finally {
      setTestingConnection(false);
    }
  };

  // One-click Apply Rectified URL
  const handleApplyRectifiedUrl = () => {
    if (rectified.url) {
      setSupabaseUrlInput(rectified.url);
    }
  };

  // Reset / Clear Credentials
  const handleReset = () => {
    resetSupabaseCredentials();
    setSupabaseUrlInput('');
    setAnonKeyInput('');
    setConnectionDetails(null);
    setCurrentUser(null);
    setSuccessMsg('Supabase credentials purged from volatile memory.');
    setErrorMsg('');
  };

  // Authentication: Sign In or Sign Up
  const handleAuth = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (authMode === 'signin') {
        const data = await signInWithEmail(email, password);
        setCurrentUser(data.user);
        setSuccessMsg(`Welcome back, ${data.user.email}! Authenticated to your database.`);
      } else {
        const data = await signUpWithEmail(email, password, fullName);
        if (data.session) {
          setCurrentUser(data.user);
          setSuccessMsg('Account created and signed into your database!');
        } else {
          setSuccessMsg('Registration submitted! If email confirmation is enabled in your Supabase project, please check your inbox.');
        }
      }
    } catch (err) {
      setErrorMsg(err.message || 'Authentication failed. Please verify email and password.');
    } finally {
      setLoading(false);
    }
  };

  // Sign Out
  const handleSignOut = async () => {
    setLoading(true);
    try {
      await signOut();
      setCurrentUser(null);
      setSuccessMsg('Signed out of Supabase successfully.');
      setErrorMsg('');
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Cloud Sync
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
        ? ` and ${result.syncedFilesCount.toLocaleString()} project & dataset files stored in your private database!`
        : '!';

      setSuccessMsg(`Successfully stored "${result.project.name}"${filesMsg}`);
      if (onSyncSuccess) onSyncSuccess(result);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to sync to Supabase. Ensure database schema is initialized.');
    } finally {
      setSyncing(false);
    }
  };

  // Copy SQL Schema
  const handleCopySchemaSql = () => {
    const sqlCode = `-- ==============================================================================
-- PROJECT EXPLAINER SUPABASE SCHEMA SETUP (1000+ FILES & RLS ENABLED)
-- Run this in your Supabase Project SQL Editor:
-- ==============================================================================

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

-- Isolation Policies (Users access only their own records)
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
CREATE POLICY "Users view own profile" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users own projects" ON public.projects;
CREATE POLICY "Users own projects" ON public.projects FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users own scans" ON public.project_scans;
CREATE POLICY "Users own scans" ON public.project_scans FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users own files" ON public.project_files;
CREATE POLICY "Users own files" ON public.project_files FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
`;
    navigator.clipboard.writeText(sqlCode);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2200);
  };

  const isConfigured = Boolean(connectionDetails?.url);
  const totalFiles = activeScanData?.total_files || Object.keys(activeScanData?.files || {}).length;
  const dataFilesCount = activeScanData?.data_files_count || 0;
  const codeFilesCount = activeScanData?.code_files_count || Math.max(0, totalFiles - dataFilesCount);

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1200 }}>
      <div
        className="supabase-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="supabase-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(56, 189, 248, 0.15))',
              border: '1px solid rgba(52, 211, 153, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#34d399',
              boxShadow: '0 0 15px rgba(52, 211, 153, 0.2)'
            }}>
              <Database size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                  Connect to Supabase
                </h3>
                {isConfigured ? (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.7rem',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '9999px',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(52, 211, 153, 0.4)',
                    color: '#34d399',
                    fontWeight: 600
                  }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#34d399' }} />
                    Connected {connectionDetails.projectId ? `(${connectionDetails.projectId})` : ''}
                  </span>
                ) : (
                  <span style={{
                    fontSize: '0.7rem',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '9999px',
                    backgroundColor: 'rgba(148, 163, 184, 0.12)',
                    color: '#94a3b8',
                    border: '1px solid rgba(148, 163, 184, 0.2)'
                  }}>
                    Not Connected
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.76rem', color: '#94a3b8', marginTop: '2px' }}>
                Store projects &amp; 1,000+ data files securely in your personal database
              </div>
            </div>
          </div>

          <button
            type="button"
            className="control-btn"
            onClick={onClose}
            title="Close modal"
            style={{ width: '32px', height: '32px' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Global Feedback Banner */}
        {errorMsg && (
          <div style={{
            margin: '0.75rem 1.5rem 0',
            padding: '0.65rem 0.95rem',
            borderRadius: '6px',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            color: '#f87171',
            fontSize: '0.82rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <AlertCircle size={15} style={{ flexShrink: 0 }} />
            <span style={{ lineHeight: 1.4 }}>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div style={{
            margin: '0.75rem 1.5rem 0',
            padding: '0.65rem 0.95rem',
            borderRadius: '6px',
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(52, 211, 153, 0.35)',
            color: '#34d399',
            fontSize: '0.82rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
            <span style={{ lineHeight: 1.4 }}>{successMsg}</span>
          </div>
        )}

        {/* Body Content */}
        <div className="supabase-modal-body">
          {/* Navigation Tabs */}
          <div className="supabase-nav-tabs">
            <button
              type="button"
              className={`supabase-tab-btn ${activeTab === 'credentials' ? 'active' : ''}`}
              onClick={() => setActiveTab('credentials')}
            >
              <KeyRound size={14} />
              <span>1. Credentials &amp; URL</span>
            </button>

            <button
              type="button"
              className={`supabase-tab-btn ${activeTab === 'auth' ? 'active' : ''}`}
              onClick={() => setActiveTab('auth')}
            >
              <LogIn size={14} />
              <span>2. User Account {currentUser ? '(Signed In)' : ''}</span>
            </button>

            <button
              type="button"
              className={`supabase-tab-btn ${activeTab === 'sync' ? 'active' : ''}`}
              onClick={() => setActiveTab('sync')}
            >
              <UploadCloud size={14} />
              <span>3. Cloud Sync</span>
            </button>

            <button
              type="button"
              className={`supabase-tab-btn ${activeTab === 'schema' ? 'active' : ''}`}
              onClick={() => setActiveTab('schema')}
            >
              <FileText size={14} />
              <span>4. SQL Setup</span>
            </button>
          </div>

          {/* TAB 1: CREDENTIALS & RECTIFICATION (PRIMARY) */}
          {activeTab === 'credentials' && (
            <div>
              {/* Zero-Storage Notice */}
              <div style={{
                backgroundColor: 'rgba(16, 185, 129, 0.07)',
                border: '1px solid rgba(52, 211, 153, 0.22)',
                borderRadius: '8px',
                padding: '0.75rem 0.95rem',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.65rem'
              }}>
                <Lock size={16} color="#34d399" style={{ marginTop: '2px', flexShrink: 0 }} />
                <div style={{ fontSize: '0.78rem', color: '#cbd5e1', lineHeight: '1.45' }}>
                  <strong style={{ color: '#34d399' }}>Zero-Storage Ephemeral Policy: </strong>
                  Your credentials are kept <strong>strictly in volatile browser RAM</strong>. They are never written to disk, localStorage, or cookies, and evaporate immediately when this browser tab is closed.
                </div>
              </div>

              {/* Form Input Section */}
              <form onSubmit={handleSaveConnection}>
                {/* 1. Supabase Project URL or Reference ID */}
                <div style={{ marginBottom: '1.1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Globe size={14} color="#38bdf8" />
                      <span>Supabase Project URL or Project ID</span>
                      <span style={{ color: '#f43f5e' }}>*</span>
                    </label>

                    {isConfigured && (
                      <button
                        type="button"
                        onClick={handleReset}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#f87171',
                          fontSize: '0.73rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}
                        title="Wipe active credentials from RAM"
                      >
                        <RotateCcw size={11} /> Clear Credentials
                      </button>
                    )}
                  </div>

                  <div className="supabase-input-group">
                    <Database size={15} className="supabase-input-icon" />
                    <input
                      type="text"
                      required
                      className="supabase-text-input"
                      placeholder="e.g. https://xyz.supabase.co or project ref xyz..."
                      value={supabaseUrlInput}
                      onChange={(e) => setSupabaseUrlInput(e.target.value)}
                    />
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.35rem' }}>
                    Accepts project URLs (<code>https://&lt;id&gt;.supabase.co</code>), REST endpoints (<code>.../rest/v1/</code>), or standalone project IDs.
                  </div>
                </div>

                {/* 2. Supabase Anon Public Key */}
                <div style={{ marginBottom: '1.1rem' }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', fontWeight: 600, color: '#f1f5f9', marginBottom: '0.35rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <KeyRound size={14} color="#34d399" />
                      <span>Supabase Public Anon Key (anon public)</span>
                      <span style={{ color: '#f43f5e' }}>*</span>
                    </span>

                    {rectified.isKeyJwt && (
                      <span style={{ fontSize: '0.7rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <CheckCircle2 size={11} /> Valid JWT Format
                      </span>
                    )}
                  </label>

                  <div className="supabase-input-group">
                    <KeyRound size={15} className="supabase-input-icon" />
                    <input
                      type={showAnonKey ? 'text' : 'password'}
                      required
                      className="supabase-text-input has-action"
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      value={anonKeyInput}
                      onChange={(e) => setAnonKeyInput(e.target.value)}
                    />
                    <button
                      type="button"
                      className="supabase-input-action-btn"
                      onClick={() => setShowAnonKey(!showAnonKey)}
                      title={showAnonKey ? 'Hide key' : 'Show key'}
                    >
                      {showAnonKey ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>

                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.35rem' }}>
                    Found under: <strong>Project Settings → API → Project API Keys (anon public)</strong>.
                  </div>
                </div>

                {/* LIVE RECTIFICATION PREVIEW & FEEDBACK */}
                {(supabaseUrlInput.trim() || anonKeyInput.trim()) && (
                  <div className="supabase-rectify-box">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#34d399', fontSize: '0.8rem', fontWeight: 600 }}>
                        <Wand2 size={14} />
                        <span>Neat Input Rectification &amp; Validation</span>
                      </div>

                      {rectified.rectifications.length > 0 && (
                        <button
                          type="button"
                          onClick={handleApplyRectifiedUrl}
                          style={{
                            background: 'rgba(52, 211, 153, 0.15)',
                            border: '1px solid rgba(52, 211, 153, 0.3)',
                            borderRadius: '4px',
                            color: '#34d399',
                            fontSize: '0.72rem',
                            padding: '0.15rem 0.5rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                        >
                          <Sparkles size={11} /> Cleaned Input
                        </button>
                      )}
                    </div>

                    {/* Rectifications Applied Pills */}
                    {rectified.rectifications.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                        {rectified.rectifications.map((item, idx) => (
                          <span key={idx} className="supabase-rectify-pill">
                            <Check size={11} /> {item}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Rectified URL Preview */}
                    {rectified.url && (
                      <div style={{ fontSize: '0.77rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>Target Clean URL:</span>
                        <code style={{ color: '#38bdf8', backgroundColor: 'rgba(0,0,0,0.3)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                          {rectified.url}
                        </code>
                      </div>
                    )}

                    {/* Project ID Deep-Link */}
                    {rectified.projectId && (
                      <div style={{ fontSize: '0.76rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>Detected Project ID:</span>
                        <strong style={{ color: '#f1f5f9' }}>{rectified.projectId}</strong>
                        <a
                          href={`https://supabase.com/dashboard/project/${rectified.projectId}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: '#38bdf8', display: 'inline-flex', alignItems: 'center', gap: '3px', textDecoration: 'none' }}
                        >
                          Dashboard <ExternalLink size={11} />
                        </a>
                      </div>
                    )}

                    {/* Warnings (e.g. Service Role detected) */}
                    {rectified.keyWarnings.length > 0 && (
                      <div style={{ marginTop: '0.2rem' }}>
                        {rectified.keyWarnings.map((warn, idx) => (
                          <div key={idx} style={{ color: rectified.isServiceRole ? '#f87171' : '#fbbf24', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <AlertCircle size={13} />
                            <span>{warn}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="supabase-action-row" style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', marginTop: '1.25rem' }}>
                  <button
                    type="submit"
                    disabled={testingConnection || !supabaseUrlInput || !anonKeyInput}
                    className="btn-primary"
                    style={{
                      flex: 1,
                      padding: '0.65rem 1.25rem',
                      fontSize: '0.86rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.45rem',
                      background: 'linear-gradient(135deg, #059669, #10b981)',
                      borderColor: '#34d399'
                    }}
                  >
                    {testingConnection ? (
                      <>
                        <Loader2 size={16} className="spin-animation" />
                        <span>Verifying &amp; Connecting...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={16} />
                        <span>{isConfigured ? 'Update & Reconnect (In-Memory)' : 'Verify & Connect to Supabase'}</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('schema')}
                    className="btn-secondary"
                    style={{ padding: '0.65rem 1rem', fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <FileText size={15} />
                    <span>Get SQL Schema</span>
                  </button>
                </div>
              </form>

              {/* Collapsible Where to Find Guide */}
              <div className="supabase-guide-box">
                <button
                  type="button"
                  className="supabase-guide-toggle"
                  onClick={() => setShowGuide(!showGuide)}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <HelpCircle size={15} color="#38bdf8" />
                    Where do I find my Project URL and Public Anon Key?
                  </span>
                  {showGuide ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </button>

                {showGuide && (
                  <div className="supabase-guide-content">
                    <ol style={{ margin: 0, paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                      <li>
                        Log in to your <strong><a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" style={{ color: '#38bdf8' }}>Supabase Dashboard ↗</a></strong> and select your project.
                      </li>
                      <li>
                        In the bottom-left sidebar, click <strong>Project Settings (gear icon) → API</strong>.
                      </li>
                      <li>
                        Under <strong>Project URL</strong>, copy the URL (e.g. <code>https://&lt;ref&gt;.supabase.co</code>).
                      </li>
                      <li>
                        Under <strong>Project API keys</strong>, copy the <strong>`anon` `public`</strong> key (starts with <code>eyJ...</code>).
                      </li>
                      <li>
                        Paste both into the fields above. Project Explainer automatically rectifies any whitespace or trailing endpoints.
                      </li>
                    </ol>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: USER ACCOUNT & AUTH */}
          {activeTab === 'auth' && (
            <div>
              {!isConfigured ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#94a3b8' }}>
                  <Database size={36} color="#64748b" style={{ margin: '0 auto 0.75rem' }} />
                  <h4 style={{ color: '#f1f5f9', margin: '0 0 0.4rem', fontSize: '1rem' }}>No Database Connected Yet</h4>
                  <p style={{ fontSize: '0.82rem', maxWidth: '380px', margin: '0 auto 1.25rem' }}>
                    Please enter and verify your Supabase URL &amp; Anon Key in Step 1 before signing in.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('credentials')}
                    className="btn-primary"
                    style={{ fontSize: '0.82rem', padding: '0.5rem 1rem' }}
                  >
                    Go to Step 1: Credentials
                  </button>
                </div>
              ) : currentUser ? (
                /* Authenticated User Profile */
                <div style={{
                  backgroundColor: 'rgba(30, 41, 59, 0.7)',
                  border: '1px solid rgba(52, 211, 153, 0.3)',
                  borderRadius: '10px',
                  padding: '1.25rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <ShieldCheck size={20} color="#34d399" />
                      <div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc' }}>
                          Authenticated to Your Supabase
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#34d399' }}>
                          Row-Level Security (RLS) Active
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="control-btn"
                      disabled={loading}
                      style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <LogOut size={13} />
                      <span>Sign Out</span>
                    </button>
                  </div>

                  <div style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    borderRadius: '8px',
                    padding: '0.85rem 1rem',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    fontSize: '0.82rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem'
                  }}>
                    <div>
                      <span style={{ color: '#94a3b8' }}>Logged in as: </span>
                      <strong style={{ color: '#38bdf8' }}>{currentUser.email}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8' }}>User ID: </span>
                      <code style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>{currentUser.id}</code>
                    </div>
                  </div>

                  <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => setActiveTab('sync')}
                      className="btn-primary"
                      style={{ fontSize: '0.84rem', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                      <span>Proceed to Cloud Sync</span>
                      <UploadCloud size={15} />
                    </button>
                  </div>
                </div>
              ) : (
                /* Auth Form (Sign In / Sign Up) */
                <div style={{
                  backgroundColor: 'rgba(30, 41, 59, 0.45)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  padding: '1.25rem'
                }}>
                  {/* Mode Selector */}
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
                    <button
                      type="button"
                      onClick={() => setAuthMode('signin')}
                      className={`btn-tab ${authMode === 'signin' ? 'active' : ''}`}
                      style={{ flex: 1, padding: '0.5rem', fontSize: '0.84rem', textAlign: 'center' }}
                    >
                      <LogIn size={14} style={{ display: 'inline', marginRight: '5px' }} />
                      Sign In to My Project
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthMode('signup')}
                      className={`btn-tab ${authMode === 'signup' ? 'active' : ''}`}
                      style={{ flex: 1, padding: '0.5rem', fontSize: '0.84rem', textAlign: 'center' }}
                    >
                      <UserPlus size={14} style={{ display: 'inline', marginRight: '5px' }} />
                      Create User in My Project
                    </button>
                  </div>

                  <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {authMode === 'signup' && (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', marginBottom: '0.25rem' }}>
                          Full Name
                        </label>
                        <input
                          type="text"
                          className="supabase-text-input"
                          style={{ paddingLeft: '0.85rem' }}
                          placeholder="Your Name"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                        />
                      </div>
                    )}

                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', marginBottom: '0.25rem' }}>
                        Email Address
                      </label>
                      <input
                        type="email"
                        required
                        className="supabase-text-input"
                        style={{ paddingLeft: '0.85rem' }}
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', marginBottom: '0.25rem' }}>
                        Password
                      </label>
                      <input
                        type="password"
                        required
                        className="supabase-text-input"
                        style={{ paddingLeft: '0.85rem' }}
                        placeholder="••••••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="btn-primary"
                      style={{ marginTop: '0.5rem', padding: '0.65rem', fontSize: '0.86rem' }}
                    >
                      {loading ? (
                        <Loader2 size={16} className="spin-animation" style={{ margin: '0 auto' }} />
                      ) : authMode === 'signin' ? (
                        'Sign In to My Supabase'
                      ) : (
                        'Register Account in My Supabase'
                      )}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CLOUD SYNC & STORAGE */}
          {activeTab === 'sync' && (
            <div>
              {activeScanData ? (
                <div style={{
                  backgroundColor: 'rgba(30, 41, 59, 0.5)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  borderRadius: '10px',
                  padding: '1.25rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <Layers size={18} color="#38bdf8" />
                    <span style={{ fontSize: '0.92rem', fontWeight: 600, color: '#f8fafc' }}>
                      Ready to Store: <span style={{ color: '#38bdf8' }}>{activeScanData.repo_name || 'Codebase'}</span>
                    </span>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: '0.6rem',
                    marginBottom: '1.25rem'
                  }}>
                    <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Total Files</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>{totalFiles.toLocaleString()}</div>
                    </div>
                    <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Code Files</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#38bdf8' }}>{codeFilesCount.toLocaleString()}</div>
                    </div>
                    <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Dataset Files</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#34d399' }}>{dataFilesCount.toLocaleString()}</div>
                    </div>
                  </div>

                  {/* Checkbox for 1000+ files sync */}
                  <label style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.5rem',
                    fontSize: '0.8rem',
                    color: '#cbd5e1',
                    marginBottom: '1.25rem',
                    cursor: 'pointer',
                    lineHeight: 1.45
                  }}>
                    <input
                      type="checkbox"
                      checked={syncIncludeFiles}
                      onChange={(e) => setSyncIncludeFiles(e.target.checked)}
                      style={{ accentColor: '#34d399', marginTop: '2px', cursor: 'pointer' }}
                    />
                    <span>
                      Store all individual code &amp; data files (CSV, JSON, SQL, Parquet) in chunks of 200 records (supports <strong>1,000+ files</strong>).
                    </span>
                  </label>

                  {/* Sync progress bar */}
                  {syncProgress && (
                    <div style={{ marginBottom: '1.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.35rem' }}>
                        <span>Persisting files to Supabase...</span>
                        <span>{syncProgress.current} / {syncProgress.total} ({Math.round((syncProgress.current / syncProgress.total) * 100)}%)</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(51, 65, 85, 0.6)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${(syncProgress.current / syncProgress.total) * 100}%`,
                          height: '100%',
                          backgroundColor: '#34d399',
                          transition: 'width 0.2s ease'
                        }} />
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={handleCloudSync}
                      disabled={syncing || !currentUser}
                      className="btn-primary"
                      style={{
                        padding: '0.65rem 1.25rem',
                        fontSize: '0.86rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        background: 'linear-gradient(135deg, #059669, #10b981)',
                        borderColor: '#34d399'
                      }}
                    >
                      {syncing ? (
                        <>
                          <Loader2 size={16} className="spin-animation" />
                          <span>{syncProgress ? 'Uploading File Records...' : 'Syncing...'}</span>
                        </>
                      ) : (
                        <>
                          <UploadCloud size={16} />
                          <span>{currentUser ? 'Sync to My Supabase' : 'Please Sign In First'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#94a3b8' }}>
                  <UploadCloud size={36} color="#64748b" style={{ margin: '0 auto 0.75rem' }} />
                  <h4 style={{ color: '#f1f5f9', margin: '0 0 0.4rem', fontSize: '1rem' }}>No Active Project Scanned</h4>
                  <p style={{ fontSize: '0.82rem', maxWidth: '380px', margin: '0 auto' }}>
                    Scan a local directory, GitHub repository, or ZIP archive first to save its diagrams and files to Supabase.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: SQL SCHEMA SETUP */}
          {activeTab === 'schema' && (
            <div>
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f8fafc', marginBottom: '0.3rem' }}>
                  Database Setup &amp; Row-Level Security (RLS)
                </div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.5 }}>
                  Run this SQL in your Supabase SQL Editor once to initialize the tables (<code>projects</code>, <code>project_scans</code>, <code>project_files</code>) and configure secure user-isolated Row-Level Security policies.
                </div>
              </div>

              <div style={{
                position: 'relative',
                backgroundColor: 'rgba(15, 23, 42, 0.85)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                padding: '1rem',
                maxHeight: '260px',
                overflowY: 'auto',
                fontFamily: 'monospace',
                fontSize: '0.74rem',
                color: '#cbd5e1',
                lineHeight: 1.5
              }}>
                <button
                  type="button"
                  onClick={handleCopySchemaSql}
                  style={{
                    position: 'absolute',
                    top: '0.65rem',
                    right: '0.65rem',
                    padding: '0.35rem 0.65rem',
                    borderRadius: '6px',
                    backgroundColor: copiedSql ? 'rgba(16, 185, 129, 0.2)' : 'rgba(56, 189, 248, 0.15)',
                    border: '1px solid',
                    borderColor: copiedSql ? '#34d399' : 'rgba(56, 189, 248, 0.3)',
                    color: copiedSql ? '#34d399' : '#38bdf8',
                    cursor: 'pointer',
                    fontSize: '0.74rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {copiedSql ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiedSql ? 'Copied to Clipboard!' : 'Copy SQL'}</span>
                </button>

                <pre style={{ margin: 0 }}>
{`-- 1. Create Core Tables
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    source_type TEXT NOT NULL DEFAULT 'folder',
    loc INTEGER DEFAULT 0,
    files_count INTEGER DEFAULT 0,
    data_files_count INTEGER DEFAULT 0,
    languages JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    summary TEXT,
    architecture_layers JSONB DEFAULT '{}'::jsonb,
    diagrams JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_category TEXT NOT NULL DEFAULT 'code',
    size_bytes BIGINT DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable Row-Level Security
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;

-- 3. Isolation Policies
CREATE POLICY "Users own projects" ON public.projects FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users own scans" ON public.project_scans FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users own files" ON public.project_files FOR ALL TO authenticated USING (auth.uid() = user_id);`}
                </pre>
              </div>

              <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {rectified.projectId ? (
                  <a
                    href={`https://supabase.com/dashboard/project/${rectified.projectId}/sql`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      color: '#34d399',
                      fontSize: '0.8rem',
                      textDecoration: 'none'
                    }}
                  >
                    <span>Open SQL Editor for {rectified.projectId}</span>
                    <ExternalLink size={13} />
                  </a>
                ) : (
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Provide your project URL in Step 1 to generate direct links.
                  </span>
                )}

                <button
                  type="button"
                  onClick={handleCopySchemaSql}
                  className="btn-primary"
                  style={{ fontSize: '0.82rem', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  {copiedSql ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedSql ? 'SQL Copied!' : 'Copy Schema SQL'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useState, useCallback } from 'react';
import {
  Layers,
  Network,
  Code2,
  MessageSquare,
  AlertCircle,
  Loader2,
  RefreshCw,
  FolderUp,
  GitBranch,
  FileArchive,
  FolderSearch,
  X,
  Sparkles
} from 'lucide-react';

import Header from './components/Header';
import ApiKeyModal from './components/ApiKeyModal';
import SupabaseAuthModal from './components/SupabaseAuthModal';
import ProjectSourceModal from './components/ProjectSourceModal';
import ChatbotWidget from './components/ChatbotWidget';
import ArchitectureTab from './components/ArchitectureTab';
import VisualizerTab from './components/VisualizerTab';
import InspectorTab from './components/InspectorTab';
import AssistantTab from './components/AssistantTab';
import CodeExplainerTab from './components/CodeExplainerTab';
import { getCurrentUser, onAuthStateChange } from './lib/supabaseClient';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '');

export default function App() {
  const [activeTab, setActiveTab] = useState('architecture');
  const [scanData, setScanData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [error, setError] = useState(null);
  // Ephemeral In-Memory Only state (NEVER written to disk or localStorage)
  const [apiKey, setApiKey] = useState('');
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [supabaseUser, setSupabaseUser] = useState(null);
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [sourceModalInitialTab, setSourceModalInitialTab] = useState('folder');
  const [activeInspectorFile, setActiveInspectorFile] = useState(null);
  const [activeExplainerFile, setActiveExplainerFile] = useState(null);

  React.useEffect(() => {
    // Purge any stored keys from localStorage
    try {
      localStorage.removeItem('GEMINI_API_KEY');
      localStorage.removeItem('SUPABASE_URL');
      localStorage.removeItem('SUPABASE_ANON_KEY');
    } catch {}

    getCurrentUser().then((user) => setSupabaseUser(user)).catch(() => {});
    const sub = onAuthStateChange((_event, session) => {
      setSupabaseUser(session?.user || null);
    });
    return () => sub?.unsubscribe?.();
  }, []);

  const handleSaveApiKey = (key) => {
    // Kept strictly in active RAM memory for the current session
    setApiKey((key || '').trim());
  };

  const handleOpenSourceModal = (tab = 'folder') => {
    setSourceModalInitialTab(tab);
    setIsSourceModalOpen(true);
  };

  // Local Path Scan
  const handleScan = async (path) => {
    setLoading(true);
    setLoadingStatus('Scanning directory & generating AST...');
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_path: path, api_key: apiKey || null })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Scan failed with status ${res.status}`);
      }
      const data = await res.json();
      setScanData(data);
      setActiveInspectorFile(null);
    } catch (err) {
      console.error(err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
      setLoadingStatus('');
    }
  };

  // Git Clone & Scan
  const handleCloneGit = async (repoUrl, branch = null) => {
    setLoading(true);
    setLoadingStatus('Cloning repository & analyzing AST modules...');
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo_url: repoUrl,
          branch: branch || null,
          api_key: apiKey || null
        })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Clone failed with status ${res.status}`);
      }
      const data = await res.json();
      setScanData(data);
      setActiveInspectorFile(null);
    } catch (err) {
      console.error(err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
      setLoadingStatus('');
    }
  };

  // Folder Upload with High-Scale Chunking (> 1,000 files support)
  const handleUploadFolder = async (files) => {
    setLoading(true);
    setError(null);

    const totalFiles = files.length;
    const firstRel = files[0]?.webkitRelativePath || '';
    const folderName = firstRel.split('/')[0] || 'Uploaded_Project';

    // If folder has <= 200 files, upload in single batch
    if (totalFiles <= 200) {
      setLoadingStatus(`Uploading ${totalFiles} folder files & parsing code...`);
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
        const relPath = files[i].webkitRelativePath || files[i].name;
        formData.append('paths', relPath);
      }
      if (apiKey) {
        formData.append('api_key', apiKey);
      }

      try {
        const res = await fetch(`${API_BASE}/api/upload-folder`, {
          method: 'POST',
          body: formData
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || `Folder upload failed with status ${res.status}`);
        }
        const data = await res.json();
        setScanData(data);
        setActiveInspectorFile(null);
      } catch (err) {
        console.error(err);
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
        setLoadingStatus('');
      }
      return;
    }

    // High-Scale Chunked Upload: Bypasses multipart/form limits and handles 1,000+ files effortlessly
    const chunkSize = 200;
    const totalChunks = Math.ceil(totalFiles / chunkSize);
    const sessionId = 'session_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();

    try {
      let finalScanData = null;
      for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
        const start = chunkIdx * chunkSize;
        const end = Math.min(start + chunkSize, totalFiles);
        const chunkFiles = files.slice(start, end);
        const isLastChunk = chunkIdx === totalChunks - 1;

        setLoadingStatus(`Uploading high-scale project: Batch ${chunkIdx + 1}/${totalChunks} (${end}/${totalFiles} files)...`);

        const chunkFormData = new FormData();
        chunkFormData.append('session_id', sessionId);
        chunkFormData.append('chunk_index', chunkIdx);
        chunkFormData.append('total_chunks', totalChunks);
        chunkFormData.append('is_last_chunk', isLastChunk);
        chunkFormData.append('folder_name', folderName);
        if (apiKey) chunkFormData.append('api_key', apiKey);

        for (let i = 0; i < chunkFiles.length; i++) {
          chunkFormData.append('files', chunkFiles[i]);
          chunkFormData.append('paths', chunkFiles[i].webkitRelativePath || chunkFiles[i].name);
        }

        const res = await fetch(`${API_BASE}/api/upload-folder-chunk`, {
          method: 'POST',
          body: chunkFormData
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || `Batch upload failed at batch ${chunkIdx + 1}`);
        }

        if (isLastChunk) {
          setLoadingStatus(`Analyzing AST, building dependency graphs & indexing data files for ${totalFiles} files...`);
          finalScanData = await res.json();
        }
      }

      if (finalScanData) {
        setScanData(finalScanData);
        setActiveInspectorFile(null);
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
      setLoadingStatus('');
    }
  };

  // ZIP Archive Upload
  const handleUploadZip = async (zipFile) => {
    setLoading(true);
    setLoadingStatus('Extracting ZIP archive & parsing AST...');
    setError(null);

    const formData = new FormData();
    formData.append('file', zipFile);
    if (apiKey) {
      formData.append('api_key', apiKey);
    }

    try {
      const res = await fetch(`${API_BASE}/api/upload-zip`, {
        method: 'POST',
        body: formData
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `ZIP upload failed with status ${res.status}`);
      }
      const data = await res.json();
      setScanData(data);
      setActiveInspectorFile(null);
    } catch (err) {
      console.error(err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
      setLoadingStatus('');
    }
  };

  // Cross-tab navigation (e.g. clicking a node in Mermaid or a module badge in Assistant)
  const handleNavigateToFile = (filePath) => {
    setActiveInspectorFile(filePath);
    setActiveExplainerFile(filePath);
    setActiveTab('inspector');
  };

  // Direct navigation to Code & Logic Explainer
  const handleExplainCode = (filePath, symbolName = null) => {
    if (filePath) {
      setActiveExplainerFile(filePath);
      setActiveInspectorFile(filePath);
    }
    setActiveTab('explainer');
  };

  // Unload / Remove currently active workspace
  const handleCloseWorkspace = () => {
    setScanData(null);
    setActiveInspectorFile(null);
    setActiveExplainerFile(null);
    setActiveTab('architecture');
  };

  const languages = scanData?.languages || {};
  const stats = scanData?.graph?.stats || {};

  return (
    <div className="app-container">
      {/* Top Header */}
      <Header
        repoPath={scanData?.repo_path}
        repoName={scanData?.repo_name}
        onScan={handleScan}
        onCloneGit={handleCloneGit}
        onOpenSourceModal={() => handleOpenSourceModal('folder')}
        onCloseWorkspace={handleCloseWorkspace}
        loading={loading}
        apiKey={apiKey}
        onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
        onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
        supabaseUser={supabaseUser}
      />

      {/* Stats Ribbon */}
      {scanData && (
        <div className="stats-ribbon">
          <div className="stats-items-group">
            <div className="stat-pill">
              <span className="stat-label">Project:</span>
              <span className="stat-value" style={{ color: '#38bdf8' }}>{scanData.repo_name}</span>
            </div>
            <div className="stat-pill">
              <span className="stat-label">Files:</span>
              <span className="stat-value">{scanData.total_files}</span>
            </div>
            <div className="stat-pill">
              <span className="stat-label">Lines of Code:</span>
              <span className="stat-value">{scanData.total_loc.toLocaleString()}</span>
            </div>
            <div className="stat-pill">
              <span className="stat-label">Dependencies:</span>
              <span className="stat-value">{stats.total_edges || 0}</span>
            </div>
            <button
              onClick={() => handleOpenSourceModal('folder')}
              className="btn-secondary"
              title="Import or Switch Project"
              style={{ padding: '0.2rem 0.55rem', fontSize: '0.72rem', gap: '0.3rem' }}
            >
              <FolderUp size={12} color="#38bdf8" />
              <span>Change Project</span>
            </button>
            <button
              onClick={handleCloseWorkspace}
              className="btn-secondary"
              title="Remove / Close active workspace"
              style={{
                padding: '0.2rem 0.55rem',
                fontSize: '0.72rem',
                gap: '0.3rem',
                color: '#f43f5e',
                borderColor: 'rgba(244, 63, 94, 0.3)',
                background: 'rgba(244, 63, 94, 0.08)'
              }}
            >
              <X size={12} color="#f43f5e" />
              <span>Remove Workspace</span>
            </button>
            <button
              onClick={() => scanData?.repo_path && handleScan(scanData.repo_path)}
              className="control-btn"
              title="Rescan & Refresh"
              style={{ width: '26px', height: '26px' }}
            >
              <RefreshCw size={13} color="#94a3b8" />
            </button>
          </div>

          {/* Language Breakdown */}
          <div className="lang-pills-row">
            {Object.entries(languages).map(([lang, count]) => (
              <span key={lang} className="lang-tag">
                {lang}: {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Navigation Tabs (only shown when a project is loaded) */}
      {scanData && (
        <div className="tabs-navigation">
          <button
            onClick={() => setActiveTab('architecture')}
            className={`tab-btn ${activeTab === 'architecture' ? 'active' : ''}`}
          >
            <Layers size={17} />
            <span>Architecture & Summary</span>
          </button>

          <button
            onClick={() => setActiveTab('visualizer')}
            className={`tab-btn ${activeTab === 'visualizer' ? 'active' : ''}`}
          >
            <Network size={17} />
            <span>Dependency & Diagrams</span>
          </button>

          <button
            onClick={() => setActiveTab('inspector')}
            className={`tab-btn ${activeTab === 'inspector' ? 'active' : ''}`}
          >
            <Code2 size={17} />
            <span>Code & Symbol Inspector</span>
          </button>

          <button
            onClick={() => setActiveTab('explainer')}
            className={`tab-btn ${activeTab === 'explainer' ? 'active' : ''}`}
          >
            <Sparkles size={17} />
            <span>Code & Logic Explainer</span>
          </button>

          <button
            onClick={() => setActiveTab('assistant')}
            className={`tab-btn ${activeTab === 'assistant' ? 'active' : ''}`}
          >
            <MessageSquare size={17} />
            <span>Plain-Language AI Q&A</span>
          </button>
        </div>
      )}

      {/* Main Workspace Area */}
      <main className="workspace-content">
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '350px', gap: '1rem' }}>
            <Loader2 size={36} color="#38bdf8" className="spin-animation" />
            <div style={{ color: '#cbd5e1', fontWeight: 600, fontSize: '1rem' }}>
              {loadingStatus || 'Analyzing Repository AST & Building Dependency Graphs...'}
            </div>
            <p style={{ color: '#64748b', fontSize: '0.85rem' }}>
              Extracting symbols, imports, classes, and generating Mermaid diagrams
            </p>
          </div>
        )}

        {error && !loading && (
          <div style={{
            background: 'rgba(244, 63, 94, 0.1)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            borderRadius: '12px',
            padding: '1.5rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '1rem',
            color: '#fecdd3'
          }}>
            <AlertCircle size={22} color="#f43f5e" style={{ marginTop: '0.2rem', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.35rem' }}>Project Loading Notice</div>
              <div style={{ fontSize: '0.88rem' }}>{error}</div>
              <div style={{ marginTop: '0.85rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => handleOpenSourceModal('folder')}
                  className="btn-primary"
                  style={{ padding: '0.35rem 0.85rem', fontSize: '0.8rem' }}
                >
                  <FolderUp size={14} /> Open Project Dialog
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Empty State / Get Started Hero when no project has been scanned yet */}
        {!loading && !scanData && !error && (
          <div className="empty-get-started-hero">
            <div className="empty-hero-badge">
              <Layers size={32} color="#38bdf8" />
            </div>
            <h2 className="empty-hero-title">Welcome to Project Explainer</h2>
            <p className="empty-hero-subtitle">
              Upload a folder, clone a Git repository, or provide a local path to inspect architecture, visualize diagrams, and ask AI doubts about the code.
            </p>

            <div className="empty-action-cards">
              <button
                type="button"
                className="empty-action-card"
                onClick={() => handleOpenSourceModal('folder')}
              >
                <div className="card-icon-wrap" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                  <FolderUp size={22} />
                </div>
                <div className="card-info">
                  <div className="card-title">Upload Folder</div>
                  <div className="card-desc">Select any local project directory directly from your computer</div>
                </div>
              </button>

              <button
                type="button"
                className="empty-action-card"
                onClick={() => handleOpenSourceModal('git')}
              >
                <div className="card-icon-wrap" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>
                  <GitBranch size={22} />
                </div>
                <div className="card-info">
                  <div className="card-title">Clone Git Repo</div>
                  <div className="card-desc">Paste a GitHub or Git repository link to clone & explain</div>
                </div>
              </button>

              <button
                type="button"
                className="empty-action-card"
                onClick={() => handleOpenSourceModal('zip')}
              >
                <div className="card-icon-wrap" style={{ background: 'rgba(52, 211, 153, 0.15)', color: '#34d399' }}>
                  <FileArchive size={22} />
                </div>
                <div className="card-info">
                  <div className="card-title">Upload ZIP</div>
                  <div className="card-desc">Drop or browse a compressed .zip archive of your project</div>
                </div>
              </button>

              <button
                type="button"
                className="empty-action-card"
                onClick={() => handleOpenSourceModal('path')}
              >
                <div className="card-icon-wrap" style={{ background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24' }}>
                  <FolderSearch size={22} />
                </div>
                <div className="card-info">
                  <div className="card-title">Local Path</div>
                  <div className="card-desc">Enter an absolute system directory path without copying files</div>
                </div>
              </button>
            </div>
          </div>
        )}

        {!loading && scanData && (
          <>
            {activeTab === 'architecture' && (
              <ArchitectureTab
                scanData={scanData}
                onNavigateToFile={handleNavigateToFile}
                onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
              />
            )}
            {activeTab === 'visualizer' && (
              <VisualizerTab
                scanData={scanData}
                onNavigateToFile={handleNavigateToFile}
              />
            )}
            {activeTab === 'inspector' && (
              <InspectorTab
                scanData={scanData}
                apiBaseUrl={API_BASE}
                initialFile={activeInspectorFile}
                onSelectActiveFile={(f) => setActiveInspectorFile(f)}
                onExplainCode={handleExplainCode}
              />
            )}
            {activeTab === 'explainer' && (
              <CodeExplainerTab
                scanData={scanData}
                apiBaseUrl={API_BASE}
                apiKey={apiKey}
                initialFile={activeExplainerFile || activeInspectorFile}
                onNavigateToAssistant={(question, file) => {
                  if (file) setActiveInspectorFile(file);
                  setActiveTab('assistant');
                }}
                onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
              />
            )}
            {activeTab === 'assistant' && (
              <AssistantTab
                scanData={scanData}
                apiBaseUrl={API_BASE}
                apiKey={apiKey}
                activeInspectorFile={activeInspectorFile}
                onNavigateToFile={handleNavigateToFile}
                onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
              />
            )}
          </>
        )}
      </main>

      {/* Floating AI Chatbot Widget (Always available across all tabs) */}
      <ChatbotWidget
        scanData={scanData}
        activeInspectorFile={activeInspectorFile}
        onNavigateToFile={handleNavigateToFile}
        apiBaseUrl={API_BASE}
        apiKey={apiKey}
        onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
      />

      {/* Project Source Ingestion Modal */}
      <ProjectSourceModal
        isOpen={isSourceModalOpen}
        onClose={() => setIsSourceModalOpen(false)}
        onScanPath={handleScan}
        onCloneGit={handleCloneGit}
        onUploadFolder={handleUploadFolder}
        onUploadZip={handleUploadZip}
        loading={loading}
        loadingStatus={loadingStatus}
        initialTab={sourceModalInitialTab}
      />

      {/* API Key Modal */}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        apiKey={apiKey}
        onSaveKey={handleSaveApiKey}
      />

      {/* Supabase Cloud Connection & Auth Modal */}
      <SupabaseAuthModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        activeScanData={scanData}
        onSyncSuccess={(res) => {
          console.log('Project synchronized to Supabase Cloud:', res);
        }}
      />
    </div>
  );
}

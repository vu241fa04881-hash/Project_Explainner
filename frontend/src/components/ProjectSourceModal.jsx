import React, { useState, useRef } from 'react';
import {
  FolderUp,
  GitBranch,
  FileArchive,
  FolderSearch,
  Sparkles,
  X,
  Upload,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ExternalLink,
  BookOpen
} from 'lucide-react';

const SAMPLE_REPOS = [
  { name: 'FastAPI', url: 'https://github.com/fastapi/fastapi', desc: 'Modern Python web framework' },
  { name: 'Flask', url: 'https://github.com/pallets/flask', desc: 'Lightweight WSGI web app framework' },
  { name: 'Express', url: 'https://github.com/expressjs/express', desc: 'Fast, minimalist Node.js web framework' },
  { name: 'Axios', url: 'https://github.com/axios/axios', desc: 'Promise-based HTTP client for browser & node' }
];

export default function ProjectSourceModal({
  isOpen,
  onClose,
  onScanPath,
  onCloneGit,
  onUploadFolder,
  onUploadZip,
  onOpenSavedProjects,
  loading,
  loadingStatus,
  initialTab = 'folder'
}) {
  const [activeSourceTab, setActiveSourceTab] = useState(initialTab);
  const [gitUrl, setGitUrl] = useState('');
  const [gitBranch, setGitBranch] = useState('');
  const [localPathInput, setLocalPathInput] = useState('');
  const [selectedFolderFiles, setSelectedFolderFiles] = useState([]);
  const [selectedFolderName, setSelectedFolderName] = useState('');
  const [selectedZipFile, setSelectedZipFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const folderInputRef = useRef(null);
  const zipInputRef = useRef(null);

  React.useEffect(() => {
    if (initialTab && isOpen) {
      setActiveSourceTab(initialTab);
    }
  }, [initialTab, isOpen]);

  if (!isOpen) return null;

  // Folder selection via native directory picker
  const handleFolderChange = (e) => {
    setErrorMsg('');
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Detect root folder name
    const firstRel = files[0].webkitRelativePath || '';
    const rootName = firstRel.split('/')[0] || 'Selected Folder';

    setSelectedFolderFiles(files);
    setSelectedFolderName(rootName);
  };

  // ZIP file selection
  const handleZipChange = (e) => {
    setErrorMsg('');
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.zip')) {
        setErrorMsg('Please select a valid .zip archive.');
        return;
      }
      setSelectedZipFile(file);
    }
  };

  // Drag and drop handler
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setErrorMsg('');

    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;

    // If single zip file dropped
    if (files.length === 1 && files[0].name.toLowerCase().endsWith('.zip')) {
      setActiveSourceTab('zip');
      setSelectedZipFile(files[0]);
      return;
    }

    // Check if webkitRelativePath exists or multiple files dropped
    if (files.some(f => f.webkitRelativePath)) {
      const firstRel = files[0].webkitRelativePath || '';
      const rootName = firstRel.split('/')[0] || 'Dropped Folder';
      setActiveSourceTab('folder');
      setSelectedFolderFiles(files);
      setSelectedFolderName(rootName);
    } else {
      // Just multiple files or folder without relative path
      setActiveSourceTab('folder');
      setSelectedFolderFiles(files);
      setSelectedFolderName(files[0].name.split('.')[0] || 'Uploaded Folder');
    }
  };

  const handleSubmitFolder = async () => {
    if (selectedFolderFiles.length === 0) {
      setErrorMsg('Please select a folder to upload.');
      return;
    }
    setErrorMsg('');
    try {
      await onUploadFolder(selectedFolderFiles);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to upload and process folder');
    }
  };

  const handleSubmitZip = async () => {
    if (!selectedZipFile) {
      setErrorMsg('Please select a .zip project file to upload.');
      return;
    }
    setErrorMsg('');
    try {
      await onUploadZip(selectedZipFile);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to upload and extract zip');
    }
  };

  const handleSubmitGit = async (urlToUse) => {
    const url = (urlToUse || gitUrl).trim();
    if (!url) {
      setErrorMsg('Please enter a valid Git or GitHub repository URL.');
      return;
    }
    setErrorMsg('');
    try {
      await onCloneGit(url, gitBranch.trim() || null);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to clone repository');
    }
  };

  const handleSubmitLocalPath = async () => {
    const path = localPathInput.trim();
    if (!path) {
      setErrorMsg('Please enter a directory path on your computer.');
      return;
    }
    setErrorMsg('');
    try {
      await onScanPath(path);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to scan directory');
    }
  };

  return (
    <div className="modal-overlay" onClick={() => !loading && onClose()}>
      <div className="modal-content project-source-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="brand-logo-badge" style={{ width: '38px', height: '38px' }}>
              <FolderUp size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>Import / Open Project</h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.2rem 0 0' }}>
                Upload a folder, clone a Git repo, or unpack a zip archive to analyze & ask doubts
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="control-btn"
            disabled={loading}
            style={{ width: '32px', height: '32px' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Source Navigation Tabs */}
        <div className="source-tabs-bar">
          <button
            type="button"
            className={`source-tab-btn ${activeSourceTab === 'folder' ? 'active' : ''}`}
            onClick={() => setActiveSourceTab('folder')}
            disabled={loading}
          >
            <FolderUp size={16} />
            <span>Upload Folder</span>
          </button>

          <button
            type="button"
            className={`source-tab-btn ${activeSourceTab === 'git' ? 'active' : ''}`}
            onClick={() => setActiveSourceTab('git')}
            disabled={loading}
          >
            <GitBranch size={16} />
            <span>Git Repository</span>
          </button>

          <button
            type="button"
            className={`source-tab-btn ${activeSourceTab === 'zip' ? 'active' : ''}`}
            onClick={() => setActiveSourceTab('zip')}
            disabled={loading}
          >
            <FileArchive size={16} />
            <span>Upload ZIP</span>
          </button>

          <button
            type="button"
            className={`source-tab-btn ${activeSourceTab === 'path' ? 'active' : ''}`}
            onClick={() => setActiveSourceTab('path')}
            disabled={loading}
          >
            <FolderSearch size={16} />
            <span>Local Path</span>
          </button>

          {onOpenSavedProjects && (
            <button
              type="button"
              className="source-tab-btn"
              style={{ color: '#34d399', marginLeft: 'auto' }}
              onClick={() => {
                onClose();
                onOpenSavedProjects();
              }}
              title="Study previously saved uploads from Supabase"
            >
              <BookOpen size={16} color="#34d399" />
              <span>Saved in Database</span>
            </button>
          )}
        </div>

        {/* Error Notice */}
        {errorMsg && (
          <div className="source-error-banner">
            <AlertCircle size={16} color="#f43f5e" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Tab 1: Upload Folder */}
        {activeSourceTab === 'folder' && (
          <div className="source-tab-panel">
            <div
              className={`dropzone-container ${dragActive ? 'dragover' : ''} ${selectedFolderFiles.length > 0 ? 'has-files' : ''}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => folderInputRef.current?.click()}
            >
              <input
                ref={folderInputRef}
                type="file"
                webkitdirectory=""
                directory=""
                multiple
                style={{ display: 'none' }}
                onChange={handleFolderChange}
              />

              {selectedFolderFiles.length > 0 ? (
                <div className="dropzone-selected-info">
                  <div className="success-icon-badge">
                    <CheckCircle2 size={24} color="#34d399" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#f8fafc' }}>
                      {selectedFolderName}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                      {selectedFolderFiles.length.toLocaleString()} files queued
                      {selectedFolderFiles.length > 1000 && (
                        <span style={{ marginLeft: '6px', color: '#38bdf8', fontWeight: 600 }}>
                          (High-Scale Mode: &gt;1,000 files chunked)
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '0.15rem' }}>
                      Includes source code, data files (.csv, .json, .sql, .tsv), and configs
                    </div>
                  </div>
                  <span className="btn-secondary" style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}>
                    Change Folder
                  </span>
                </div>
              ) : (
                <div className="dropzone-idle">
                  <div className="dropzone-icon-circle">
                    <Upload size={24} color="#4f46e5" />
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#0f172a', marginTop: '0.6rem' }}>
                    Click to select a project folder or drag & drop here
                  </div>
                  <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.35rem 0 0' }}>
                    Supports 1,000+ files, source code &amp; data files (.csv, .json, .sql, etc.)
                  </p>
                </div>
              )}
            </div>

            <div className="modal-actions-bar">
              <button
                type="button"
                className="btn-secondary"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn-primary"
                onClick={handleSubmitFolder}
                disabled={loading || selectedFolderFiles.length === 0}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="spin-animation" />
                    <span>{loadingStatus || 'Processing Folder...'}</span>
                  </>
                ) : (
                  <>
                    <span>Upload & Explain</span>
                    <Upload size={15} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Git Repository URL */}
        {activeSourceTab === 'git' && (
          <div className="source-tab-panel">
            <div style={{ marginBottom: '1.2rem' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.4rem' }}>
                Git or GitHub Repository URL
              </label>
              <div className="input-with-icon">
                <GitBranch size={17} color="#94a3b8" />
                <input
                  type="text"
                  className="modal-text-input"
                  placeholder="e.g. https://github.com/fastapi/fastapi or https://github.com/pallets/flask"
                  value={gitUrl}
                  onChange={(e) => setGitUrl(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div style={{ marginBottom: '1.2rem' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.4rem' }}>
                Branch (Optional, defaults to main/master)
              </label>
              <input
                type="text"
                className="modal-text-input"
                placeholder="main"
                value={gitBranch}
                onChange={(e) => setGitBranch(e.target.value)}
                disabled={loading}
                style={{ width: '180px' }}
              />
            </div>

            {/* Quick Starter Chips */}
            <div style={{ marginTop: '0.5rem', marginBottom: '1.2rem' }}>
              <span style={{ fontSize: '0.76rem', color: '#94a3b8', display: 'block', marginBottom: '0.5rem' }}>
                Or try one of these popular open-source projects:
              </span>
              <div className="sample-repos-grid">
                {SAMPLE_REPOS.map((repo, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="sample-repo-card"
                    onClick={() => {
                      setGitUrl(repo.url);
                      handleSubmitGit(repo.url);
                    }}
                    disabled={loading}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 600, color: '#4f46e5', fontSize: '0.82rem' }}>{repo.name}</span>
                      <ExternalLink size={12} color="#64748b" />
                    </div>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.2rem', display: 'block', textAlign: 'left' }}>
                      {repo.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="modal-actions-bar">
              <button
                type="button"
                className="btn-secondary"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn-primary"
                onClick={() => handleSubmitGit()}
                disabled={loading || !gitUrl.trim()}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="spin-animation" />
                    <span>{loadingStatus || 'Cloning & Analyzing...'}</span>
                  </>
                ) : (
                  <>
                    <span>Clone & Explain</span>
                    <GitBranch size={15} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Upload ZIP Archive */}
        {activeSourceTab === 'zip' && (
          <div className="source-tab-panel">
            <div
              className={`dropzone-container ${dragActive ? 'dragover' : ''} ${selectedZipFile ? 'has-files' : ''}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => zipInputRef.current?.click()}
            >
              <input
                ref={zipInputRef}
                type="file"
                accept=".zip"
                style={{ display: 'none' }}
                onChange={handleZipChange}
              />

              {selectedZipFile ? (
                <div className="dropzone-selected-info">
                  <div className="success-icon-badge">
                    <CheckCircle2 size={24} color="#34d399" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#f8fafc' }}>
                      {selectedZipFile.name}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                      {(selectedZipFile.size / (1024 * 1024)).toFixed(2)} MB • Ready to unpack & scan
                    </div>
                  </div>
                  <span className="btn-secondary" style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}>
                    Choose Other
                  </span>
                </div>
              ) : (
                <div className="dropzone-idle">
                  <div className="dropzone-icon-circle">
                    <FileArchive size={24} color="#4f46e5" />
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#0f172a', marginTop: '0.6rem' }}>
                    Drop a .zip project file here or click to browse
                  </div>
                  <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.35rem 0 0' }}>
                    Great for downloaded GitHub repository archives or zipped project folders
                  </p>
                </div>
              )}
            </div>

            <div className="modal-actions-bar">
              <button
                type="button"
                className="btn-secondary"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn-primary"
                onClick={handleSubmitZip}
                disabled={loading || !selectedZipFile}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="spin-animation" />
                    <span>{loadingStatus || 'Extracting & Analyzing...'}</span>
                  </>
                ) : (
                  <>
                    <span>Unpack & Explain</span>
                    <Upload size={15} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Tab 4: Local Path */}
        {activeSourceTab === 'path' && (
          <div className="source-tab-panel">
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.4rem' }}>
                Local Folder Absolute Path
              </label>
              <div className="input-with-icon">
                <FolderSearch size={17} color="#94a3b8" />
                <input
                  type="text"
                  className="modal-text-input"
                  placeholder="e.g. C:\Users\Username\Projects\MyApp"
                  value={localPathInput}
                  onChange={(e) => setLocalPathInput(e.target.value)}
                  disabled={loading}
                />
              </div>
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.4rem' }}>
                Scans directly from disk without copying files. Recommended for very large repos.
              </p>
            </div>

            <div className="modal-actions-bar">
              <button
                type="button"
                className="btn-secondary"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn-primary"
                onClick={handleSubmitLocalPath}
                disabled={loading || !localPathInput.trim()}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="spin-animation" />
                    <span>{loadingStatus || 'Scanning Path...'}</span>
                  </>
                ) : (
                  <>
                    <span>Scan & Explain</span>
                    <FolderSearch size={15} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

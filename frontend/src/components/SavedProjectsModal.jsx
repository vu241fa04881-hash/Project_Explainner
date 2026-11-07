import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  FolderOpen,
  FolderUp,
  GitBranch,
  FileArchive,
  Database,
  Trash2,
  Calendar,
  Layers,
  Code2,
  FileText,
  Search,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import {
  fetchUserProjects,
  loadProjectFullData,
  deleteProject,
  getCurrentUser,
  isSupabaseConfigured
} from '../lib/supabaseClient';

export default function SavedProjectsModal({
  isOpen,
  onClose,
  onOpenSupabaseConnect,
  onLoadProject,
  apiBaseUrl = ''
}) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingProjectId, setLoadingProjectId] = useState(null);
  const [deletingProjectId, setDeletingProjectId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadProjectsList();
    }
  }, [isOpen]);

  const loadProjectsList = async () => {
    setErrorMsg('');
    setLoading(true);
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);

      if (!currentUser) {
        setProjects([]);
        setLoading(false);
        return;
      }

      const list = await fetchUserProjects();
      setProjects(list || []);
    } catch (err) {
      console.error('Error fetching projects:', err);
      setErrorMsg(err.message || 'Failed to load projects from your Supabase database.');
    } finally {
      setLoading(false);
    }
  };

  const handleStudyProject = async (project) => {
    setLoadingProjectId(project.id);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // 1. Fetch full project, scan, diagrams & files from Supabase
      const scanData = await loadProjectFullData(project.id);

      // 2. Sync to backend session if running so AI assistant & code explain work seamlessly
      try {
        await fetch(`${apiBaseUrl}/api/restore-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            repo_name: scanData.repo_name,
            repo_path: scanData.repo_path,
            total_files: scanData.total_files,
            total_loc: scanData.total_loc,
            languages: scanData.languages,
            files: scanData.files,
            tree: scanData.tree,
            diagrams: scanData.diagrams,
            explanation: scanData.explanation
          })
        });
      } catch (backendErr) {
        console.warn('Backend session restore optional notification:', backendErr);
      }

      // 3. Inject into active workspace
      onLoadProject(scanData);
      onClose();
    } catch (err) {
      console.error('Failed to load project for study:', err);
      setErrorMsg(`Unable to load "${project.name}": ${err.message}`);
    } finally {
      setLoadingProjectId(null);
    }
  };

  const handleDelete = async (e, projectId, projectName) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete "${projectName}" from your Supabase database?`)) {
      return;
    }

    setDeletingProjectId(projectId);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await deleteProject(projectId);
      setProjects(prev => prev.filter(p => p.id !== projectId));
      setSuccessMsg(`"${projectName}" was removed from your database.`);
    } catch (err) {
      setErrorMsg(`Failed to delete project: ${err.message}`);
    } finally {
      setDeletingProjectId(null);
    }
  };

  if (!isOpen) return null;

  const filteredProjects = projects.filter(p => {
    const q = searchQuery.toLowerCase();
    const nameMatch = (p.name || '').toLowerCase().includes(q);
    const langMatch = Object.keys(p.languages || {}).some(l => l.toLowerCase().includes(q));
    return nameMatch || langMatch;
  });

  const getSourceIcon = (type) => {
    switch (type) {
      case 'git':
        return <GitBranch size={15} color="#38bdf8" />;
      case 'zip':
        return <FileArchive size={15} color="#f59e0b" />;
      default:
        return <FolderUp size={15} color="#34d399" />;
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1250 }}>
      <div
        className="supabase-modal-container"
        onClick={(e) => e.stopPropagation()}
        style={{ width: '740px', maxWidth: '96vw', maxHeight: '88vh' }}
      >
        {/* Header */}
        <div className="supabase-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(52, 211, 153, 0.2), rgba(56, 189, 248, 0.15))',
              border: '1px solid rgba(52, 211, 153, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#34d399',
              boxShadow: '0 0 15px rgba(52, 211, 153, 0.2)'
            }}>
              <BookOpen size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                  Study Previous Uploads
                </h3>
                {projects.length > 0 && (
                  <span style={{
                    fontSize: '0.7rem',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '9999px',
                    backgroundColor: 'rgba(52, 211, 153, 0.15)',
                    border: '1px solid rgba(52, 211, 153, 0.35)',
                    color: '#34d399',
                    fontWeight: 600
                  }}>
                    {projects.length} Saved {projects.length === 1 ? 'Project' : 'Projects'}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.76rem', color: '#94a3b8', marginTop: '2px' }}>
                Open previously analyzed codebases and datasets stored in your private database
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <button
              type="button"
              className="control-btn"
              onClick={loadProjectsList}
              disabled={loading}
              title="Refresh projects list"
              style={{ width: '32px', height: '32px' }}
            >
              <RefreshCw size={14} className={loading ? 'spin-animation' : ''} />
            </button>
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

        {/* Search Bar */}
        {projects.length > 0 && (
          <div style={{ padding: '0.85rem 1.5rem 0' }}>
            <div className="supabase-input-group">
              <Search size={15} className="supabase-input-icon" />
              <input
                type="text"
                className="supabase-text-input"
                placeholder="Search saved projects by name or language..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Projects List Body */}
        <div className="supabase-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {!user ? (
            /* Not logged in state */
            <div style={{
              textAlign: 'center',
              padding: '3rem 1.5rem',
              color: '#94a3b8',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.85rem'
            }}>
              <Database size={42} color="#64748b" />
              <div>
                <h4 style={{ color: '#f1f5f9', fontSize: '1.05rem', margin: '0 0 0.4rem' }}>
                  Supabase Authentication Required
                </h4>
                <p style={{ fontSize: '0.82rem', maxWidth: '420px', margin: '0 auto', lineHeight: 1.5 }}>
                  Connect your personal Supabase project and sign in to view and study your previously uploaded documents and codebases.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSupabaseConnect();
                }}
                className="btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  fontSize: '0.85rem',
                  padding: '0.6rem 1.25rem',
                  background: 'linear-gradient(135deg, #059669, #10b981)',
                  borderColor: '#34d399'
                }}
              >
                <Database size={15} />
                <span>Connect &amp; Sign In to Supabase</span>
              </button>
            </div>
          ) : loading && projects.length === 0 ? (
            /* Loading state */
            <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: '#94a3b8' }}>
              <Loader2 size={32} className="spin-animation" style={{ margin: '0 auto 0.75rem', color: '#34d399' }} />
              <div style={{ fontSize: '0.86rem' }}>Loading your saved projects from Supabase...</div>
            </div>
          ) : filteredProjects.length === 0 ? (
            /* Empty state */
            <div style={{
              textAlign: 'center',
              padding: '3rem 1.5rem',
              color: '#94a3b8',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.75rem'
            }}>
              <BookOpen size={40} color="#64748b" />
              <div>
                <h4 style={{ color: '#0f172a', fontSize: '1.05rem', margin: '0 0 0.4rem' }}>
                  {searchQuery ? 'No Matching Projects Found' : 'No Saved Projects Yet'}
                </h4>
                <p style={{ fontSize: '0.82rem', maxWidth: '400px', margin: '0 auto', lineHeight: 1.5, color: '#64748b' }}>
                  {searchQuery
                    ? `No saved project matches "${searchQuery}". Try a different keyword.`
                    : 'Any folder, Git repository, or ZIP file you analyze will be stored in your database. You can return here anytime to study them.'}
                </p>
              </div>
            </div>
          ) : (
            /* Cards List */
            filteredProjects.map((p) => {
              const isLoadingThis = loadingProjectId === p.id;
              const isDeletingThis = deletingProjectId === p.id;
              const dateStr = p.created_at ? new Date(p.created_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              }) : 'Saved';
              const topLanguages = Object.keys(p.languages || {}).slice(0, 4);

              return (
                <div
                  key={p.id}
                  style={{
                    backgroundColor: '#f8fafc',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '10px',
                    padding: '1.1rem 1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
                  }}
                  className="saved-project-card"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <div style={{
                        padding: '0.45rem',
                        borderRadius: '8px',
                        backgroundColor: '#ffffff',
                        border: '1px solid var(--border-subtle)'
                      }}>
                        {getSourceIcon(p.source_type)}
                      </div>
                      <div>
                        <h4 style={{ fontSize: '0.96rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                          {p.name}
                        </h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.73rem', color: '#64748b', marginTop: '2px' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Calendar size={11} /> {dateStr}
                          </span>
                          <span>•</span>
                          <span style={{ textTransform: 'capitalize' }}>Source: {p.source_type || 'folder'}</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, p.id, p.name)}
                        disabled={isDeletingThis || isLoadingThis}
                        className="control-btn"
                        title="Delete project from database"
                        style={{ width: '30px', height: '30px', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.25)' }}
                      >
                        {isDeletingThis ? <Loader2 size={13} className="spin-animation" /> : <Trash2 size={13} />}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStudyProject(p)}
                        disabled={isLoadingThis || isDeletingThis}
                        className="btn-primary"
                        style={{
                          fontSize: '0.8rem',
                          padding: '0.45rem 0.95rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          background: 'linear-gradient(135deg, #059669, #10b981)',
                          borderColor: '#34d399'
                        }}
                      >
                        {isLoadingThis ? (
                          <>
                            <Loader2 size={13} className="spin-animation" />
                            <span>Loading Documents...</span>
                          </>
                        ) : (
                          <>
                            <FolderOpen size={13} />
                            <span>Study / Open</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Summary Snippet */}
                  {p.project_scans?.[0]?.summary && (
                    <div style={{
                      fontSize: '0.78rem',
                      color: '#475569',
                      lineHeight: 1.45,
                      backgroundColor: '#ffffff',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border-subtle)'
                    }}>
                      {p.project_scans[0].summary.slice(0, 180)}
                      {p.project_scans[0].summary.length > 180 ? '...' : ''}
                    </div>
                  )}

                  {/* Project Metrics Pills */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', fontSize: '0.73rem' }}>
                      <span style={{ backgroundColor: '#eff6ff', color: '#2563eb', padding: '0.15rem 0.5rem', borderRadius: '4px', border: '1px solid #bfdbfe' }}>
                        <strong>{p.files_count?.toLocaleString() || 0}</strong> Files
                      </span>
                      {p.data_files_count > 0 && (
                        <span style={{ backgroundColor: '#ecfdf5', color: '#059669', padding: '0.15rem 0.5rem', borderRadius: '4px', border: '1px solid #bbf7d0' }}>
                          <strong>{p.data_files_count.toLocaleString()}</strong> Data Datasets
                        </span>
                      )}
                      <span style={{ backgroundColor: '#f1f5f9', color: '#475569', padding: '0.15rem 0.5rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                        <strong>{p.loc?.toLocaleString() || 0}</strong> LOC
                      </span>
                    </div>

                    {topLanguages.length > 0 && (
                      <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                        {topLanguages.map((lang, idx) => (
                          <span key={idx} style={{
                            fontSize: '0.7rem',
                            color: '#64748b',
                            backgroundColor: '#ffffff',
                            border: '1px solid var(--border-subtle)',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '4px'
                          }}>
                            {lang}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}


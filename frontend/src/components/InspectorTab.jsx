import React, { useState, useEffect, useCallback } from 'react';
import {
  Folder,
  FolderOpen,
  FileCode,
  ChevronRight,
  ChevronDown,
  Search,
  Copy,
  Check,
  Code2,
  Box,
  Layers,
  PanelLeftClose,
  PanelLeft,
  Sparkles,
  Database,
  Table
} from 'lucide-react';

function TreeNode({ node, onSelectFile, selectedFile, searchTerm }) {
  const [isOpen, setIsOpen] = useState(true);

  if (node.type === 'directory') {
    return (
      <div style={{ marginLeft: '0.5rem' }}>
        <div
          onClick={() => setIsOpen(!isOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.28rem 0.45rem',
            cursor: 'pointer',
            borderRadius: '5px',
            fontSize: '0.82rem',
            color: '#334155',
            userSelect: 'none'
          }}
          className="tree-dir-hover"
        >
          {isOpen ? <ChevronDown size={14} color="#94a3b8" /> : <ChevronRight size={14} color="#94a3b8" />}
          {isOpen ? <FolderOpen size={15} color="#4f46e5" /> : <Folder size={15} color="#4f46e5" />}
          <span style={{ fontWeight: 600 }}>{node.name}</span>
        </div>
        {isOpen && node.children && (
          <div style={{ borderLeft: '1px solid var(--border-subtle)', marginLeft: '0.55rem', paddingLeft: '0.2rem' }}>
            {node.children.map((child, idx) => (
              <TreeNode
                key={idx}
                node={child}
                onSelectFile={onSelectFile}
                selectedFile={selectedFile}
                searchTerm={searchTerm}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // File node
  const isSelected = selectedFile === node.path;
  const matchesSearch = !searchTerm || node.name.toLowerCase().includes(searchTerm.toLowerCase());

  if (!matchesSearch) return null;

  return (
    <div
      onClick={() => onSelectFile(node.path)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.32rem 0.6rem',
        marginLeft: '1.2rem',
        cursor: 'pointer',
        borderRadius: '6px',
        fontSize: '0.8rem',
        background: isSelected ? '#eef2ff' : 'transparent',
        border: isSelected ? '1px solid #c7d2fe' : '1px solid transparent',
        color: isSelected ? '#4f46e5' : '#475569',
        fontWeight: isSelected ? 600 : 400,
        transition: 'all 0.15s ease'
      }}
      className="tree-file-hover"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', overflow: 'hidden' }}>
        {node.category === 'data' || ['.csv', '.tsv', '.json', '.sql', '.xml', '.parquet'].some(ext => node.name.toLowerCase().endsWith(ext)) ? (
          <Database size={14} color={isSelected ? '#16a34a' : '#10b981'} />
        ) : (
          <FileCode size={14} color={isSelected ? '#4f46e5' : '#64748b'} />
        )}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name}</span>
      </div>
      <span style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'monospace' }}>{node.loc}L</span>
    </div>
  );
}

export default function InspectorTab({
  scanData,
  apiBaseUrl,
  initialFile = null,
  onSelectActiveFile = null,
  onExplainCode = null
}) {
  const [selectedPath, setSelectedPath] = useState(initialFile);
  const [fileDetails, setFileDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const handleSelectFile = useCallback(async (filePath) => {
    setSelectedPath(filePath);
    if (onSelectActiveFile) {
      onSelectActiveFile(filePath);
    }
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/file?path=${encodeURIComponent(filePath)}`);
      if (res.ok) {
        const data = await res.json();
        setFileDetails(data);
      }
    } catch (e) {
      console.error('Error fetching file content:', e);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, onSelectActiveFile]);

  // Auto-select initial file or first available file
  useEffect(() => {
    if (initialFile) {
      handleSelectFile(initialFile);
      return;
    }
    if (scanData?.tree && !selectedPath) {
      const findFirst = (n) => {
        if (n.type === 'file') return n.path;
        if (n.children) {
          for (const c of n.children) {
            const f = findFirst(c);
            if (f) return f;
          }
        }
        return null;
      };
      const first = findFirst(scanData.tree);
      if (first) handleSelectFile(first);
    }
  }, [scanData, initialFile, handleSelectFile, selectedPath]);

  const handleCopyCode = () => {
    if (!fileDetails?.content) return;
    navigator.clipboard.writeText(fileDetails.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  if (!scanData) return null;

  const analysis = fileDetails?.analysis || {};
  const classes = analysis.classes || [];
  const functions = analysis.functions || [];
  const imports = analysis.imports || [];
  const meta = analysis.metadata || {};

  return (
    <div className={`code-inspector-container ${!isSidebarOpen ? 'sidebar-collapsed' : ''}`}>
      {/* File Tree Sidebar */}
      <div className={`file-tree-pane ${!isSidebarOpen ? 'hidden-pane' : ''}`}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#f1f5f9', fontWeight: 600, fontSize: '0.85rem' }}>
            <Layers size={16} color="#38bdf8" />
            <span>Files Explorer</span>
          </div>
          <button
            className="control-btn"
            onClick={() => setIsSidebarOpen(false)}
            title="Collapse file tree"
          >
            <PanelLeftClose size={15} />
          </button>
        </div>

        {/* Search inside file tree */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          background: 'rgba(15, 23, 42, 0.8)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '6px',
          padding: '0.35rem 0.6rem',
          marginBottom: '0.75rem'
        }}>
          <Search size={14} color="#64748b" />
          <input
            type="text"
            placeholder="Filter files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#f8fafc',
              fontSize: '0.78rem',
              width: '100%'
            }}
          />
        </div>

        {/* Tree List */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {scanData.tree ? (
            <TreeNode
              node={scanData.tree}
              onSelectFile={handleSelectFile}
              selectedFile={selectedPath}
              searchTerm={searchTerm}
            />
          ) : (
            <p style={{ color: '#94a3b8', fontSize: '0.8rem' }}>No files found.</p>
          )}
        </div>
      </div>

      {/* Code Viewer Main Area */}
      <div className="file-editor-pane">
        {/* Header Ribbon */}
        <div className="file-code-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            {!isSidebarOpen && (
              <button
                className="control-btn"
                onClick={() => setIsSidebarOpen(true)}
                title="Expand file tree"
                style={{ marginRight: '0.3rem' }}
              >
                <PanelLeft size={16} color="#4f46e5" />
              </button>
            )}
            <FileCode size={16} color="#4f46e5" />
            <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.85rem', color: '#0f172a' }}>
              {selectedPath || 'Select a file to inspect'}
            </span>
          </div>

          {fileDetails && (
            <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
              <button
                className="btn-primary"
                onClick={() => onExplainCode && onExplainCode(selectedPath)}
                style={{ padding: '0.32rem 0.75rem', fontSize: '0.75rem', gap: '0.35rem' }}
                title="Open Code & Logic Explainer for this file"
              >
                <Sparkles size={13} />
                <span>Explain Code & Logic</span>
              </button>
              <span className="lang-tag">{fileDetails.language}</span>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                {fileDetails.loc} lines
              </span>
              <button
                className="btn-secondary"
                onClick={handleCopyCode}
                style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
                title="Copy entire file"
              >
                {copied ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Symbols Strip: Classes, Functions & Data Columns */}
        {fileDetails && (classes.length > 0 || functions.length > 0 || imports.length > 0 || meta.columns || meta.tables_referenced || meta.keys) && (
          <div style={{
            background: 'rgba(15, 23, 42, 0.6)',
            padding: '0.5rem 1.25rem',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            gap: '1.25rem',
            alignItems: 'center',
            flexWrap: 'wrap',
            fontSize: '0.75rem'
          }}>
            {meta.columns && meta.columns.length > 0 && (
              <div style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                <Table size={14} />
                <span style={{ fontWeight: 700 }}>Data Columns ({meta.columns.length}):</span>
                {meta.columns.slice(0, 8).map((col, i) => (
                  <span key={i} style={{ color: '#6ee7b7', backgroundColor: 'rgba(52, 211, 153, 0.1)', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                    {col}
                  </span>
                ))}
                {meta.columns.length > 8 && <span style={{ color: '#64748b' }}>+{meta.columns.length - 8} more</span>}
              </div>
            )}
            {meta.tables_referenced && meta.tables_referenced.length > 0 && (
              <div style={{ color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                <Database size={14} />
                <span style={{ fontWeight: 700 }}>Tables ({meta.tables_referenced.length}):</span>
                {meta.tables_referenced.map((t, i) => (
                  <span key={i} style={{ color: '#bae6fd', backgroundColor: 'rgba(56, 189, 248, 0.1)', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                    {t}
                  </span>
                ))}
              </div>
            )}
            {classes.length > 0 && (
              <div style={{ color: '#818cf8', display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                <Box size={14} />
                <span style={{ fontWeight: 700 }}>Classes ({classes.length}):</span>
                {classes.map((c, i) => (
                  <span
                    key={i}
                    onClick={() => onExplainCode && onExplainCode(selectedPath, c.name)}
                    style={{ cursor: 'pointer', textDecoration: 'underline dotted', color: '#c7d2fe' }}
                    title={`Click to explain class ${c.name}`}
                  >
                    {c.name}{i < classes.length - 1 ? ',' : ''}
                  </span>
                ))}
              </div>
            )}
            {functions.length > 0 && (
              <div style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                <Code2 size={14} />
                <span style={{ fontWeight: 700 }}>Functions ({functions.length}):</span>
                {functions.slice(0, 5).map((f, i) => (
                  <span
                    key={i}
                    onClick={() => onExplainCode && onExplainCode(selectedPath, f.name)}
                    style={{ cursor: 'pointer', textDecoration: 'underline dotted', color: '#a7f3d0' }}
                    title={`Click to explain function ${f.name}() logic`}
                  >
                    {f.name}(){i < Math.min(5, functions.length) - 1 ? ',' : ''}
                  </span>
                ))}
                {functions.length > 5 && (
                  <span style={{ color: '#64748b' }}>+{functions.length - 5} more</span>
                )}
              </div>
            )}
            {imports.length > 0 && (
              <div style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ fontWeight: 600 }}>Imports: {imports.length}</span>
              </div>
            )}
          </div>
        )}

        {/* Code Content */}
        <div className="file-code-body">
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
              Parsing symbols and loading source...
            </div>
          ) : fileDetails ? (
            <div style={{ display: 'table', width: '100%' }}>
              {fileDetails.content.split('\n').map((line, idx) => (
                <div key={idx} style={{ display: 'table-row', lineHeight: 1.6 }} className="code-line-row">
                  <span style={{
                    display: 'table-cell',
                    width: '45px',
                    textAlign: 'right',
                    paddingRight: '1rem',
                    color: '#475569',
                    userSelect: 'none',
                    borderRight: '1px solid rgba(255, 255, 255, 0.05)'
                  }}>
                    {idx + 1}
                  </span>
                  <span style={{ display: 'table-cell', paddingLeft: '1rem', whiteSpace: 'pre', color: '#e2e8f0' }}>
                    {line}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
              Select a file from the explorer on the left to view symbols and source code.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

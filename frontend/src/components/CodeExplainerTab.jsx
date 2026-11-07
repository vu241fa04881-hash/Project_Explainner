import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileCode,
  Sparkles,
  HelpCircle,
  Copy,
  Check,
  RefreshCw,
  Layers,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Search,
  BookOpen,
  Code2,
  Cpu,
  GitBranch,
  Lightbulb,
  Maximize2,
  ArrowRight,
  MessageSquare,
  AlertCircle,
  Edit3,
  Send,
  Loader2,
  Workflow
} from 'lucide-react';
import MermaidViewer from './MermaidViewer';

const EXPLAIN_MODES = [
  { id: 'full', label: 'Full Walkthrough', icon: BookOpen, desc: 'Complete breakdown of purpose, logic, symbols & edge cases' },
  { id: 'logic', label: 'Step-by-Step Logic', icon: GitBranch, desc: 'Sequential trace of inputs, state mutations, conditions & returns' },
  { id: 'beginner', label: 'Explain to a Beginner', icon: Lightbulb, desc: 'Everyday analogies and clear plain English without heavy jargon' },
  { id: 'functions', label: 'Functions & Classes', icon: Code2, desc: 'In-depth breakdown of arguments, return values and methods' },
  { id: 'flowchart', label: 'Visual Flowchart', icon: Workflow, desc: 'Interactive decision tree and visual execution flow diagram' }
];

const QUICK_PROMPTS = [
  { label: 'Step-by-Step Logic', mode: 'logic', query: 'Trace the step-by-step execution flow from input to output' },
  { label: 'Like I\'m 10', mode: 'beginner', query: 'Explain how this code works using a simple real-world analogy' },
  { label: 'Key Functions', mode: 'functions', query: 'What does each function do and what are its inputs/outputs?' },
  { label: 'Edge Cases & Gotchas', mode: 'full', query: 'What edge cases, error conditions, or tricky logic exist here?' },
  { label: 'Control Flow Diagram', mode: 'flowchart', query: 'Show me the visual logic flowchart of this code' }
];

function TreeNode({ node, onSelectFile, selectedFile, searchTerm }) {
  const [isOpen, setIsOpen] = useState(true);

  if (node.type === 'directory') {
    return (
      <div style={{ marginLeft: '0.45rem' }}>
        <div
          onClick={() => setIsOpen(!isOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.26rem 0.45rem',
            cursor: 'pointer',
            borderRadius: '5px',
            fontSize: '0.8rem',
            color: '#cbd5e1',
            userSelect: 'none'
          }}
          className="tree-dir-hover"
        >
          {isOpen ? <ChevronDown size={13} color="#94a3b8" /> : <ChevronRight size={13} color="#94a3b8" />}
          {isOpen ? <FolderOpen size={14} color="#38bdf8" /> : <Folder size={14} color="#38bdf8" />}
          <span style={{ fontWeight: 600 }}>{node.name}</span>
        </div>
        {isOpen && node.children && (
          <div style={{ borderLeft: '1px solid rgba(255, 255, 255, 0.08)', marginLeft: '0.5rem', paddingLeft: '0.2rem' }}>
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
        padding: '0.3rem 0.55rem',
        marginLeft: '1.1rem',
        cursor: 'pointer',
        borderRadius: '6px',
        fontSize: '0.78rem',
        background: isSelected ? 'rgba(56, 189, 248, 0.18)' : 'transparent',
        border: isSelected ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid transparent',
        color: isSelected ? '#38bdf8' : '#94a3b8',
        fontWeight: isSelected ? 600 : 400,
        transition: 'all 0.15s ease'
      }}
      className="tree-file-hover"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', overflow: 'hidden' }}>
        <FileCode size={13} color={isSelected ? '#38bdf8' : '#64748b'} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name}</span>
      </div>
      <span style={{ fontSize: '0.68rem', color: '#64748b', fontFamily: 'monospace' }}>{node.loc}L</span>
    </div>
  );
}

export default function CodeExplainerTab({
  scanData,
  apiBaseUrl,
  apiKey,
  initialFile = null,
  onNavigateToAssistant = null,
  onOpenApiKeyModal = null
}) {
  const [selectedFile, setSelectedFile] = useState(initialFile);
  const [fileDetails, setFileDetails] = useState(null);
  const [customCode, setCustomCode] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customSnippetTitle, setCustomSnippetTitle] = useState('My Custom Code Snippet');
  
  const [mode, setMode] = useState('full');
  const [activeSymbol, setActiveSymbol] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [explanation, setExplanation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [error, setError] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedExplanation, setCopiedExplanation] = useState(false);
  
  const [viewTab, setViewTab] = useState('explanation'); // 'explanation' | 'flowchart'
  const [followUpQuestion, setFollowUpQuestion] = useState('');

  // Fetch file content from in-memory scanData or backend
  const loadFileContent = useCallback(async (filePath) => {
    // If file content is already present in scanData (e.g. loaded from Supabase)
    if (scanData?.files?.[filePath]?.content) {
      const cached = {
        path: filePath,
        name: scanData.files[filePath].name || filePath.split('/').pop(),
        content: scanData.files[filePath].content,
        language: scanData.files[filePath].language || 'text',
        size_bytes: scanData.files[filePath].size_bytes || 0,
        loc: scanData.files[filePath].loc || 0,
        analysis: scanData.files[filePath].analysis || {}
      };
      setFileDetails(cached);
      return cached;
    }

    try {
      const res = await fetch(`${apiBaseUrl}/api/file?path=${encodeURIComponent(filePath)}`);
      if (res.ok) {
        const data = await res.json();
        setFileDetails(data);
        return data;
      }
    } catch (e) {
      console.error('Error fetching file content:', e);
    }
    return null;
  }, [apiBaseUrl, scanData]);

  // Request explanation from backend
  const explainCode = useCallback(async ({
    targetFile = null,
    codeContent = null,
    explainMode = 'full',
    symbolName = null
  } = {}) => {
    setLoading(true);
    setError(null);
    setLoadingStep('Analyzing AST, tracing execution logic, and drafting explanation...');

    try {
      const payload = {
        file_path: targetFile || (isCustomMode ? 'custom_snippet' : selectedFile),
        code: codeContent || (isCustomMode ? customCode : fileDetails?.content || ''),
        mode: explainMode || mode,
        api_key: apiKey || null,
        symbol_name: symbolName !== undefined ? symbolName : activeSymbol
      };

      if (!payload.code && payload.file_path && scanData) {
        // If code is not loaded in memory yet, load it first
        const loaded = await loadFileContent(payload.file_path);
        if (loaded?.content) {
          payload.code = loaded.content;
        }
      }

      if (!payload.code?.trim()) {
        throw new Error('Please select a file with source code or enter custom code to explain.');
      }

      const res = await fetch(`${apiBaseUrl}/api/explain-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Server returned error status ${res.status}`);
      }

      const data = await res.json();
      setExplanation(data);

      // If user selected flowchart mode, switch view tab to flowchart automatically
      if (explainMode === 'flowchart' && data.flowchart_mermaid) {
        setViewTab('flowchart');
      } else {
        setViewTab('explanation');
      }
    } catch (err) {
      console.error('Explainer error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  }, [apiBaseUrl, apiKey, isCustomMode, selectedFile, customCode, fileDetails, mode, activeSymbol, scanData, loadFileContent]);

  // Handle switching active file
  const handleSelectFile = async (path) => {
    setIsCustomMode(false);
    setSelectedFile(path);
    setActiveSymbol(null);
    setExplanation(null);
    const details = await loadFileContent(path);
    if (details?.content) {
      explainCode({
        targetFile: path,
        codeContent: details.content,
        explainMode: mode,
        symbolName: null
      });
    }
  };

  // Handle Custom Code Snippet mode
  const handleEnableCustomMode = () => {
    setIsCustomMode(true);
    setSelectedFile(null);
    setActiveSymbol(null);
    setExplanation(null);
    if (!customCode) {
      setCustomCode(`// Paste or type any function, algorithm, or component code here\nfunction calculateDiscount(user, cartTotal) {\n  if (!user || cartTotal <= 0) return 0;\n  let rate = user.isPremium ? 0.20 : 0.05;\n  if (cartTotal > 100) rate += 0.05;\n  return cartTotal * rate;\n}`);
    }
  };

  // Auto-select initial file or first available file on mount
  useEffect(() => {
    if (initialFile) {
      handleSelectFile(initialFile);
      return;
    }
    if (scanData?.tree && !selectedFile && !isCustomMode) {
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
      if (first) {
        handleSelectFile(first);
      }
    }
  }, [initialFile, scanData]);

  // Quick prompt click
  const handleQuickPrompt = (prompt) => {
    setMode(prompt.mode);
    explainCode({ explainMode: prompt.mode });
  };

  // Symbol click (explain specific function or class)
  const handleSymbolClick = (symName) => {
    const nextSym = activeSymbol === symName ? null : symName;
    setActiveSymbol(nextSym);
    explainCode({ symbolName: nextSym, explainMode: mode });
  };

  // Copy code
  const handleCopyCode = () => {
    const textToCopy = isCustomMode ? customCode : fileDetails?.content || '';
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1500);
  };

  // Copy explanation
  const handleCopyExplanation = () => {
    if (!explanation?.markdown_explanation) return;
    navigator.clipboard.writeText(explanation.markdown_explanation);
    setCopiedExplanation(true);
    setTimeout(() => setCopiedExplanation(false), 1500);
  };

  // Ask AI about this code
  const handleAskFollowUp = () => {
    if (!followUpQuestion.trim()) return;
    if (onNavigateToAssistant) {
      const question = `Regarding \`${isCustomMode ? 'custom code' : selectedFile}\`:\n${followUpQuestion}`;
      onNavigateToAssistant(question, selectedFile);
    }
  };

  const currentCode = isCustomMode ? customCode : fileDetails?.content || '';
  const currentFileName = isCustomMode
    ? 'Custom Snippet'
    : selectedFile ? selectedFile.replace(/\\/g, '/').split('/').pop() : 'No File Selected';

  const symbols = explanation?.symbols || fileDetails?.analysis || {};
  const classesList = symbols.classes || [];
  const functionsList = symbols.functions || [];

  return (
    <div className="code-explainer-page">
      {/* Top Banner / Explanation Mode Selector */}
      <div className="explainer-header-card glass-card">
        <div className="explainer-header-top">
          <div className="explainer-title-group">
            <div className="explainer-badge-icon">
              <Sparkles size={20} color="#4f46e5" />
            </div>
            <div>
              <h2 className="explainer-main-title">Code & Logic Explainer</h2>
              <p className="explainer-subtitle">
                Understand architecture, control flow, functions, and state in plain English with AI & visual flowcharts
              </p>
            </div>
          </div>

          <div className="explainer-status-group">
            {explanation && (
              <div
                className="ai-source-badge"
                style={{
                  background: explanation.is_ai_generated ? '#eef2ff' : '#fffbeb',
                  borderColor: explanation.is_ai_generated ? '#c7d2fe' : '#fde68a',
                  color: explanation.is_ai_generated ? '#4f46e5' : '#d97706'
                }}
              >
                {explanation.is_ai_generated ? <Sparkles size={13} /> : <AlertCircle size={13} />}
                <span>{explanation.is_ai_generated ? `${explanation.model_used || 'Gemini 3.5 Flash'}` : 'AST Heuristic Engine'}</span>
              </div>
            )}
            <button
              onClick={() => explainCode({ explainMode: mode })}
              disabled={loading || (!selectedFile && !isCustomMode)}
              className="btn-primary"
              style={{ padding: '0.45rem 0.95rem', fontSize: '0.82rem', gap: '0.4rem' }}
            >
              {loading ? <Loader2 size={14} className="spin-animation" /> : <RefreshCw size={14} />}
              <span>{loading ? 'Analyzing...' : 'Re-Explain Logic'}</span>
            </button>
          </div>
        </div>

        {/* Heuristic Notice when no API key */}
        {!apiKey && (
          <div style={{
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: '8px',
            padding: '0.55rem 0.85rem',
            fontSize: '0.8rem',
            color: '#fde68a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.6rem',
            marginBottom: '0.75rem',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={14} color="#fbbf24" />
              <span>Offline AST Analysis Active. Enter your own Gemini API Key for AI logic walkthroughs.</span>
            </div>
            {onOpenApiKeyModal && (
              <button
                type="button"
                onClick={onOpenApiKeyModal}
                className="btn-secondary"
                style={{ padding: '0.2rem 0.65rem', fontSize: '0.74rem', color: '#fbbf24', borderColor: 'rgba(245, 158, 11, 0.3)' }}
              >
                Enter Key
              </button>
            )}
          </div>
        )}

        {/* Mode Selector Buttons */}
        <div className="explainer-mode-selector">
          {EXPLAIN_MODES.map((m) => {
            const Icon = m.icon;
            const isActive = mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => {
                  setMode(m.id);
                  explainCode({ explainMode: m.id });
                }}
                className={`explainer-mode-pill ${isActive ? 'active' : ''}`}
                title={m.desc}
              >
                <Icon size={14} />
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>

        {/* Quick Question Chips */}
        <div className="explainer-chips-row">
          <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
            Quick Logic Inquiries:
          </span>
          {QUICK_PROMPTS.map((qp, idx) => (
            <button
              key={idx}
              onClick={() => handleQuickPrompt(qp)}
              className="explainer-chip"
            >
              <span>{qp.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Dual-Pane Workspace */}
      <div className="explainer-workspace-grid">
        {/* Left Column: Explorer + Code View */}
        <div className="explainer-code-column">
          {/* File Picker & Mode Tabs */}
          <div className="explainer-left-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
              <FileCode size={16} color="#38bdf8" style={{ flexShrink: 0 }} />
              <span className="file-heading-text" title={selectedFile || 'Custom Snippet'}>
                {currentFileName}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <button
                onClick={handleEnableCustomMode}
                className={`snippet-mode-btn ${isCustomMode ? 'active' : ''}`}
                title="Paste or type any code snippet"
              >
                <Edit3 size={13} />
                <span>Paste Code</span>
              </button>
              <button
                onClick={handleCopyCode}
                className="control-btn"
                title="Copy code"
                style={{ width: '28px', height: '28px' }}
              >
                {copiedCode ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          {/* Quick Symbol Pills Strip (Classes & Functions) */}
          {(classesList.length > 0 || functionsList.length > 0) && !isCustomMode && (
            <div className="explainer-symbols-strip">
              <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Symbols:</span>
              {classesList.map((c, i) => (
                <button
                  key={`cls-${i}`}
                  onClick={() => handleSymbolClick(c.name)}
                  className={`symbol-pill class-pill ${activeSymbol === c.name ? 'active' : ''}`}
                  title={`Explain class ${c.name}`}
                >
                  <Cpu size={11} />
                  <span>class {c.name}</span>
                </button>
              ))}
              {functionsList.slice(0, 8).map((f, i) => (
                <button
                  key={`fn-${i}`}
                  onClick={() => handleSymbolClick(f.name)}
                  className={`symbol-pill fn-pill ${activeSymbol === f.name ? 'active' : ''}`}
                  title={`Explain function ${f.name}()`}
                >
                  <Code2 size={11} />
                  <span>{f.name}()</span>
                </button>
              ))}
              {functionsList.length > 8 && (
                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                  +{functionsList.length - 8} more
                </span>
              )}
            </div>
          )}

          {/* Code Viewer / Custom Editor Area */}
          <div className="explainer-code-body">
            {isCustomMode ? (
              <div className="custom-snippet-editor-wrap">
                <textarea
                  className="custom-snippet-textarea"
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value)}
                  placeholder="Paste or type any code here (JavaScript, Python, TypeScript, HTML, SQL, etc.)..."
                  spellCheck={false}
                />
                <div className="custom-snippet-footer">
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    {customCode.split('\n').length} lines of code
                  </span>
                  <button
                    onClick={() => explainCode({ codeContent: customCode, explainMode: mode })}
                    className="btn-primary"
                    style={{ padding: '0.35rem 0.85rem', fontSize: '0.78rem' }}
                  >
                    <Sparkles size={13} />
                    <span>Explain This Snippet</span>
                  </button>
                </div>
              </div>
            ) : fileDetails?.content ? (
              <div className="code-table-scroll">
                <div style={{ display: 'table', width: '100%' }}>
                  {fileDetails.content.split('\n').map((line, idx) => {
                    const isTargetSymbol = activeSymbol && line.includes(activeSymbol);
                    return (
                      <div
                        key={idx}
                        className={`code-line-row ${isTargetSymbol ? 'line-highlight' : ''}`}
                        style={{ display: 'table-row', lineHeight: 1.6 }}
                      >
                        <span
                          style={{
                            display: 'table-cell',
                            width: '42px',
                            textAlign: 'right',
                            paddingRight: '0.85rem',
                            color: '#475569',
                            userSelect: 'none',
                            borderRight: '1px solid rgba(255, 255, 255, 0.05)',
                            fontSize: '0.74rem'
                          }}
                        >
                          {idx + 1}
                        </span>
                        <span
                          style={{
                            display: 'table-cell',
                            paddingLeft: '0.85rem',
                            whiteSpace: 'pre',
                            color: isTargetSymbol ? '#38bdf8' : '#e2e8f0',
                            fontWeight: isTargetSymbol ? 600 : 400,
                            fontSize: '0.78rem'
                          }}
                        >
                          {line}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="explainer-empty-code">
                <p>Select a file from the list or click "Paste Code" to explain custom logic.</p>
              </div>
            )}
          </div>

          {/* Quick File Tree Drawer / Selector */}
          {scanData?.tree && (
            <div className="explainer-mini-tree">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0.75rem', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>Quick File Switcher</span>
                <input
                  type="text"
                  placeholder="Filter files..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    background: 'rgba(15, 23, 42, 0.7)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '4px',
                    padding: '0.15rem 0.45rem',
                    color: '#f8fafc',
                    fontSize: '0.72rem',
                    width: '130px'
                  }}
                />
              </div>
              <div style={{ maxHeight: '150px', overflowY: 'auto', padding: '0.35rem 0' }}>
                <TreeNode
                  node={scanData.tree}
                  onSelectFile={handleSelectFile}
                  selectedFile={selectedFile}
                  searchTerm={searchTerm}
                />
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Logic Explanation & Visual Flowchart */}
        <div className="explainer-output-column glass-card">
          {/* Header with Switcher Tabs */}
          <div className="explainer-output-header">
            <div className="output-tab-group">
              <button
                onClick={() => setViewTab('explanation')}
                className={`output-tab-btn ${viewTab === 'explanation' ? 'active' : ''}`}
              >
                <BookOpen size={14} />
                <span>Logic & Walkthrough</span>
              </button>
              {explanation?.flowchart_mermaid && (
                <button
                  onClick={() => setViewTab('flowchart')}
                  className={`output-tab-btn ${viewTab === 'flowchart' ? 'active' : ''}`}
                >
                  <Workflow size={14} />
                  <span>Visual Logic Flowchart</span>
                </button>
              )}
            </div>

            <button
              onClick={handleCopyExplanation}
              className="btn-secondary"
              style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem', gap: '0.35rem' }}
              title="Copy entire explanation"
            >
              {copiedExplanation ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
              <span>{copiedExplanation ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          {/* Loading Overlay */}
          {loading && (
            <div className="explainer-loading-state">
              <Loader2 size={32} color="#4f46e5" className="spin-animation" />
              <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#0f172a' }}>
                {loadingStep || 'Analyzing Code AST & Logic...'}
              </div>
              <p style={{ fontSize: '0.78rem', color: '#64748b' }}>
                Synthesizing execution paths, parameters, state variables, and visual diagram
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && !loading && (
            <div className="explainer-error-card">
              <AlertCircle size={20} color="#f43f5e" />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Explanation Notice</div>
                <div style={{ fontSize: '0.82rem', marginTop: '0.2rem' }}>{error}</div>
              </div>
            </div>
          )}

          {/* Output Content */}
          {!loading && !error && explanation && (
            <div className="explainer-output-body">
              {viewTab === 'flowchart' && explanation.flowchart_mermaid ? (
                <div className="flowchart-viewer-wrap">
                  <div className="flowchart-info-bar">
                    <span style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>
                      Interactive control flow diagram for <strong>{currentFileName}</strong>
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      Use mouse wheel or toolbar to zoom and pan
                    </span>
                  </div>
                  <div style={{ flex: 1, minHeight: '380px' }}>
                    <MermaidViewer
                      chartCode={explanation.flowchart_mermaid}
                      idPrefix="code_explainer_flow"
                      enableWheelZoom={true}
                    />
                  </div>
                </div>
              ) : (
                <div className="markdown-explanation-scroll">
                  {explanation.markdown_explanation ? (
                    <div className="markdown-body">
                      {explanation.markdown_explanation.split('\n\n').map((paragraph, idx) => {
                        const trimmed = paragraph.trim();
                        if (trimmed.startsWith('## ')) {
                          return <h2 key={idx}>{trimmed.replace('## ', '')}</h2>;
                        }
                        if (trimmed.startsWith('### ')) {
                          return <h3 key={idx}>{trimmed.replace('### ', '')}</h3>;
                        }
                        if (trimmed.startsWith('> ')) {
                          return (
                            <blockquote key={idx} className="explainer-quote">
                              {trimmed.replace('> ', '')}
                            </blockquote>
                          );
                        }
                        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                          return (
                            <ul key={idx}>
                              {trimmed.split('\n').map((li, i) => (
                                <li key={i}>{li.replace(/^[-*]\s+/, '')}</li>
                              ))}
                            </ul>
                          );
                        }
                        if (/^\d+\.\s/.test(trimmed)) {
                          return (
                            <ol key={idx} className="step-numbered-list">
                              {trimmed.split('\n').map((li, i) => (
                                <li key={i}>{li.replace(/^\d+\.\s+/, '')}</li>
                              ))}
                            </ol>
                          );
                        }
                        if (trimmed.startsWith('```') && trimmed.endsWith('```')) {
                          const codeLines = trimmed.split('\n');
                          const lang = codeLines[0].replace('```', '');
                          const rawCode = codeLines.slice(1, -1).join('\n');
                          return (
                            <pre key={idx} className="code-block-render">
                              <code>{rawCode}</code>
                            </pre>
                          );
                        }
                        return <p key={idx}>{trimmed}</p>;
                      })}
                    </div>
                  ) : (
                    <p style={{ color: '#94a3b8' }}>No explanation text generated.</p>
                  )}
                </div>
              )}

              {/* Bottom Interactive Question Drawer */}
              <div className="explainer-followup-bar">
                <input
                  type="text"
                  placeholder="Ask a specific doubt about this code's logic..."
                  value={followUpQuestion}
                  onChange={(e) => setFollowUpQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAskFollowUp()}
                  className="explainer-question-input"
                />
                <button
                  onClick={handleAskFollowUp}
                  disabled={!followUpQuestion.trim()}
                  className="btn-primary"
                  style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem', gap: '0.35rem' }}
                >
                  <Send size={13} />
                  <span>Ask AI</span>
                </button>
              </div>
            </div>
          )}

          {/* Empty Prompt State when no explanation loaded yet */}
          {!loading && !explanation && !error && (
            <div className="explainer-empty-state">
              <Lightbulb size={36} color="#4f46e5" />
              <h3>Ready to Explain Code & Logic</h3>
              <p>
                Select any file from the project or paste a custom code snippet, then pick an explanation mode to get an instant breakdown.
              </p>
              <button
                onClick={() => explainCode({ explainMode: mode })}
                className="btn-primary"
                style={{ marginTop: '0.5rem' }}
              >
                <Sparkles size={15} />
                <span>Explain Now</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

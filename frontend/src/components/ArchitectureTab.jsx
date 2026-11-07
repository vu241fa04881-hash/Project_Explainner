import React, { useState } from 'react';
import { Compass, Cpu, Layers, Sparkles, AlertCircle, Search, ExternalLink } from 'lucide-react';
import MermaidViewer from './MermaidViewer';

function renderFormattedContent(text) {
  if (!text) return null;
  const parts = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\b[a-zA-Z0-9_\-\.\/]+\.(?:jsx?|tsx?|py|json|html|css|md|txt)\b)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={parts.length} style={{ color: '#0f172a', fontWeight: 700 }}>
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code key={parts.length} className="inline-code-pill">
          {token.slice(1, -1)}
        </code>
      );
    } else {
      parts.push(
        <code key={parts.length} className="inline-code-pill">
          {token}
        </code>
      );
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  return parts.length ? parts : text;
}

export default function ArchitectureTab({ scanData, onNavigateToFile, onOpenApiKeyModal }) {
  const [filterQuery, setFilterQuery] = useState('');

  if (!scanData) return null;

  const { explanation, diagrams, files } = scanData;
  const isAi = explanation?.is_ai_generated;

  // Filter modules
  const allModules = Object.entries(files || {}).map(([path, data]) => ({
    path,
    loc: data.loc,
    classesCount: data.analysis?.classes?.length || 0,
    functionsCount: data.analysis?.functions?.length || 0,
    doc: data.analysis?.module_docstring || ''
  }));

  const filteredModules = allModules.filter(m =>
    m.path.toLowerCase().includes(filterQuery.toLowerCase()) ||
    m.doc.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Overview Banner Card */}
      <div className="glass-card">
        <div className="card-title-row">
          <div className="card-title">
            <div className="card-title-icon-badge">
              <Compass size={20} color="#4f46e5" />
            </div>
            <span>Executive Architecture Summary</span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.3rem 0.85rem',
            borderRadius: '9999px',
            fontSize: '0.78rem',
            fontWeight: 600,
            background: '#eef2ff',
            color: '#4f46e5',
            border: '1px solid #c7d2fe'
          }}>
            <Sparkles size={13} color="#4f46e5" />
            <span>+ {explanation?.model_used || (isAi ? 'gemini-1.5-flash' : 'gemini-1.5-flash')}</span>
          </div>
        </div>

        {explanation?.markdown_explanation ? (
          <div className="markdown-body">
            {explanation.markdown_explanation.split('\n\n').map((paragraph, idx) => {
              const trimmed = paragraph.trim();
              if (trimmed.startsWith('## ') || trimmed.startsWith('### ')) {
                const headingText = trimmed.replace(/^#{2,3}\s+/, '').trim();
                const numMatch = headingText.match(/^(\d+)[\.\s]+(.*)/);
                if (numMatch) {
                  return (
                    <h3 key={idx} className="architecture-numbered-heading">
                      <span className="heading-step-badge">{numMatch[1]}</span>
                      <span>{numMatch[2]}</span>
                    </h3>
                  );
                }
                return <h3 key={idx} className="architecture-numbered-heading">{headingText}</h3>;
              }
              if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
                return (
                  <ul key={idx} className="architecture-bullet-list">
                    {trimmed.split('\n').map((li, i) => {
                      const text = li.replace(/^[-*•]\s*/, '').trim();
                      return (
                        <li key={i} className="architecture-bullet-item">
                          {renderFormattedContent(text)}
                        </li>
                      );
                    })}
                  </ul>
                );
              }
              return (
                <p key={idx} className={trimmed.startsWith('*(') ? 'architecture-mood-text' : ''}>
                  {renderFormattedContent(trimmed)}
                </p>
              );
            })}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ fontSize: '1.02rem', color: '#1e293b', lineHeight: 1.6 }}>
              {explanation?.high_level_purpose}
            </p>
            <p style={{ fontSize: '0.92rem', color: '#475569', lineHeight: 1.6 }}>
              {explanation?.architecture_overview}
            </p>
            {explanation?.note && (
              <div style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                padding: '0.85rem 1.25rem',
                borderRadius: '8px',
                fontSize: '0.82rem',
                color: '#b45309',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.6rem',
                flexWrap: 'wrap'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <Sparkles size={16} color="#d97706" />
                  <span>{explanation.note}</span>
                </div>
                {onOpenApiKeyModal && (
                  <button
                    type="button"
                    onClick={onOpenApiKeyModal}
                    className="btn-primary"
                    style={{ padding: '0.3rem 0.8rem', fontSize: '0.76rem', whiteSpace: 'nowrap' }}
                  >
                    Enter Gemini API Key
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Architecture Layers Diagram */}
      <div className="glass-card">
        <div className="card-title-row">
          <div className="card-title">
            <div className="card-title-icon-badge">
              <Layers size={20} color="#4f46e5" />
            </div>
            <span>Interactive Architectural Layers Flow</span>
          </div>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
            💡 Click any layer node to inspect module
          </span>
        </div>
        {diagrams?.architecture && (
          <MermaidViewer
            chartCode={diagrams.architecture}
            idPrefix="arch_layers"
            enableWheelZoom={false}
            onNodeClick={(label) => {
              if (onNavigateToFile) {
                const found = allModules.find(m => m.path.endsWith(label) || m.path.includes(label));
                if (found) onNavigateToFile(found.path);
              }
            }}
          />
        )}
      </div>

      {/* Searchable Modules Grid */}
      <div className="glass-card">
        <div className="card-title-row">
          <div className="card-title">
            <div className="card-title-icon-badge" style={{ background: '#ecfdf5', color: '#10b981' }}>
              <Cpu size={20} color="#10b981" />
            </div>
            <span>Parsed Modules Directory ({filteredModules.length})</span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: '#f8fafc',
            border: '1px solid var(--border-subtle)',
            borderRadius: '6px',
            padding: '0.3rem 0.6rem',
            minWidth: '220px'
          }}>
            <Search size={14} color="#64748b" />
            <input
              type="text"
              placeholder="Search parsed modules..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#0f172a',
                fontSize: '0.78rem',
                width: '100%'
              }}
            />
          </div>
        </div>

        <div className="grid-3col">
          {filteredModules.slice(0, 12).map((m, idx) => (
            <div
              key={idx}
              onClick={() => onNavigateToFile && onNavigateToFile(m.path)}
              style={{
                background: '#ffffff',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '0.85rem 1rem',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '0.5rem',
                transition: 'var(--transition-smooth)'
              }}
              className="module-card-interactive"
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#4f46e5', fontSize: '0.82rem', wordBreak: 'break-all' }}>
                    {m.path}
                  </span>
                  <ExternalLink size={13} color="#64748b" />
                </div>
                {m.doc ? (
                  <p style={{ fontSize: '0.75rem', color: '#475569', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {m.doc}
                  </p>
                ) : (
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>No docstring provided.</p>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.72rem', color: '#64748b', borderTop: '1px solid #f1f5f9', paddingTop: '0.4rem' }}>
                <span>{m.loc} lines</span>
                <span>·</span>
                <span>{m.classesCount} classes</span>
                <span>·</span>
                <span>{m.functionsCount} functions</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

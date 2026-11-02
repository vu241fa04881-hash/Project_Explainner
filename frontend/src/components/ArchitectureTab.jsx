import React, { useState } from 'react';
import { Compass, Cpu, Layers, Sparkles, AlertCircle, Search, ExternalLink } from 'lucide-react';
import MermaidViewer from './MermaidViewer';

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
      <div className="glass-card" style={{ background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(13, 18, 31, 0.9))' }}>
        <div className="card-title-row">
          <div className="card-title">
            <Compass size={22} color="#38bdf8" />
            <span>Executive Architecture Summary</span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.35rem 0.85rem',
            borderRadius: '9999px',
            fontSize: '0.75rem',
            fontWeight: 600,
            background: isAi ? 'rgba(56, 189, 248, 0.15)' : 'rgba(245, 158, 11, 0.15)',
            color: isAi ? '#38bdf8' : '#fbbf24',
            border: `1px solid ${isAi ? 'rgba(56, 189, 248, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
          }}>
            {isAi ? <Sparkles size={14} /> : <AlertCircle size={14} />}
            <span>{isAi ? (explanation?.model_used ? `${explanation.model_used}` : 'Gemini AI Reasoning') : 'AST Heuristic Analysis'}</span>
          </div>
        </div>

        {explanation?.markdown_explanation ? (
          <div className="markdown-body">
            {explanation.markdown_explanation.split('\n\n').map((paragraph, idx) => {
              if (paragraph.startsWith('### ')) {
                return <h3 key={idx}>{paragraph.replace('### ', '')}</h3>;
              }
              if (paragraph.startsWith('- ')) {
                return (
                  <ul key={idx}>
                    {paragraph.split('\n').map((li, i) => (
                      <li key={i}>{li.replace('- ', '')}</li>
                    ))}
                  </ul>
                );
              }
              return <p key={idx}>{paragraph}</p>;
            })}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ fontSize: '1.02rem', color: '#f1f5f9', lineHeight: 1.6 }}>
              {explanation?.high_level_purpose}
            </p>
            <p style={{ fontSize: '0.92rem', color: '#94a3b8', lineHeight: 1.6 }}>
              {explanation?.architecture_overview}
            </p>
            {explanation?.note && (
              <div style={{
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                padding: '0.85rem 1.25rem',
                borderRadius: '8px',
                fontSize: '0.82rem',
                color: '#fde68a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.6rem',
                flexWrap: 'wrap'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <Sparkles size={16} color="#fbbf24" />
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
            <Layers size={22} color="#818cf8" />
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
            <Cpu size={20} color="#34d399" />
            <span>Parsed Modules Directory ({filteredModules.length})</span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: 'rgba(15, 23, 42, 0.8)',
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
                color: '#f8fafc',
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
                background: 'rgba(255, 255, 255, 0.02)',
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
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#38bdf8', fontSize: '0.82rem', wordBreak: 'break-all' }}>
                    {m.path}
                  </span>
                  <ExternalLink size={13} color="#64748b" />
                </div>
                {m.doc ? (
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {m.doc}
                  </p>
                ) : (
                  <p style={{ fontSize: '0.75rem', color: '#64748b' }}>No docstring provided.</p>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.72rem', color: '#94a3b8', borderTop: '1px solid rgba(255, 255, 255, 0.04)', paddingTop: '0.4rem' }}>
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

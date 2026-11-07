import React, { useState } from 'react';
import { Network, Boxes, GitFork, AlertTriangle, CheckCircle, ArrowDownUp, ArrowLeftRight, ExternalLink } from 'lucide-react';
import MermaidViewer from './MermaidViewer';

export default function VisualizerTab({ scanData, onNavigateToFile }) {
  const [subTab, setSubTab] = useState('dependency');
  const [direction, setDirection] = useState('TD');

  if (!scanData) return null;
  const { diagrams, graph } = scanData;
  const stats = graph?.stats || {};

  // Handle clicking a node in the diagram
  const handleDiagramNodeClick = (nodeLabel) => {
    if (!nodeLabel || !onNavigateToFile) return;
    // Find matching file in graph or repo
    const cleanLabel = nodeLabel.trim();
    const matchedNode = graph?.nodes?.find(
      (n) => n.label === cleanLabel || n.id.endsWith(cleanLabel) || n.id === cleanLabel
    );
    if (matchedNode) {
      onNavigateToFile(matchedNode.id);
    }
  };

  // Allow switching direction dynamically by adjusting flowchart header
  const getDynamicDiagram = (diagramCode, dir) => {
    if (!diagramCode) return '';
    return diagramCode.replace(/flowchart\s+(TD|TB|LR|RL)/, `flowchart ${dir}`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Controls Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(15, 23, 42, 0.7)', padding: '0.35rem', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
          <button
            onClick={() => setSubTab('dependency')}
            className={`btn-secondary ${subTab === 'dependency' ? 'btn-primary' : ''}`}
            style={{ fontSize: '0.8rem', padding: '0.45rem 0.9rem' }}
          >
            <Network size={15} />
            <span>Module Dependencies</span>
          </button>
          <button
            onClick={() => setSubTab('classes')}
            className={`btn-secondary ${subTab === 'classes' ? 'btn-primary' : ''}`}
            style={{ fontSize: '0.8rem', padding: '0.45rem 0.9rem' }}
          >
            <Boxes size={15} />
            <span>Class & Inheritance</span>
          </button>
          <button
            onClick={() => setSubTab('coupling')}
            className={`btn-secondary ${subTab === 'coupling' ? 'btn-primary' : ''}`}
            style={{ fontSize: '0.8rem', padding: '0.45rem 0.9rem' }}
          >
            <GitFork size={15} />
            <span>Coupling & Cycles</span>
          </button>
        </div>

        {/* Orientation & Stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          {subTab === 'dependency' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(255, 255, 255, 0.04)', padding: '0.25rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginRight: '0.2rem' }}>Layout:</span>
              <button
                className={`control-btn ${direction === 'TD' ? 'active' : ''}`}
                style={{ width: '28px', height: '28px', color: direction === 'TD' ? '#4f46e5' : '#94a3b8' }}
                title="Top to Bottom Flow"
                onClick={() => setDirection('TD')}
              >
                <ArrowDownUp size={14} />
              </button>
              <button
                className={`control-btn ${direction === 'LR' ? 'active' : ''}`}
                style={{ width: '28px', height: '28px', color: direction === 'LR' ? '#4f46e5' : '#94a3b8' }}
                title="Left to Right Flow"
                onClick={() => setDirection('LR')}
              >
                <ArrowLeftRight size={14} />
              </button>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center', fontSize: '0.78rem' }}>
            <span style={{ color: '#94a3b8' }}>
              Nodes: <strong style={{ color: '#2563eb' }}>{stats.total_nodes || 0}</strong>
            </span>
            <span style={{ color: '#94a3b8' }}>
              Edges: <strong style={{ color: '#4f46e5' }}>{stats.total_edges || 0}</strong>
            </span>
            <span style={{ color: '#94a3b8' }}>
              Cycles: <strong style={{ color: stats.cycles_count > 0 ? '#f43f5e' : '#10b981' }}>{stats.cycles_count || 0}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Main Diagram Area */}
      {subTab === 'dependency' && (
        <div className="glass-card">
          <div className="card-title-row">
            <div className="card-title">
              <Network size={20} color="#4f46e5" />
              <span>Inter-Module Dependency Graph</span>
            </div>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
              💡 Click any node to open it directly in the Code Inspector
            </span>
          </div>
          {diagrams?.dependency ? (
            <MermaidViewer
              chartCode={getDynamicDiagram(diagrams.dependency, direction)}
              idPrefix="dep_graph"
              onNodeClick={handleDiagramNodeClick}
            />
          ) : (
            <p style={{ color: '#94a3b8' }}>No dependencies detected.</p>
          )}
        </div>
      )}

      {subTab === 'classes' && (
        <div className="glass-card">
          <div className="card-title-row">
            <div className="card-title">
              <Boxes size={20} color="#818cf8" />
              <span>Class Structure & Inheritance Hierarchy</span>
            </div>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Parsed directly from AST class definitions</span>
          </div>
          {diagrams?.classes ? (
            <MermaidViewer chartCode={diagrams.classes} idPrefix="class_graph" />
          ) : (
            <p style={{ color: '#94a3b8' }}>No classes detected in this codebase.</p>
          )}
        </div>
      )}

      {subTab === 'coupling' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="grid-2col">
            <div className="glass-card">
              <div className="card-title-row">
                <div className="card-title">
                  <GitFork size={20} color="#4f46e5" />
                  <span>Most Depended-Upon Modules</span>
                </div>
              </div>
              <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '1rem' }}>
                Files with highest in-degree centrality. Click to inspect symbols and usage.
              </p>
              {stats.top_depended && stats.top_depended.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {stats.top_depended.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => onNavigateToFile && onNavigateToFile(item.file)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem 1rem',
                        background: '#ffffff',
                        borderRadius: '8px',
                        border: '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        transition: 'var(--transition-smooth)'
                      }}
                      className="depended-item-hover"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#0f172a' }}>{item.file}</span>
                        <ExternalLink size={13} color="#4f46e5" />
                      </div>
                      <span style={{
                        background: '#eef2ff',
                        color: '#4f46e5',
                        border: '1px solid #c7d2fe',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 700
                      }}>
                        {item.dependents_count} dependents
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No external dependents found.</div>
              )}
            </div>

            <div className="glass-card">
              <div className="card-title-row">
                <div className="card-title">
                  {stats.cycles_count > 0 ? (
                    <AlertTriangle size={20} color="#f43f5e" />
                  ) : (
                    <CheckCircle size={20} color="#10b981" />
                  )}
                  <span>Circular Dependency Audit</span>
                </div>
              </div>
              {stats.cycles_count > 0 ? (
                <div>
                  <div style={{ color: '#f87171', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                    Detected {stats.cycles_count} circular dependency cycle(s):
                  </div>
                  {stats.cycles.map((cy, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '0.65rem 0.85rem',
                        background: 'rgba(244, 63, 94, 0.1)',
                        border: '1px solid rgba(244, 63, 94, 0.25)',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontFamily: 'monospace',
                        color: '#fecdd3',
                        marginBottom: '0.5rem'
                      }}
                    >
                      {cy.join(' ➔ ')}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ color: '#34d399', fontSize: '0.9rem', fontWeight: 600 }}>
                    No circular dependencies detected!
                  </div>
                  <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                    The dependency graph is a clean Directed Acyclic Graph (DAG), ensuring predictable imports and zero circular import errors at runtime.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

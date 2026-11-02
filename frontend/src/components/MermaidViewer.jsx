import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { ZoomIn, ZoomOut, RotateCcw, Download, Copy, Check, Maximize2, Minimize2, MousePointerClick } from 'lucide-react';

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  themeVariables: {
    primaryColor: '#1e293b',
    primaryTextColor: '#f8fafc',
    primaryBorderColor: '#38bdf8',
    lineColor: '#60a5fa',
    secondaryColor: '#0f172a',
    tertiaryColor: '#1e1b4b',
    background: '#090e17',
    mainBkg: '#1e293b',
    nodeBorder: '#38bdf8',
    clusterBkg: '#0d1322',
    clusterBorder: '#334155',
    titleColor: '#e2e8f0',
    edgeLabelBackground: '#0f172a'
  },
  flowchart: {
    useMaxWidth: false,
    htmlLabels: true,
    curve: 'basis'
  },
  securityLevel: 'loose'
});

export default function MermaidViewer({
  chartCode,
  idPrefix = 'diagram',
  onNodeClick = null,
  enableWheelZoom = false
}) {
  const containerRef = useRef(null);
  const wrapperRef = useRef(null);
  const [svgContent, setSvgContent] = useState('');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [renderError, setRenderError] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);

  // Stop dragging on window mouseup so pan doesn't get stuck
  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  // Render diagram on chartCode change
  useEffect(() => {
    let isMounted = true;
    if (!chartCode) return;

    const render = async () => {
      setRenderError(null);
      const uniqueId = `mermaid_${idPrefix}_${Math.random().toString(36).substring(2, 9)}`;
      try {
        const { svg } = await mermaid.render(uniqueId, chartCode);
        if (isMounted) {
          setSvgContent(svg);
          setZoom(1);
          setPan({ x: 0, y: 0 });
        }
      } catch (err) {
        console.error('Mermaid render error:', err);
        const strayEl = document.getElementById(uniqueId) || document.getElementById(`d${uniqueId}`);
        if (strayEl) strayEl.remove();
        if (isMounted) {
          setRenderError(err.message || 'Unable to render Mermaid diagram');
        }
      }
    };

    render();
    return () => {
      isMounted = false;
    };
  }, [chartCode, idPrefix]);

  // Attach interactive node clicks to rendered SVG
  useEffect(() => {
    if (!containerRef.current) return;
    const svgEl = containerRef.current.querySelector('svg');
    if (!svgEl) return;

    const nodes = svgEl.querySelectorAll('.node, .cluster');
    const cleanups = [];

    nodes.forEach((node) => {
      node.style.cursor = 'pointer';
      node.style.transition = 'filter 0.2s ease, transform 0.2s ease';

      const handleHover = () => {
        node.style.filter = 'drop-shadow(0 0 8px #38bdf8)';
      };
      const handleLeave = () => {
        node.style.filter = 'none';
      };
      const handleClick = (e) => {
        e.stopPropagation();
        const text = node.textContent?.trim();
        setSelectedNode(text);
        if (onNodeClick && text) {
          onNodeClick(text);
        }
      };

      node.addEventListener('mouseenter', handleHover);
      node.addEventListener('mouseleave', handleLeave);
      node.addEventListener('click', handleClick);

      cleanups.push(() => {
        node.removeEventListener('mouseenter', handleHover);
        node.removeEventListener('mouseleave', handleLeave);
        node.removeEventListener('click', handleClick);
      });
    });

    return () => {
      cleanups.forEach((fn) => fn());
    };
  }, [svgContent, onNodeClick]);

  // Wheel zoom (only if explicitly enabled with Ctrl/Cmd key to prevent hijacking page scroll)
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || !enableWheelZoom) return;

    const handleWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.88;
      setZoom((prev) => Math.min(Math.max(prev * zoomFactor, 0.3), 3.0));
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [enableWheelZoom]);

  // Mouse pan
  const handleMouseDown = (e) => {
    if (e.button !== 0) return; // Only left click
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Touch pan support
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - pan.x,
        y: e.touches[0].clientY - pan.y
      });
    }
  };

  const handleTouchMove = (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    setPan({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y
    });
  };

  const handleTouchEnd = () => setIsDragging(false);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3.0));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.35));
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelectedNode(null);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(chartCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const handleDownloadSvg = () => {
    if (!svgContent) return;
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${idPrefix}-diagram.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      ref={wrapperRef}
      className={`diagram-canvas-container ${isFullscreen ? 'fullscreen-diagram' : ''}`}
      style={{
        position: isFullscreen ? 'fixed' : 'relative',
        inset: isFullscreen ? 0 : 'auto',
        zIndex: isFullscreen ? 9999 : 1,
        width: isFullscreen ? '100vw' : '100%',
        height: isFullscreen ? '100vh' : 'auto'
      }}
    >
      {/* Top action toolbar */}
      <div className="diagram-controls">
        {selectedNode && (
          <div style={{
            fontSize: '0.75rem',
            color: '#38bdf8',
            fontWeight: 600,
            padding: '0 0.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            borderRight: '1px solid rgba(255,255,255,0.1)'
          }}>
            <MousePointerClick size={13} />
            <span>{selectedNode}</span>
          </div>
        )}
        <button className="control-btn" title="Zoom In (+)" onClick={handleZoomIn}>
          <ZoomIn size={16} />
        </button>
        <button className="control-btn" title="Zoom Out (-)" onClick={handleZoomOut}>
          <ZoomOut size={16} />
        </button>
        <button className="control-btn" title="Reset View" onClick={handleReset}>
          <RotateCcw size={15} />
        </button>
        <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.1)', margin: '0 2px' }} />
        <button
          className="control-btn"
          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen View"}
          onClick={() => setIsFullscreen(!isFullscreen)}
        >
          {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>
        <button className="control-btn" title="Copy Mermaid Syntax" onClick={handleCopyCode}>
          {copied ? <Check size={16} color="#10b981" /> : <Copy size={15} />}
        </button>
        <button className="control-btn" title="Download SVG Vector" onClick={handleDownloadSvg}>
          <Download size={15} />
        </button>
      </div>

      {renderError ? (
        <div style={{ color: '#f87171', padding: '2.5rem', textAlign: 'center' }}>
          <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Failed to render diagram</p>
          <pre style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#94a3b8', maxWidth: '600px', margin: '0 auto', overflowX: 'auto' }}>
            {renderError}
          </pre>
        </div>
      ) : (
        <div
          className="diagram-render-area"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div
            ref={containerRef}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.12s ease-out'
            }}
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        </div>
      )}
    </div>
  );
}

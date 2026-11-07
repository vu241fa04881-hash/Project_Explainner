import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  User,
  Loader2,
  FileText,
  Copy,
  Check,
  FileCode,
  Sparkles,
  HelpCircle
} from 'lucide-react';

const SUGGESTED_PROMPTS = [
  "Explain the high-level architecture and component flow in simple terms",
  "What is the complete execution flow from entry point to output?",
  "Which files or modules are most critical or have highest coupling?",
  "Where are API routes, request handling, or data logic located?",
  "What dependencies or libraries are required to run and test this project?"
];

export default function AssistantTab({
  scanData,
  apiBaseUrl,
  apiKey,
  activeInspectorFile,
  onNavigateToFile,
  onOpenApiKeyModal
}) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: `Hello! I am your **Project Explainer AI Assistant**.\n\nI have analyzed the AST structure and module dependencies of **${scanData?.repo_name || 'this repository'}**.\n\nAsk me anything about how the project works, how data travels through components, or how to implement/refactor specific modules!`,
      sources: []
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleCopyCode = (codeText, key) => {
    navigator.clipboard.writeText(codeText);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSend = async (questionText) => {
    const q = (questionText || input).trim();
    if (!q || loading) return;

    setInput('');
    const userMsg = { role: 'user', text: q };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setLoading(true);

    try {
      const historyPayload = updated.slice(-6).map(m => ({ role: m.role, text: m.text }));

      const res = await fetch(`${apiBaseUrl}/api/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          api_key: apiKey || null,
          active_file: activeInspectorFile || null,
          history: historyPayload
        })
      });

      if (!res.ok) {
        throw new Error('Failed to query assistant');
      }

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: data.answer,
          sources: data.sources || [],
          isAi: data.is_ai,
          modelUsed: data.model_used
        }
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `⚠️ **Error:** ${err.message}. Please check if the backend server is active.`,
          sources: []
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Helper to render markdown code blocks and lists
  const renderMessageContent = (text, msgIdx) => {
    if (!text) return null;

    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    let count = 0;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: text.substring(lastIndex, match.index) });
      }
      parts.push({
        type: 'code',
        lang: match[1] || 'code',
        code: match[2],
        key: `asst-${msgIdx}-${count++}`
      });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push({ type: 'text', content: text.substring(lastIndex) });
    }

    return (
      <div className="message-content-body">
        {parts.map((p, idx) => {
          if (p.type === 'code') {
            const isCopied = copiedKey === p.key;
            return (
              <div key={idx} className="chatbot-code-block" style={{ margin: '0.75rem 0' }}>
                <div className="code-block-header">
                  <span className="code-lang-tag">{p.lang}</span>
                  <button
                    type="button"
                    className="code-copy-btn"
                    onClick={() => handleCopyCode(p.code, p.key)}
                  >
                    {isCopied ? (
                      <>
                        <Check size={12} color="#34d399" />
                        <span style={{ color: '#34d399' }}>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="code-block-pre">
                  <code>{p.code}</code>
                </pre>
              </div>
            );
          }

          const lines = p.content.split('\n');
          return (
            <div key={idx}>
              {lines.map((l, lIdx) => {
                if (!l.trim()) return <div key={lIdx} style={{ height: '0.4rem' }} />;
                if (l.trim().startsWith('- ') || l.trim().startsWith('* ')) {
                  return (
                    <div key={lIdx} className="chat-bullet-line">
                      <span className="chat-bullet-dot">•</span>
                      <span>{renderInline(l.trim().substring(2))}</span>
                    </div>
                  );
                }
                if (l.trim().startsWith('### ')) {
                  return (
                    <div key={lIdx} className="chat-header-3">
                      {l.trim().substring(4)}
                    </div>
                  );
                }
                if (l.trim().startsWith('## ')) {
                  return (
                    <div key={lIdx} className="chat-header-2">
                      {l.trim().substring(3)}
                    </div>
                  );
                }
                return (
                  <p key={lIdx} style={{ margin: '0.25rem 0' }}>
                    {renderInline(l)}
                  </p>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  const renderInline = (line) => {
    const parts = [];
    const inlineRegex = /(`[^`]+`|\*\*[^*]+\*\*)/g;
    let last = 0;
    let m;
    while ((m = inlineRegex.exec(line)) !== null) {
      if (m.index > last) {
        parts.push(line.substring(last, m.index));
      }
      if (m[0].startsWith('`')) {
        parts.push(<code key={parts.length} className="inline-code">{m[0].slice(1, -1)}</code>);
      } else if (m[0].startsWith('**')) {
        parts.push(<strong key={parts.length} className="inline-strong">{m[0].slice(2, -2)}</strong>);
      }
      last = m.index + m[0].length;
    }
    if (last < line.length) {
      parts.push(line.substring(last));
    }
    return parts;
  };

  return (
    <div className="chat-container">
      {/* Active File Banner */}
      {activeInspectorFile && (
        <div style={{
          background: 'rgba(56, 189, 248, 0.1)',
          borderBottom: '1px solid rgba(56, 189, 248, 0.2)',
          padding: '0.6rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.82rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileCode size={15} color="#4f46e5" />
            <span style={{ color: '#64748b' }}>Currently inspecting:</span>
            <code style={{ color: '#4f46e5', fontWeight: 600 }}>{activeInspectorFile}</code>
          </div>
          <button
            type="button"
            className="btn-secondary"
            style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}
            onClick={() => handleSend(`Explain the role, functions, and architecture of ${activeInspectorFile}.`)}
            disabled={loading}
          >
            Ask About This File
          </button>
        </div>
      )}

      {!apiKey && (
        <div style={{
          background: '#fffbeb',
          borderBottom: '1px solid #fde68a',
          padding: '0.65rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          fontSize: '0.82rem',
          color: '#b45309'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={15} color="#d97706" />
            <span>Currently in <strong>AST Heuristic Mode</strong>. Enter your own Gemini API key for conversational AI reasoning and code recommendations.</span>
          </div>
          {onOpenApiKeyModal && (
            <button
              type="button"
              onClick={onOpenApiKeyModal}
              className="btn-primary"
              style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
            >
              Enter API Key
            </button>
          )}
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="chat-history">
        {messages.map((msg, idx) => (
          <div key={idx} className={`chat-bubble ${msg.role}`}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem', fontSize: '0.78rem', color: msg.role === 'user' ? '#ffffff' : '#4f46e5', fontWeight: 600 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                <span>{msg.role === 'user' ? 'You' : 'Project Explainer AI'}</span>
              </div>
              {msg.modelUsed && (
                <span className="model-used-tag" style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem' }}>
                  {msg.modelUsed}
                </span>
              )}
            </div>

            {renderMessageContent(msg.text, idx)}

            {msg.sources && msg.sources.length > 0 && (
              <div style={{ marginTop: '0.85rem', paddingTop: '0.65rem', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Relevant modules:</span>
                {msg.sources.map((src, sIdx) => (
                  <button
                    key={sIdx}
                    type="button"
                    className="source-nav-pill"
                    onClick={() => onNavigateToFile && onNavigateToFile(src)}
                    title={`View ${src} in Inspector`}
                  >
                    <FileText size={11} />
                    <span>{src}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="chat-bubble assistant" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#64748b' }}>
            <Loader2 size={16} className="spin-animation" color="#4f46e5" />
            <span>Analyzing repository context and drafting response...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompt Chips & Input Row */}
      <div className="chat-input-area">
        <div className="chat-prompt-chips">
          {SUGGESTED_PROMPTS.map((prompt, pIdx) => (
            <button
              key={pIdx}
              className="prompt-chip"
              onClick={() => handleSend(prompt)}
              disabled={loading}
            >
              {prompt}
            </button>
          ))}
        </div>

        <form
          className="chat-input-row"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
        >
          <input
            type="text"
            className="chat-input"
            placeholder="Ask anything about the architecture, execution flow, or dependencies..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
          />
          <button type="submit" className="btn-primary" disabled={loading || !input.trim()}>
            <Send size={15} />
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
}

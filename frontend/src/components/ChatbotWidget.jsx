import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Sparkles,
  X,
  Send,
  Bot,
  User,
  Loader2,
  Trash2,
  FileCode,
  Check,
  Copy,
  Maximize2,
  Minimize2,
  HelpCircle,
  Code
} from 'lucide-react';

const COMMON_DOUBTS = [
  "How does this project work from start to finish?",
  "What is the main execution flow and entry point?",
  "Which files or modules have the highest coupling?",
  "How do I run and test this codebase locally?"
];

export default function ChatbotWidget({
  scanData,
  activeInspectorFile,
  onNavigateToFile,
  apiBaseUrl,
  apiKey,
  onOpenApiKeyModal
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Initialize greeting when project changes
  useEffect(() => {
    if (scanData?.repo_name) {
      setMessages([
        {
          role: 'assistant',
          text: `👋 Hi! I am your **Project Explainer AI Chatbot**.\n\nI have parsed the AST, module dependencies, and architecture for **${scanData.repo_name}** (${scanData.total_files} files, ${scanData.total_loc.toLocaleString()} LOC).\n\nAsk me any doubts about how the code works, data flow, functions, or how to implement new features!`,
          sources: []
        }
      ]);
    }
  }, [scanData?.repo_name, scanData?.total_files, scanData?.total_loc]);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      inputRef.current?.focus();
    }
  }, [isOpen, messages, loading]);

  const handleSend = async (questionText) => {
    const q = (questionText || input).trim();
    if (!q || loading) return;

    setInput('');
    const userMsg = { role: 'user', text: q };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setLoading(true);

    try {
      // Build lightweight conversation history for the API
      const historyPayload = updatedMessages
        .slice(-6)
        .map(m => ({ role: m.role, text: m.text }));

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
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to query AI assistant');
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
          text: `⚠️ **Notice:** ${err.message}. Please verify the backend is active on \`${apiBaseUrl}\`.`,
          sources: []
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = (codeText, idx) => {
    navigator.clipboard.writeText(codeText);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleClearHistory = () => {
    setMessages([
      {
        role: 'assistant',
        text: `Conversation cleared! Ask me anything about **${scanData?.repo_name || 'this project'}**.`,
        sources: []
      }
    ]);
  };

  // Helper to render message text with formatted code blocks and markdown styling
  const renderMessageContent = (text, msgIdx) => {
    if (!text) return null;

    // Split code blocks: ```lang ... ```
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    let blockCount = 0;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      const precedingText = text.substring(lastIndex, match.index);
      if (precedingText) {
        parts.push({ type: 'text', content: precedingText });
      }

      const lang = match[1] || 'code';
      const code = match[2];
      const codeKey = `${msgIdx}-block-${blockCount++}`;

      parts.push({
        type: 'code',
        lang,
        code,
        key: codeKey
      });

      lastIndex = match.index + match[0].length;
    }

    const remainingText = text.substring(lastIndex);
    if (remainingText) {
      parts.push({ type: 'text', content: remainingText });
    }

    return (
      <div className="message-content-body">
        {parts.map((part, pIdx) => {
          if (part.type === 'code') {
            const isCopied = copiedIndex === part.key;
            return (
              <div key={pIdx} className="chatbot-code-block">
                <div className="code-block-header">
                  <span className="code-lang-tag">{part.lang}</span>
                  <button
                    type="button"
                    className="code-copy-btn"
                    onClick={() => handleCopyCode(part.code, part.key)}
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
                  <code>{part.code}</code>
                </pre>
              </div>
            );
          }

          // Plain text with markdown line breaks and bold
          const lines = part.content.split('\n');
          return (
            <div key={pIdx} className="text-paragraphs">
              {lines.map((line, lIdx) => {
                if (!line.trim()) return <div key={lIdx} style={{ height: '0.45rem' }} />;

                // Bullet item
                if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
                  const bulletText = line.trim().substring(2);
                  return (
                    <div key={lIdx} className="chat-bullet-line">
                      <span className="chat-bullet-dot">•</span>
                      <span>{renderInlineMarkdown(bulletText)}</span>
                    </div>
                  );
                }

                // Header ###
                if (line.trim().startsWith('### ')) {
                  return (
                    <div key={lIdx} className="chat-header-3">
                      {line.trim().substring(4)}
                    </div>
                  );
                }
                if (line.trim().startsWith('## ')) {
                  return (
                    <div key={lIdx} className="chat-header-2">
                      {line.trim().substring(3)}
                    </div>
                  );
                }

                return (
                  <p key={lIdx} style={{ margin: '0.2rem 0' }}>
                    {renderInlineMarkdown(line)}
                  </p>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  // Helper for inline `code` and **bold**
  const renderInlineMarkdown = (line) => {
    const parts = [];
    const inlineRegex = /(`[^`]+`|\*\*[^*]+\*\*)/g;
    let lastIdx = 0;
    let m;

    while ((m = inlineRegex.exec(line)) !== null) {
      if (m.index > lastIdx) {
        parts.push(line.substring(lastIdx, m.index));
      }
      const token = m[0];
      if (token.startsWith('`') && token.endsWith('`')) {
        parts.push(
          <code key={parts.length} className="inline-code">
            {token.slice(1, -1)}
          </code>
        );
      } else if (token.startsWith('**') && token.endsWith('**')) {
        parts.push(
          <strong key={parts.length} className="inline-strong">
            {token.slice(2, -2)}
          </strong>
        );
      }
      lastIdx = m.index + token.length;
    }

    if (lastIdx < line.length) {
      parts.push(line.substring(lastIdx));
    }

    return parts;
  };

  return (
    <>
      {/* Floating Trigger Button in bottom-right (Round FAB design) */}
      {!isOpen && (
        <button
          type="button"
          className="chatbot-floating-trigger round-btn"
          onClick={() => setIsOpen(true)}
          aria-label="Ask AI doubts about the project architecture & code"
        >
          <div className="chatbot-trigger-icon-wrap">
            <Sparkles size={24} className="sparkle-pulse" />
          </div>
          {activeInspectorFile && (
            <span className="chatbot-round-badge" title={`Focused file: ${activeInspectorFile}`}>
              <span className="badge-ping" />
            </span>
          )}
          <span className="chatbot-floating-tooltip">
            {activeInspectorFile ? `Ask Doubts • ${activeInspectorFile}` : 'Ask AI Doubts'}
          </span>
        </button>
      )}

      {/* Floating Chatbot Window */}
      {isOpen && (
        <div className={`chatbot-window ${isExpanded ? 'expanded' : ''}`}>
          {/* Header */}
          <div className="chatbot-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div className="chatbot-avatar-badge">
                <Bot size={18} color="#38bdf8" />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="chatbot-title">Project AI Chatbot</span>
                  <button
                    type="button"
                    onClick={onOpenApiKeyModal}
                    className={`ai-mode-pill ${apiKey ? 'active-ai' : 'heuristic'}`}
                    style={{ cursor: 'pointer', border: 'none', background: apiKey ? 'rgba(56, 189, 248, 0.2)' : 'rgba(245, 158, 11, 0.2)' }}
                    title={apiKey ? 'Gemini AI reasoning active (Click to manage key)' : 'Click to enter your Gemini API Key'}
                  >
                    {apiKey ? 'Gemini AI' : 'AST Mode (Add Key)'}
                  </button>
                </div>
                <div className="chatbot-subtitle">
                  {scanData?.repo_name ? `Project: ${scanData.repo_name}` : 'Ready for questions'}
                </div>
              </div>
            </div>

            <div className="chatbot-header-actions">
              <button
                type="button"
                onClick={handleClearHistory}
                className="chatbot-icon-btn"
                title="Clear chat history"
              >
                <Trash2 size={14} />
              </button>
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="chatbot-icon-btn"
                title={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="chatbot-icon-btn"
                title="Close chat"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Active File Context Notification Bar */}
          {activeInspectorFile && (
            <div className="chatbot-context-banner">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', overflow: 'hidden' }}>
                <FileCode size={13} color="#38bdf8" />
                <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Focused File:</span>
                <span className="context-file-tag">{activeInspectorFile}</span>
              </div>
              <button
                type="button"
                className="context-ask-btn"
                onClick={() => handleSend(`Explain what ${activeInspectorFile} does and how it fits into the architecture.`)}
                disabled={loading}
              >
                Ask About This File
              </button>
            </div>
          )}

          {/* Messages Stream */}
          <div className="chatbot-messages-area">
            {messages.map((msg, idx) => (
              <div key={idx} className={`chatbot-bubble-row ${msg.role}`}>
                <div className="bubble-avatar">
                  {msg.role === 'user' ? <User size={13} /> : <Bot size={13} />}
                </div>

                <div className="bubble-body">
                  <div className="bubble-author">
                    <span>{msg.role === 'user' ? 'You' : 'Explainer AI'}</span>
                    {msg.modelUsed && (
                      <span className="model-used-tag">{msg.modelUsed}</span>
                    )}
                  </div>

                  {renderMessageContent(msg.text, idx)}

                  {/* Sources / Modules chips */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="bubble-sources-wrap">
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Sources:</span>
                      {msg.sources.map((src, sIdx) => (
                        <button
                          key={sIdx}
                          type="button"
                          className="source-nav-pill"
                          onClick={() => onNavigateToFile && onNavigateToFile(src)}
                          title={`Inspect ${src}`}
                        >
                          <FileCode size={11} />
                          <span>{src}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="chatbot-bubble-row assistant">
                <div className="bubble-avatar">
                  <Bot size={13} />
                </div>
                <div className="bubble-body loading-bubble">
                  <Loader2 size={15} className="spin-animation" color="#38bdf8" />
                  <span>Reasoning over codebase context & AST...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Doubts Prompt Chips */}
          <div className="chatbot-quick-chips">
            <div className="quick-chips-scroll">
              {COMMON_DOUBTS.map((doubt, dIdx) => (
                <button
                  key={dIdx}
                  type="button"
                  className="quick-doubt-chip"
                  onClick={() => handleSend(doubt)}
                  disabled={loading}
                >
                  <HelpCircle size={11} color="#38bdf8" />
                  <span>{doubt}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Chat Input Bar */}
          <form
            className="chatbot-input-row"
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
          >
            <input
              ref={inputRef}
              type="text"
              className="chatbot-input"
              placeholder="Ask any doubt about architecture, files, or functions..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
            />
            <button
              type="submit"
              className="chatbot-send-btn"
              disabled={loading || !input.trim()}
              title="Send question"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

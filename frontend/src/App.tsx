import { useState, useRef, useEffect } from 'react';
import { Paperclip, ArrowUp, Loader2, FileText, CheckCircle2, Sparkles, BookOpen, Zap } from 'lucide-react';
import axios from 'axios';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  isLoading?: boolean;
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [treePath, setTreePath] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 192) + 'px';
    }
  }, [query]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', selected);

      const res = await axios.post(`${API_URL}/api/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setTreePath(res.data.tree_path);
      setMessages([{
        id: Date.now().toString(),
        role: 'assistant',
        content: `Document indexed successfully — **${selected.name}**\n\nI've analyzed the structure of your document and I'm ready to answer questions. Go ahead, ask me anything.`
      }]);
    } catch (err) {
      console.error(err);
      setMessages([{
        id: Date.now().toString(),
        role: 'assistant',
        content: `Something went wrong while processing your document. Please make sure the backend server is running and try again.`
      }]);
      setFile(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSend = async () => {
    if (!query.trim() || !treePath || !file || isUploading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: query };
    const loadingId = (Date.now() + 1).toString();
    const loadingMsg: Message = { id: loadingId, role: 'assistant', content: '', isLoading: true };

    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setQuery('');

    try {
      const formData = new FormData();
      formData.append('question', userMsg.content);
      formData.append('filename', file.name);
      formData.append('tree_path', treePath);

      const res = await axios.post(`${API_URL}/api/ask`, formData);

      setMessages(prev => prev.map(m =>
        m.id === loadingId
          ? { ...m, content: res.data.answer, sources: res.data.sources, isLoading: false }
          : m
      ));
    } catch (err) {
      console.error(err);
      setMessages(prev => prev.map(m =>
        m.id === loadingId
          ? { ...m, content: "I encountered an error while searching. Please try again.", isLoading: false }
          : m
      ));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickActions = [
    { icon: <BookOpen size={14} />, label: "Summarize this document" },
    { icon: <Sparkles size={14} />, label: "Extract key concepts" },
    { icon: <Zap size={14} />, label: "Find important definitions" },
  ];

  const handleQuickAction = (action: string) => {
    if (!file || !treePath) return;
    setQuery(action);
    setTimeout(() => handleSend(), 100);
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-[#030303] text-white overflow-hidden" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

      {/* Header */}
      <header className="shrink-0 flex items-center justify-between px-4 sm:px-8 h-14 sm:h-16 border-b border-white/[0.06] z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Sparkles size={14} className="text-white" />
          </div>
          <h1 className="text-base sm:text-lg font-semibold tracking-tight">Cortex</h1>
          <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-white/[0.06] text-[10px] font-medium text-white/50 border border-white/[0.06] tracking-wide">BETA</span>
        </div>

        {/* File status in header on mobile */}
        {file && (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06]">
            {isUploading ? <Loader2 size={12} className="animate-spin text-violet-400" /> : <CheckCircle2 size={12} className="text-emerald-400" />}
            <span className="text-xs text-white/60 truncate max-w-[120px] sm:max-w-[200px]">{file.name}</span>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center w-full overflow-hidden">

        {/* Chat / Hero Area */}
        <div className="flex-1 flex flex-col items-center w-full px-4 sm:px-6 overflow-hidden">

          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center w-full max-w-2xl animate-fade-in">

              {/* Hero */}
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-600/20 border border-violet-500/20 flex items-center justify-center mb-6 sm:mb-8 shadow-2xl shadow-violet-500/10">
                <Sparkles size={24} className="text-violet-400" />
              </div>
              <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight text-center mb-3 sm:mb-4 bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
                What do you want to know?
              </h2>
              <p className="text-sm sm:text-base text-white/40 text-center mb-8 sm:mb-12 max-w-md px-4">
                Upload a document and ask anything. Cortex will intelligently search your content to find the answer.
              </p>

              {/* Quick Actions */}
              {!file && (
                <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 w-full sm:w-auto px-4 sm:px-0">
                  {quickActions.map((action, i) => (
                    <button
                      key={i}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] text-sm text-white/50 hover:text-white/80 hover:bg-white/[0.06] hover:border-white/[0.12] cursor-default transition-all duration-200 flex items-center gap-2 justify-center"
                    >
                      {action.icon}
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div
              ref={scrollRef}
              className="flex-1 w-full max-w-2xl overflow-y-auto pb-4 pt-6 space-y-6 scroll-smooth"
              style={{ scrollbarWidth: 'none' }}
            >
              {messages.map((msg) => (
                <div key={msg.id} className={`flex w-full animate-fade-in ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'user' ? (
                    <div className="max-w-[85%] sm:max-w-[75%] px-4 py-3 rounded-2xl rounded-tr-md text-[14px] sm:text-[15px] leading-relaxed bg-violet-600/20 border border-violet-500/20 text-white/90">
                      {msg.content}
                    </div>
                  ) : (
                    <div className="flex gap-3 max-w-[95%] sm:max-w-[85%]">
                      <div className="shrink-0 w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-gradient-to-br from-violet-500/30 to-indigo-600/30 border border-violet-500/20 flex items-center justify-center mt-0.5">
                        <Sparkles size={12} className="text-violet-400" />
                      </div>
                      <div className="flex flex-col gap-2 min-w-0">
                        {msg.isLoading ? (
                          <div className="flex items-center gap-2.5 py-2">
                            <div className="flex gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                            </div>
                            <span className="text-xs sm:text-sm text-white/40">Analyzing document...</span>
                          </div>
                        ) : (
                          <>
                            <div className="text-[14px] sm:text-[15px] leading-relaxed text-white/85">
                              <p className="whitespace-pre-wrap">{msg.content}</p>
                            </div>
                            {msg.sources && msg.sources.length > 0 && (
                              <div className="mt-2 pt-2.5 border-t border-white/[0.06] flex flex-wrap gap-1.5">
                                {msg.sources.map((s, i) => (
                                  <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-[11px] text-white/40">
                                    <FileText size={10} /> {s}
                                  </span>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Input Area — Always at bottom */}
        <div className="shrink-0 w-full max-w-2xl px-4 sm:px-6 pb-4 sm:pb-6 pt-2">

          {/* Search Bar Container */}
          <div className="rounded-2xl w-full p-1.5 sm:p-2 flex items-end bg-white/[0.04] border border-white/[0.08] shadow-[0_8px_40px_rgba(0,0,0,0.4)] transition-all duration-300 focus-within:border-violet-500/30 focus-within:shadow-[0_8px_40px_rgba(139,92,246,0.08)]">

            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 sm:p-3 text-white/30 hover:text-white/70 hover:bg-white/[0.04] rounded-xl transition-all shrink-0"
              title="Attach Document"
            >
              <Paperclip size={18} className="stroke-[1.5]" />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".md,.pdf"
              className="hidden"
            />

            <textarea
              ref={textareaRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={file ? "Ask a question about your document..." : "Attach a document to get started"}
              disabled={!file || isUploading}
              className="flex-1 max-h-48 min-h-[40px] sm:min-h-[44px] bg-transparent border-none outline-none resize-none pt-2.5 sm:pt-3 pb-2.5 sm:pb-3 px-1 sm:px-2 text-[14px] sm:text-[15px] text-white/90 placeholder:text-white/20 disabled:opacity-40"
              rows={1}
            />

            <button
              onClick={handleSend}
              disabled={!query.trim() || !treePath || isUploading}
              className="p-2.5 sm:p-3 ml-1 bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-15 disabled:hover:bg-violet-600 rounded-xl transition-all shrink-0 shadow-lg shadow-violet-600/20"
            >
              <ArrowUp size={18} className="stroke-2" />
            </button>
          </div>

          <p className="text-center text-[10px] sm:text-xs text-white/20 mt-3 sm:mt-4 tracking-wide">
            Powered by PageIndex · Built by <span className="text-white/30 font-medium">Saini</span>
          </p>
        </div>
      </main>
    </div>
  );
}

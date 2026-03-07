import { useState, useRef, useEffect } from 'react';
import { Paperclip, ArrowUp, Loader2, FileText, CheckCircle2, History, Settings, MessageSquare } from 'lucide-react';
import axios from 'axios';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  isLoading?: boolean;
};

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [treePath, setTreePath] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', selected);

      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const res = await axios.post(`${API_URL}/api/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setTreePath(res.data.tree_path);
      setMessages([{
        id: Date.now().toString(),
        role: 'assistant',
        content: `I've successfully indexed **${selected.name}**. What would you like to know about it?`
      }]);
    } catch (err) {
      console.error(err);
      setMessages([{
        id: Date.now().toString(),
        role: 'assistant',
        content: `Failed to process document. Make sure the backend is running.`
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

      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
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
          ? { ...m, content: "Sorry, I encountered an error while searching the document.", isLoading: false }
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

  return (
    <div className="flex h-screen w-full bg-[#030303] text-primary overflow-hidden font-sans selection:bg-white/20">

      {/* Side Navigation (Minimalist) */}
      <nav className="w-16 h-full border-r border-border/40 flex flex-col items-center py-6 gap-8 shrink-0 z-10 bg-transparent">
        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center cursor-pointer hover:scale-105 transition-transform">
          <span className="text-black font-bold text-lg leading-none mt-[-2px]">◓</span>
        </div>
        <div className="flex flex-col items-center gap-6 mt-4 opacity-60">
          <button className="hover:opacity-100 hover:text-white transition-all"><MessageSquare size={20} className="stroke-[1.5]" /></button>
          <button className="hover:opacity-100 hover:text-white transition-all"><History size={20} className="stroke-[1.5]" /></button>
          <button className="hover:opacity-100 hover:text-white transition-all"><Settings size={20} className="stroke-[1.5]" /></button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative">

        {/* Top Header */}
        <header className="absolute top-0 left-0 right-0 h-16 flex items-center justify-between px-8 z-10 pointer-events-none">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-medium tracking-tight opacity-90 pointer-events-auto">PageIndex</h1>
            <span className="px-2 py-0.5 rounded-full bg-white/10 text-xs font-medium text-white/70 border border-white/5 pointer-events-auto">Beta</span>
          </div>
        </header>

        {/* Chat / Hero Area */}
        <div className="flex-1 flex flex-col items-center w-full px-4 overflow-hidden pt-20">

          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center w-full max-w-3xl animate-fade-in -mt-20">
              <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-center mb-12 opacity-90">
                What do you want to know?
              </h2>
            </div>
          ) : (
            <div
              ref={scrollRef}
              className="flex-1 w-full max-w-3xl overflow-y-auto no-scrollbar pb-8 pt-4 space-y-8 scroll-smooth"
            >
              {messages.map((msg) => (
                <div key={msg.id} className={`flex w-full animate-fade-in ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'user' ? (
                    <div className="bg-surfaceHover max-w-[85%] px-5 py-3.5 rounded-2xl rounded-tr-sm text-[15px] leading-relaxed border border-border/50 shadow-sm">
                      {msg.content}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 max-w-[95%]">
                      {msg.isLoading ? (
                        <div className="flex items-center gap-3 text-secondary py-2">
                          <Loader2 size={16} className="animate-spin" />
                          <span className="text-sm font-medium">Scanning document structure...</span>
                        </div>
                      ) : (
                        <div className="text-[15px] leading-relaxed opacity-90 prose prose-invert max-w-none">
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                          {msg.sources && msg.sources.length > 0 && (
                            <div className="mt-4 pt-3 border-t border-border/50 flex flex-wrap gap-2">
                              {msg.sources.map((s, i) => (
                                <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-xs text-secondary">
                                  <FileText size={12} /> {s}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Input Area (Variant 2 style) */}
          <div className="w-full max-w-3xl pb-8 pt-2">

            {/* Context Chips (if empty) */}
            {messages.length === 0 && !file && (
              <div className="flex items-center justify-center gap-3 mb-6 animate-fade-in delay-100">
                <span className="px-4 py-2 rounded-full border border-border/60 bg-surface/30 text-sm text-secondary hover:text-white cursor-pointer transition-colors backdrop-blur-sm">Summarize key points</span>
                <span className="px-4 py-2 rounded-full border border-border/60 bg-surface/30 text-sm text-secondary hover:text-white cursor-pointer transition-colors backdrop-blur-sm">Extract main arguments</span>
              </div>
            )}

            {/* Attached File Indicator */}
            {file && (
              <div className="mb-3 flex items-center gap-2 animate-fade-in px-2">
                <div className="px-3 py-1.5 rounded-lg bg-surfaceHover border border-border flex items-center gap-2 text-sm text-secondary shadow-sm">
                  {isUploading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} className="text-emerald-500" />}
                  <span className="truncate max-w-[200px] font-medium">{file.name}</span>
                </div>
              </div>
            )}

            {/* Search Bar Container */}
            <div className="glass rounded-2xl w-full p-2 flex items-end shadow-[0_8px_30px_rgb(0,0,0,0.5)] transition-all duration-300 focus-within:ring-1 focus-within:ring-white/20">

              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-3 text-secondary hover:text-white hover:bg-white/5 rounded-xl transition-colors shrink-0"
                title="Attach Document"
              >
                <Paperclip size={20} className="stroke-[1.5]" />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".md,.pdf"
                className="hidden"
              />

              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={file ? "Ask a question..." : "Attach a document to get started"}
                disabled={!file || isUploading}
                className="flex-1 max-h-48 min-h-[44px] bg-transparent border-none outline-none resize-none pt-3 pb-3 px-2 text-[15px] placeholder:text-secondary disabled:opacity-50"
                rows={1}
              />

              <button
                onClick={handleSend}
                disabled={!query.trim() || !treePath || isUploading}
                className="p-3 ml-2 bg-white text-black hover:bg-primaryHover disabled:opacity-20 disabled:hover:bg-white rounded-xl transition-all shrink-0 font-medium shadow-sm"
              >
                <ArrowUp size={20} className="stroke-2" />
              </button>
            </div>

            <p className="text-center text-xs text-secondary/60 mt-4 tracking-wide">
              Powering vectorless RAG with PageIndex and Groq.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

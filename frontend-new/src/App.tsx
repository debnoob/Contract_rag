import { useState, useRef, useEffect } from 'react';
import { Send, Upload, FileText, Trash2, Bot, User, Menu } from 'lucide-react';
import axios from 'axios';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const API_BASE = 'http://localhost:8000';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

type Document = {
  id: string;
  filename: string;
};

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hi there! I am your contract assistant. Upload a legal document and ask me anything about it.' }
  ]);
  const [input, setInput] = useState('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const fetchDocuments = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/documents`);
      setDocuments(res.data);
    } catch (e) {
      console.error("Failed to fetch documents", e);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      await axios.post(`${API_BASE}/api/upload`, formData);
      await fetchDocuments();
      setMessages(prev => [...prev, { role: 'assistant', content: `Successfully uploaded ${file.name}. What would you like to know about it?` }]);
    } catch (e) {
      console.error("Upload failed", e);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I failed to upload that document.' }]);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (docId: string, filename: string) => {
    try {
      await axios.delete(`${API_BASE}/api/documents/${docId}`);
      await fetchDocuments();
      setMessages(prev => [...prev, { role: 'assistant', content: `Deleted ${filename}.` }]);
    } catch (e) {
      console.error("Failed to delete", e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      const res = await axios.post(`${API_BASE}/api/query`, { query: userMsg });
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.answer }]);
    } catch (e) {
      console.error("Query failed", e);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error while processing your request.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden relative">
      {/* Sidebar */}
      <aside 
        className={cn(
          "absolute inset-y-0 left-0 z-20 w-72 bg-panel border-r border-border transition-transform duration-300 ease-in-out md:static md:translate-x-0 flex flex-col",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="h-14 flex items-center justify-between px-4 border-b border-border">
          <h2 className="font-semibold text-lg text-primary truncate">Documents</h2>
          <button 
            className="md:hidden p-1 text-muted hover:text-primary transition"
            onClick={() => setSidebarOpen(false)}
          >
             <Menu size={20} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {documents.length === 0 ? (
            <p className="text-sm text-muted text-center pt-8">No documents uploaded</p>
          ) : (
            documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/50 group hover:border-accent/30 transition">
                <div className="flex items-center space-x-3 overflow-hidden">
                  <FileText className="text-accent shrink-0" size={18} />
                  <span className="text-sm truncate font-medium text-primary">{doc.filename}</span>
                </div>
                <button 
                  onClick={() => handleDelete(doc.id, doc.filename)}
                  className="p-1.5 text-muted hover:text-red-500 hover:bg-white rounded-md transition opacity-0 group-hover:opacity-100"
                  title="Delete document"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-border bg-secondary/20">
          <input 
            type="file" 
            accept=".pdf" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleUpload}
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full py-2.5 px-4 bg-primary text-white rounded-lg font-medium flex items-center justify-center space-x-2 hover:bg-primary/90 transition disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Upload size={18} />
                <span>Upload PDF</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-panel relative">
        {/* Mobile Header */}
        <header className="h-14 flex items-center px-4 border-b border-border md:hidden bg-panel/80 backdrop-blur-sm z-10 sticky top-0">
          <button 
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 text-muted hover:text-primary transition"
          >
            <Menu size={24} />
          </button>
          <h1 className="font-semibold text-lg ml-2">Chat</h1>
        </header>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="w-full max-w-3xl mx-auto py-8 px-4 flex flex-col space-y-8">
            {messages.map((msg, idx) => (
              <div key={idx} className={cn("flex space-x-4 max-w-prose", msg.role === 'user' ? "ml-auto flex-row-reverse space-x-reverse" : "mr-auto")}>
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                  msg.role === 'user' ? "bg-[#2d2d2d] text-white font-medium mt-1" : "bg-transparent text-accent"
                )}>
                  {msg.role === 'user' ? <User size={16} /> : <Bot size={24} />}
                </div>
                <div className={cn(
                  "px-5 py-3.5 rounded-2xl text-[15px] leading-relaxed",
                  msg.role === 'user' 
                    ? "bg-[#f3f1e9] text-primary rounded-tr-sm" 
                    : "bg-transparent text-primary"
                )}>
                  {msg.role === 'user' ? (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  ) : (
                    <div className="prose prose-sm md:prose-base prose-neutral max-w-none prose-p:leading-relaxed prose-pre:bg-secondary prose-pre:text-primary prose-a:text-accent hover:prose-a:text-accentHover">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex space-x-4 max-w-prose mr-auto">
                <div className="w-8 h-8 flex items-center justify-center shrink-0 bg-transparent text-accent">
                  <Bot size={24} />
                </div>
                <div className="px-5 py-3.5 flex items-center space-x-1.5 h-12">
                  <div className="w-2 h-2 rounded-full bg-muted/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-muted/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-muted/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={bottomRef} className="h-4" />
          </div>
        </div>

        {/* Input Area */}
        <div className="p-4 bg-panel border-t border-border/50">
          <div className="w-full max-w-3xl mx-auto relative group">
            <form onSubmit={handleSubmit} className="relative flex items-end">
              <textarea
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  // Auto-resize
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder="Ask Claude or anything about your contracts..."
                className="w-full bg-[#f3f1e9] text-primary placeholder:text-muted rounded-2xl py-3.5 pl-5 pr-12 focus:outline-none focus:bg-[#f3f1e9] resize-none max-h-[200px] scrollbar-hide shadow-sm"
                rows={1}
                disabled={isLoading}
              />
              <button 
                type="submit" 
                disabled={!input.trim() || isLoading}
                className="absolute right-3 mb-2.5 p-1.5 text-primary hover:bg-[#e4e2da] rounded-lg transition disabled:text-muted/40 disabled:hover:bg-transparent"
              >
                <Send size={18} />
              </button>
            </form>
            <div className="text-center mt-3">
              <span className="text-[12px] text-muted tracking-wide font-serif italic">
                Claude can make mistakes. Please double-check responses.
              </span>
            </div>
          </div>
        </div>
      </main>
      
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-primary/20 backdrop-blur-sm z-10"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}

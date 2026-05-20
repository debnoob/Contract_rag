import { useState, useRef, useEffect } from 'react';
import { Send, Upload, FileText, Trash2, Bot, User, Menu, MessageSquare, Plus } from 'lucide-react';
import axios from 'axios';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { supabase } from './lib/supabase';

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

type Chat = {
  id: string;
  title: string;
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
  
  const [activeTab, setActiveTab] = useState<'chats' | 'documents'>('chats');
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchChats();
  }, []);

  useEffect(() => {
    fetchDocuments(currentChatId);
  }, [currentChatId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const fetchDocuments = async (chatId: string | null) => {
    if (!chatId) {
      setDocuments([]);
      return;
    }
    try {
      const res = await axios.get(`${API_BASE}/api/documents?chat_id=${chatId}`);
      setDocuments(res.data);
    } catch (e) {
      console.error("Failed to fetch documents", e);
    }
  };

  const fetchChats = async () => {
    const { data, error } = await supabase
      .from('chats')
      .select('id, title')
      .order('created_at', { ascending: false });
    if (!error && data) {
      setChats(data);
    }
  };

  const selectChat = async (chatId: string) => {
    setCurrentChatId(chatId);
    if (window.innerWidth < 768) setSidebarOpen(false); // Close sidebar on mobile
    const { data, error } = await supabase
      .from('messages')
      .select('role, content')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });
    
    if (!error && data) {
      if (data.length === 0) {
        setMessages([{ role: 'assistant', content: 'Hi there! I am your contract assistant. Upload a legal document and ask me anything about it.' }]);
      } else {
        setMessages(data as Message[]);
      }
    }
  };

  const createNewChat = () => {
    setCurrentChatId(null);
    setMessages([{ role: 'assistant', content: 'Hi there! I am your contract assistant. Upload a legal document and ask me anything about it.' }]);
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let chatId = currentChatId;
    if (!chatId) {
      const title = 'Document Upload...';
      const { data: newChat, error: chatError } = await supabase
        .from('chats')
        .insert({ title })
        .select('id')
        .single();
        
      if (!chatError && newChat) {
        chatId = newChat.id;
        setCurrentChatId(chatId);
        setChats(prev => [{ id: chatId as string, title }, ...prev]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Failed to create a chat for this document.' }]);
        return;
      }
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('chat_id', chatId);

    try {
      await axios.post(`${API_BASE}/api/upload`, formData);
      await fetchDocuments(chatId);
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
      await fetchDocuments(currentChatId);
      setMessages(prev => [...prev, { role: 'assistant', content: `Deleted ${filename}.` }]);
    } catch (e) {
      console.error("Failed to delete", e);
    }
  };

  const handleDeleteChat = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation(); // Prevent clicking from also selecting the chat
    try {
      const { error } = await supabase.from('chats').delete().eq('id', chatId);
      if (!error) {
        setChats(prev => prev.filter(c => c.id !== chatId));
        if (currentChatId === chatId) {
          createNewChat();
        }
      } else {
        console.error("Failed to delete chat", error);
      }
    } catch (err) {
      console.error("Error deleting chat", err);
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
      let chatId = currentChatId;
      
      if (!chatId) {
        const title = userMsg.split(' ').slice(0, 4).join(' ') + '...';
        const { data: newChat, error: chatError } = await supabase
          .from('chats')
          .insert({ title })
          .select('id')
          .single();
          
        if (!chatError && newChat) {
          chatId = newChat.id;
          setCurrentChatId(chatId);
          setChats(prev => [{ id: chatId as string, title }, ...prev]);
        }
      }

      if (chatId) {
        await supabase.from('messages').insert({
          chat_id: chatId,
          role: 'user',
          content: userMsg
        });
      }

      const res = await axios.post(`${API_BASE}/api/query`, { query: userMsg, chat_id: chatId });
      const assistantMsg = res.data.answer;
      
      setMessages(prev => [...prev, { role: 'assistant', content: assistantMsg }]);

      if (chatId) {
        await supabase.from('messages').insert({
          chat_id: chatId,
          role: 'assistant',
          content: assistantMsg
        });
      }
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
        <div className="h-14 flex items-center justify-between px-4 border-b border-border shrink-0">
          <div className="flex w-full items-center p-1 space-x-1 bg-secondary/50 rounded-lg">
            <button 
              onClick={() => setActiveTab('chats')} 
              className={cn("flex-1 flex items-center justify-center space-x-2 py-1.5 rounded-md text-sm transition font-medium", activeTab === 'chats' ? 'bg-panel text-primary shadow-sm border border-border/50' : 'text-muted hover:text-primary')}
            >
              <MessageSquare size={16} />
              <span>Chats</span>
            </button>
            <button 
              onClick={() => setActiveTab('documents')} 
              className={cn("flex-1 flex items-center justify-center space-x-2 py-1.5 rounded-md text-sm transition font-medium", activeTab === 'documents' ? 'bg-panel text-primary shadow-sm border border-border/50' : 'text-muted hover:text-primary')}
            >
              <FileText size={16} />
              <span>Docs</span>
            </button>
          </div>
          <button 
            className="md:hidden p-1 text-muted hover:text-primary transition ml-2"
            onClick={() => setSidebarOpen(false)}
          >
             <Menu size={20} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {activeTab === 'chats' ? (
            <>
              <button onClick={createNewChat} className="w-full flex items-center justify-center space-x-2 p-2.5 rounded-lg border border-dashed border-border text-muted hover:text-primary hover:border-primary hover:bg-secondary/30 transition mb-4">
                <Plus size={16} />
                <span className="text-sm font-medium">New Chat</span>
              </button>
              {chats.length === 0 ? (
                <p className="text-sm text-muted text-center pt-8">No past chats</p>
              ) : (
                chats.map((chat) => (
                  <button 
                    key={chat.id} 
                    onClick={() => selectChat(chat.id)}
                    className={cn(
                      "w-full flex items-center justify-between text-left p-3 rounded-lg transition border group", 
                      currentChatId === chat.id 
                        ? 'bg-secondary/80 border-border shadow-sm' 
                        : 'border-transparent hover:bg-secondary/50'
                    )}
                  >
                    <div className="flex items-center overflow-hidden mr-2">
                      <MessageSquare className="text-accent shrink-0 mr-3" size={18} />
                      <span className="text-sm truncate font-medium text-primary">{chat.title}</span>
                    </div>
                    <div 
                      onClick={(e) => handleDeleteChat(e, chat.id)}
                      className="p-1.5 text-muted hover:text-red-500 hover:bg-white rounded-md transition opacity-0 group-hover:opacity-100"
                      title="Delete chat"
                    >
                      <Trash2 size={16} />
                    </div>
                  </button>
                ))
              )}
            </>
          ) : (
            documents.length === 0 ? (
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
            )
          )}
        </div>

        {activeTab === 'documents' && (
          <div className="p-4 border-t border-border bg-secondary/20 shrink-0">
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
        )}
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-panel relative">
        {/* Mobile Header */}
        <header className="h-14 flex items-center px-4 border-b border-border md:hidden bg-panel/80 backdrop-blur-sm z-10 sticky top-0 shrink-0">
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
        <div className="p-4 bg-panel border-t border-border/50 shrink-0">
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

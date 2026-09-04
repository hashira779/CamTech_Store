'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import {
  Sparkles,
  X,
  Send,
  Bot,
  User,
  ArrowUpRight,
  Lightbulb,
  Maximize2,
  Minimize2,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { CopilotChatResponse } from '@mystore/contracts';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  intent?: string;
  authorized?: boolean;
  actionLink?: string | null;
  actionText?: string | null;
  suggestions?: string[];
  timestamp: string;
}

export function AiCopilotDrawer() {
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'msg_welcome',
      sender: 'assistant',
      text: 'Hello! I am your **MyStore Enterprise Copilot**. Ask me about today\'s sales, stock shortages, active delivery couriers, or pending approvals.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      suggestions: [
        'What are today\'s sales and top products?',
        'Show low stock inventory alerts',
        'Where are our active drivers right now?',
      ],
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Global Cmd+J / Ctrl+J hotkey
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Chat Mutation
  const chatMutation = useMutation({
    mutationFn: (msg: string) => api.copilotChat(token!, msg),
    onSuccess: (data: CopilotChatResponse) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_${Date.now()}`,
          sender: 'assistant',
          text: data.message,
          intent: data.intent,
          authorized: data.authorized,
          actionLink: data.actionLink,
          actionText: data.actionText,
          suggestions: data.suggestions,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_err_${Date.now()}`,
          sender: 'assistant',
          text: '⚠️ Unable to process query. Please check your network connection or backend services.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    },
  });

  const handleSend = (textToSend?: string) => {
    const query = textToSend || inputMessage;
    if (!query.trim() || chatMutation.isPending) return;

    // Append user message
    setMessages((prev) => [
      ...prev,
      {
        id: `msg_usr_${Date.now()}`,
        sender: 'user',
        text: query,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);

    setInputMessage('');
    chatMutation.mutate(query);
  };

  if (!token) return null;

  return (
    <>
      {/* ─── Floating Trigger Bubble ─── */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-sky-600 via-indigo-600 to-purple-600 text-white shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-200 border border-white/20 group"
          title="Open AI Copilot (Cmd+J)"
        >
          <Sparkles className="w-4 h-4 animate-spin-slow group-hover:rotate-12 transition-transform" />
          <span className="text-xs font-semibold tracking-wide">AI Copilot</span>
          <kbd className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-md font-mono">⌘J</kbd>
        </button>
      )}

      {/* ─── Slide-Over Copilot Panel ─── */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[420px] max-w-[calc(100vw-2rem)] h-[620px] max-h-[calc(100vh-4rem)] rounded-2xl bg-slate-950/95 backdrop-blur-xl border border-sky-500/30 shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-6">
          {/* Top Bar */}
          <div className="p-4 bg-slate-900/80 border-b border-border/40 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-500 flex items-center justify-center text-white shadow-md">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                  Enterprise AI Copilot
                  <Badge variant="outline" className="text-[9px] bg-sky-500/10 text-sky-400 border-sky-500/30">
                    AI Assistant
                  </Badge>
                </h3>
                <p className="text-[10px] text-slate-400">Contextual telemetry & analytics assistant</p>
              </div>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="w-7 h-7 text-slate-400 hover:text-white"
              onClick={() => setIsOpen(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-2.5 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.sender === 'assistant' && (
                  <div className="w-6 h-6 rounded-lg bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}

                <div
                  className={`max-w-[82%] rounded-2xl p-3 shadow-md ${
                    m.sender === 'user'
                      ? 'bg-sky-600 text-white rounded-br-xs'
                      : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-xs'
                  }`}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>

                  {/* Action Link Button */}
                  {m.actionLink && m.actionText && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2.5 h-7 text-[11px] gap-1 bg-sky-500/10 text-sky-300 border-sky-500/30 hover:bg-sky-500/20"
                      onClick={() => {
                        setIsOpen(false);
                        navigate(m.actionLink!);
                      }}
                    >
                      {m.actionText}
                      <ArrowUpRight className="w-3 h-3" />
                    </Button>
                  )}

                  {/* Suggestion Pills */}
                  {m.suggestions && m.suggestions.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-800/80 space-y-1.5">
                      <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                        <Lightbulb className="w-2.5 h-2.5 text-amber-400" /> Suggested queries:
                      </span>
                      <div className="flex flex-col gap-1">
                        {m.suggestions.map((s, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSend(s)}
                            className="text-left text-[10px] text-sky-300 hover:text-sky-200 hover:bg-sky-950/40 px-2 py-1 rounded-md transition-colors border border-sky-900/40"
                          >
                            • {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <span className="text-[9px] text-slate-500 block text-right mt-1.5">
                    {m.timestamp}
                  </span>
                </div>

                {m.sender === 'user' && (
                  <div className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300 shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            ))}

            {chatMutation.isPending && (
              <div className="flex gap-2.5 items-center text-slate-400 text-xs italic">
                <div className="w-6 h-6 rounded-lg bg-sky-500/20 flex items-center justify-center text-sky-400 animate-spin">
                  <Sparkles className="w-3 h-3" />
                </div>
                <span>Analyzing telemetry & domain models...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <div className="p-3 bg-slate-900/90 border-t border-border/40">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <Input
                placeholder="Ask about sales, stock, drivers, approvals..."
                className="h-9 text-xs bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-500 focus-visible:ring-sky-500"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                disabled={chatMutation.isPending}
              />
              <Button
                type="submit"
                size="sm"
                className="h-9 px-3 bg-sky-600 hover:bg-sky-500 text-white"
                disabled={!inputMessage.trim() || chatMutation.isPending}
              >
                <Send className="w-3.5 h-3.5" />
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default AiCopilotDrawer;

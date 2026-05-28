import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, User, Loader2, Lock } from 'lucide-react';
import { askAssistant } from '../services/aiService';

export function ChatModal({ onClose, permissionState, requestTokenManually }) {
  const [messages, setMessages] = useState([
    { sender: 'bot', text: '¡Hola! Soy tu asistente virtual con IA. ¿En qué te puedo ayudar hoy con el convenio, licencias o turnos?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    setInput('');
    setMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setIsLoading(true);

    try {
      const response = await askAssistant(userText);
      setMessages(prev => [...prev, { sender: 'bot', text: response.text }]);
    } catch (error) {
      setMessages(prev => [...prev, { sender: 'bot', text: `Error: ${error.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg h-[80vh] max-h-[800px] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-emerald-600 p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center shrink-0 shadow-inner">
              <div 
                style={{
                  width: '20px',
                  height: '20px',
                  background: 'conic-gradient(from 0deg, #EA4335 0%, #4285F4 25%, #34A853 50%, #FBBC04 75%, #EA4335 100%)',
                  clipPath: 'path("M10 0 C10 5.5 14.5 10 20 10 C14.5 10 10 14.5 10 20 C10 14.5 5.5 10 0 10 C5.5 10 10 5.5 10 0 Z")'
                }}
              />
            </div>
            <div>
              <h3 className="text-white font-black text-lg leading-tight">Asistente IA</h3>
              <p className="text-emerald-100 text-xs font-bold">Experto en tu Convenio</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center text-emerald-100 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {permissionState !== 'granted' ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-slate-800 p-6 text-center relative overflow-hidden">
            {/* Fondo Animado Bloqueado */}
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-emerald-500 opacity-20 rounded-full blur-3xl"></div>
            
            <div className="relative z-10 flex flex-col items-center gap-4">
              <div className="bg-slate-900/50 p-6 rounded-3xl backdrop-blur-md shadow-2xl flex flex-col items-center gap-4 border border-slate-700/50">
                <Lock size={48} className="text-emerald-400 drop-shadow-md" />
                <div>
                  <h3 className="text-xl font-black text-white mb-2">Asistente IA Bloqueado</h3>
                  <p className="text-sm font-medium text-slate-300 leading-relaxed max-w-xs">Activa las notificaciones para poder resolver tus dudas con el asistente virtual.</p>
                </div>
                <button onClick={requestTokenManually} className="mt-2 w-full bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-black px-6 py-3 rounded-xl transition-colors shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-2">
                  <Lock size={16} className="opacity-50" />
                  ACTIVAR AHORA
                </button>
              </div>
            </div>
          </div>
        ) : (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 bg-slate-50 flex flex-col gap-4">
            {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl p-3 shadow-sm ${msg.sender === 'user' ? 'bg-emerald-600 text-white rounded-br-sm' : 'bg-white border border-slate-100 text-slate-700 rounded-bl-sm'}`}>
                <div className="flex items-center gap-2 mb-1 opacity-70">
                  {msg.sender === 'user' ? <User size={12} /> : (
                    <div 
                      style={{
                        width: '12px',
                        height: '12px',
                        background: 'conic-gradient(from 0deg, #EA4335 0%, #4285F4 25%, #34A853 50%, #FBBC04 75%, #EA4335 100%)',
                        clipPath: 'path("M6 0 C6 3.3 8.7 6 12 6 C8.7 6 6 8.7 6 12 C6 8.7 3.3 6 0 6 C3.3 6 6 3.3 6 0 Z")'
                      }}
                    />
                  )}
                  <span className="text-[9px] font-black uppercase tracking-widest">{msg.sender === 'user' ? 'Tú' : 'IA'}</span>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-100 rounded-2xl rounded-bl-sm p-4 shadow-sm flex items-center gap-3">
                <Loader2 size={16} className="text-emerald-500 animate-spin" />
                <span className="text-xs text-slate-500 font-bold animate-pulse">Escribiendo...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="p-4 bg-white border-t border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu consulta laboral aquí..."
              disabled={isLoading}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all disabled:opacity-50"
            />
            <button 
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="w-12 h-12 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl flex items-center justify-center transition-all shrink-0 active:scale-95"
            >
              <Send size={18} />
            </button>
          </div>
          <p className="text-center text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-widest">
            Limitado a 10 preguntas por día
          </p>
        </div>
        </>
        )}

      </div>
    </div>
  );
}

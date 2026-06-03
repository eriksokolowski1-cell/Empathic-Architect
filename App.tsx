import React, { useState, useRef, useEffect } from 'react';
import { useLiveSession } from './hooks/useLiveSession';
import OrbVisualizer from './components/OrbVisualizer';
import TranscriptLog from './components/TranscriptLog';
import { ConnectionState } from './types';
import { Mic, MicOff, Power, Activity, AlertCircle, MessageSquare, Send, X, Settings, Check } from 'lucide-react';

const VOICES = [
  { id: 'Kore', label: 'Kore', sub: 'Calm & Natural' },
  { id: 'Fenrir', label: 'Fenrir', sub: 'Deep & Steady' },
  { id: 'Puck', label: 'Puck', sub: 'Soft & Playful' },
];

export default function App() {
  const { connect, disconnect, connectionState, transcripts, volume, errorMessage, sendText, currentVoice, setVoice } = useLiveSession();
  const [showTranscript, setShowTranscript] = useState(false);
  const [showTextWindow, setShowTextWindow] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [textInput, setTextInput] = useState('');

  const textInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (showTextWindow && textInputRef.current) {
      textInputRef.current.focus();
    }
  }, [showTextWindow]);

  const handleToggleConnection = () => {
    if (connectionState === ConnectionState.CONNECTED) {
      disconnect();
    } else {
      connect();
    }
  };

  const handleSendText = () => {
    if (!textInput.trim()) return;
    if (connectionState !== ConnectionState.CONNECTED) {
       // Optional: Could queue or auto-connect, but for now just warn or connect
       // Let's just require connection for simplicity in this context
       alert("Please connect to The Architect first.");
       return;
    }
    sendText(textInput);
    setTextInput('');
  };

  const handleVoiceChange = (voiceId: string) => {
    if (voiceId === currentVoice) return;
    setVoice(voiceId);
    // If connected, we need to reconnect to switch voices
    if (connectionState === ConnectionState.CONNECTED) {
      disconnect();
      // Small timeout to allow cleanup before reconnecting
      setTimeout(() => connect(), 500);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col md:flex-row overflow-hidden relative selection:bg-indigo-500/30">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(30,27,75,0.5),rgba(15,23,42,1))] pointer-events-none" />
      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-slate-900/50 to-transparent pointer-events-none z-10" />

      {/* Main Content Area (Visualizer & Interaction) */}
      <main className="flex-1 flex flex-col relative z-20 h-[100dvh] md:h-screen transition-all duration-500 ease-in-out">
        
        {/* Header */}
        <header className="absolute top-0 left-0 w-full p-6 flex justify-between items-center z-30">
          <div>
            <h1 className="font-serif text-2xl md:text-3xl text-slate-100 tracking-tight">
              The Architect
            </h1>
            <p className="text-xs text-indigo-400 font-medium tracking-widest uppercase mt-1 opacity-80">
              Emotional Intelligence Module • Active
            </p>
          </div>
          <div className="flex items-center gap-4">
             {/* Voice Settings Trigger */}
            <div className="relative">
              <button 
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 rounded-full transition-all duration-300 ${showSettings ? 'bg-indigo-500/20 text-indigo-300' : 'hover:bg-white/5 text-slate-400'}`}
              >
                <Settings size={20} />
              </button>
              
              {/* Voice Settings Dropdown */}
              {showSettings && (
                <div className="absolute right-0 top-12 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl z-50 animate-in fade-in zoom-in-95 duration-200">
                  <div className="p-3 border-b border-slate-800 bg-slate-950/50">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Select Voice</span>
                  </div>
                  <div className="p-1">
                    {VOICES.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => handleVoiceChange(v.id)}
                        className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-all flex items-center justify-between group ${
                          currentVoice === v.id 
                            ? 'bg-indigo-500/10 text-indigo-300' 
                            : 'text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <div>
                          <div className="font-medium">{v.label}</div>
                          <div className="text-[10px] text-slate-500 group-hover:text-slate-400 transition-colors">{v.sub}</div>
                        </div>
                        {currentVoice === v.id && <Check size={14} className="text-indigo-400" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pl-4 border-l border-slate-800/50">
              <span className={`h-2 w-2 rounded-full ${
                  connectionState === ConnectionState.CONNECTED ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 
                  connectionState === ConnectionState.CONNECTING ? 'bg-amber-400 animate-pulse' : 
                  connectionState === ConnectionState.ERROR ? 'bg-red-500' : 'bg-slate-600'
                }`} 
              />
              <span className={`text-xs font-mono ${connectionState === ConnectionState.ERROR ? 'text-red-400' : 'text-slate-500'}`}>
                {connectionState}
              </span>
            </div>
          </div>
        </header>

        {/* Center Stage: The Orb */}
        <div className="flex-1 flex flex-col items-center justify-center relative">
          <div className="w-64 h-64 md:w-96 md:h-96 relative">
            <OrbVisualizer 
              isActive={connectionState === ConnectionState.CONNECTED}
              isConnecting={connectionState === ConnectionState.CONNECTING}
              volume={volume} 
            />
          </div>
          
          <div className="mt-8 text-center px-4">
             {connectionState === ConnectionState.ERROR && errorMessage ? (
               <div className="flex items-center justify-center gap-2 text-red-400 bg-red-900/20 px-4 py-2 rounded-lg border border-red-900/50">
                 <AlertCircle size={16} />
                 <span className="text-sm font-medium">{errorMessage}</span>
               </div>
             ) : (
                <p className={`text-slate-400 text-sm font-light tracking-wide transition-opacity duration-500 ${
                  connectionState === ConnectionState.CONNECTED ? 'opacity-100' : 'opacity-0'
                }`}>
                   Listening deeply...
                </p>
             )}
          </div>
        </div>

        {/* Text Window Overlay */}
        {showTextWindow && (
          <div className="absolute inset-x-0 bottom-32 z-40 px-4 md:px-0 flex justify-center animate-in slide-in-from-bottom-10 fade-in duration-300">
             <div className="w-full max-w-2xl bg-slate-900/90 backdrop-blur-xl border border-indigo-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col ring-1 ring-white/10">
                <div className="flex justify-between items-center px-4 py-2 border-b border-indigo-500/20 bg-indigo-500/5">
                   <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">Context Injection</span>
                   <button onClick={() => setShowTextWindow(false)} className="text-slate-400 hover:text-white transition-colors">
                     <X size={16} />
                   </button>
                </div>
                <div className="p-4">
                  <textarea
                    ref={textInputRef}
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Paste text here to share it with the Architect..."
                    className="w-full bg-slate-950/50 text-slate-200 p-3 rounded-lg border border-slate-700/50 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 outline-none resize-none h-32 text-sm placeholder:text-slate-600"
                  />
                  <div className="flex justify-between items-center mt-3">
                    <span className="text-[10px] text-slate-500">
                      Press Enter to send • Shift+Enter for new line
                    </span>
                    <button 
                      onClick={handleSendText}
                      disabled={!textInput.trim()}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span>Transmit</span>
                      <Send size={14} />
                    </button>
                  </div>
                </div>
             </div>
          </div>
        )}

        {/* Control Dock */}
        <div className="pb-12 px-6 flex justify-center items-center gap-6 z-30">
          
          <button 
            onClick={() => setShowTranscript(!showTranscript)}
            className={`p-4 rounded-full transition-all duration-300 backdrop-blur-md border ${
              showTranscript 
                ? 'bg-slate-700/50 border-slate-500 text-white' 
                : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
            }`}
            aria-label="Toggle Transcript"
            title="View Transcript"
          >
            <Activity size={24} />
          </button>

          <button
            onClick={handleToggleConnection}
            className={`h-20 w-20 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl border ${
              connectionState === ConnectionState.CONNECTED
                ? 'bg-rose-500/10 border-rose-500/50 text-rose-500 hover:bg-rose-500/20 hover:scale-105'
                : connectionState === ConnectionState.ERROR
                ? 'bg-red-500 hover:bg-red-400 border-red-400/50 text-white'
                : 'bg-indigo-500 hover:bg-indigo-400 border-indigo-400/50 text-white hover:scale-105 hover:shadow-[0_0_30px_rgba(99,102,241,0.4)]'
            }`}
          >
            {connectionState === ConnectionState.CONNECTED ? (
              <MicOff size={32} />
            ) : (
              <Mic size={32} />
            )}
          </button>

          <button 
            onClick={() => setShowTextWindow(!showTextWindow)}
            className={`p-4 rounded-full transition-all duration-300 backdrop-blur-md border ${
              showTextWindow
                ? 'bg-indigo-500/50 border-indigo-400 text-white shadow-[0_0_15px_rgba(99,102,241,0.3)]' 
                : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
            }`}
            aria-label="Open Text Input"
            title="Share Text"
          >
            <MessageSquare size={24} />
          </button>

        </div>
      </main>

      {/* Transcript Sidebar (Collapsible) */}
      <aside 
        className={`fixed md:relative right-0 top-0 h-full bg-slate-900/95 md:bg-slate-950 border-l border-slate-800 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] z-40 overflow-hidden ${
          showTranscript ? 'w-full md:w-96 translate-x-0' : 'w-0 translate-x-full md:translate-x-0 md:w-0'
        }`}
      >
        <div className="h-full flex flex-col">
          <div className="p-6 border-b border-slate-800 flex justify-between items-center">
             <h2 className="font-serif text-lg text-slate-200">Session Log</h2>
             <button 
                onClick={() => setShowTranscript(false)}
                className="md:hidden text-slate-400"
             >
               Close
             </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <TranscriptLog items={transcripts} />
          </div>
          <div className="p-4 border-t border-slate-800 bg-slate-950">
            <p className="text-[10px] text-slate-600 text-center">
              The Empathetic Architect • Powered by Gemini 2.5
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
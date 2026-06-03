import { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { ConnectionState, TranscriptItem } from '../types';
import { createPcmBlob, decodeAudioData, base64ToUint8Array } from '../utils/audioUtils';
import { MODEL_NAME, OUTPUT_SAMPLE_RATE, SYSTEM_INSTRUCTION } from '../constants';

export const useLiveSession = () => {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [volume, setVolume] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentVoice, setCurrentVoice] = useState<string>('Kore');
  
  // Audio Contexts & Nodes
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const inputNodeRef = useRef<GainNode | null>(null);
  const outputNodeRef = useRef<GainNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Timing & Sources
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  // Session
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const currentSessionRef = useRef<any>(null);

  // Transcripts buffer
  const currentInputTransRef = useRef<string>('');
  const currentOutputTransRef = useRef<string>('');

  const cleanupAudio = useCallback(() => {
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }
    
    // Stop all playing sources
    sourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) {}
    });
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  }, []);

  const connect = useCallback(async () => {
    setErrorMessage(null);
    try {
      setConnectionState(ConnectionState.CONNECTING);

      // Initialize Audio Contexts
      const InputContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      const OutputContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      
      let inputCtx: AudioContext;
      try {
        inputCtx = new InputContextClass({ sampleRate: 16000 });
      } catch (e) {
        console.warn("16kHz sample rate not supported, falling back to default");
        inputCtx = new InputContextClass();
      }

      let outputCtx: AudioContext;
      try {
        outputCtx = new OutputContextClass({ sampleRate: OUTPUT_SAMPLE_RATE });
      } catch (e) {
         console.warn("24kHz sample rate not supported, falling back to default");
         outputCtx = new OutputContextClass();
      }

      inputAudioContextRef.current = inputCtx;
      outputAudioContextRef.current = outputCtx;
      
      if (inputCtx.state === 'suspended') await inputCtx.resume();
      if (outputCtx.state === 'suspended') await outputCtx.resume();
      
      inputNodeRef.current = inputCtx.createGain();
      outputNodeRef.current = outputCtx.createGain();
      outputNodeRef.current.connect(outputCtx.destination);

      // Get Microphone Stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Connect to Gemini Live
      const sessionPromise = ai.live.connect({
        model: MODEL_NAME,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: SYSTEM_INSTRUCTION,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: currentVoice } }
          },
          inputAudioTranscription: {}, 
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            console.log('Session Opened');
            setConnectionState(ConnectionState.CONNECTED);
            
            if (!inputAudioContextRef.current || !streamRef.current) return;
            
            const source = inputAudioContextRef.current.createMediaStreamSource(streamRef.current);
            const processor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = processor;
            
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              
              let sum = 0;
              for (let i = 0; i < inputData.length; i++) {
                sum += inputData[i] * inputData[i];
              }
              const rms = Math.sqrt(sum / inputData.length);
              setVolume(rms);

              const pcmBlob = createPcmBlob(inputData);
              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(processor);
            processor.connect(inputAudioContextRef.current.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.outputTranscription) {
              currentOutputTransRef.current += message.serverContent.outputTranscription.text;
            } else if (message.serverContent?.inputTranscription) {
              currentInputTransRef.current += message.serverContent.inputTranscription.text;
            }

            if (message.serverContent?.turnComplete) {
              const newTranscripts: TranscriptItem[] = [];
              if (currentInputTransRef.current.trim()) {
                newTranscripts.push({
                  id: Date.now().toString() + '-user',
                  role: 'user',
                  text: currentInputTransRef.current.trim(),
                  timestamp: new Date()
                });
              }
              if (currentOutputTransRef.current.trim()) {
                 newTranscripts.push({
                  id: Date.now().toString() + '-model',
                  role: 'model',
                  text: currentOutputTransRef.current.trim(),
                  timestamp: new Date()
                });
              }
              
              if (newTranscripts.length > 0) {
                 setTranscripts(prev => [...prev, ...newTranscripts]);
              }
              
              currentInputTransRef.current = '';
              currentOutputTransRef.current = '';
            }

            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current && outputNodeRef.current) {
              const ctx = outputAudioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              
              const audioBytes = base64ToUint8Array(base64Audio);
              const audioBuffer = await decodeAudioData(audioBytes, ctx, OUTPUT_SAMPLE_RATE, 1);
              
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputNodeRef.current);
              
              source.addEventListener('ended', () => {
                sourcesRef.current.delete(source);
              });
              
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
            }
            
             const interrupted = message.serverContent?.interrupted;
             if (interrupted) {
                sourcesRef.current.forEach(source => {
                  try { source.stop(); } catch(e) {}
                });
                sourcesRef.current.clear();
                nextStartTimeRef.current = 0;
             }
          },
          onclose: (e) => {
            console.log('Session Closed', e);
            setConnectionState(ConnectionState.DISCONNECTED);
          },
          onerror: (err) => {
            console.error('Session Error', err);
            setErrorMessage(err instanceof Error ? err.message : "Connection error detected");
            setConnectionState(ConnectionState.ERROR);
          }
        }
      });

      sessionPromiseRef.current = sessionPromise;
      sessionPromise.then(s => { currentSessionRef.current = s; });

    } catch (error) {
      console.error("Connection failed:", error);
      setErrorMessage(error instanceof Error ? error.message : "Failed to initialize session");
      setConnectionState(ConnectionState.ERROR);
      cleanupAudio();
    }
  }, [cleanupAudio, currentVoice]);

  const disconnect = useCallback(() => {
    if (currentSessionRef.current) {
        try {
           if (typeof currentSessionRef.current.close === 'function') {
               currentSessionRef.current.close();
           }
        } catch(e) {
            console.warn("Could not close session gracefully", e);
        }
    }
    cleanupAudio();
    setConnectionState(ConnectionState.DISCONNECTED);
  }, [cleanupAudio]);

  const sendText = useCallback((text: string) => {
    if (sessionPromiseRef.current) {
      const timestamp = new Date();
      // Optimistically add to transcript so user sees it
      setTranscripts(prev => [...prev, {
          id: Date.now().toString() + '-text-user',
          role: 'user',
          text: text,
          timestamp
      }]);

      sessionPromiseRef.current.then(session => {
           session.send({ clientContent: { turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true } });
      });
    }
  }, []);

  return {
    connect,
    disconnect,
    connectionState,
    transcripts,
    volume,
    errorMessage,
    sendText,
    currentVoice,
    setVoice: setCurrentVoice,
    isSpeaking: connectionState === ConnectionState.CONNECTED && volume > 0.01
  };
};
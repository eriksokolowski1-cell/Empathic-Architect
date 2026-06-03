export interface AudioConfig {
  sampleRate: number;
  channels: number;
}

export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
}

export interface TranscriptItem {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

// Visualizer specific types
export interface VisualizerState {
  volume: number;
  isTalking: boolean;
}
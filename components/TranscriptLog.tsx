import React, { useEffect, useRef } from 'react';
import { TranscriptItem } from '../types';

interface TranscriptLogProps {
  items: TranscriptItem[];
}

const TranscriptLog: React.FC<TranscriptLogProps> = ({ items }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500 text-sm italic">
        Awaiting input...
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-4 p-4">
      {items.map((item) => (
        <div 
          key={item.id} 
          className={`flex flex-col ${item.role === 'user' ? 'items-end' : 'items-start'}`}
        >
          <div 
            className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              item.role === 'user' 
                ? 'bg-indigo-600 text-white rounded-tr-sm' 
                : 'bg-slate-800/80 text-slate-200 border border-slate-700/50 rounded-tl-sm'
            }`}
          >
            {item.text}
          </div>
          <span className="text-[10px] text-slate-500 mt-1 px-1">
            {item.role === 'user' ? 'Architect' : 'Cerebral'}
          </span>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
};

export default TranscriptLog;
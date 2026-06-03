import React, { useEffect, useRef } from 'react';

interface OrbVisualizerProps {
  isActive: boolean;
  volume: number; // 0 to 1
  isConnecting: boolean;
}

const OrbVisualizer: React.FC<OrbVisualizerProps> = ({ isActive, volume, isConnecting }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  const timeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      timeRef.current += 0.01;
      
      // Resize handling
      if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
      }
      
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;
      
      ctx.clearRect(0, 0, width, height);

      // Base radius configuration
      // If connecting, pulse slowly. If active, react to volume. If inactive, small dot.
      let baseRadius = 60;
      let pulseSpeed = 2;
      let color1 = 'rgba(79, 70, 229, 0.6)'; // Indigo
      let color2 = 'rgba(124, 58, 237, 0.4)'; // Violet

      if (isConnecting) {
          baseRadius = 50 + Math.sin(timeRef.current * 4) * 5;
          color1 = 'rgba(234, 179, 8, 0.6)'; // Yellow
      } else if (!isActive) {
          baseRadius = 20;
          color1 = 'rgba(148, 163, 184, 0.2)'; // Slate
          color2 = 'rgba(148, 163, 184, 0.1)';
      } else {
          // Active state logic
          // Map volume (RMS) to radius expansion
          // RMS usually 0.0 to 0.5 for speech
          const expansion = Math.min(volume * 400, 100); 
          baseRadius = 70 + expansion;
      }

      // Draw Outer Glow
      const gradient = ctx.createRadialGradient(centerX, centerY, baseRadius * 0.2, centerX, centerY, baseRadius * 1.5);
      gradient.addColorStop(0, color1);
      gradient.addColorStop(0.6, color2);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');

      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Draw Inner Core
      ctx.beginPath();
      // Add some noise/wobble to the inner core based on time
      const wobble = isActive ? Math.sin(timeRef.current * 3) * 2 : 0;
      ctx.arc(centerX, centerY, (baseRadius * 0.5) + wobble, 0, Math.PI * 2);
      ctx.fillStyle = 'white';
      ctx.globalAlpha = isActive ? 0.9 : 0.3;
      ctx.shadowBlur = 20;
      ctx.shadowColor = 'white';
      ctx.fill();
      
      // Reset globals
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      // Draw "Rings" if active
      if (isActive) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.arc(centerX, centerY, baseRadius * 1.2, 0, Math.PI * 2);
        ctx.stroke();
      }

      requestRef.current = requestAnimationFrame(render);
    };

    requestRef.current = requestAnimationFrame(render);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isActive, volume, isConnecting]);

  return (
    <canvas 
      ref={canvasRef} 
      className="w-full h-full"
    />
  );
};

export default OrbVisualizer;
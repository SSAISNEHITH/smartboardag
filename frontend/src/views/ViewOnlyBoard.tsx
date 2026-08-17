import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import API_BASE from '../config/api';


const LINE_HEIGHT = 40;
const TOTAL_LINES = 356;
const TOTAL_HEIGHT = TOTAL_LINES * LINE_HEIGHT;

interface Point { x: number; y: number; }
interface Stroke { id: string; points: Point[]; color: string; width: number; isEraser: boolean; step: number; }
interface RuledLineText { id: string; line: number; text: string; color: string; fontSize: number; step: number; }
interface DiagramItem {
  id: string;
  type: string;
  title: string;
  startLine: number;
  endLine: number;
  data: any;
  step: number;
}

const ViewOnlyBoard: React.FC = () => {
  const { id } = useParams();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [ruledTexts, setRuledTexts] = useState<{ [line: number]: RuledLineText }>({});
  const [diagrams, setDiagrams] = useState<DiagramItem[]>([]);
  const [boardTitle, setBoardTitle] = useState('View Only Board');

  // Load board from backend
  useEffect(() => {
    const load = async () => {
      if (!id || id === 'demo') return;
      try {
        const res = await fetch(`${API_BASE}/api/dashboard/files/item/${id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.name) setBoardTitle(data.name);
          if (data.content) {
            try {
              const parsed = JSON.parse(data.content);
              if (parsed.strokes) setStrokes(parsed.strokes);
              if (parsed.ruledTexts) setRuledTexts(parsed.ruledTexts);
              if (parsed.diagrams) setDiagrams(parsed.diagrams);
            } catch { /* ignore */ }
          }
        }
      } catch { /* offline fallback */ }
    };
    load();
    // Poll every 5s for live updates
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [id]);

  // Draw strokes onto canvas
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    strokes.forEach(stroke => {
      if (stroke.points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      if (stroke.isEraser) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = stroke.width || 28;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.width || 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    });
  }, [strokes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvas.parentElement?.clientWidth ? canvas.parentElement.clientWidth - 45 : 1200;
    canvas.height = TOTAL_HEIGHT;
    redrawCanvas();
  }, [redrawCanvas]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#fff', fontFamily: 'Inter, sans-serif' }}>
      {/* View-Only Header */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.65rem 1.5rem', background: '#0A2540', color: '#fff',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)', zIndex: 10, flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            background: '#EF4444', color: '#fff', padding: '0.2rem 0.65rem',
            borderRadius: '1rem', fontSize: '0.72rem', fontWeight: 800,
            letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: '0.3rem'
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff', display: 'inline-block' }} />
            VIEW ONLY
          </div>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>{boardTitle}</h2>
        </div>
        <div style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 500 }}>
          🔒 Read-only mode — no drawing or editing allowed
        </div>
      </header>

      {/* Board */}
      <div style={{ flex: 1, overflow: 'auto', position: 'relative', background: '#fff' }} ref={containerRef}>
        {/* Ruled lines background */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: `${TOTAL_HEIGHT}px`,
          backgroundImage: 'linear-gradient(to bottom, transparent 39px, #E2E8F0 40px)',
          backgroundSize: '100% 40px', pointerEvents: 'none', zIndex: 1
        }} />

        {/* Line numbers */}
        <div style={{
          position: 'absolute', top: 0, left: 0, width: 44, height: `${TOTAL_HEIGHT}px`,
          borderRight: '1px solid #E2E8F0', background: '#F8FAFC', zIndex: 5, userSelect: 'none'
        }}>
          {Array.from({ length: TOTAL_LINES }).map((_, i) => (
            <div key={i + 1} style={{
              height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.72rem', color: '#94A3B8', fontWeight: 600
            }}>
              {i + 1}
            </div>
          ))}
        </div>

        {/* Canvas (read-only, no events) */}
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute', top: 0, left: 45, width: 'calc(100% - 45px)',
            height: `${TOTAL_HEIGHT}px`, zIndex: 2, pointerEvents: 'none'
          }}
        />

        {/* Text overlay (read-only) */}
        <div style={{
          position: 'absolute', top: 0, left: 45, right: 0,
          width: 'calc(100% - 45px)', height: `${TOTAL_HEIGHT}px`,
          zIndex: 3, pointerEvents: 'none'
        }}>
          {Object.values(ruledTexts).map(textData => (
            <div
              key={textData.id}
              style={{
                position: 'absolute',
                top: (textData.line - 1) * LINE_HEIGHT,
                left: 0, right: 0, height: LINE_HEIGHT,
                display: 'flex', alignItems: 'center',
                paddingLeft: '1.25rem',
                color: textData.color || '#0A2540',
                fontSize: `${textData.fontSize || 20}px`,
                fontWeight: 600,
                fontFamily: 'inherit',
                letterSpacing: '0.01em',
                userSelect: 'none',
                whiteSpace: 'pre'
              }}
            >
              {textData.text}
            </div>
          ))}

          {/* Diagrams (read-only) */}
          {diagrams.map(diag => {
            const height = (diag.endLine - diag.startLine) * LINE_HEIGHT;
            return (
              <div key={diag.id} style={{
                position: 'absolute',
                top: (diag.startLine - 1) * LINE_HEIGHT,
                left: '1.5rem', right: '2rem', height,
                border: '2px solid #2563EB', borderRadius: '0.75rem',
                background: '#fff', display: 'flex', flexDirection: 'column',
                overflow: 'hidden', zIndex: 4
              }}>
                <div style={{
                  padding: '0.5rem 1rem', background: '#F8FAFC',
                  borderBottom: '1px solid #E2E8F0', fontWeight: 700,
                  fontSize: '0.9rem', color: '#0A2540'
                }}>
                  {diag.title}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        height: 32, background: '#0A2540', color: '#94A3B8',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.8rem', fontWeight: 600
      }}>
        Thrisual Smart Teach · View Only Mode · Board ID: {id || 'demo'}
      </div>
    </div>
  );
};

export default ViewOnlyBoard;

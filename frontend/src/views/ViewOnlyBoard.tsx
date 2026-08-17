import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Activity, BookOpen, ChevronLeft, ChevronRight, FileText, 
  Image as ImageIcon, Presentation, ZoomIn, ZoomOut, Wifi, WifiOff 
} from 'lucide-react';
import API_BASE from '../config/api';
import useBoardSync, { type LiveMessage } from '../hooks/useBoardSync';
import styles from './Smartboard.module.css';

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
interface FileEmbed {
  id: string;
  name: string;
  fileType: string;
  dataUrl?: string;
  startLine: number;
  endLine: number;
  zoom: number;
  currentPage: number;
  totalPages: number;
  slidesOrPages?: Array<{ title?: string; text?: string }>;
  step: number;
}

const ViewOnlyBoard: React.FC = () => {
  const { id } = useParams();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [liveStroke, setLiveStroke] = useState<Stroke | null>(null);
  const [ruledTexts, setRuledTexts] = useState<{ [line: number]: RuledLineText }>({});
  const [diagrams, setDiagrams] = useState<DiagramItem[]>([]);
  const [fileEmbeds, setFileEmbeds] = useState<FileEmbed[]>([]);
  const [boardTitle, setBoardTitle] = useState('Live Teaching Smartboard');
  const [revealedStep, setRevealedStep] = useState(0);

  // Handle incoming live broadcast messages from the educator
  const handleLiveMessage = useCallback((msg: LiveMessage) => {
    switch (msg.type) {
      case 'STROKE_START':
        if (msg.stroke) {
          setLiveStroke(msg.stroke);
        }
        break;

      case 'STROKE_DRAW':
        if (msg.point) {
          setLiveStroke(prev => {
            if (!prev) return null;
            return {
              ...prev,
              points: [...prev.points, msg.point!]
            };
          });
        }
        break;

      case 'STROKE_END':
        if (msg.stroke) {
          setStrokes(prev => [...prev, msg.stroke]);
        }
        setLiveStroke(null);
        break;

      case 'TEXT_CHANGE':
        if (msg.lineNum !== undefined && msg.textData) {
          setRuledTexts(prev => ({
            ...prev,
            [msg.lineNum!]: msg.textData
          }));
        }
        break;

      case 'DIAGRAM_UPDATE':
        if (Array.isArray(msg.diagrams)) {
          setDiagrams(msg.diagrams);
        }
        break;

      case 'FILES_UPDATE':
        if (Array.isArray(msg.fileEmbeds)) {
          setFileEmbeds(msg.fileEmbeds);
        }
        break;

      case 'REVEAL_UPDATE':
        if (typeof msg.revealedStep === 'number') {
          setRevealedStep(msg.revealedStep);
        }
        break;

      case 'BOARD_SYNC':
      case 'FULL_STATE':
        if (msg.data) {
          const d = msg.data;
          if (d.strokes) setStrokes(d.strokes);
          if (d.ruledTexts) setRuledTexts(d.ruledTexts);
          if (d.diagrams) setDiagrams(d.diagrams);
          if (d.fileEmbeds) setFileEmbeds(d.fileEmbeds);
          if (typeof d.revealedStep === 'number') setRevealedStep(d.revealedStep);
          else if (typeof d.totalRecordedSteps === 'number') setRevealedStep(d.totalRecordedSteps);
          if (d.name) setBoardTitle(d.name);
        }
        break;

      default:
        break;
    }
  }, []);

  const { isConnected, peerCount } = useBoardSync(id, handleLiveMessage);

  // Initial load from backend API
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
              if (parsed.fileEmbeds) setFileEmbeds(parsed.fileEmbeds);
              if (typeof parsed.totalRecordedSteps === 'number') {
                setRevealedStep(parsed.totalRecordedSteps);
              }
            } catch { /* ignore */ }
          }
        }
      } catch { /* offline fallback */ }
    };
    load();

    // Polling fallback every 3s in case WebSocket drops
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [id]);

  // Draw completed strokes + live active in-progress stroke onto canvas
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const allStrokes = [...strokes];
    if (liveStroke && liveStroke.points.length > 0) {
      allStrokes.push(liveStroke);
    }

    allStrokes.forEach(stroke => {
      if (stroke.step > 0 && stroke.step > revealedStep) {
        return;
      }
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
  }, [strokes, liveStroke, revealedStep]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvas.parentElement?.clientWidth ? canvas.parentElement.clientWidth - 45 : 1200;
    canvas.height = TOTAL_HEIGHT;
    redrawCanvas();
  }, [redrawCanvas]);

  const updateFileZoom = (fileId: string, delta: number) => {
    setFileEmbeds(prev => prev.map(f => f.id === fileId ? { ...f, zoom: Math.min(250, Math.max(50, f.zoom + delta)) } : f));
  };

  const updateFilePage = (fileId: string, delta: number) => {
    setFileEmbeds(prev => prev.map(f => f.id === fileId ? { ...f, currentPage: Math.min(f.totalPages, Math.max(1, f.currentPage + delta)) } : f));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#fff', fontFamily: 'Inter, sans-serif' }}>
      {/* Live Stream View-Only Header */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.65rem 1.5rem', background: '#0A2540', color: '#fff',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)', zIndex: 10, flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            background: '#EF4444', color: '#fff', padding: '0.25rem 0.75rem',
            borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 800,
            letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: '0.4rem',
            boxShadow: '0 0 10px rgba(239, 68, 68, 0.5)'
          }}>
            <span style={{ 
              width: 8, height: 8, borderRadius: '50%', background: '#fff', 
              display: 'inline-block', animation: 'pulse 1.2s infinite' 
            }} />
            LIVE STREAM
          </div>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>{boardTitle}</h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ 
            display: 'flex', alignItems: 'center', gap: '0.4rem', 
            fontSize: '0.8rem', color: isConnected ? '#34D399' : '#FBBF24', fontWeight: 600,
            background: 'rgba(255,255,255,0.1)', padding: '0.25rem 0.75rem', borderRadius: '1rem'
          }}>
            {isConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
            {isConnected ? 'Real-Time Connected' : 'Reconnecting...'}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#94A3B8', fontWeight: 500 }}>
            👥 Joined: <strong style={{ color: '#fff' }}>{peerCount}</strong>
          </div>
        </div>
      </header>

      {/* Board Canvas & Overlay */}
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

        {/* Canvas for Live Pen/Eraser Strokes */}
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute', top: 0, left: 45, width: 'calc(100% - 45px)',
            height: `${TOTAL_HEIGHT}px`, zIndex: 2, pointerEvents: 'none'
          }}
        />

        {/* Overlay for Live Text, Diagrams & Documents */}
        <div style={{
          position: 'absolute', top: 0, left: 45, right: 0,
          width: 'calc(100% - 45px)', height: `${TOTAL_HEIGHT}px`,
          zIndex: 3, pointerEvents: 'auto'
        }}>
          {/* 1. Ruled Text Overlay */}
          {Object.values(ruledTexts).map(textData => {
            if (textData.step > 0 && textData.step > revealedStep) return null;
            return (
              <div
                key={textData.id || textData.line}
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
                  whiteSpace: 'pre',
                  pointerEvents: 'none'
                }}
              >
                {textData.text}
              </div>
            );
          })}

          {/* 2. Embedded Diagrams (Rendered with full SVG) */}
          {diagrams.map(diag => {
            if (diag.step > 0 && diag.step > revealedStep) return null;
            const height = (diag.endLine - diag.startLine) * LINE_HEIGHT;

            return (
              <div 
                key={diag.id}
                className={styles.diagramContainer}
                style={{ 
                  top: (diag.startLine - 1) * LINE_HEIGHT, 
                  height: `${height}px`,
                  pointerEvents: 'none'
                }}
              >
                <div className={styles.diagramHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Activity size={16} color="#2563EB" />
                    <strong>{diag.title}</strong>
                    <span className={styles.lineTag}>Lines {diag.startLine}–{diag.endLine}</span>
                  </div>
                </div>

                <div className={styles.diagramBody}>
                  {diag.type === 'cartesian_plane' && (
                    <svg width="100%" height="100%" viewBox="-150 -100 300 200" className={styles.diagramSvg}>
                      <defs>
                        <pattern id={`view_grid_${diag.id}`} width="20" height="20" patternUnits="userSpaceOnUse">
                          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#E2E8F0" strokeWidth="1"/>
                        </pattern>
                      </defs>
                      <rect x="-140" y="-90" width="280" height="180" fill={`url(#view_grid_${diag.id})`} rx="6" />
                      <line x1="-130" y1="0" x2="130" y2="0" stroke="#0F172A" strokeWidth="2" />
                      <line x1="0" y1="-85" x2="0" y2="85" stroke="#0F172A" strokeWidth="2" />
                      <polygon points="135,0 125,-4 125,4" fill="#0F172A" />
                      <polygon points="0,-90 -4,-80 4,-80" fill="#0F172A" />
                      <text x="135" y="15" fill="#475569" fontSize="11" fontWeight="bold">X</text>
                      <text x="10" y="-80" fill="#475569" fontSize="11" fontWeight="bold">Y</text>
                      <text x="5" y="14" fill="#64748B" fontSize="10">(0,0)</text>
                      {[-100, -80, -60, -40, -20, 20, 40, 60, 80, 100].map(val => (
                        <line key={val} x1={val} y1="-3" x2={val} y2="3" stroke="#0F172A" strokeWidth="1.5" />
                      ))}
                      {[-60, -40, -20, 20, 40, 60].map(val => (
                        <line key={val} x1="-3" y1={val} x2="3" y2={val} stroke="#0F172A" strokeWidth="1.5" />
                      ))}
                    </svg>
                  )}

                  {diag.type === 'parabola' && (
                    <svg width="100%" height="100%" viewBox="-150 -100 300 200" className={styles.diagramSvg}>
                      <line x1="-130" y1="60" x2="130" y2="60" stroke="#0F172A" strokeWidth="2" />
                      <line x1="0" y1="-85" x2="0" y2="85" stroke="#0F172A" strokeWidth="2" />
                      <path d="M -80,-60 Q 0,60 80,-60" fill="none" stroke="#2563EB" strokeWidth="3" />
                      <text x="20" y="-50" fill="#2563EB" fontSize="12" fontWeight="bold">y = ax² + bx + c</text>
                      <circle cx="0" cy="60" r="4" fill="#EF4444" />
                      <text x="10" y="75" fill="#EF4444" fontSize="10">Vertex (0,0)</text>
                    </svg>
                  )}

                  {diag.type === 'sine_wave' && (
                    <svg width="100%" height="100%" viewBox="-150 -100 300 200" className={styles.diagramSvg}>
                      <line x1="-130" y1="0" x2="130" y2="0" stroke="#0F172A" strokeWidth="2" />
                      <line x1="0" y1="-85" x2="0" y2="85" stroke="#0F172A" strokeWidth="2" />
                      <path d="M -120,0 Q -90,-60 -60,0 T 0,0 T 60,0 T 120,0" fill="none" stroke="#10B981" strokeWidth="3" />
                      <text x="30" y="-45" fill="#10B981" fontSize="12" fontWeight="bold">y = A·sin(ωt + φ)</text>
                    </svg>
                  )}

                  {diag.type === 'binary_tree' && (
                    <svg width="100%" height="100%" viewBox="0 0 400 200" className={styles.diagramSvg}>
                      <line x1="200" y1="35" x2="110" y2="90" stroke="#64748B" strokeWidth="2" />
                      <line x1="200" y1="35" x2="290" y2="90" stroke="#64748B" strokeWidth="2" />
                      <line x1="110" y1="90" x2="65" y2="155" stroke="#64748B" strokeWidth="2" />
                      <line x1="110" y1="90" x2="155" y2="155" stroke="#64748B" strokeWidth="2" />
                      <line x1="290" y1="90" x2="245" y2="155" stroke="#64748B" strokeWidth="2" />
                      <line x1="290" y1="90" x2="335" y2="155" stroke="#64748B" strokeWidth="2" />
                      <g><circle cx="200" cy="35" r="18" fill="#2563EB" /><text x="200" y="40" fill="white" fontSize="12" fontWeight="bold" textAnchor="middle">Root (A)</text></g>
                      <g><circle cx="110" cy="90" r="16" fill="#3B82F6" /><text x="110" y="95" fill="white" fontSize="11" fontWeight="bold" textAnchor="middle">B</text></g>
                      <g><circle cx="290" cy="90" r="16" fill="#3B82F6" /><text x="290" y="95" fill="white" fontSize="11" fontWeight="bold" textAnchor="middle">C</text></g>
                      <g><circle cx="65" cy="155" r="14" fill="#93C5FD" /><text x="65" y="159" fill="#0A2540" fontSize="10" fontWeight="bold" textAnchor="middle">D</text></g>
                      <g><circle cx="155" cy="155" r="14" fill="#93C5FD" /><text x="155" y="159" fill="#0A2540" fontSize="10" fontWeight="bold" textAnchor="middle">E</text></g>
                      <g><circle cx="245" cy="155" r="14" fill="#93C5FD" /><text x="245" y="159" fill="#0A2540" fontSize="10" fontWeight="bold" textAnchor="middle">F</text></g>
                      <g><circle cx="335" cy="155" r="14" fill="#93C5FD" /><text x="335" y="159" fill="#0A2540" fontSize="10" fontWeight="bold" textAnchor="middle">G</text></g>
                    </svg>
                  )}

                  {diag.type === 'venn_2' && (
                    <svg width="100%" height="100%" viewBox="0 0 350 180" className={styles.diagramSvg}>
                      <circle cx="135" cy="90" r="60" fill="rgba(37, 99, 235, 0.25)" stroke="#2563EB" strokeWidth="2.5" />
                      <circle cx="215" cy="90" r="60" fill="rgba(16, 185, 129, 0.25)" stroke="#10B981" strokeWidth="2.5" />
                      <text x="100" y="95" fill="#1E40AF" fontSize="14" fontWeight="bold">Set A</text>
                      <text x="245" y="95" fill="#065F46" fontSize="14" fontWeight="bold">Set B</text>
                      <text x="175" y="95" fill="#0F172A" fontSize="11" fontWeight="bold" textAnchor="middle">A ∩ B</text>
                    </svg>
                  )}

                  {diag.type === 'venn_3' && (
                    <svg width="100%" height="100%" viewBox="0 0 350 180" className={styles.diagramSvg}>
                      <circle cx="140" cy="75" r="48" fill="rgba(37, 99, 235, 0.2)" stroke="#2563EB" strokeWidth="2" />
                      <circle cx="210" cy="75" r="48" fill="rgba(239, 68, 68, 0.2)" stroke="#EF4444" strokeWidth="2" />
                      <circle cx="175" cy="120" r="48" fill="rgba(16, 185, 129, 0.2)" stroke="#10B981" strokeWidth="2" />
                      <text x="115" y="65" fill="#1E40AF" fontSize="12" fontWeight="bold">A</text>
                      <text x="230" y="65" fill="#991B1B" fontSize="12" fontWeight="bold">B</text>
                      <text x="175" y="155" fill="#065F46" fontSize="12" fontWeight="bold" textAnchor="middle">C</text>
                      <text x="175" y="88" fill="#0F172A" fontSize="9" fontWeight="bold" textAnchor="middle">A∩B∩C</text>
                    </svg>
                  )}

                  {diag.type === 'flowchart' && (
                    <svg width="100%" height="100%" viewBox="0 0 420 180" className={styles.diagramSvg}>
                      <rect x="20" y="65" width="80" height="40" rx="20" fill="#6366F1" />
                      <text x="60" y="89" fill="white" fontSize="11" fontWeight="bold" textAnchor="middle">START</text>
                      <line x1="100" y1="85" x2="140" y2="85" stroke="#475569" strokeWidth="2" />
                      <rect x="140" y="65" width="90" height="40" rx="6" fill="#0284C7" />
                      <text x="185" y="89" fill="white" fontSize="11" fontWeight="bold" textAnchor="middle">Process Data</text>
                      <line x1="230" y1="85" x2="270" y2="85" stroke="#475569" strokeWidth="2" />
                      <polygon points="310,60 350,85 310,110 270,85" fill="#F59E0B" />
                      <text x="310" y="89" fill="white" fontSize="10" fontWeight="bold" textAnchor="middle">Condition?</text>
                      <line x1="350" y1="85" x2="380" y2="85" stroke="#475569" strokeWidth="2" />
                      <rect x="380" y="65" width="35" height="40" rx="6" fill="#10B981" />
                      <text x="397" y="89" fill="white" fontSize="9" fontWeight="bold" textAnchor="middle">END</text>
                    </svg>
                  )}
                </div>
              </div>
            );
          })}

          {/* 3. Embedded Document Viewer Boxes */}
          {fileEmbeds.map(file => {
            if (file.step > 0 && file.step > revealedStep) return null;
            const height = (file.endLine - file.startLine) * LINE_HEIGHT;

            return (
              <div 
                key={file.id}
                className={styles.fileEmbedContainer}
                style={{ 
                  top: (file.startLine - 1) * LINE_HEIGHT, 
                  height: `${height}px`,
                  pointerEvents: 'auto'
                }}
              >
                <div className={styles.fileEmbedHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    {file.fileType === 'pptx' && <Presentation size={18} color="#EA580C" />}
                    {file.fileType === 'docx' && <FileText size={18} color="#2563EB" />}
                    {file.fileType === 'pdf' && <BookOpen size={18} color="#DC2626" />}
                    {['png', 'jpg', 'jpeg', 'svg', 'webp'].includes(file.fileType) && <ImageIcon size={18} color="#059669" />}
                    <span className={styles.fileName}>{file.name}</span>
                    <span className={styles.fileTypeBadge}>{file.fileType.toUpperCase()}</span>
                    <span className={styles.lineRangeBadge}>Lines {file.startLine}–{file.endLine}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <button className={styles.viewerBtn} onClick={() => updateFileZoom(file.id, -15)} title="Zoom Out">
                      <ZoomOut size={15} />
                    </button>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, minWidth: '42px', textAlign: 'center', color: '#475569' }}>
                      {file.zoom}%
                    </span>
                    <button className={styles.viewerBtn} onClick={() => updateFileZoom(file.id, 15)} title="Zoom In">
                      <ZoomIn size={15} />
                    </button>

                    {file.totalPages > 1 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', marginLeft: '0.5rem', background: '#F1F5F9', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                        <button className={styles.pageBtn} onClick={() => updateFilePage(file.id, -1)} disabled={file.currentPage <= 1}>
                          <ChevronLeft size={14} />
                        </button>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>
                          {file.fileType === 'pptx' ? 'Slide' : 'Page'} {file.currentPage} / {file.totalPages}
                        </span>
                        <button className={styles.pageBtn} onClick={() => updateFilePage(file.id, 1)} disabled={file.currentPage >= file.totalPages}>
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className={styles.fileEmbedBody}>
                  {['png', 'jpg', 'jpeg', 'svg', 'webp'].includes(file.fileType) && (
                    <div className={styles.imageScrollWrapper}>
                      <img 
                        src={file.dataUrl} 
                        alt={file.name} 
                        style={{ 
                          transform: `scale(${file.zoom / 100})`, 
                          transformOrigin: 'top center',
                          maxWidth: '100%',
                          borderRadius: '6px'
                        }} 
                      />
                    </div>
                  )}

                  {file.fileType === 'pptx' && (
                    <div className={styles.slideViewer} style={{ transform: `scale(${file.zoom / 100})`, transformOrigin: 'top center' }}>
                      <div className={styles.slideCanvas}>
                        <div className={styles.slideTopBanner}>
                          <span>Slide {file.currentPage} of {file.totalPages}</span>
                          <span style={{ fontWeight: 700 }}>{boardTitle} Presentation Deck</span>
                        </div>
                        <div className={styles.slideContent}>
                          <h3 className={styles.slideHeading}>
                            {file.slidesOrPages?.[file.currentPage - 1]?.title || `Slide ${file.currentPage}`}
                          </h3>
                          <div className={styles.slideParagraph}>
                            {file.slidesOrPages?.[file.currentPage - 1]?.text?.split('\n').map((line, idx) => (
                              <p key={idx} style={{ margin: '0.4rem 0' }}>{line}</p>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {file.fileType === 'docx' && (
                    <div className={styles.docxViewer} style={{ transform: `scale(${file.zoom / 100})`, transformOrigin: 'top center' }}>
                      <div className={styles.docxPaper}>
                        <div className={styles.docxHeader}>
                          <span>{file.name}</span>
                          <span>Page {file.currentPage} of {file.totalPages}</span>
                        </div>
                        <div className={styles.docxBody}>
                          <h4>{file.slidesOrPages?.[file.currentPage - 1]?.title || 'Document Section'}</h4>
                          <div style={{ whiteSpace: 'pre-line', lineHeight: 1.6, color: '#334155', fontSize: '0.95rem' }}>
                            {file.slidesOrPages?.[file.currentPage - 1]?.text || 'Document content loaded.'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {file.fileType === 'pdf' && (
                    <div className={styles.pdfViewer} style={{ transform: `scale(${file.zoom / 100})`, transformOrigin: 'top center' }}>
                      {file.dataUrl ? (
                        <iframe 
                          src={`${file.dataUrl}#page=${file.currentPage}&toolbar=0&navpanes=0`} 
                          title={file.name}
                          className={styles.pdfIframe}
                        />
                      ) : (
                        <div style={{ padding: '2rem', textAlign: 'center', color: '#64748B' }}>
                          <BookOpen size={48} color="#DC2626" style={{ margin: '0 auto 1rem' }} />
                          <p style={{ fontWeight: 600 }}>PDF Document: {file.name}</p>
                        </div>
                      )}
                    </div>
                  )}
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
        Thrisual Smart Teach · Live Student Stream · Board ID: {id || 'demo'}
      </div>
    </div>
  );
};

export default ViewOnlyBoard;

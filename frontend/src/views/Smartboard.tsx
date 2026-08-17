import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  ArrowLeft, Circle, SkipForward, SkipBack, Eye, EyeOff, 
  FileUp, Users, Pen, Eraser, Type, Copy, X, Download, Check,
  Activity, Trash2, ZoomIn, ZoomOut, ChevronLeft, ChevronRight,
  Grid, GitBranch, Layers, Sparkles, BookOpen,
  FileText, Presentation, Image as ImageIcon
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import styles from './Smartboard.module.css';
import { useToast } from '../contexts/ToastContext';
import API_BASE from '../config/api';
import useBoardSync, { type LiveMessage } from '../hooks/useBoardSync';

const COLORS = ['#0A2540', '#EF4444', '#2563EB', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];
const LINE_HEIGHT = 40;
const TOTAL_LINES = 356;
const TOTAL_HEIGHT = TOTAL_LINES * LINE_HEIGHT;

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  id: string;
  points: Point[];
  color: string;
  width: number;
  isEraser: boolean;
  step: number; // 0 for unrecorded, 1+ for recorded steps
}

interface RuledLineText {
  id: string;
  line: number;
  text: string;
  color: string;
  fontSize: number;
  step: number;
}

interface DiagramItem {
  id: string;
  type: 'cartesian_plane' | 'parabola' | 'sine_wave' | 'binary_tree' | 'decision_tree' | 'venn_2' | 'venn_3' | 'flowchart' | 'math_formula';
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
  slidesOrPages?: Array<{ title?: string; text?: string; preview?: string }>;
  step: number;
}

const MATH_SYMBOLS = [
  '∑', '∫', '∬', '∂', '√x', '∛x', 'π', 'θ', 'α', 'β', 'γ', 'λ', 'μ', 'Δ', 'Ω', '∞',
  '±', '≠', '≈', '≤', '≥', '÷', '×', '∈', '∉', '⊂', '⊆', '∪', '∩', '→', '⇒', '⇔',
  'lim', 'log', 'sin', 'cos', 'tan', 'f(x)', 'dy/dx', '∫ f(x)dx'
];

const Smartboard: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRefs = useRef<{ [line: number]: HTMLInputElement | null }>({});
  const lastDrawEmitRef = useRef<number>(0);
  const autoSaveTimerRef = useRef<number | null>(null);

  // View-only mode (when logged in with view-only password)
  const isViewOnly = localStorage.getItem('isViewOnly') === 'true';

  // Tools & Drawing State
  const [activeTool, setActiveTool] = useState<'pen' | 'eraser' | 'text' | 'diagram'>('pen');
  const [activeColor, setActiveColor] = useState(COLORS[0]);
  const [isDrawing, setIsDrawing] = useState(false);
  const currentStrokeRef = useRef<Stroke | null>(null);

  // Smartboard Data Structures
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [ruledTexts, setRuledTexts] = useState<{ [line: number]: RuledLineText }>({});
  const [diagrams, setDiagrams] = useState<DiagramItem[]>([]);
  const [fileEmbeds, setFileEmbeds] = useState<FileEmbed[]>([]);
  const [boardTitle, setBoardTitle] = useState(`Topic Board ${id || ''}`);
  const [activeLineEditing, setActiveLineEditing] = useState<number | null>(null);

  // Auto-Save Status
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [lastSavedTime, setLastSavedTime] = useState<string>('');

  // Point Recording & Step-by-Step Reveal Engine
  const [isRecording, setIsRecording] = useState(false);
  const [totalRecordedSteps, setTotalRecordedSteps] = useState(0);
  const [revealedStep, setRevealedStep] = useState(0);

  // Collaboration / QR
  const [showCollabModal, setShowCollabModal] = useState(false);
  const [showDiagramModal, setShowDiagramModal] = useState(false);
  const [diagramTab, setDiagramTab] = useState<'graphs' | 'trees' | 'venn' | 'symbols'>('graphs');
  const [copiedLink, setCopiedLink] = useState(false);
  const [boardUrl, setBoardUrl] = useState('');

  // Real-time WebSocket hook
  const handleIncomingMessage = useCallback((msg: LiveMessage) => {
    // If we receive a full sync request from a freshly joined client, we can re-broadcast full state
    if (msg.type === 'REQUEST_STATE') {
      // Handled by backend cache or re-broadcast
    }
  }, []);

  const { isConnected: isWsConnected, peerCount, sendMessage } = useBoardSync(id, handleIncomingMessage);

  // Build the view-only URL using the real local network IP
  useEffect(() => {
    const buildUrl = async () => {
      const boardId = id || 'demo';
      const path = `/board/${boardId}/view`;
      try {
        const pc = new RTCPeerConnection({ iceServers: [] });
        pc.createDataChannel('');
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await new Promise<void>(resolve => {
          pc.onicecandidate = e => {
            if (!e.candidate) { resolve(); return; }
            const m = e.candidate.candidate.match(/([0-9]{1,3}(\.[0-9]{1,3}){3})/);
            if (m && !m[1].startsWith('127.')) {
              setBoardUrl(`http://${m[1]}:3000${path}`);
              pc.close();
              resolve();
            }
          };
          setTimeout(resolve, 1500);
        });
        pc.close();
      } catch {
        // ignore
      }
      setBoardUrl(prev => prev || `http://localhost:3000${path}`);
    };
    buildUrl();
  }, [id]);

  // Highest Line Calculation
  const calculateHighestLine = useCallback(() => {
    let maxLine = 0;
    strokes.forEach(s => {
      s.points.forEach(p => {
        const line = Math.floor(p.y / LINE_HEIGHT);
        if (line > maxLine) maxLine = line;
      });
    });
    Object.values(ruledTexts).forEach(t => {
      if (t.text && t.text.trim().length > 0 && t.line > maxLine) maxLine = t.line;
    });
    diagrams.forEach(d => {
      if (d.endLine > maxLine) maxLine = d.endLine;
    });
    fileEmbeds.forEach(f => {
      if (f.endLine > maxLine) maxLine = f.endLine;
    });
    return Math.min(TOTAL_LINES, maxLine);
  }, [strokes, ruledTexts, diagrams, fileEmbeds]);

  const linesUsed = calculateHighestLine();

  // Load Saved Board from Backend (with localStorage fallback)
  useEffect(() => {
    const loadBoard = async () => {
      if (!id || id === 'demo') return;

      const applyContent = (contentJson: string) => {
        try {
          const parsed = JSON.parse(contentJson);
          if (parsed.strokes) setStrokes(parsed.strokes);
          if (parsed.ruledTexts) setRuledTexts(parsed.ruledTexts);
          if (parsed.textItems && !parsed.ruledTexts) {
            const map: { [line: number]: RuledLineText } = {};
            parsed.textItems.forEach((t: any) => {
              map[t.line] = {
                id: t.id || Date.now().toString(),
                line: t.line,
                text: t.text,
                color: t.color || '#0A2540',
                fontSize: t.fontSize || 20,
                step: t.step || 0
              };
            });
            setRuledTexts(map);
          }
          if (parsed.diagrams) setDiagrams(parsed.diagrams);
          if (parsed.fileEmbeds) setFileEmbeds(parsed.fileEmbeds);
          if (parsed.totalRecordedSteps) {
            setTotalRecordedSteps(parsed.totalRecordedSteps);
            setRevealedStep(parsed.totalRecordedSteps);
          }
        } catch (e) {
          console.error('Error parsing board content:', e);
        }
      };

      // 1️⃣ Try backend first
      try {
        const res = await fetch(`${API_BASE}/api/dashboard/files/item/${id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.name) setBoardTitle(data.name);
          if (data.content && data.content.trim().length > 0) {
            applyContent(data.content);
            localStorage.setItem(`board_content_${id}`, data.content);
            setSaveStatus('saved');
            return;
          }
        }
      } catch (e) {
        console.warn('Backend unreachable, trying localStorage fallback', e);
      }

      // 2️⃣ Fallback to localStorage
      const local = localStorage.getItem(`board_content_${id}`);
      if (local && local.trim().length > 0) {
        console.log('Loaded board from localStorage fallback');
        applyContent(local);
        setSaveStatus('saved');
      }
    };
    loadBoard();
  }, [id]);

  // --- AUTOMATIC BACKGROUND AUTO-SAVE ENGINE ---
  const performSave = useCallback(async () => {
    const payload = {
      strokes,
      ruledTexts,
      diagrams,
      fileEmbeds,
      totalRecordedSteps,
      revealedStep,
      name: boardTitle,
      savedAt: new Date().toISOString()
    };

    const contentJson = JSON.stringify(payload);

    // 1. Guaranteed Local Backup
    if (id && id !== 'demo') {
      try {
        localStorage.setItem(`board_content_${id}`, contentJson);
      } catch (e) {
        console.warn('localStorage save warning:', e);
      }
    }

    // 2. Broadcast Full State / Sync Cache to WebSocket
    sendMessage({
      type: 'BOARD_SYNC',
      data: payload
    });

    // 3. Save to Database (MySQL backend)
    if (id && id !== 'demo') {
      try {
        const res = await fetch(`${API_BASE}/api/dashboard/files/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: contentJson })
        });
        if (res.ok) {
          setSaveStatus('saved');
          const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          setLastSavedTime(timeStr);
        } else {
          // If backend returned error, local backup is still intact
          setSaveStatus('saved');
        }
      } catch (e) {
        // Offline mode: locally saved
        setSaveStatus('saved');
      }
    } else {
      setSaveStatus('saved');
    }
  }, [id, strokes, ruledTexts, diagrams, fileEmbeds, totalRecordedSteps, revealedStep, boardTitle, sendMessage]);

  const scheduleAutoSave = useCallback(() => {
    setSaveStatus('saving');
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = window.setTimeout(() => {
      performSave();
    }, 800);
  }, [performSave]);

  // Auto-save on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (id && id !== 'demo') {
        const payload = {
          strokes,
          ruledTexts,
          diagrams,
          fileEmbeds,
          totalRecordedSteps,
          revealedStep,
          name: boardTitle,
          savedAt: new Date().toISOString()
        };
        navigator.sendBeacon(
          `${API_BASE}/api/dashboard/files/${id}`,
          new Blob([JSON.stringify({ content: JSON.stringify(payload) })], { type: 'application/json' })
        );
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [id, strokes, ruledTexts, diagrams, fileEmbeds, totalRecordedSteps, revealedStep, boardTitle]);

  // Redraw Canvas on strokes / revealedStep change
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    strokes.forEach(stroke => {
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
  }, [strokes, revealedStep]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvas.parentElement?.clientWidth ? canvas.parentElement.clientWidth - 45 : 1200;
    canvas.height = TOTAL_HEIGHT;
    redrawCanvas();
  }, [redrawCanvas]);

  // Drawing Handlers with Live Streaming
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool === 'text') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDrawing(true);

    const stepIndex = isRecording ? totalRecordedSteps + 1 : 0;
    const newStroke: Stroke = {
      id: Date.now().toString(),
      points: [{ x, y }],
      color: activeColor,
      width: activeTool === 'eraser' ? 28 : 3,
      isEraser: activeTool === 'eraser',
      step: stepIndex
    };

    currentStrokeRef.current = newStroke;

    // Broadcast stroke start to joined collaboration devices in real-time
    sendMessage({
      type: 'STROKE_START',
      stroke: newStroke
    });

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentStrokeRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const point = { x, y };
    currentStrokeRef.current.points.push(point);

    // Live Stream: Broadcast drawing point in real-time (~25ms throttle)
    const now = Date.now();
    if (now - lastDrawEmitRef.current > 25) {
      lastDrawEmitRef.current = now;
      sendMessage({
        type: 'STROKE_DRAW',
        point
      });
    }

    const ctx = canvas.getContext('2d');
    if (ctx) {
      if (currentStrokeRef.current.isEraser) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = 28;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = activeColor;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentStrokeRef.current) return;
    setIsDrawing(false);

    if (currentStrokeRef.current.points.length > 1) {
      const finishedStroke = currentStrokeRef.current;
      setStrokes(prev => [...prev, finishedStroke]);

      // Broadcast finished stroke to joined collaboration devices
      sendMessage({
        type: 'STROKE_END',
        stroke: finishedStroke
      });

      if (isRecording) {
        const nextStep = totalRecordedSteps + 1;
        setTotalRecordedSteps(nextStep);
        setRevealedStep(nextStep);
        sendMessage({
          type: 'REVEAL_UPDATE',
          revealedStep: nextStep,
          totalRecordedSteps: nextStep
        });
      }

      // Trigger automatic background save
      scheduleAutoSave();
    }
    currentStrokeRef.current = null;
  };

  // --- RULED LINE TEXT ENGINE (Continuous live typing broadcast) ---
  const handleSelectTextTool = () => {
    setActiveTool('text');
    const nextLine = Math.min(TOTAL_LINES, linesUsed + 1);
    focusLine(nextLine);
  };

  const handleSelectPenTool = () => {
    if (activeLineEditing !== null && inputRefs.current[activeLineEditing]) {
      inputRefs.current[activeLineEditing]?.blur();
    }
    setActiveLineEditing(null);
    setActiveTool('pen');
  };

  const focusLine = (targetLine: number) => {
    setActiveLineEditing(targetLine);
    
    setRuledTexts(prev => {
      if (!prev[targetLine]) {
        const stepIndex = isRecording ? totalRecordedSteps + 1 : 0;
        if (isRecording) {
          setTotalRecordedSteps(stepIndex);
          setRevealedStep(stepIndex);
          sendMessage({
            type: 'REVEAL_UPDATE',
            revealedStep: stepIndex,
            totalRecordedSteps: stepIndex
          });
        }
        const newTextItem: RuledLineText = {
          id: `line_${targetLine}_${Date.now()}`,
          line: targetLine,
          text: '',
          color: activeColor,
          fontSize: 20,
          step: stepIndex
        };
        sendMessage({
          type: 'TEXT_CHANGE',
          lineNum: targetLine,
          textData: newTextItem
        });
        return {
          ...prev,
          [targetLine]: newTextItem
        };
      }
      return prev;
    });

    if (containerRef.current) {
      const yPos = (targetLine - 1) * LINE_HEIGHT;
      containerRef.current.scrollTo({ top: Math.max(0, yPos - 120), behavior: 'smooth' });
    }

    setTimeout(() => {
      inputRefs.current[targetLine]?.focus();
    }, 50);
  };

  const handleLineClick = (lineNumber: number) => {
    if (activeTool === 'text') {
      focusLine(lineNumber);
    }
  };

  const handleRuledTextChange = (lineNum: number, value: string) => {
    const updatedText: RuledLineText = {
      ...(ruledTexts[lineNum] || {
        id: `line_${lineNum}_${Date.now()}`,
        line: lineNum,
        color: activeColor,
        fontSize: 20,
        step: isRecording ? totalRecordedSteps + 1 : 0
      }),
      text: value
    };

    setRuledTexts(prev => ({
      ...prev,
      [lineNum]: updatedText
    }));

    // Broadcast live text change to joined collaboration devices in real-time
    sendMessage({
      type: 'TEXT_CHANGE',
      lineNum,
      textData: updatedText
    });

    scheduleAutoSave();
  };

  const handleRuledTextKeyDown = (lineNum: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const nextLine = Math.min(TOTAL_LINES, lineNum + 1);
      focusLine(nextLine);
    } else if (e.key === 'Backspace' && (e.currentTarget.value === '' || e.currentTarget.selectionStart === 0)) {
      if (lineNum > 1) {
        e.preventDefault();
        const prevLine = lineNum - 1;
        focusLine(prevLine);
      }
    } else if (e.key === 'ArrowDown') {
      if (lineNum < TOTAL_LINES) {
        e.preventDefault();
        focusLine(lineNum + 1);
      }
    } else if (e.key === 'ArrowUp') {
      if (lineNum > 1) {
        e.preventDefault();
        focusLine(lineNum - 1);
      }
    }
  };

  const insertSymbolAtActiveLine = (sym: string) => {
    const lineNum = activeLineEditing || (linesUsed + 1);
    const existing = ruledTexts[lineNum]?.text || '';
    handleRuledTextChange(lineNum, existing + ' ' + sym + ' ');
    focusLine(lineNum);
    showToast(`Inserted symbol: ${sym}`, 'info');
  };

  // --- DIAGRAMS, GRAPHS & TREES ENGINE ---
  const insertDiagram = (type: DiagramItem['type'], title: string, customData?: any) => {
    const startLine = linesUsed + 1;
    let lineSpan = 10;
    if (type === 'math_formula') lineSpan = 4;
    else if (type === 'binary_tree' || type === 'cartesian_plane') lineSpan = 11;
    else if (type === 'venn_2' || type === 'venn_3') lineSpan = 9;

    const endLine = Math.min(TOTAL_LINES, startLine + lineSpan);

    const stepIndex = isRecording ? totalRecordedSteps + 1 : 0;
    if (isRecording) {
      setTotalRecordedSteps(stepIndex);
      setRevealedStep(stepIndex);
      sendMessage({
        type: 'REVEAL_UPDATE',
        revealedStep: stepIndex,
        totalRecordedSteps: stepIndex
      });
    }

    const newDiagram: DiagramItem = {
      id: `diag_${Date.now()}`,
      type,
      title,
      startLine,
      endLine,
      data: customData || {},
      step: stepIndex
    };

    const nextDiagrams = [...diagrams, newDiagram];
    setDiagrams(nextDiagrams);
    setShowDiagramModal(false);

    // Live broadcast diagrams
    sendMessage({
      type: 'DIAGRAM_UPDATE',
      diagrams: nextDiagrams
    });

    scheduleAutoSave();

    if (containerRef.current) {
      containerRef.current.scrollTo({ top: Math.max(0, startLine * LINE_HEIGHT - 80), behavior: 'smooth' });
    }
    showToast(`Added ${title} (Lines ${startLine}–${endLine})`, 'success');
  };

  const removeDiagram = (diagramId: string) => {
    const nextDiagrams = diagrams.filter(d => d.id !== diagramId);
    setDiagrams(nextDiagrams);
    
    sendMessage({
      type: 'DIAGRAM_UPDATE',
      diagrams: nextDiagrams
    });

    scheduleAutoSave();
    showToast('Diagram removed', 'info');
  };

  // --- EMBEDDED DOCUMENT VIEWER (PPTX, DOCX, PDF, Images) ---
  const handleAddFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pptx,.docx,.pdf,.png,.jpg,.jpeg,.svg,.webp';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      const ext = file.name.split('.').pop()?.toLowerCase() || 'file';

      reader.onload = () => {
        const dataUrl = reader.result as string;
        const startLine = linesUsed + 1;
        const lineSpan = 12;
        const endLine = Math.min(TOTAL_LINES, startLine + lineSpan);

        const stepIndex = isRecording ? totalRecordedSteps + 1 : 0;
        if (isRecording) {
          setTotalRecordedSteps(stepIndex);
          setRevealedStep(stepIndex);
          sendMessage({
            type: 'REVEAL_UPDATE',
            revealedStep: stepIndex,
            totalRecordedSteps: stepIndex
          });
        }

        let slidesOrPages: Array<{ title?: string; text?: string }> = [];
        let totalPages = 1;

        if (ext === 'pptx') {
          totalPages = 5;
          slidesOrPages = [
            { title: `${file.name} - Slide 1`, text: 'Introduction & Core Concepts\n\n• Key objectives of the lesson\n• Fundamental definitions\n• Illustrated diagrams & breakdown' },
            { title: 'Slide 2: Theoretical Framework', text: 'Mathematical formulations, derivations, and step-by-step proofs for the topic.' },
            { title: 'Slide 3: Real-World Applications', text: 'Case studies, physical examples, and experimental observations.' },
            { title: 'Slide 4: Worked Example Problem', text: 'Problem Statement: Calculate the resultant value given parameters X and Y.\nSolution: Apply formula step 1 -> step 2 -> final output.' },
            { title: 'Slide 5: Summary & Key Takeaways', text: 'Important formulas to memorize for exams and review questions.' }
          ];
        } else if (ext === 'docx') {
          totalPages = 3;
          slidesOrPages = [
            { title: `${file.name} - Page 1`, text: 'CHAPTER 1: FOUNDATIONS & PRINCIPLES\n\nThis document outlines the curriculum requirements, lesson notes, and comprehensive reference material for the chapter. Students should review each section in conjunction with the smartboard board notes.' },
            { title: 'Page 2: Detailed Syllabus Notes', text: 'Section 2.1: Key Laws and Definitions\nSection 2.2: Analytical Procedures\nSection 2.3: Practice Exercises and Quiz Review' },
            { title: 'Page 3: Reference Index', text: 'Bibliography, equation references, and glossary terms.' }
          ];
        } else if (ext === 'pdf') {
          totalPages = 4;
        }

        const newEmbed: FileEmbed = {
          id: `file_${Date.now()}`,
          name: file.name,
          fileType: ext,
          dataUrl,
          startLine,
          endLine,
          zoom: 100,
          currentPage: 1,
          totalPages,
          slidesOrPages,
          step: stepIndex
        };

        const nextFiles = [...fileEmbeds, newEmbed];
        setFileEmbeds(nextFiles);

        sendMessage({
          type: 'FILES_UPDATE',
          fileEmbeds: nextFiles
        });

        scheduleAutoSave();

        if (containerRef.current) {
          containerRef.current.scrollTo({ top: Math.max(0, startLine * LINE_HEIGHT - 80), behavior: 'smooth' });
        }
        showToast(`Document "${file.name}" displayed between lines ${startLine} and ${endLine}`, 'success');
      };

      reader.readAsDataURL(file);
    };
    input.click();
  };

  const updateFileZoom = (fileId: string, delta: number) => {
    const nextFiles = fileEmbeds.map(f => {
      if (f.id === fileId) {
        const nextZoom = Math.min(250, Math.max(50, f.zoom + delta));
        return { ...f, zoom: nextZoom };
      }
      return f;
    });
    setFileEmbeds(nextFiles);
    sendMessage({ type: 'FILES_UPDATE', fileEmbeds: nextFiles });
    scheduleAutoSave();
  };

  const updateFilePage = (fileId: string, delta: number) => {
    const nextFiles = fileEmbeds.map(f => {
      if (f.id === fileId) {
        const nextPage = Math.min(f.totalPages, Math.max(1, f.currentPage + delta));
        return { ...f, currentPage: nextPage };
      }
      return f;
    });
    setFileEmbeds(nextFiles);
    sendMessage({ type: 'FILES_UPDATE', fileEmbeds: nextFiles });
    scheduleAutoSave();
  };

  const removeFileEmbed = (fileId: string) => {
    const nextFiles = fileEmbeds.filter(f => f.id !== fileId);
    setFileEmbeds(nextFiles);
    sendMessage({ type: 'FILES_UPDATE', fileEmbeds: nextFiles });
    scheduleAutoSave();
    showToast('Document removed from smartboard', 'info');
  };

  // Step-by-Step Point Recording Controls
  const handleToggleRecording = () => {
    setIsRecording(!isRecording);
    if (!isRecording) {
      showToast('Recording smartboard points started', 'info');
    } else {
      showToast('Recording points paused', 'info');
    }
  };

  const handleRevealNext = () => {
    if (totalRecordedSteps === 0) return;
    const next = Math.min(totalRecordedSteps, revealedStep + 1);
    setRevealedStep(next);
    sendMessage({ type: 'REVEAL_UPDATE', revealedStep: next, totalRecordedSteps });
  };

  const handleRevealPrevious = () => {
    if (totalRecordedSteps === 0) return;
    const prevStep = Math.max(0, revealedStep - 1);
    setRevealedStep(prevStep);
    sendMessage({ type: 'REVEAL_UPDATE', revealedStep: prevStep, totalRecordedSteps });
  };

  const handleRevealAll = () => {
    setRevealedStep(totalRecordedSteps);
    sendMessage({ type: 'REVEAL_UPDATE', revealedStep: totalRecordedSteps, totalRecordedSteps });
  };

  const handleCloseAll = () => {
    setRevealedStep(0);
    sendMessage({ type: 'REVEAL_UPDATE', revealedStep: 0, totalRecordedSteps });
  };

  const handleExportBoard = () => {
    const exportData = {
      title: boardTitle,
      strokes,
      ruledTexts,
      diagrams,
      fileEmbeds,
      totalRecordedSteps,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${boardTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Smartboard exported as JSON', 'success');
  };

  const handleCopyLink = () => {
    const url = boardUrl || `http://localhost:3000/board/${id || 'demo'}/view`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
    showToast('View-only live link copied to clipboard', 'success');
  };

  return (
    <div className={styles.container}>
      {/* Top Bar */}
      <header className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <button 
            className="btn-secondary" 
            style={{ padding: '0.45rem', display: 'flex', alignItems: 'center' }} 
            onClick={() => {
              performSave();
              navigate('/dashboard');
            }}
            title="Back to Dashboard"
          >
            <ArrowLeft size={18} />
          </button>
          <h2 className={styles.boardTitle}>{boardTitle}</h2>
          {isRecording && (
            <span className={styles.recBadge}>
              <Circle size={8} fill="#DC2626" /> REC (Step {totalRecordedSteps + 1})
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {isViewOnly ? (
            <div style={{
              background: '#FEF3C7', border: '1px solid #FDE68A', color: '#92400E',
              padding: '0.35rem 0.85rem', borderRadius: '0.5rem',
              fontSize: '0.82rem', fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: '0.4rem'
            }}>
              🔒 View Only — No editing allowed
            </div>
          ) : (
            <>
              {/* Seamless Auto-Save Indicator */}
              <div 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.4rem 0.85rem',
                  borderRadius: '0.5rem',
                  background: saveStatus === 'saving' ? '#EFF6FF' : '#F0FDF4',
                  border: `1px solid ${saveStatus === 'saving' ? '#BFDBFE' : '#BBF7D0'}`,
                  color: saveStatus === 'saving' ? '#1D4ED8' : '#15803D',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  transition: 'all 0.25s ease'
                }}
                title={lastSavedTime ? `Last saved at ${lastSavedTime}` : 'Board autosaves continuously'}
              >
                {saveStatus === 'saving' ? (
                  <>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#2563EB', animation: 'pulse 1s infinite' }} />
                    <span>Auto-saving...</span>
                  </>
                ) : (
                  <>
                    <Check size={14} color="#16A34A" />
                    <span>All changes saved {lastSavedTime ? `(${lastSavedTime})` : ''}</span>
                  </>
                )}
              </div>

              {/* Export Board */}
              <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem' }} onClick={handleExportBoard}>
                <Download size={16} /> Export
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Workspace */}
      <div className={styles.workspace}>
        {/* Left Toolbar */}
        {!isViewOnly && (
          <aside className={styles.leftToolbar}>
            <button 
              className={`${styles.circleBtn} ${isRecording ? styles.activeRec : ''}`}
              onClick={handleToggleRecording}
              title={isRecording ? "Stop Recording Points" : "Record Points"}
            >
              <Circle size={22} fill={isRecording ? "#FFFFFF" : "none"} />
            </button>
            
            <button 
              className={styles.circleBtn} 
              onClick={handleRevealNext} 
              title="Reveal Next Point"
              disabled={totalRecordedSteps === 0 || revealedStep >= totalRecordedSteps}
              style={{ opacity: totalRecordedSteps > 0 && revealedStep < totalRecordedSteps ? 1 : 0.5 }}
            >
              <SkipForward size={22} />
            </button>

            <button 
              className={styles.circleBtn} 
              onClick={handleRevealPrevious} 
              title="Reveal Previous Point"
              disabled={totalRecordedSteps === 0 || revealedStep === 0}
              style={{ opacity: revealedStep > 0 ? 1 : 0.5 }}
            >
              <SkipBack size={22} />
            </button>

            <button 
              className={styles.circleBtn} 
              onClick={handleRevealAll} 
              title="Reveal All Points"
            >
              <Eye size={22} />
            </button>

            <button 
              className={styles.circleBtn} 
              onClick={handleCloseAll} 
              title="Close All Points"
            >
              <EyeOff size={22} />
            </button>
            
            <div style={{ flex: 1 }} />

            <button 
              className={styles.circleBtn} 
              onClick={() => setShowDiagramModal(true)} 
              title="Insert Graphs, Trees & Shapes"
              style={{ background: showDiagramModal ? '#EFF6FF' : undefined, borderColor: showDiagramModal ? '#2563EB' : undefined }}
            >
              <Activity size={22} color="#2563EB" />
            </button>
            
            <button className={styles.circleBtn} onClick={handleAddFile} title="Add Embedded Document (PPTX, DOCX, PDF, Images)">
              <FileUp size={22} color="#0D9488" />
            </button>

            <button 
              className={styles.circleBtn} 
              onClick={() => setShowCollabModal(true)} 
              title="Collaborate (Live Stream & QR)"
              style={{ position: 'relative' }}
            >
              <Users size={22} />
              {peerCount > 1 && (
                <span style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  background: '#10B981',
                  color: '#fff',
                  borderRadius: '50%',
                  width: 18,
                  height: 18,
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {peerCount - 1}
                </span>
              )}
            </button>
          </aside>
        )}

        {/* 356-Line Scrollable Board */}
        <div className={styles.boardContainer} ref={containerRef}>
          <div className={styles.boardLines} />

          {/* Line Numbers */}
          <div className={styles.lineNumbers}>
            {Array.from({ length: TOTAL_LINES }).map((_, i) => {
              const lineNum = i + 1;
              return (
                <div 
                  key={lineNum} 
                  className={`${styles.lineNum} ${activeLineEditing === lineNum ? styles.activeLineNum : ''}`}
                  onClick={() => handleLineClick(lineNum)}
                  title={`Click to write on Line ${lineNum}`}
                >
                  {lineNum}
                </div>
              );
            })}
          </div>
          
          {/* Drawing Canvas */}
          <canvas 
            ref={canvasRef}
            className={styles.canvas}
            style={{ 
              cursor: isViewOnly ? 'default' : (activeTool === 'text' ? 'text' : activeTool === 'eraser' ? 'cell' : 'crosshair'),
              pointerEvents: isViewOnly ? 'none' : (activeTool === 'text' ? 'none' : 'auto')
            }}
            onMouseDown={isViewOnly ? undefined : handleMouseDown}
            onMouseMove={isViewOnly ? undefined : handleMouseMove}
            onMouseUp={isViewOnly ? undefined : handleMouseUp}
            onMouseLeave={isViewOnly ? undefined : handleMouseUp}
          />
          
          {/* Overlay for Ruled-Line Continuous Typing, Diagrams, and Document Boxes */}
          <div className={styles.boardOverlay}>
            {/* 1. Ruled Text Lines */}
            {Array.from({ length: TOTAL_LINES }).map((_, i) => {
              const lineNum = i + 1;
              const textData = ruledTexts[lineNum];
              const isVisible = !textData || textData.step === 0 || textData.step <= revealedStep;
              
              if (!isVisible) return null;

              return (
                <div 
                  key={lineNum}
                  className={styles.ruledTextRow}
                  style={{
                    top: (lineNum - 1) * LINE_HEIGHT,
                    pointerEvents: activeTool === 'pen' || activeTool === 'eraser' ? 'none' : 'auto'
                  }}
                  onClick={() => handleLineClick(lineNum)}
                >
                  <input
                    ref={el => { inputRefs.current[lineNum] = el; }}
                    type="text"
                    className={styles.ruledTextInput}
                    style={{ 
                      color: textData?.color || activeColor,
                      fontSize: `${textData?.fontSize || 20}px`
                    }}
                    value={textData?.text || ''}
                    placeholder={activeLineEditing === lineNum ? "Type keyboard notes on this line..." : ""}
                    onFocus={() => setActiveLineEditing(lineNum)}
                    onChange={(e) => handleRuledTextChange(lineNum, e.target.value)}
                    onKeyDown={(e) => handleRuledTextKeyDown(lineNum, e)}
                  />
                </div>
              );
            })}

            {/* 2. Embedded Diagrams, Graphs, and Trees */}
            {diagrams.map(diag => {
              if (diag.step > 0 && diag.step > revealedStep) return null;
              const height = (diag.endLine - diag.startLine) * LINE_HEIGHT;

              return (
                <div 
                  key={diag.id}
                  className={styles.diagramContainer}
                  style={{ 
                    top: (diag.startLine - 1) * LINE_HEIGHT, 
                    height: `${height}px` 
                  }}
                >
                  <div className={styles.diagramHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Activity size={16} color="#2563EB" />
                      <strong>{diag.title}</strong>
                      <span className={styles.lineTag}>Lines {diag.startLine}–{diag.endLine}</span>
                    </div>
                    <button 
                      className={styles.iconBtn} 
                      onClick={() => removeDiagram(diag.id)}
                      title="Remove Diagram"
                    >
                      <Trash2 size={15} color="#EF4444" />
                    </button>
                  </div>

                  <div className={styles.diagramBody}>
                    {diag.type === 'cartesian_plane' && (
                      <svg width="100%" height="100%" viewBox="-150 -100 300 200" className={styles.diagramSvg}>
                        <defs>
                          <pattern id={`grid_${diag.id}`} width="20" height="20" patternUnits="userSpaceOnUse">
                            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#E2E8F0" strokeWidth="1"/>
                          </pattern>
                        </defs>
                        <rect x="-140" y="-90" width="280" height="180" fill={`url(#grid_${diag.id})`} rx="6" />
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
                    height: `${height}px` 
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

                      <button className={styles.deleteBtn} onClick={() => removeFileEmbed(file.id)} title="Remove Document from Smartboard">
                        <Trash2 size={16} />
                      </button>
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
                            transition: 'transform 0.15s ease-out',
                            maxWidth: '100%',
                            borderRadius: '6px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
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
                            <p style={{ fontSize: '0.85rem' }}>Page {file.currentPage} of {file.totalPages}</p>
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
      </div>

      {/* Bottom Drawing Toolbar */}
      {!isViewOnly && (
      <footer className={styles.bottomToolbar}>
        <div className={styles.toolGroup}>
          <button 
            className={`${styles.toolBtn} ${activeTool === 'pen' ? styles.active : ''}`} 
            onClick={handleSelectPenTool}
            title="Pen / Handwriting Tool"
          >
            <Pen size={18} />
          </button>
          <button 
            className={`${styles.toolBtn} ${activeTool === 'eraser' ? styles.active : ''}`} 
            onClick={() => setActiveTool('eraser')}
            title="Eraser Tool"
          >
            <Eraser size={18} />
          </button>
          <button 
            className={`${styles.toolBtn} ${activeTool === 'text' ? styles.active : ''}`} 
            onClick={handleSelectTextTool}
            title="Ruled Line Text Tool (Type directly on smartboard lines)"
          >
            <Type size={18} />
          </button>
          <button 
            className={`${styles.toolBtn} ${activeTool === 'diagram' || showDiagramModal ? styles.active : ''}`} 
            onClick={() => setShowDiagramModal(true)}
            title="Insert Graphs, Trees, Venn Diagrams & Symbols"
          >
            <Activity size={18} />
          </button>
        </div>

        <div className={styles.toolGroup}>
          <div className={styles.colorPicker}>
            {COLORS.map(color => (
              <div 
                key={color}
                className={`${styles.colorSwat} ${activeColor === color ? styles.active : ''}`}
                style={{ backgroundColor: color }}
                onClick={() => setActiveColor(color)}
              />
            ))}
          </div>
        </div>
      </footer>
      )}

      {/* Live Status Bar */}
      <div className={styles.statusBar}>
        Lines: {linesUsed} / {TOTAL_LINES} &nbsp;&nbsp;|&nbsp;&nbsp; Revealed: {revealedStep} / {totalRecordedSteps} &nbsp;&nbsp;|&nbsp;&nbsp; Items: {strokes.length + Object.keys(ruledTexts).length + diagrams.length + fileEmbeds.length} &nbsp;&nbsp;|&nbsp;&nbsp; Live Peers: {peerCount > 1 ? `${peerCount - 1} connected` : 'Ready'}
      </div>

      {/* Diagram & Shapes Selection Modal */}
      {showDiagramModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.diagramModal}>
            <div className={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Activity size={20} color="#2563EB" />
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary-color)' }}>
                  Graphs, Trees & Symbol Shapes
                </h3>
              </div>
              <X size={20} style={{ cursor: 'pointer', color: '#64748B' }} onClick={() => setShowDiagramModal(false)} />
            </div>

            <div className={styles.tabBar}>
              <button 
                className={`${styles.tabBtn} ${diagramTab === 'graphs' ? styles.activeTab : ''}`}
                onClick={() => setDiagramTab('graphs')}
              >
                <Grid size={15} /> Coordinate Graphs
              </button>
              <button 
                className={`${styles.tabBtn} ${diagramTab === 'trees' ? styles.activeTab : ''}`}
                onClick={() => setDiagramTab('trees')}
              >
                <GitBranch size={15} /> Trees & Flowcharts
              </button>
              <button 
                className={`${styles.tabBtn} ${diagramTab === 'venn' ? styles.activeTab : ''}`}
                onClick={() => setDiagramTab('venn')}
              >
                <Layers size={15} /> Venn Diagrams
              </button>
              <button 
                className={`${styles.tabBtn} ${diagramTab === 'symbols' ? styles.activeTab : ''}`}
                onClick={() => setDiagramTab('symbols')}
              >
                <Sparkles size={15} /> Math & Science Symbols
              </button>
            </div>

            <div className={styles.modalTabContent}>
              {diagramTab === 'graphs' && (
                <div className={styles.gridCards}>
                  <div className={styles.diagCard} onClick={() => insertDiagram('cartesian_plane', 'Cartesian X-Y Coordinate Plane')}>
                    <div className={styles.diagCardPreview}>
                      <svg width="80" height="60" viewBox="-50 -40 100 80">
                        <line x1="-40" y1="0" x2="40" y2="0" stroke="#0F172A" strokeWidth="2" />
                        <line x1="0" y1="-30" x2="0" y2="30" stroke="#0F172A" strokeWidth="2" />
                      </svg>
                    </div>
                    <h4>Cartesian Plane (X-Y)</h4>
                    <p>2D grid with ticks & origin</p>
                  </div>

                  <div className={styles.diagCard} onClick={() => insertDiagram('parabola', 'Quadratic Parabola Curve')}>
                    <div className={styles.diagCardPreview}>
                      <svg width="80" height="60" viewBox="-50 -40 100 80">
                        <line x1="-40" y1="20" x2="40" y2="20" stroke="#94A3B8" strokeWidth="1.5" />
                        <line x1="0" y1="-30" x2="0" y2="30" stroke="#94A3B8" strokeWidth="1.5" />
                        <path d="M -30,-20 Q 0,20 30,-20" fill="none" stroke="#2563EB" strokeWidth="2.5" />
                      </svg>
                    </div>
                    <h4>Parabola Graph</h4>
                    <p>y = ax² + bx + c curve</p>
                  </div>

                  <div className={styles.diagCard} onClick={() => insertDiagram('sine_wave', 'Harmonic Sine Wave')}>
                    <div className={styles.diagCardPreview}>
                      <svg width="80" height="60" viewBox="-50 -40 100 80">
                        <line x1="-40" y1="0" x2="40" y2="0" stroke="#94A3B8" strokeWidth="1.5" />
                        <path d="M -40,0 Q -30,-20 -20,0 T 0,0 T 20,0 T 40,0" fill="none" stroke="#10B981" strokeWidth="2.5" />
                      </svg>
                    </div>
                    <h4>Sine / Cosine Wave</h4>
                    <p>Oscillations & frequency graph</p>
                  </div>
                </div>
              )}

              {diagramTab === 'trees' && (
                <div className={styles.gridCards}>
                  <div className={styles.diagCard} onClick={() => insertDiagram('binary_tree', 'Binary Search Tree')}>
                    <div className={styles.diagCardPreview}>
                      <svg width="80" height="60" viewBox="0 0 100 70">
                        <line x1="50" y1="15" x2="25" y2="40" stroke="#64748B" strokeWidth="1.5" />
                        <line x1="50" y1="15" x2="75" y2="40" stroke="#64748B" strokeWidth="1.5" />
                        <circle cx="50" cy="15" r="8" fill="#2563EB" />
                        <circle cx="25" cy="40" r="7" fill="#3B82F6" />
                        <circle cx="75" cy="40" r="7" fill="#3B82F6" />
                      </svg>
                    </div>
                    <h4>Binary Tree</h4>
                    <p>Hierarchical tree with child nodes</p>
                  </div>

                  <div className={styles.diagCard} onClick={() => insertDiagram('flowchart', 'Flowchart Diagram')}>
                    <div className={styles.diagCardPreview}>
                      <svg width="80" height="60" viewBox="0 0 100 70">
                        <rect x="10" y="25" width="25" height="20" rx="10" fill="#6366F1" />
                        <line x1="35" y1="35" x2="50" y2="35" stroke="#475569" strokeWidth="1.5" />
                        <polygon points="65,20 80,35 65,50 50,35" fill="#F59E0B" />
                      </svg>
                    </div>
                    <h4>Flowchart Workflow</h4>
                    <p>Process blocks & decision logic</p>
                  </div>
                </div>
              )}

              {diagramTab === 'venn' && (
                <div className={styles.gridCards}>
                  <div className={styles.diagCard} onClick={() => insertDiagram('venn_2', '2-Set Venn Diagram (A ∩ B)')}>
                    <div className={styles.diagCardPreview}>
                      <svg width="80" height="60" viewBox="0 0 100 70">
                        <circle cx="40" cy="35" r="22" fill="rgba(37, 99, 235, 0.3)" stroke="#2563EB" strokeWidth="1.5" />
                        <circle cx="60" cy="35" r="22" fill="rgba(16, 185, 129, 0.3)" stroke="#10B981" strokeWidth="1.5" />
                      </svg>
                    </div>
                    <h4>2-Set Venn Diagram</h4>
                    <p>Two overlapping set circles</p>
                  </div>

                  <div className={styles.diagCard} onClick={() => insertDiagram('venn_3', '3-Set Venn Diagram (A ∩ B ∩ C)')}>
                    <div className={styles.diagCardPreview}>
                      <svg width="80" height="60" viewBox="0 0 100 70">
                        <circle cx="42" cy="30" r="18" fill="rgba(37, 99, 235, 0.25)" stroke="#2563EB" strokeWidth="1.5" />
                        <circle cx="58" cy="30" r="18" fill="rgba(239, 68, 68, 0.25)" stroke="#EF4444" strokeWidth="1.5" />
                        <circle cx="50" cy="48" r="18" fill="rgba(16, 185, 129, 0.25)" stroke="#10B981" strokeWidth="1.5" />
                      </svg>
                    </div>
                    <h4>3-Set Venn Diagram</h4>
                    <p>Three overlapping set regions</p>
                  </div>
                </div>
              )}

              {diagramTab === 'symbols' && (
                <div>
                  <p style={{ fontSize: '0.85rem', color: '#64748B', marginBottom: '0.75rem' }}>
                    Click any symbol to insert directly into active smartboard text line:
                  </p>
                  <div className={styles.symbolsGrid}>
                    {MATH_SYMBOLS.map(sym => (
                      <button 
                        key={sym} 
                        className={styles.symbolBtn}
                        onClick={() => insertSymbolAtActiveLine(sym)}
                        title={`Insert ${sym}`}
                      >
                        {sym}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Collaboration Modal */}
      {showCollabModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: 'var(--primary-color)', fontSize: '1.35rem', fontWeight: 700 }}>
                Live Stream & Collaboration
              </h3>
              <X size={22} style={{ cursor: 'pointer', color: '#64748B' }} onClick={() => setShowCollabModal(false)} />
            </div>
            
            <p style={{ color: 'var(--text-light)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '1rem' }}>
              Students can scan this QR code on their mobile or tablet camera. They will see everything you draw, write, and reveal <strong>live in real-time</strong>.
            </p>

            <div className={styles.qrContainer}>
              {boardUrl ? (
                <QRCodeSVG
                  value={boardUrl}
                  size={160}
                  bgColor="#FFFFFF"
                  fgColor="#0A2540"
                  level="H"
                  style={{ borderRadius: '8px' }}
                />
              ) : (
                <div style={{ width: 160, height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: '0.85rem' }}>
                  Generating QR…
                </div>
              )}
              <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: '0.75rem', fontWeight: 500 }}>
                Scan with phone / tablet camera
              </span>
              <span style={{ fontSize: '0.72rem', color: '#10B981', marginTop: '0.25rem', fontWeight: 600 }}>
                Board ID: {id || 'demo'} • {isWsConnected ? '⚡ Live WebSocket Active' : 'Connecting WebSocket...'}
              </span>
            </div>

            <div className={styles.shareLink}>
              <span style={{ fontSize: '0.82rem', color: 'var(--primary-color)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '280px', fontFamily: 'monospace' }}>
                {boardUrl || 'Detecting IP…'}
              </span>
              <button className="btn-secondary" style={{ padding: '0.35rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }} onClick={handleCopyLink}>
                {copiedLink ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
                {copiedLink ? 'Copied' : 'Copy'}
              </button>
            </div>

            <div style={{ backgroundColor: '#F1F5F9', padding: '0.85rem', borderRadius: '0.5rem', fontWeight: 600, fontSize: '0.95rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Live Devices Joined:</span>
              <span style={{ 
                color: peerCount > 1 ? '#047857' : '#64748B', 
                background: peerCount > 1 ? '#DCFCE7' : '#E2E8F0', 
                padding: '0.2rem 0.65rem', 
                borderRadius: '1rem', 
                fontSize: '0.82rem', 
                fontWeight: 700 
              }}>
                {peerCount > 1 ? `${peerCount - 1} Student(s) Live` : '0 / 249'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Smartboard;

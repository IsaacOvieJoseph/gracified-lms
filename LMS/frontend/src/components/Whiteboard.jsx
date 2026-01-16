import React, { useRef, useEffect, useState, useContext, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Undo, Redo, Square, Circle as CircleIcon, Type, Eraser, MousePointer, Paintbrush, Trash2, Lock, Unlock, Download, Eye, EyeOff, Hand } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const DEFAULT_SOCKET_URL = API_URL.replace(/\/api$/, '');
const SOCKET_URL = import.meta.env.VITE_API_WS_URL || DEFAULT_SOCKET_URL;

export default function Whiteboard() {
  const { classId: paramClassId } = useParams();
  const classId = paramClassId;
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const canvasHeightRef = useRef(4000);
  const overlayRef = useRef(null);
  const socketRef = useRef(null);
  const containerRef = useRef(null);
  const strokeBufferRef = useRef([]);
  const flushIntervalRef = useRef(null);
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const strokeHistoryRef = useRef([]); // local authoritative history for redraws
  const inputRef = useRef(null);
  const panStartRef = useRef({ clientX: 0, clientY: 0, scrollTop: 0, scrollLeft: 0 });
  const [textInput, setTextInput] = useState({ visible: false, x: 0, y: 0, value: '', fontSize: 18 });
  const [otherCursors, setOtherCursors] = useState({});
  const lastCursorEmitRef = useRef(0);
  const { user } = useAuth();
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [locked, setLocked] = useState(false);
  const [followEnabled, setFollowEnabled] = useState(false);
  const [tool, setTool] = useState('pen'); // pen, eraser, rect, circle, text, pointer
  const [color, setColor] = useState('#000000');
  const [width, setWidth] = useState(2);
  const shapeStartRef = useRef(null);

  const isTeacher = user && (user.role === 'teacher' || user.role === 'personal_teacher' || user.role === 'school_admin' || user.role === 'root_admin');

  const generateId = () => {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return `id_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  };

  const pushToBuffer = (stroke) => {
    const s = { ...(stroke || {}) };
    if (!s._id && !s.id) s._id = generateId();
    if (!s.ts) s.ts = new Date().toISOString();
    strokeBufferRef.current.push(s);
    // record in local history and undo stack
    strokeHistoryRef.current.push(s);
    undoStackRef.current.push(s);
    // flush if buffer large
    if (strokeBufferRef.current.length >= 30) flushBuffer();
  };

  const flushBuffer = useCallback(() => {
    const buf = strokeBufferRef.current;
    if (!buf || buf.length === 0) return;
    const toSend = buf.splice(0, buf.length);
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('wb:draw-bulk', { strokes: toSend });
    }
  }, []);

  const redrawAll = () => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // redraw each stroke in order
    strokeHistoryRef.current.forEach(s => renderStroke(s, false));
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    // initial dimensions: full width, tall height so users can scroll vertically
    canvas.width = canvas.clientWidth;
    canvas.height = canvasHeightRef.current;
    canvas.style.height = `${canvas.height}px`;
    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#000';
    ctxRef.current = ctx;

    // initialize overlay canvas to match main canvas
    if (overlayRef.current) {
      overlayRef.current.width = canvas.width;
      overlayRef.current.height = canvas.height;
      overlayRef.current.style.height = `${canvas.height}px`;
      overlayRef.current.style.width = '100%';
    }

    const ensureCanvasHeight = (minHeight) => {
      if (minHeight <= canvas.height) return;
      // copy existing content
      const tmp = document.createElement('canvas');
      tmp.width = canvas.width;
      tmp.height = canvas.height;
      const tctx = tmp.getContext('2d');
      tctx.drawImage(canvas, 0, 0);
      // increase height
      canvas.height = minHeight;
      canvas.style.height = `${canvas.height}px`;
      if (overlayRef.current) {
        overlayRef.current.height = canvas.height;
        overlayRef.current.style.height = `${canvas.height}px`;
      }
      const newCtx = canvas.getContext('2d');
      newCtx.drawImage(tmp, 0, 0);
      ctxRef.current = newCtx;
      canvasHeightRef.current = canvas.height;
    };

    const token = localStorage.getItem('token') || '';
    const socket = io(SOCKET_URL, { auth: { token: token ? `Bearer ${token}` : '' } });
    socketRef.current = socket;
    socket.emit('wb:join', { classId });

    socket.on('wb:draw', (data) => {
      // real-time single stroke from another client
      renderStroke(data, false);
      // record to local history if it has an id
      if (data && (data._id || data.id)) strokeHistoryRef.current.push(data);
    });

    socket.on('wb:cursor', (payload) => {
      // payload: { socketId, xNorm, yNorm, name, color }
      setOtherCursors((prev) => ({ ...prev, [payload.socketId]: { ...payload, lastSeen: Date.now() } }));
    });

    socket.on('wb:viewport', ({ scrollTopNorm, teacherSocketId }) => {
      // when teacher broadcasts viewport and follow mode is enabled, students follow
      if (!isTeacher && followEnabled && containerRef.current && canvasRef.current) {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        const maxScroll = Math.max(0, canvas.height - container.clientHeight);
        const newTop = Math.max(0, Math.min(1, scrollTopNorm)) * maxScroll;
        container.scrollTop = newTop;
      }
    });

    socket.on('wb:clear', () => {
      clearCanvas(false);
    });

    socket.on('wb:lock-state', ({ locked }) => {
      setLocked(!!locked);
    });
    socket.on('wb:follow-state', ({ follow }) => {
      setFollowEnabled(!!follow);
    });

    socket.on('wb:history', (strokes) => {
      try {
        // draw persisted strokes in order
        strokes.forEach((s) => {
          renderStroke(s, false);
          // populate history
          strokeHistoryRef.current.push(s);
        });
      } catch (err) {
        console.error('Error replaying history', err);
      }
    });

    // when a stroke is removed (undo by owner or teacher), remove locally and redraw
    socket.on('wb:remove-stroke', ({ strokeId }) => {
      if (!strokeId) return;
      strokeHistoryRef.current = strokeHistoryRef.current.filter(s => (s._id || s.id) !== strokeId);
      // redraw all
      redrawAll();
      // also remove from undo stack if present
      undoStackRef.current = undoStackRef.current.filter(s => (s._id || s.id) !== strokeId);
    });

    // cleanup stale cursors periodically
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setOtherCursors((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((k) => {
          if (now - next[k].lastSeen > 8000) delete next[k];
        });
        return next;
      });
    }, 3000);

    // setup periodic flush of buffered strokes
    flushIntervalRef.current = setInterval(() => {
      try { flushBuffer(); } catch (e) { /* ignore */ }
    }, 700);

    return () => {
      clearInterval(cleanupInterval);
      if (flushIntervalRef.current) clearInterval(flushIntervalRef.current);
      try { flushBuffer(); } catch (e) { }
      socket.emit('wb:leave');
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  useEffect(() => {
    if (textInput.visible && inputRef.current) {
      inputRef.current.focus();
    }
  }, [textInput.visible]);

  function drawLine(prev, curr, color = '#000', width = 2, emit = true) {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    // helper converts normalized (0..1) coords to pixels if needed
    const toPixels = (pt) => {
      if (pt == null) return pt;
      // if coordinates look normalized (0..1), convert
      if (pt.x <= 1 && pt.y <= 1) {
        return { x: pt.x * canvas.width, y: pt.y * canvas.height };
      }
      return pt;
    };

    const p1 = toPixels(prev);
    const p2 = toPixels(curr);

    // dynamically expand canvas if drawing near bottom
    const margin = 200;
    if (p2.y > canvas.height - margin) {
      const newH = canvas.height + 3000;
      // preserve content while expanding
      const tmp = document.createElement('canvas');
      tmp.width = canvas.width;
      tmp.height = canvas.height;
      const tctx = tmp.getContext('2d');
      tctx.drawImage(canvas, 0, 0);
      canvas.height = newH;
      canvas.style.height = `${canvas.height}px`;
      const newCtx = canvas.getContext('2d');
      newCtx.drawImage(tmp, 0, 0);
      ctxRef.current = newCtx;
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.closePath();

    if (!emit) return;
    // emit normalized coords so strokes replay correctly on different client sizes
    const norm = (pt) => ({ x: pt.x / canvas.width, y: pt.y / canvas.height });
    const stroke = { type: 'line', prev: norm(p1), curr: norm(p2), color, width };
    if (!stroke._id && !stroke.id) stroke._id = generateId();
    socketRef.current.emit('wb:draw', { ...stroke, persist: false });
    pushToBuffer(stroke);
  }

  function renderStroke(s, emit = false) {
    // s: stroke object with type
    const t = s.type || 'line';
    if (t === 'line') {
      drawLine(s.prev, s.curr, s.color || '#000', s.width || 2, emit);
      return;
    }
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    const toPixels = (pt) => {
      if (!pt) return pt;
      if (pt.x <= 1 && pt.y <= 1) return { x: pt.x * canvas.width, y: pt.y * canvas.height };
      return pt;
    };
    if (t === 'rect') {
      const p1 = toPixels(s.prev);
      const p2 = toPixels(s.curr);
      const x = Math.min(p1.x, p2.x);
      const y = Math.min(p1.y, p2.y);
      const w = Math.abs(p2.x - p1.x);
      const h = Math.abs(p2.y - p1.y);
      ctx.strokeStyle = s.color || '#000';
      ctx.lineWidth = s.width || 2;
      ctx.strokeRect(x, y, w, h);
      return;
    }
    if (t === 'circle') {
      const p1 = toPixels(s.prev);
      const p2 = toPixels(s.curr);
      const cx = (p1.x + p2.x) / 2;
      const cy = (p1.y + p2.y) / 2;
      const rx = Math.abs(p2.x - p1.x) / 2;
      const ry = Math.abs(p2.y - p1.y) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.strokeStyle = s.color || '#000';
      ctx.lineWidth = s.width || 2;
      ctx.stroke();
      ctx.closePath();
      return;
    }
    if (t === 'erase') {
      // draw using destination-out to erase
      const prev = toPixels(s.prev);
      const curr = toPixels(s.curr);
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = s.width || 20;
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(curr.x, curr.y);
      ctx.stroke();
      ctx.closePath();
      ctx.restore();
      return;
    }
    if (t === 'text') {
      const pos = toPixels(s.pos || s.prev);
      ctx.fillStyle = s.color || '#000';
      ctx.font = `${(s.fontSize || 16)}px sans-serif`;
      ctx.fillText(s.text || '', pos.x, pos.y);
      return;
    }
  }

  function clearCanvas(emit = true) {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (emit) socketRef.current.emit('wb:clear');
  }

  function getPointerPos(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    if (e.touches) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left), y: (t.clientY - rect.top) };
    }
    return { x: (e.clientX - rect.left), y: (e.clientY - rect.top) };
  }

  const handlePointerDown = (e) => {
    if (locked && !isTeacher) return;
    const pos = getPointerPos(e);
    if (tool === 'pen' || tool === 'eraser') {
      setIsDrawing(true);
      socketRef.current._lastPos = pos;
    } else if (tool === 'hand') {
      setIsPanning(true);
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      panStartRef.current = {
        clientX,
        clientY,
        scrollTop: containerRef.current.scrollTop,
        scrollLeft: containerRef.current.scrollLeft
      };
    } else if (tool === 'rect' || tool === 'circle') {
      shapeStartRef.current = pos;
      // clear overlay
      const ov = overlayRef.current;
      if (ov) {
        ov.width = canvasRef.current.width;
        ov.height = canvasRef.current.height;
      }
    } else if (tool === 'text') {
      // show inline text input at clicked position
      // Using direct canvas coordinates since absolute items in a relative 
      // overflow div will scroll correctly without manual offset tracking
      setTextInput({ visible: true, x: pos.x, y: pos.y, value: '', fontSize: 18 });
    }
  };
  const handlePointerMove = (e) => {
    if (locked && !isTeacher && tool !== 'hand') return;
    const pos = getPointerPos(e);
    if (tool === 'hand' && isPanning) {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const dx = clientX - panStartRef.current.clientX;
      const dy = clientY - panStartRef.current.clientY;
      containerRef.current.scrollTop = panStartRef.current.scrollTop - dy;
      containerRef.current.scrollLeft = panStartRef.current.scrollLeft - dx;
      return;
    }
    if (tool === 'pen') {
      if (!isDrawing) return;
      const prev = socketRef.current._lastPos || pos;
      drawLine(prev, pos, color, width, true);
      socketRef.current._lastPos = pos;
    } else if (tool === 'eraser') {
      if (!isDrawing) return;
      const prev = socketRef.current._lastPos || pos;
      // draw erase locally
      const eraseStroke = { type: 'erase', prev: { x: prev.x / canvasRef.current.width, y: prev.y / canvasRef.current.height }, curr: { x: pos.x / canvasRef.current.width, y: pos.y / canvasRef.current.height }, width: width * 8 };
      renderStroke(eraseStroke, false);
      socketRef.current.emit('wb:draw', { ...eraseStroke, persist: false });
      pushToBuffer(eraseStroke);
      socketRef.current._lastPos = pos;
    } else if (tool === 'rect' || tool === 'circle') {
      // draw preview on overlay
      const start = shapeStartRef.current;
      if (!start) return;
      const ov = overlayRef.current;
      const octx = ov.getContext('2d');
      // clear overlay
      octx.clearRect(0, 0, ov.width, ov.height);
      octx.strokeStyle = color;
      octx.lineWidth = width;
      const x = Math.min(start.x, pos.x);
      const y = Math.min(start.y, pos.y);
      const w = Math.abs(pos.x - start.x);
      const h = Math.abs(pos.y - start.y);
      if (tool === 'rect') {
        octx.strokeRect(x, y, w, h);
      } else {
        octx.beginPath();
        octx.ellipse((start.x + pos.x) / 2, (start.y + pos.y) / 2, Math.abs(pos.x - start.x) / 2, Math.abs(pos.y - start.y) / 2, 0, 0, Math.PI * 2);
        octx.stroke();
        octx.closePath();
      }
    }
    // emit cursor position (normalized) throttled
    try {
      const now = Date.now();
      if (now - lastCursorEmitRef.current > 80) {
        const canvas = canvasRef.current;
        const xNorm = pos.x / canvas.width;
        const yNorm = pos.y / canvas.height;
        socketRef.current.emit('wb:cursor', { xNorm, yNorm });
        lastCursorEmitRef.current = now;
      }
    } catch (err) {
      // ignore
    }
  };
  const handlePointerUp = (e) => {
    if (tool === 'hand') {
      setIsPanning(false);
      return;
    }
    if (tool === 'pen' || tool === 'eraser') {
      setIsDrawing(false);
      if (socketRef.current) socketRef.current._lastPos = null;
    } else if (tool === 'rect' || tool === 'circle') {
      const start = shapeStartRef.current;
      const end = getPointerPos(e);
      if (start && end) {
        const canvas = canvasRef.current;
        const stroke = {
          type: tool,
          prev: { x: start.x / canvas.width, y: start.y / canvas.height },
          curr: { x: end.x / canvas.width, y: end.y / canvas.height },
          color,
          width,
        };
        // clear overlay
        const ov = overlayRef.current;
        if (ov) ov.getContext('2d').clearRect(0, 0, ov.width, ov.height);
        renderStroke(stroke, false);
        socketRef.current.emit('wb:draw', { ...stroke, persist: false });
        pushToBuffer(stroke);
      }
      shapeStartRef.current = null;
    }
  };

  // handler for submitting text input
  const submitTextInput = () => {
    if (!textInput.value) {
      setTextInput({ visible: false, x: 0, y: 0, value: '' });
      return;
    }
    const canvas = canvasRef.current;
    const posNorm = { x: textInput.x / canvas.width, y: textInput.y / canvas.height };
    const stroke = { type: 'text', pos: posNorm, text: textInput.value, color, fontSize: textInput.fontSize };
    renderStroke(stroke, false);
    socketRef.current.emit('wb:draw', { ...stroke, persist: false });
    pushToBuffer(stroke);
    setTextInput({ visible: false, x: 0, y: 0, value: '' });
  };

  const onExportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // create a temporary canvas to draw a white background then the board on top
    const tmp = document.createElement('canvas');
    tmp.width = canvas.width;
    tmp.height = canvas.height;
    const tctx = tmp.getContext('2d');
    // fill white background to avoid transparent/black background in saved PNG
    tctx.fillStyle = '#ffffff';
    tctx.fillRect(0, 0, tmp.width, tmp.height);
    // draw the main canvas onto the temp canvas
    tctx.drawImage(canvas, 0, 0);
    const url = tmp.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `whiteboard_${classId || 'board'}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const onClear = () => {
    if (!isTeacher) return;
    clearCanvas(true);
  };

  const onToggleLock = () => {
    if (!isTeacher) return;
    socketRef.current.emit('wb:lock', { locked: !locked });
    setLocked(!locked);
  };

  // teacher: emit viewport on scroll when locked; students: follow teacher when locked
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !socketRef.current) return;

    let lastEmit = 0;
    const onScroll = () => {
      if (!socketRef.current) return;
      if (!isTeacher) return;
      if (!whiteboardSessionLocked()) return; // helper below
      const now = Date.now();
      if (now - lastEmit < 100) return;
      lastEmit = now;
      const canvas = canvasRef.current;
      const maxScroll = Math.max(0, canvas.height - container.clientHeight);
      const scrollTopNorm = maxScroll > 0 ? container.scrollTop / maxScroll : 0;
      socketRef.current.emit('wb:viewport', { scrollTopNorm });
    };

    if (isTeacher) {
      container.addEventListener('scroll', onScroll, { passive: true });
    }

    return () => {
      if (isTeacher) container.removeEventListener('scroll', onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTeacher, locked]);

  function whiteboardSessionLocked() {
    // prefer server lock state; local locked state is okay as an approximation
    return !!locked;
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden">
      {/* Responsive Toolbar */}
      <div className="bg-white border-b border-gray-200 p-2 md:p-3 flex flex-wrap items-center gap-2 md:gap-4 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-gray-800 hidden sm:block">Whiteboard</h3>
          <div className={`px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${locked ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {locked ? 'Locked' : 'Open'}
          </div>
        </div>

        {isTeacher && (
          <>
            {/* Utility Actions */}
            <div className="flex items-center gap-1 border-r pr-2 md:pr-4">
              <button
                className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                onClick={onClear}
                title="Clear All"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                className={`p-2 rounded-lg transition-colors ${locked ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                onClick={onToggleLock}
                title={locked ? 'Unlock' : 'Lock'}
              >
                {locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              </button>
              <button
                className={`p-2 rounded-lg transition-colors ${followEnabled ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                onClick={() => { socketRef.current?.emit('wb:follow', { follow: !followEnabled }); setFollowEnabled(!followEnabled); }}
                title={followEnabled ? 'Disable Follow' : 'Enable Follow'}
              >
                {followEnabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>

            {/* Drawing Tools */}
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
              <button
                onClick={() => setTool('hand')}
                className={`p-2 rounded-lg transition-all ${tool === 'hand' ? 'bg-white shadow-sm text-indigo-600 scale-110' : 'text-gray-600 hover:text-gray-900'}`}
                title="Pan Tool (Hand)"
              >
                <Hand className="w-4 h-4" />
              </button>
              <button
                onClick={() => setTool('pointer')}
                className={`p-2 rounded-lg transition-all ${tool === 'pointer' ? 'bg-white shadow-sm text-indigo-600 scale-110' : 'text-gray-600 hover:text-gray-900'}`}
                title="Pointer"
              >
                <MousePointer className="w-4 h-4" />
              </button>
              <button
                onClick={() => setTool('pen')}
                className={`p-2 rounded-lg transition-all ${tool === 'pen' ? 'bg-white shadow-sm text-indigo-600 scale-110' : 'text-gray-600 hover:text-gray-900'}`}
                title="Pen"
              >
                <Paintbrush className="w-4 h-4" />
              </button>
              <button
                onClick={() => setTool('eraser')}
                className={`p-2 rounded-lg transition-all ${tool === 'eraser' ? 'bg-white shadow-sm text-indigo-600 scale-110' : 'text-gray-600 hover:text-gray-900'}`}
                title="Eraser"
              >
                <Eraser className="w-4 h-4" />
              </button>
              <button
                onClick={() => setTool('rect')}
                className={`p-2 rounded-lg transition-all ${tool === 'rect' ? 'bg-white shadow-sm text-indigo-600 scale-110' : 'text-gray-600 hover:text-gray-900'}`}
                title="Rectangle"
              >
                <Square className="w-4 h-4" />
              </button>
              <button
                onClick={() => setTool('circle')}
                className={`p-2 rounded-lg transition-all ${tool === 'circle' ? 'bg-white shadow-sm text-indigo-600 scale-110' : 'text-gray-600 hover:text-gray-900'}`}
                title="Circle"
              >
                <CircleIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setTool('text')}
                className={`p-2 rounded-lg transition-all ${tool === 'text' ? 'bg-white shadow-sm text-indigo-600 scale-110' : 'text-gray-600 hover:text-gray-900'}`}
                title="Text"
              >
                <Type className="w-4 h-4" />
              </button>
            </div>

            {/* Colors */}
            <div className="flex items-center gap-1 px-2 border-l border-r">
              <div className="flex flex-wrap gap-1 max-w-[100px] sm:max-w-none">
                {['#000000', '#ef4444', '#22c55e', '#3b82f6', '#eab308', '#a855f7', '#06b6d4', '#ffffff'].map(c => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className="w-5 h-5 rounded-full border border-gray-200 transition-transform active:scale-90"
                    style={{ background: c }}
                    title={c}
                  />
                ))}
              </div>
            </div>

            {/* History & Export */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  if (undoStackRef.current.length > 0) {
                    const s = undoStackRef.current.pop();
                    redoStackRef.current.push(s);
                    socketRef.current.emit('wb:remove-stroke', { strokeId: s._id || s.id });
                    strokeHistoryRef.current = strokeHistoryRef.current.filter(x => (x._id || x.id) !== (s._id || s.id));
                    redrawAll();
                  }
                }}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Undo"
              >
                <Undo className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  if (redoStackRef.current.length > 0) {
                    const s = redoStackRef.current.pop();
                    renderStroke(s, false);
                    pushToBuffer(s);
                    socketRef.current.emit('wb:draw', { ...s, persist: false });
                  }
                }}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Redo"
              >
                <Redo className="w-4 h-4" />
              </button>
              <button
                onClick={onExportPNG}
                className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors hidden sm:flex items-center gap-2 font-medium text-sm"
                title="Export Image"
              >
                <Download className="w-4 h-4" />
                <span>Export</span>
              </button>
              <button
                onClick={onExportPNG}
                className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors sm:hidden"
                title="Export Image"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>

      <div
        ref={containerRef}
        className={`flex-1 overflow-auto relative bg-gray-100/50 ${tool === 'hand' ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') :
            tool === 'pointer' ? 'cursor-default' : 'cursor-crosshair'
          }`}
      >
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: `${canvasHeightRef.current}px`, border: '1px solid #e5e7eb', touchAction: 'none', display: 'block' }}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={(e) => handlePointerUp(e)}
          onMouseLeave={(e) => handlePointerUp(e)}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={(e) => handlePointerUp(e)}
        />
        {/* overlay canvas for previews */}
        <canvas ref={overlayRef} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', width: '100%', height: `${canvasHeightRef.current}px` }} />

        {/* inline text input */}
        {textInput.visible && (
          <input
            ref={inputRef}
            className="outline-none border-b-2 border-indigo-500 bg-white/90 backdrop-blur-sm shadow-lg pointer-events-auto"
            value={textInput.value}
            onChange={(e) => setTextInput(t => ({ ...t, value: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitTextInput();
              if (e.key === 'Escape') setTextInput({ visible: false, x: 0, y: 0, value: '' });
              e.stopPropagation();
            }}
            onBlur={() => submitTextInput()}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              left: `${textInput.x}px`,
              top: `${textInput.y}px`,
              zIndex: 100,
              padding: '4px 8px',
              fontSize: `${textInput.fontSize}px`,
              minWidth: '150px'
            }}
          />
        )}

        {/* render other users' cursors */}
        {Object.keys(otherCursors).map((id) => {
          const c = otherCursors[id];
          if (!c) return null;
          const canvas = canvasRef.current;
          const container = containerRef.current;
          if (!canvas || !container) return null;
          const px = c.xNorm * canvas.width;
          const py = c.yNorm * canvas.height - container.scrollTop;
          return (
            <div key={id} style={{ position: 'absolute', left: px + 8, top: py - 8, pointerEvents: 'none', zIndex: 40 }}>
              <div style={{ background: c.color || '#000', color: '#fff', padding: '2px 6px', borderRadius: 6, fontSize: 12, whiteSpace: 'nowrap' }}>{c.name}</div>
              <div style={{ width: 8, height: 8, background: c.color || '#000', borderRadius: '50%', marginTop: 4 }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

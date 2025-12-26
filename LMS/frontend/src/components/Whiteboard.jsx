import React, { useRef, useEffect, useState, useContext } from 'react';
import { io } from 'socket.io-client';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const SOCKET_URL = import.meta.env.VITE_API_WS_URL || 'http://localhost:5000';

export default function Whiteboard() {
  const { classId: paramClassId } = useParams();
  const classId = paramClassId;
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const canvasHeightRef = useRef(4000);
  const overlayRef = useRef(null);
  const socketRef = useRef(null);
  const containerRef = useRef(null);
  const [otherCursors, setOtherCursors] = useState({});
  const lastCursorEmitRef = useRef(0);
  const { user } = useAuth();
  const [isDrawing, setIsDrawing] = useState(false);
  const [locked, setLocked] = useState(false);
  const [followEnabled, setFollowEnabled] = useState(false);
  const [tool, setTool] = useState('pen'); // pen, eraser, rect, circle, text, pointer
  const [color, setColor] = useState('#000000');
  const [width, setWidth] = useState(2);
  const shapeStartRef = useRef(null);

  const isTeacher = user && (user.role === 'teacher' || user.role === 'personal_teacher' || user.role === 'school_admin' || user.role === 'root_admin');

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
    const socket = io(SOCKET_URL, { transports: ['websocket'], auth: { token: token ? `Bearer ${token}` : '' } });
    socketRef.current = socket;
    socket.emit('wb:join', { classId });

    socket.on('wb:draw', (data) => {
      // data may contain type and payload
      renderStroke(data, false);
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
        strokes.forEach((s) => renderStroke(s, false));
      } catch (err) {
        console.error('Error replaying history', err);
      }
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

    return () => {
      clearInterval(cleanupInterval);
      socket.emit('wb:leave');
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

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
    socketRef.current.emit('wb:draw', { type: 'line', prev: norm(p1), curr: norm(p2), color, width });
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
    } else if (tool === 'rect' || tool === 'circle') {
      shapeStartRef.current = pos;
      // clear overlay
      const ov = overlayRef.current;
      if (ov) {
        ov.width = canvasRef.current.width;
        ov.height = canvasRef.current.height;
      }
    } else if (tool === 'text') {
      // prompt for text input
      const txt = window.prompt('Enter text');
      if (txt) {
        const canvas = canvasRef.current;
        const posNorm = { x: pos.x / canvas.width, y: pos.y / canvas.height };
        const stroke = { type: 'text', pos: posNorm, text: txt, color, fontSize: 18 };
        renderStroke(stroke, false);
        socketRef.current.emit('wb:draw', stroke);
      }
    }
  };
  const handlePointerMove = (e) => {
    if (locked && !isTeacher) return;
    const pos = getPointerPos(e);
    if (tool === 'pen') {
      if (!isDrawing) return;
      const prev = socketRef.current._lastPos || pos;
      drawLine(prev, pos, color, width, true);
      socketRef.current._lastPos = pos;
    } else if (tool === 'eraser') {
      if (!isDrawing) return;
      const prev = socketRef.current._lastPos || pos;
      // draw erase locally
      renderStroke({ type: 'erase', prev: { x: prev.x / canvasRef.current.width, y: prev.y / canvasRef.current.height }, curr: { x: pos.x / canvasRef.current.width, y: pos.y / canvasRef.current.height }, width: width * 8 }, false);
      socketRef.current.emit('wb:draw', { type: 'erase', prev: { x: prev.x / canvasRef.current.width, y: prev.y / canvasRef.current.height }, curr: { x: pos.x / canvasRef.current.width, y: pos.y / canvasRef.current.height }, width: width * 8 });
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
        socketRef.current.emit('wb:draw', stroke);
      }
      shapeStartRef.current = null;
    }
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
    <div className="p-4 h-full" style={{ height: '100%' }}>
      <div className="flex items-center gap-2 mb-2">
        <h3 className="font-semibold">Whiteboard</h3>
        {isTeacher && <button className="px-3 py-1 bg-red-500 text-white rounded" onClick={onClear}>Clear</button>}
        {isTeacher && <button className="px-3 py-1 bg-gray-700 text-white rounded" onClick={onToggleLock}>{locked ? 'Unlock' : 'Lock'}</button>}
        {isTeacher && <button className="px-3 py-1 bg-indigo-600 text-white rounded" onClick={() => { socketRef.current?.emit('wb:follow', { follow: !followEnabled }); setFollowEnabled(!followEnabled); }}>{followEnabled ? 'Disable Follow' : 'Enable Follow'}</button>}
        <div style={{ display: 'flex', gap: 8, marginLeft: 12 }}>
          {isTeacher && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button onClick={() => setTool('pointer')} title="Pointer" className={`px-2 py-1 rounded ${tool==='pointer' ? 'bg-gray-200' : 'bg-white'}`}>☝️</button>
              <button onClick={() => setTool('pen')} title="Pen" className={`px-2 py-1 rounded ${tool==='pen' ? 'bg-gray-200' : 'bg-white'}`}>✏️</button>
              <button onClick={() => setTool('eraser')} title="Eraser" className={`px-2 py-1 rounded ${tool==='eraser' ? 'bg-gray-200' : 'bg-white'}`}>🧽</button>
              <button onClick={() => setTool('rect')} title="Rectangle" className={`px-2 py-1 rounded ${tool==='rect' ? 'bg-gray-200' : 'bg-white'}`}>▭</button>
              <button onClick={() => setTool('circle')} title="Circle" className={`px-2 py-1 rounded ${tool==='circle' ? 'bg-gray-200' : 'bg-white'}`}>◯</button>
              <button onClick={() => setTool('text')} title="Text" className={`px-2 py-1 rounded ${tool==='text' ? 'bg-gray-200' : 'bg-white'}`}>T</button>
              <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
                {['#000000','#ff0000','#00ff00','#0000ff','#ffff00','#ff00ff','#00ffff','#ffffff'].map(c=> (
                  <button key={c} onClick={()=>setColor(c)} style={{ width:20, height:20, background:c, border: c==='#ffffff' ? '1px solid #ccc' : 'none' }} />
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="ml-auto">{locked ? 'Locked' : 'Open'}</div>
      </div>
      <div ref={containerRef} style={{ height: 'calc(100vh - 140px)', overflowY: 'auto', position: 'relative' }}>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: `${canvasHeightRef.current}px`, border: '1px solid #e5e7eb', touchAction: 'none', display: 'block' }}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={(e)=>handlePointerUp(e)}
          onMouseLeave={(e)=>handlePointerUp(e)}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={(e)=>handlePointerUp(e)}
        />
        {/* overlay canvas for previews */}
        <canvas ref={overlayRef} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', width: '100%', height: `${canvasHeightRef.current}px` }} />

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

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
  const socketRef = useRef(null);
  const { user } = useAuth();
  const [isDrawing, setIsDrawing] = useState(false);
  const [locked, setLocked] = useState(false);

  const isTeacher = user && (user.role === 'teacher' || user.role === 'personal_teacher' || user.role === 'school_admin' || user.role === 'root_admin');

  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#000';
    ctxRef.current = ctx;

    const token = localStorage.getItem('token') || '';
    const socket = io(SOCKET_URL, { transports: ['websocket'], auth: { token: token ? `Bearer ${token}` : '' } });
    socketRef.current = socket;
    socket.emit('wb:join', { classId });

    socket.on('wb:draw', ({ prev, curr, color, width }) => {
      drawLine(prev, curr, color, width, false);
    });

    socket.on('wb:clear', () => {
      clearCanvas(false);
    });

    socket.on('wb:lock-state', ({ locked }) => {
      setLocked(!!locked);
    });

    return () => {
      socket.emit('wb:leave');
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  function drawLine(prev, curr, color = '#000', width = 2, emit = true) {
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(curr.x, curr.y);
    ctx.stroke();
    ctx.closePath();
    if (!emit) return;
    socketRef.current.emit('wb:draw', { prev, curr, color, width });
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
    setIsDrawing(true);
    const pos = getPointerPos(e);
    socketRef.current._lastPos = pos;
  };
  const handlePointerMove = (e) => {
    if (!isDrawing || (locked && !isTeacher)) return;
    const pos = getPointerPos(e);
    const prev = socketRef.current._lastPos || pos;
    drawLine(prev, pos, '#000', 2, true);
    socketRef.current._lastPos = pos;
  };
  const handlePointerUp = () => {
    setIsDrawing(false);
    if (socketRef.current) socketRef.current._lastPos = null;
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

  return (
    <div className="p-4 h-full" style={{ height: '100%' }}>
      <div className="flex items-center gap-2 mb-2">
        <h3 className="font-semibold">Whiteboard</h3>
        {isTeacher && <button className="px-3 py-1 bg-red-500 text-white rounded" onClick={onClear}>Clear</button>}
        {isTeacher && <button className="px-3 py-1 bg-gray-700 text-white rounded" onClick={onToggleLock}>{locked ? 'Unlock' : 'Lock'}</button>}
        <div className="ml-auto">{locked ? 'Locked' : 'Open'}</div>
      </div>
      <div style={{ height: 'calc(100vh - 140px)' }}>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', border: '1px solid #e5e7eb', touchAction: 'none' }}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
        />
      </div>
    </div>
  );
}

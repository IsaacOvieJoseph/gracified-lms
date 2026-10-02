import React, { useRef, useEffect, useState, useContext, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { io } from 'socket.io-client';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Undo, Redo, Square, Circle as CircleIcon, Type, Eraser, MousePointer, Paintbrush, Trash2, Lock, Unlock, Download, Eye, EyeOff, Hand, Mic, MicOff, Volume2, VolumeX, LogOut, Video, VideoOff, Users, ChevronDown, Pencil, Moon, Sun } from 'lucide-react';
import VoiceControls from './VoiceControls';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const DEFAULT_SOCKET_URL = API_URL.replace(/\/api$/, '');
const SOCKET_URL = import.meta.env.VITE_API_WS_URL || DEFAULT_SOCKET_URL;

// --- Virtual coordinate space ---
// All strokes are stored/transmitted as fractions of this virtual canvas.
// This ensures identical rendering on ANY device regardless of screen size.
const VIRT_W = 10000;
const VIRT_H = 40000;

export default function Whiteboard() {
  const { classId: paramClassId } = useParams();
  const navigate = useNavigate();
  const classId = paramClassId;
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const canvasHeightRef = useRef(4000);
  const overlayRef = useRef(null);
  const socketRef = useRef(null);
  const containerRef = useRef(null);
  const strokeBufferRef = useRef([]);
  const flushIntervalRef = useRef(null);
  const undoStackRef = useRef([]);   // each element is a stroke or array of strokes (1 undo step)
  const redoStackRef = useRef([]);
  const currentStrokeGroupRef = useRef([]); // segments accumulated during current pen drag
  const strokeHistoryRef = useRef([]); // local authoritative history for redraws
  const inputRef = useRef(null);
  const panStartRef = useRef({ clientX: 0, clientY: 0, scrollTop: 0, scrollLeft: 0 });
  const isSubmittingTextRef = useRef(false);
  const lastPosRef = useRef(null);
  const [textInput, setTextInput] = useState({ visible: false, x: 0, y: 0, viewportX: 0, viewportY: 0, value: '', fontSize: 28 });
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [otherCursors, setOtherCursors] = useState({});
  const lastCursorEmitRef = useRef(0);
  const [isMobileView, setIsMobileView] = useState(typeof window !== 'undefined' ? window.innerWidth <= 1024 : false);
  const { user } = useAuth();
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [locked, setLocked] = useState(false);
  const lockedRef = useRef(false);
  // Follow mode is purely client-side for students — they decide whether to track the teacher
  const [followEnabled, setFollowEnabled] = useState(false);
  const followEnabledRef = useRef(false); // stable ref for socket callbacks
  const teacherSocketIdRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(1); // 1-indexed page shown in toolbar
  const lastBroadcastedPageRef = useRef(-1); // prevent redundant page emits
  const [tool, setTool] = useState('pen'); // pen, eraser, rect, circle, text, pointer
  const [color, setColor] = useState('#000000');
  const [width, setWidth] = useState(2);
  const shapeStartRef = useRef(null);

  // Media communication state
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [allowedDrawers, setAllowedDrawers] = useState(new Set());
  const allowedDrawersRef = useRef(new Set());
  const [showParticipants, setShowParticipants] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState({}); // userId -> MediaStream
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [activeSpeakers, setActiveSpeakers] = useState(new Set());
  const [activeDrawers, setActiveDrawers] = useState(new Set());
  const activeDrawersRef = useRef({}); // userId -> timeoutId
  const [micLocked, setMicLocked] = useState(false);
  const [, setCursorVisibilityTick] = useState(0);

  // Auto-focus text input when it appears
  useEffect(() => {
    if (textInput.visible && inputRef.current) {
      inputRef.current.focus();
    }
  }, [textInput.visible]);

  // Trigger re-render every second to update cursor visibility based on activity
  useEffect(() => {
    const timer = setInterval(() => setCursorVisibilityTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  const [localVolume, setLocalVolume] = useState(0);
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef({});
  const remoteStreamsRef = useRef({});
  const audioContextRef = useRef(null);
  const gainNodeRef = useRef(null);
  const analyserRef = useRef(null);
  const volumeIntervalRef = useRef(null);

  const isTeacher = user && (user.role === 'teacher' || user.role === 'personal_teacher' || user.role === 'school_admin' || user.role === 'root_admin' || user.role === 'admin');

  const generateId = () => {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return `id_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  };

  const pushToBuffer = (stroke, groupToUndoStack = true) => {
    const s = { ...(stroke || {}) };
    if (!s._id && !s.id) s._id = generateId();
    if (!s.ts) s.ts = new Date().toISOString();
    strokeBufferRef.current.push(s);
    strokeHistoryRef.current.push(s);
    // For pen strokes we only group to undo stack on pointerUp (see handlePointerUp);
    // shapes and text push directly as single-step actions
    if (groupToUndoStack) undoStackRef.current.push([s]);
    else currentStrokeGroupRef.current.push(s);
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

    const handleResize = () => {
      setIsMobileView(window.innerWidth <= 1024);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const parent = canvas.parentElement;
      if (parent) {
        const width = parent.clientWidth || parent.getBoundingClientRect().width;
        if (width > 0 && canvas.width !== width) {
          canvas.width = width;
          if (overlayRef.current) overlayRef.current.width = width;
          redrawAll();
        }
      }
    };

    window.addEventListener('resize', handleResize);
    const initialTimeout = setTimeout(handleResize, 100);

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
      // Migrate legacy 0..1 normalized strokes to virtual coordinate space
      const migrateLegacy = (s) => {
        if (!s || s.normalized) return s;
        const isLegacy = (pt) => pt && pt.x <= 1 && pt.y <= 1 && pt.x >= 0 && pt.y >= 0;
        const up = (pt) => pt ? { x: pt.x * VIRT_W, y: pt.y * VIRT_H } : pt;
        const m = { ...s, normalized: true };
        if (isLegacy(s.prev)) m.prev = up(s.prev);
        if (isLegacy(s.curr)) m.curr = up(s.curr);
        if (s.pos && isLegacy(s.pos)) m.pos = up(s.pos);
        return m;
      };
      const stroke = migrateLegacy(data);
      // real-time single stroke from another client
      renderStroke(stroke, false);
      // record to local history if it has an id
      if (stroke && (stroke._id || stroke.id)) strokeHistoryRef.current.push(stroke);

      // Track active drawers for sorting and cursor visibility
      if (data.userId) {
        setOtherCursors(prev => {
          if (!prev[data.userId]) return prev;
          // Only update state if it's been more than 2s to avoid spamming re-renders
          if (Date.now() - prev[data.userId].lastSeen < 2000) return prev;
          return { ...prev, [data.userId]: { ...prev[data.userId], lastSeen: Date.now() } };
        });

        setActiveDrawers(prev => {
          const next = new Set(prev);
          next.add(data.userId);
          return next;
        });
        if (activeDrawersRef.current[data.userId]) clearTimeout(activeDrawersRef.current[data.userId]);
        activeDrawersRef.current[data.userId] = setTimeout(() => {
          setActiveDrawers(prev => {
            const next = new Set(prev);
            next.delete(data.userId);
            return next;
          });
          delete activeDrawersRef.current[data.userId];
        }, 2000);
      }
    });

    socket.on('wb:user-joined', (payload) => {
      if (payload.socketId === socket.id) return;
      // Identify the teacher socket as early as possible for follow-mode
      if (payload.isTeacher) teacherSocketIdRef.current = payload.socketId;
      setOtherCursors((prev) => ({
        ...prev,
        [payload.socketId]: { ...payload, xNorm: 0, yNorm: 0, lastSeen: Date.now() }
      }));
    });

    // Real-time cursor positions from other participants
    socket.on('wb:cursor', (payload) => {
      // payload: { socketId, xNorm, yNorm, name, color, isTeacher }
      if (payload.isTeacher) teacherSocketIdRef.current = payload.socketId;
      setOtherCursors((prev) => ({ ...prev, [payload.socketId]: { ...payload, lastSeen: Date.now() } }));
    });

    socket.on('wb:viewport', ({ scrollTopNorm, page }) => {
      // Update the page indicator for everyone
      if (typeof page === 'number') setCurrentPage(page);

      // Students: if follow is on, scroll to the teacher's position
      if (!isTeacher && followEnabledRef.current && containerRef.current && canvasRef.current) {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        // Normalize against our own canvas CSS height — same fraction, correct absolute position
        const canvasCSSH = canvas.clientHeight || canvas.height || 4000;
        const newTop = Math.max(0, Math.min(scrollTopNorm, 1)) * canvasCSSH;
        container.scrollTop = newTop;
      }
    });


    socket.on('wb:clear', () => {
      clearCanvas(false);
    });

    socket.on('wb:lock-state', ({ locked }) => {
      setLocked(!!locked);
      lockedRef.current = !!locked;
    });
    socket.on('wb:follow-state', ({ follow }) => {
      // Server can still push follow-state (teacher toggled it globally)
      // but students can also override locally — we only auto-enable, not force-disable
      if (follow) setFollowEnabled(true);
    });

    socket.on('wb:voice-state', async ({ enabled }) => {
      // Use ref to check up-to-date state inside the listener
      if (!!enabled === isVoiceEnabledRef.current) return;

      setIsVoiceEnabled(!!enabled);
      if (enabled) {
        if (!localStreamRef.current) {
          await startMediaChat(false);
        }
      } else {
        if (localStreamRef.current) {
          // Pass false to avoid emitting another wb:voice-stop which causes loops
          stopVoiceChat(false);
        }
      }
    });

    socket.on('wb:force-mute', ({ force }) => {
      // Teachers can force mute OR unmute (active/inactive states)
      handleToggleMute(!!force);
    });

    socket.on('wb:mic-lock-state', ({ locked }) => {
      setMicLocked(!!locked);
    });

    socket.on('wb:user-video-state', ({ userId, enabled }) => {
      if (userId === socket.id) return;
      setOtherCursors(prev => {
        if (!prev[userId]) return prev;
        return { ...prev, [userId]: { ...prev[userId], videoEnabled: !!enabled } };
      });
      // If video is disabled, we might want to clean up the stream if we're also not getting audio, 
      // but WebRTC usually handles this via track enabled/disable or removal.
    });

    socket.on('wb:user-mute-state', ({ userId, muted }) => {
      if (userId === socket.id) return;
      setOtherCursors(prev => {
        if (!prev[userId]) return prev;
        return { ...prev, [userId]: { ...prev[userId], muted: !!muted } };
      });
    });

    socket.on('wb:hand-state', ({ userId, raised }) => {
      setOtherCursors(prev => {
        if (!prev[userId]) return prev;
        const person = prev[userId];
        if (isTeacher && raised && userId !== socket.id) {
          toast(`${person.name} raised their hand!`, { icon: '✋', duration: 4000 });
          // Play a gentle 'pop' sound
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
          audio.volume = 0.5;
          audio.play().catch(e => console.debug("Audio play blocked by browser policy"));
        }
        return { ...prev, [userId]: { ...prev[userId], handRaised: !!raised } };
      });
    });

    socket.on('wb:history', (strokes) => {
      try {
        // Migrate strokes that were saved with the old 0..1 normalization scheme
        // (before the virtual coordinate space was introduced).
        // Legacy strokes have no `normalized` flag and coordinates in 0..1 range.
        const migrateStroke = (s) => {
          if (!s || s.normalized) return s; // already in virtual space
          const isLegacyCoord = (pt) => pt && pt.x <= 1 && pt.y <= 1 && pt.x >= 0 && pt.y >= 0;
          const upscale = (pt) => pt ? { x: pt.x * VIRT_W, y: pt.y * VIRT_H } : pt;
          const migrated = { ...s, normalized: true };
          if (isLegacyCoord(s.prev)) migrated.prev = upscale(s.prev);
          if (isLegacyCoord(s.curr)) migrated.curr = upscale(s.curr);
          if (s.pos && isLegacyCoord(s.pos)) migrated.pos = upscale(s.pos);
          return migrated;
        };

        // draw persisted strokes in order
        strokes.forEach((s) => {
          const stroke = migrateStroke(s);
          renderStroke(stroke, false);
          // populate history (store migrated version so redrawAll works correctly)
          strokeHistoryRef.current.push(stroke);
        });
      } catch (err) {
        console.error('Error replaying history', err);
      }
    });

    socket.on('wb:remove-stroke', ({ strokeId }) => {
      if (!strokeId) return;
      strokeHistoryRef.current = strokeHistoryRef.current.filter(s => (s._id || s.id) !== strokeId);
      redrawAll();
      undoStackRef.current = undoStackRef.current.filter(s => (s._id || s.id) !== strokeId);
    });

    socket.on('wb:participants', (list) => {
      setOtherCursors(prev => {
        const next = { ...prev };
        list.forEach(p => {
          if (p.socketId !== socket.id) {
            // Identify teacher socket for follow-mode
            if (p.isTeacher) teacherSocketIdRef.current = p.socketId;
            next[p.socketId] = { ...p, xNorm: 0, yNorm: 0, lastSeen: Date.now() };
          }
        });
        return next;
      });
    });

    socket.on('wb:allow-user-status', ({ userId, allowed }) => {
      setAllowedDrawers(prev => {
        const next = new Set(prev);
        if (allowed) next.add(userId);
        else next.delete(userId);
        allowedDrawersRef.current = next;
        return next;
      });
      if (userId === socket.id) {
        toast.success(allowed ? 'The teacher has allowed you to participate!' : 'Your drawing permission was revoked.');
      }
    });

    // Remove legacy duplicate listener if it exists
    socket.off('wb:user-allow-status');

    socket.on('wb:user-left', ({ socketId }) => {
      setOtherCursors(prev => {
        const next = { ...prev };
        delete next[socketId];
        return next;
      });
      setRemoteStreams(prev => {
        const next = { ...prev };
        delete next[socketId];
        return next;
      });
      // also cleanup peer connection if voice was on
      if (peerConnectionsRef.current[socketId]) {
        peerConnectionsRef.current[socketId].close();
        delete peerConnectionsRef.current[socketId];
      }
    });

    // removed stale cursor cleanup interval to keep users in list until they leave


    // setup periodic flush of buffered strokes
    flushIntervalRef.current = setInterval(() => {
      try { flushBuffer(); } catch (e) { /* ignore */ }
    }, 700);

    // WebRTC signaling listeners
    socket.on('wb:voice-user-joined', async ({ userId }) => {
      if (!userId || userId === socket.id) return;
      const pc = createPeerConnection(userId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('wb:sdp-offer', {
        targetUserId: userId,
        sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp }
      });
    });

    socket.on('wb:sdp-offer', async ({ senderUserId, sdp }) => {
      if (!senderUserId || senderUserId === socket.id) return;
      const pc = createPeerConnection(senderUserId);
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('wb:sdp-answer', {
        targetUserId: senderUserId,
        sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp }
      });
    });

    socket.on('wb:sdp-answer', async ({ senderUserId, sdp }) => {
      const pc = peerConnectionsRef.current[senderUserId];
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      }
    });

    socket.on('wb:ice-candidate', async ({ senderUserId, candidate }) => {
      const pc = peerConnectionsRef.current[senderUserId];
      if (pc && candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    socket.on('wb:allowed-drawers', (ids) => {
      const next = new Set(ids || []);
      setAllowedDrawers(next);
      allowedDrawersRef.current = next;
    });

    socket.on('wb:theme-state', ({ isDarkMode }) => {
      setIsDarkMode(!!isDarkMode);
    });

    // Consolidated with wb:allow-user-status above

    socket.on('wb:voice-user-left', ({ userId }) => {
      if (peerConnectionsRef.current[userId]) {
        peerConnectionsRef.current[userId].close();
        delete peerConnectionsRef.current[userId];
      }
      setRemoteStreams(prev => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      setOtherCursors(prev => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    });

    socket.on('voice:speaking', ({ userId, speaking }) => {
      setActiveSpeakers(prev => {
        const next = new Set(prev);
        if (speaking) next.add(userId);
        else next.delete(userId);
        return next;
      });
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(initialTimeout);
      if (flushIntervalRef.current) clearInterval(flushIntervalRef.current);
      try { flushBuffer(); } catch (e) { }
      stopVoiceChat();
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

  // Convert a point from virtual space to canvas pixels
  const virtToPixels = (vpt, canvas) => ({
    x: (vpt.x / VIRT_W) * canvas.width,
    y: (vpt.y / VIRT_H) * canvas.height
  });

  // Convert a point from canvas pixels to virtual space
  const pixelsToVirt = (ppt, canvas) => ({
    x: (ppt.x / canvas.width) * VIRT_W,
    y: (ppt.y / canvas.height) * VIRT_H
  });

  function drawLine(prev, curr, color = '#000', width = 2, emit = true) {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;

    // prev/curr are always in virtual space when emit=false (from remote)
    // and always in canvas pixels when emit=true (from local pointer events)
    const p1virt = emit ? pixelsToVirt(prev, canvas) : prev;
    const p2virt = emit ? pixelsToVirt(curr, canvas) : curr;

    const p1 = virtToPixels(p1virt, canvas);
    const p2 = virtToPixels(p2virt, canvas);

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
      canvasHeightRef.current = newH;
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.closePath();

    if (!emit) return;
    // store in virtual space — identical on every device
    const stroke = { type: 'line', prev: p1virt, curr: p2virt, color, width, normalized: true };
    if (!stroke._id && !stroke.id) stroke._id = generateId();
    socketRef.current.emit('wb:draw', { ...stroke, persist: false });
    pushToBuffer(stroke, false); // accumulate into current stroke group; committed on pointerUp
  }

  function renderStroke(s, emit = false) {
    // s: stroke object with type.
    // All coordinates in strokes are in virtual space (VIRT_W x VIRT_H).
    const t = s.type || 'line';
    if (t === 'line') {
      // drawLine expects virtual-space coords when emit=false
      drawLine(s.prev, s.curr, s.color || '#000', s.width || 2, emit);
      return;
    }
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    // Helper: virtual → pixels
    const tp = (vpt) => ({
      x: (vpt.x / VIRT_W) * canvas.width,
      y: (vpt.y / VIRT_H) * canvas.height
    });

    if (t === 'rect') {
      const p1 = tp(s.prev);
      const p2 = tp(s.curr);
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
      const p1 = tp(s.prev);
      const p2 = tp(s.curr);
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
      const prev = tp(s.prev);
      const curr = tp(s.curr);
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
      const pos = tp(s.pos || s.prev);
      const lines = (s.text || '').split('\n');
      const fontSize = s.fontSize || 28;
      const lineHeight = fontSize * 1.25;
      
      ctx.fillStyle = s.color || (isDarkMode ? '#f1f5f9' : '#0f172a');
      ctx.font = `600 ${fontSize}px sans-serif`;
      ctx.textBaseline = 'top';
      
      lines.forEach((line, index) => {
        ctx.fillText(line, pos.x + 4, pos.y + 4 + (index * lineHeight));
      });
      return;
    }
  }

  function clearCanvas(emit = true) {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (emit) socketRef.current?.emit('wb:clear');
  }

  function getPointerPos(e) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    // Support both mouse and touch events
    const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
    
    return { 
      x: clientX - rect.left, 
      y: clientY - rect.top 
    };
  }

  function submitTextInput() {
    if (isSubmittingTextRef.current) return;
    if (!textInput.visible) return;

    if (!textInput.value.trim()) {
      setTextInput({ visible: false, x: 0, y: 0, viewportX: 0, viewportY: 0, value: '' });
      return;
    }
    isSubmittingTextRef.current = true;
    try {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      
      // Convert viewport coordinates to canvas pixels
      const canvasX = textInput.viewportX - rect.left;
      const canvasY = textInput.viewportY - rect.top;

      // convert to virtual space
      const posVirt = {
        x: (canvasX / canvas.width) * VIRT_W,
        y: (canvasY / canvas.height) * VIRT_H
      };
      const stroke = { type: 'text', pos: posVirt, text: textInput.value, color: color || (isDarkMode ? '#fff' : '#000'), fontSize: textInput.fontSize, normalized: true };
      renderStroke(stroke, false);
      socketRef.current?.emit('wb:draw', { ...stroke, persist: false });
      pushToBuffer(stroke);
      setTextInput({ visible: false, x: 0, y: 0, viewportX: 0, viewportY: 0, value: '' });
    } finally {
      isSubmittingTextRef.current = false;
    }
  }

  const handlePointerDown = (e) => {
    // Permission check using REFS for current state
    const currentAllowed = allowedDrawersRef.current;
    const canDraw = isTeacher || currentAllowed.has(socketRef.current?.id);
    if (!canDraw) return;

    // If we were typing text, commit it before starting a new action
    if (textInput.visible) {
      submitTextInput();
    }

    const pos = getPointerPos(e);
    if (tool === 'pen' || tool === 'eraser') {
      setIsDrawing(true);
      lastPosRef.current = pos;
      // Start a fresh undo group for this stroke
      currentStrokeGroupRef.current = [];
      redoStackRef.current = []; // any new draw clears the redo stack
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
      const clientX = e.nativeEvent ? e.nativeEvent.clientX : (e.clientX || 0);
      const clientY = e.nativeEvent ? e.nativeEvent.clientY : (e.clientY || 0);
      
      console.log('Whiteboard: Portal opening at', { clientX, clientY });
      toast.success('Editor Active');
      
      setTextInput({ 
        visible: true, 
        viewportX: clientX, 
        viewportY: clientY, 
        x: pos.x, 
        y: pos.y, 
        value: '', 
        fontSize: 28 
      });
    }
  };
  const handlePointerMove = (e) => {
    if (isPanning) {
      handlePan(e);
      return;
    }
    const pos = getPointerPos(e);

    // Continuous permission check
    const canDraw = isTeacher || allowedDrawersRef.current.has(socketRef.current?.id);

    if (!isDrawing) {
      // Still emit cursor for presence even if not allowed to draw
      try {
        const now = Date.now();
        if (now - lastCursorEmitRef.current > 80) {
          const canvas = canvasRef.current;
          const xNorm = (pos.x / canvas.width) * VIRT_W;
          const yNorm = (pos.y / canvas.height) * VIRT_H;
          socketRef.current?.emit('wb:cursor', { xNorm, yNorm, isTeacher: !!isTeacher });
          lastCursorEmitRef.current = now;
        }
      } catch (_) { /* ignore */ }
      return;
    }

    if (!canDraw) {
      setIsDrawing(false);
      return;
    }

    if (tool === 'pen') {
      if (!isDrawing) return;
      const prev = lastPosRef.current || pos;
      drawLine(prev, pos, color, width, true);
      lastPosRef.current = pos;
    } else if (tool === 'eraser') {
      if (!isDrawing) return;
      const prev = lastPosRef.current || pos;
      const canvas = canvasRef.current;
      // store in virtual space
      const eraseStroke = {
        type: 'erase',
        prev: { x: (prev.x / canvas.width) * VIRT_W, y: (prev.y / canvas.height) * VIRT_H },
        curr: { x: (pos.x / canvas.width) * VIRT_W, y: (pos.y / canvas.height) * VIRT_H },
        width: width * 8,
        normalized: true
      };
      renderStroke(eraseStroke, false);
      socketRef.current?.emit('wb:draw', { ...eraseStroke, persist: false });
      pushToBuffer(eraseStroke, false); // false = add to group, not directly to undo stack
      lastPosRef.current = pos;
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
    // emit cursor position in virtual space (throttled)
    try {
      const now = Date.now();
      if (now - lastCursorEmitRef.current > 80) {
        const canvas = canvasRef.current;
        // Store cursor as virtual coords so it renders at the right position on all devices
        const xNorm = (pos.x / canvas.width) * VIRT_W;
        const yNorm = (pos.y / canvas.height) * VIRT_H;
        // Include isTeacher flag so students know whose cursor to follow
        socketRef.current?.emit('wb:cursor', { xNorm, yNorm, isTeacher: !!isTeacher });
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
      lastPosRef.current = null;
      // Commit the whole stroke as one undo step
      if (currentStrokeGroupRef.current.length > 0) {
        undoStackRef.current.push([...currentStrokeGroupRef.current]);
        currentStrokeGroupRef.current = [];
      }
    } else if (tool === 'rect' || tool === 'circle') {
      const start = shapeStartRef.current;
      const end = getPointerPos(e);
      if (start && end) {
        const canvas = canvasRef.current;
        // store in virtual space
        const stroke = {
          type: tool,
          prev: { x: (start.x / canvas.width) * VIRT_W, y: (start.y / canvas.height) * VIRT_H },
          curr: { x: (end.x / canvas.width) * VIRT_W, y: (end.y / canvas.height) * VIRT_H },
          color,
          width,
          normalized: true
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

  // WebRTC Voice Communication Functions

  const startMediaChat = async (withVideo = isVideoEnabled) => {
    try {
      if (localStreamRef.current) {
        // If we already have a stream, check if we need to add video
        const currentVideoTracks = localStreamRef.current.getVideoTracks();
        let changed = false;
        if (withVideo && currentVideoTracks.length === 0) {
          const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
          const videoTrack = videoStream.getVideoTracks()[0];
          localStreamRef.current.addTrack(videoTrack);
          changed = true;
        } else if (!withVideo && currentVideoTracks.length > 0) {
          currentVideoTracks.forEach(track => {
            track.stop();
            localStreamRef.current.removeTrack(track);
          });
          changed = true;
        }

        if (changed) {
          // If we added/removed tracks, we need to update all existing peer connections
          const tracks = localStreamRef.current.getTracks();
          Object.values(peerConnectionsRef.current).forEach(pc => {
            const senders = pc.getSenders();
            tracks.forEach(track => {
              // Only add if not already there
              if (!senders.find(s => s.track === track)) {
                pc.addTrack(track, localStreamRef.current);
              }
            });
            // Also remove tracks that are no longer in the stream
            senders.forEach(sender => {
              if (sender.track && !tracks.includes(sender.track)) {
                pc.removeTrack(sender);
              }
            });
          });

          // Trigger re-negotiation for all participants
          socketRef.current?.emit('wb:voice-start');
        }
        return true;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: withVideo });
      localStreamRef.current = stream;

      // Apply initial mute/video state
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) audioTrack.enabled = !isMuted;

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) videoTrack.enabled = withVideo;

      // Initialize AudioContext and Analyser
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContextClass();
          const source = audioContextRef.current.createMediaStreamSource(stream);
          analyserRef.current = audioContextRef.current.createAnalyser();
          analyserRef.current.fftSize = 256;
          source.connect(analyserRef.current);

          volumeIntervalRef.current = setInterval(() => {
            if (!analyserRef.current || isMuted) {
              setLocalVolume(0);
              return;
            }
            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
            const average = sum / dataArray.length;
            setLocalVolume(average);

            if (average > 15 !== activeSpeakers.has(socketRef.current?.id)) {
              socketRef.current?.emit('wb:mute-status', { muted: average <= 15 });
            }
          }, 100);
        }
      } catch (e) { console.warn('AudioContext failed', e); }

      socketRef.current?.emit('wb:voice-start');
      if (withVideo) socketRef.current?.emit('wb:video-status', { enabled: true });
      return true;
    } catch (error) {
      console.error('Error starting media chat:', error);
      setIsVoiceEnabled(false);
      setIsVideoEnabled(false);
      return false;
    }
  };

  const stopVoiceChat = (emit = true) => {
    let hadStream = false;
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
      hadStream = true;
    }

    if (volumeIntervalRef.current) {
      clearInterval(volumeIntervalRef.current);
      volumeIntervalRef.current = null;
    }
    setLocalVolume(0);

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => { });
      audioContextRef.current = null;
    }
    if (gainNodeRef.current) {
      gainNodeRef.current = null;
    }

    Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
    peerConnectionsRef.current = {};

    // Only emit if we actually had an active session and emission is requested
    if (hadStream && emit) {
      socketRef.current?.emit('wb:voice-stop');
    }
  };

  const createPeerConnection = (userId) => {
    // Reuse existing connection for this user if it's still alive
    if (peerConnectionsRef.current[userId] &&
      peerConnectionsRef.current[userId].signalingState !== 'closed') {
      return peerConnectionsRef.current[userId];
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        // Add support for custom TURN servers if provided in env
        ...(import.meta.env.VITE_TURN_SERVER_URL ? [
          {
            urls: import.meta.env.VITE_TURN_SERVER_URL,
            username: import.meta.env.VITE_TURN_SERVER_USERNAME,
            credential: import.meta.env.VITE_TURN_SERVER_PASSWORD
          }
        ] : [])
      ],
      iceTransportPolicy: 'all',
      iceCandidatePoolSize: 10
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit('wb:ice-candidate', {
          targetUserId: userId,
          candidate: event.candidate.toJSON()
        });
      }
    };

    pc.ontrack = (event) => {
      console.log(`Received remote track (${event.track.kind}) from ${userId}`);
      let remoteStream = event.streams[0];

      if (!remoteStream) {
        // If track has no stream (common in some renegotiation cases), use/create one from Ref
        if (!remoteStreamsRef.current[userId]) {
          remoteStreamsRef.current[userId] = new MediaStream();
        }
        remoteStream = remoteStreamsRef.current[userId];
        remoteStream.addTrack(event.track);
      } else {
        remoteStreamsRef.current[userId] = remoteStream;
      }

      // Update remote streams state for UI rendering
      setRemoteStreams(prev => ({
        ...prev,
        [userId]: remoteStream
      }));

      // Audio specific: Ensure audio is playing if it's an audio track
      if (event.track.kind === 'audio') {
        const audio = new Audio();
        audio.srcObject = remoteStream;
        audio.autoplay = true;
        // Set slightly higher volume for remote audio
        audio.volume = 1.0;
        audio.play().catch(e => console.warn("Audio autoplay blocked:", e));
      } else if (event.track.kind === 'video') {
        console.log("Received remote video track");
        // Re-trigger remote streams update to ensure UI re-renders
        setRemoteStreams(prev => ({ ...prev }));
      }
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    peerConnectionsRef.current[userId] = pc;
    return pc;
  };

  const handleRaiseHand = () => {
    const newState = !isHandRaised;
    setIsHandRaised(newState);
    socketRef.current?.emit('wb:raise-hand', { raised: newState });
  };

  const handleExit = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    stopVoiceChat(true);
    navigate(`/classrooms/${classId}`);
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
    const next = !locked;
    setLocked(next);
    lockedRef.current = next;
    socketRef.current.emit('wb:lock', { locked: next });
  };

  // Track voice state for socket listeners to avoid stale closure issues
  const isVoiceEnabledRef = useRef(isVoiceEnabled);
  useEffect(() => {
    isVoiceEnabledRef.current = isVoiceEnabled;
  }, [isVoiceEnabled]);

  // Keep followEnabledRef in sync with state so socket callbacks see the latest value
  useEffect(() => {
    followEnabledRef.current = followEnabled;
  }, [followEnabled]);

  // Voice communication handlers
  const handleToggleVoice = async () => {
    if (isVoiceEnabled) {
      setIsVoiceEnabled(false);
      setIsVideoEnabled(false);
      await stopVoiceChat(true);
    } else {
      const success = await startMediaChat(false);
      if (success) {
        setIsVoiceEnabled(true);
      }
    }
  };

  const handleToggleVideo = async () => {
    const newState = !isVideoEnabled;
    if (!isVoiceEnabled && newState) {
      const success = await startMediaChat(true);
      if (success) {
        setIsVoiceEnabled(true);
        setIsVideoEnabled(true);
      }
    } else if (isVoiceEnabled) {
      const success = await startMediaChat(newState);
      if (success) {
        setIsVideoEnabled(newState);
        socketRef.current?.emit('wb:video-status', { enabled: newState });
        // Toggle local track visibility if already in stream
        if (localStreamRef.current) {
          const videoTrack = localStreamRef.current.getVideoTracks()[0];
          if (videoTrack) videoTrack.enabled = newState;
        }
      }
    }
  };

  const handleToggleMute = (forceState = null) => {
    // If called from onClick, forceState will be an event object or null.
    // If called from backend, it will be a boolean.
    const isExplicit = typeof forceState === 'boolean';
    const newMuteState = isExplicit ? forceState : !isMuted;

    // Prevent unmuting if mic is locked, unless it's a teacher's explicit command OR the teacher themselves
    if (!isExplicit && !newMuteState && micLocked && !isTeacher) {
      toast.error("Microphone is currently locked by teacher");
      return;
    }

    // If we're already in the desired state, skip (unless it's an explicit command we want to re-enforce)
    if (!isExplicit && newMuteState === isMuted) return;

    setIsMuted(newMuteState);
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !newMuteState;
        // Notify other users about mute status (for UI indicators)
        socketRef.current?.emit('wb:mute-status', { muted: newMuteState });
      }
    }
  };

  const handleForceMute = (targetUserId = 'all', forceState = true) => {
    if (!isTeacher) return;

    // If unmuting an individual student, mute all others first (Exclusive mode)
    if (targetUserId !== 'all' && forceState === false) {
      socketRef.current?.emit('wb:force-mute', { muteAll: true, force: true, lock: true });
    }

    socketRef.current?.emit('wb:force-mute', {
      targetUserId: targetUserId === 'all' ? null : targetUserId,
      muteAll: targetUserId === 'all',
      force: forceState,
      lock: targetUserId === 'all' ? forceState : undefined // Lock if muting all, Unlock if unmuting all
    });

    if (targetUserId === 'all') {
      setMicLocked(forceState);
    }
  };


  // ─── Page tracking & teacher viewport broadcast ───────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // For ALL users: update the page-number badge as they scroll
    let pageTick = 0;
    let viewportTick = 0;

    const onScroll = () => {
      const pageH = container.clientHeight || 1;
      const page = Math.floor(container.scrollTop / pageH) + 1;

      // Update page badge for this user (debounced)
      clearTimeout(pageTick);
      pageTick = setTimeout(() => setCurrentPage(page), 100);

      // Teacher: always broadcast scroll + page (students decide whether to follow)
      if (!isTeacher || !socketRef.current?.connected) return;
      clearTimeout(viewportTick);
      viewportTick = setTimeout(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        // scrollTopNorm = scrollTop / total canvas CSS height
        // Students apply it to their own canvas CSS height → identical fraction visible
        const canvasCSSH = canvas.clientHeight || canvas.height || 4000;
        const scrollTopNorm = canvasCSSH > 0 ? container.scrollTop / canvasCSSH : 0;
        lastBroadcastedPageRef.current = page;
        socketRef.current.emit('wb:viewport', { scrollTopNorm, page });
      }, 120);
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', onScroll);
      clearTimeout(pageTick);
      clearTimeout(viewportTick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTeacher]);

  function whiteboardSessionLocked() {
    return !!locked;
  }

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', overflow: 'hidden', background: isDarkMode ? '#0f172a' : '#f9fafb', zIndex: 100 }}>

      {/* ── Left Sidebar ── */}
      <aside style={{
        flexShrink: 0, width: 68,
        background: isDarkMode ? '#1e293b' : '#fff', borderRight: '1px solid #e5e7eb',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 4, padding: '10px 4px', overflowY: 'auto', overflowX: 'hidden', zIndex: 40,
      }}>
        {/* Drawing tools */}
        {[
          { id: 'hand',    icon: <Hand className="w-4 h-4" />,         label: 'Pan'    },
          { id: 'pointer', icon: <MousePointer className="w-4 h-4" />, label: 'Point'  },
          { id: 'pen',     icon: <Paintbrush className="w-4 h-4" />,   label: 'Pen'    },
          { id: 'eraser',  icon: <Eraser className="w-4 h-4" />,       label: 'Erase'  },
          { id: 'rect',    icon: <Square className="w-4 h-4" />,       label: 'Rect'   },
          { id: 'circle',  icon: <CircleIcon className="w-4 h-4" />,   label: 'Circle' },
          { id: 'text',    icon: <Type className="w-4 h-4" />,         label: 'Text'   },
        ].filter(t => isMobileView || t.id !== 'text').map(({ id, icon, label }) => (
          <button key={id} onClick={() => setTool(id)} title={label} style={{
            width: 52, padding: '6px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            background: tool === id ? (isDarkMode ? '#312e81' : '#eef2ff') : 'transparent',
            color: tool === id ? (isDarkMode ? '#818cf8' : '#4f46e5') : (isDarkMode ? '#94a3b8' : '#6b7280'),
            fontWeight: tool === id ? 700 : 500,
            boxShadow: tool === id ? 'inset 0 0 0 1px #c7d2fe' : 'none',
            transition: 'all 0.15s',
          }}>
            {icon}
            <span style={{ fontSize: 9, letterSpacing: '0.03em' }}>{label}</span>
          </button>
        ))}

        <div style={{ width: 48, height: 1, background: isDarkMode ? '#334155' : '#e5e7eb', margin: '4px 0', flexShrink: 0 }} />

        {/* Color palette */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, flexShrink: 0 }}>
          {['#000000', '#ef4444', '#22c55e', '#3b82f6', '#eab308', '#a855f7', '#06b6d4', '#ffffff'].map(c => (
            <button key={c} onClick={() => setColor(c)} title={c} style={{
              width: 24, height: 24, borderRadius: '50%', background: c, cursor: 'pointer',
              border: color === c ? '3px solid #4f46e5' : '2px solid #d1d5db',
              transform: color === c ? 'scale(1.15)' : 'scale(1)',
              boxShadow: color === c ? '0 0 0 2px #e0e7ff' : 'none',
              transition: 'all 0.15s',
            }} />
          ))}
        </div>

        {/* Brush size */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flexShrink: 0, padding: '0 2px', boxSizing: 'border-box' }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Size</span>
          <input
            type="range" min={1} max={24} value={width}
            onChange={e => setWidth(Number(e.target.value))}
            style={{ width: '100%', margin: 0, padding: 0, accentColor: '#4f46e5', cursor: 'pointer', display: 'block' }}
          />
          <input
            type="number" min={1} max={24} value={width}
            onChange={e => setWidth(Math.max(1, Math.min(24, Number(e.target.value) || 1)))}
            style={{
              width: 44, textAlign: 'center', border: '1px solid #e5e7eb',
              borderRadius: 6, padding: '2px 0', fontSize: 11,
              fontWeight: 700, color: '#4f46e5', outline: 'none', background: '#f9fafb'
            }}
          />
        </div>

        <div style={{ width: 48, height: 1, background: isDarkMode ? '#334155' : '#e5e7eb', margin: '4px 0', flexShrink: 0 }} />

        {/* Teacher controls */}
        {isTeacher && (<>
          <button title="Undo" onClick={() => {
            if (undoStackRef.current.length > 0) {
              const step = undoStackRef.current.pop();
              const strokes = Array.isArray(step) ? step : [step];
              redoStackRef.current.push(strokes);
              // Remove all strokes in this step from history, then redraw
              const ids = new Set(strokes.map(s => s._id || s.id).filter(Boolean));
              strokeHistoryRef.current = strokeHistoryRef.current.filter(x => !ids.has(x._id || x.id));
              strokes.forEach(s => socketRef.current?.emit('wb:remove-stroke', { strokeId: s._id || s.id }));
              redrawAll();
            }
          }}
            style={{ width: 52, padding: '6px 0', borderRadius: 10, border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'transparent', color: '#6b7280', transition: 'all 0.15s' }}>
            <Undo className="w-4 h-4" /><span style={{ fontSize: 9 }}>Undo</span>
          </button>
          <button title="Redo" onClick={() => {
            if (redoStackRef.current.length > 0) {
              const strokes = redoStackRef.current.pop();
              const arr = Array.isArray(strokes) ? strokes : [strokes];
              undoStackRef.current.push(arr);
              arr.forEach(s => { renderStroke(s, false); pushToBuffer(s, true); socketRef.current?.emit('wb:draw', { ...s, persist: false }); });
            }
          }}
            style={{ width: 52, padding: '6px 0', borderRadius: 10, border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'transparent', color: '#6b7280', transition: 'all 0.15s' }}>
            <Redo className="w-4 h-4" /><span style={{ fontSize: 9 }}>Redo</span>
          </button>
          <button title="Clear All" onClick={onClear}
            style={{ width: 52, padding: '6px 0', borderRadius: 10, border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'transparent', color: '#ef4444', transition: 'all 0.15s' }}>
            <Trash2 className="w-4 h-4" /><span style={{ fontSize: 9 }}>Clear</span>
          </button>
          <button title={locked ? 'Unlock Board' : 'Lock Board'} onClick={onToggleLock}
            style={{ width: 52, padding: '6px 0', borderRadius: 10, border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: locked ? '#1f2937' : 'transparent', color: locked ? '#fff' : '#6b7280', transition: 'all 0.15s' }}>
            {locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            <span style={{ fontSize: 9 }}>{locked ? 'Locked' : 'Lock'}</span>
          </button>

          <div style={{ position: 'relative' }}>
            <button title="Selective Participation" onClick={() => setShowParticipants(!showParticipants)}
              style={{ width: 52, padding: '6px 0', borderRadius: 10, border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: showParticipants ? '#eef2ff' : 'transparent', color: showParticipants ? '#4f46e5' : '#6b7280', transition: 'all 0.15s' }}>
              <Users className="w-4 h-4" /><span style={{ fontSize: 9 }}>Students</span>
            </button>

            {showParticipants && (
              <div style={{ 
                position: 'fixed', 
                left: 72, 
                top: 120, 
                width: 260, 
                background: isDarkMode ? '#1e293b' : '#fff', 
                border: isDarkMode ? '1px solid #334155' : '1px solid #e5e7eb', 
                borderRadius: 12, 
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', 
                zIndex: 1000, 
                padding: 12, 
                display: 'flex', 
                flexDirection: 'column' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexShrink: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Selective Unlock</div>
                  <button onClick={() => setShowParticipants(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#9ca3af', padding: 4 }}>✕</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '60vh', overflowY: 'auto', paddingRight: 4, scrollBehavior: 'smooth' }}>
                  {Object.keys(otherCursors).length === 0 ? (
                    <div style={{ fontSize: 11, fontStyle: 'italic', color: '#9ca3af', textAlign: 'center', padding: '30px 0' }}>No other students joined</div>
                  ) : (
                    Object.keys(otherCursors).map(sid => {
                      const p = otherCursors[sid];
                      const isAllowed = allowedDrawers.has(sid);
                      return (
                        <div key={sid} style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between', 
                          padding: '8px 10px', 
                          borderRadius: 8, 
                          background: isAllowed 
                            ? (isDarkMode ? '#312e81' : '#f5f7ff') 
                            : (isDarkMode ? '#334155' : '#f9fafb'), 
                          border: isAllowed 
                            ? (isDarkMode ? '1px solid #4338ca' : '1px solid #e0e7ff') 
                            : '1px solid transparent' 
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: p.color || '#000', border: '2px solid #fff', boxShadow: '0 0 0 1px #e5e7eb' }} />
                            <span style={{ 
                              fontSize: 12, 
                              fontWeight: 600, 
                              color: isDarkMode ? '#f1f5f9' : '#374151', 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis', 
                              whiteSpace: 'nowrap' 
                            }}>{p.name}</span>
                          </div>
                          <button
                            onClick={() => socketRef.current?.emit('wb:allow-user', { targetSocketId: sid, allowed: !isAllowed })}
                            title={isAllowed ? 'Revoke Drawing' : 'Allow Drawing'}
                            style={{ 
                              padding: 8, 
                              borderRadius: 10, 
                              border: 'none', 
                              cursor: 'pointer', 
                              background: isAllowed ? '#4f46e5' : (isDarkMode ? '#1e293b' : '#f1f5f9'), 
                              color: isAllowed ? '#fff' : (isDarkMode ? '#94a3b8' : '#94a3b8'),
                              boxShadow: isAllowed ? '0 4px 12px -2px rgba(79, 70, 229, 0.4)' : 'none',
                              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center'
                            }}
                          >
                            <Pencil className={`w-3.5 h-3.5 ${isAllowed ? 'scale-110' : 'scale-100 opacity-70'}`} />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </>)}

        {/* Student controls — shown immediately after tools so they're always visible */}
        {!isTeacher && (<>
          <button onClick={() => setFollowEnabled(f => !f)} title={followEnabled ? `Stop following · Pg ${currentPage}` : 'Follow teacher — view syncs to their page'}
            style={{ width: 52, padding: '6px 0', borderRadius: 10, border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: followEnabled ? '#4f46e5' : '#eef2ff', color: followEnabled ? '#fff' : '#4f46e5', transition: 'all 0.15s', boxShadow: followEnabled ? '0 0 0 2px #818cf8' : 'none' }}>
            {followEnabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            <span style={{ fontSize: 9, fontWeight: 700 }}>{followEnabled ? `Pg ${currentPage}` : 'Follow'}</span>
          </button>
          <button onClick={handleRaiseHand} title={isHandRaised ? 'Lower Hand' : 'Raise Hand'}
            style={{ width: 52, padding: '6px 0', borderRadius: 10, border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: isHandRaised ? '#f59e0b' : 'transparent', color: isHandRaised ? '#fff' : '#6b7280', transition: 'all 0.15s' }}>
            <Hand className={`w-4 h-4 ${isHandRaised ? 'animate-bounce' : ''}`} />
            <span style={{ fontSize: 9 }}>{isHandRaised ? 'Raised' : 'Hand'}</span>
          </button>
        </>)}

        {/* Night Mode Toggle */}
        <button onClick={() => {
          if (!isTeacher) return;
          const next = !isDarkMode;
          setIsDarkMode(next);
          socketRef.current?.emit('wb:theme', { isDarkMode: next });
        }} title={isDarkMode ? 'Light Mode' : 'Night Mode'}
          style={{ 
            width: 52, padding: '6px 0', borderRadius: 10, border: 'none', 
            cursor: isTeacher ? 'pointer' : 'default', 
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, 
            background: isDarkMode ? '#1e293b' : 'transparent', color: isDarkMode ? '#fbbf24' : '#64748b', 
            transition: 'all 0.15s', flexShrink: 0,
            opacity: isTeacher ? 1 : 0.8
          }}>
          {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          <span style={{ fontSize: 9 }}>{isDarkMode ? 'Light' : 'Night'}</span>
        </button>

        {/* Spacer */}
        <div style={{ flex: 1, minHeight: 8 }} />

        {/* Status badges */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 999, background: locked ? '#fee2e2' : '#dcfce7', color: locked ? '#b91c1c' : '#166534', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
            {locked ? 'Locked' : 'Open'}
          </div>
          <div style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 999, background: '#f3f4f6', color: '#4b5563' }}>
            Pg {currentPage}
          </div>
        </div>

        {/* Export */}
        <button onClick={onExportPNG} title="Export PNG" style={{ width: 52, padding: '6px 0', borderRadius: 10, border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'transparent', color: '#4f46e5', transition: 'all 0.15s', flexShrink: 0 }}>
          <Download className="w-4 h-4" /><span style={{ fontSize: 9 }}>Export</span>
        </button>

        {/* Exit */}
        <button onClick={handleExit} title="Exit Whiteboard" style={{ width: 52, padding: '6px 0', borderRadius: 10, border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: '#fff1f2', color: '#e11d48', transition: 'all 0.15s', flexShrink: 0 }}>
          <LogOut className="w-4 h-4" /><span style={{ fontSize: 9 }}>Exit</span>
        </button>
      </aside>

      {/* ── Canvas draw area ── */}
      <div
        ref={containerRef}
        style={{ 
          flex: '1 1 0', 
          overflow: 'auto', 
          position: 'relative', 
          minWidth: 0, 
          background: isDarkMode ? '#0f172a' : '#f9fafb',
          transition: 'background-color 0.3s ease',
          touchAction: 'none' // Prevent mobile scrolling gestures from interrupting canvas drawing
        }}
        className={tool === 'hand' ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : tool === 'pointer' ? 'cursor-default' : 'cursor-crosshair'}
      >
        <canvas
          ref={canvasRef}
          style={{ 
            width: '100%', 
            height: `${canvasHeightRef.current}px`, 
            border: isDarkMode ? '1px solid #1e293b' : '1px solid #e5e7eb', 
            touchAction: 'none', 
            display: 'block', 
            background: isDarkMode ? '#0f172a' : '#fff',
            filter: isDarkMode ? 'brightness(1.1)' : 'none'
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
        {/* Overlay canvas for shape previews */}
        <canvas ref={overlayRef} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', width: '100%', height: `${canvasHeightRef.current}px` }} />


        {/* Other users' cursors */}
        {Object.keys(otherCursors).map((id) => {
          const c = otherCursors[id];
          if (!c || (Date.now() - (c.lastSeen || 0) > 8000)) return null;
          const canvas = canvasRef.current;
          const container = containerRef.current;
          if (!canvas || !container) return null;
          const canvasCSSW = canvas.clientWidth  || canvas.width;
          const canvasCSSH = canvas.clientHeight || canvas.height;
          const px = (c.xNorm / VIRT_W) * canvasCSSW;
          const py = (c.yNorm / VIRT_H) * canvasCSSH;
          const isSpeaking = activeSpeakers.has(id);
          return (
            <div key={id} style={{ position: 'absolute', left: px + 8, top: py - 8, pointerEvents: 'none', zIndex: 40 }}>
              <div className={`transition-all duration-300 ${isSpeaking ? 'ring-4 ring-green-400 ring-offset-2 scale-110' : ''}`}
                style={{ background: c.color || '#000', color: '#fff', padding: '2px 6px', borderRadius: 6, fontSize: 12, whiteSpace: 'nowrap' }}>
                {c.name}{isSpeaking && <span className="ml-1">🔊</span>}
              </div>
              <div style={{ width: 8, height: 8, background: c.color || '#000', borderRadius: '50%', marginTop: 4 }} />
            </div>
          );
        })}
      </div>

      {/* RENDER TEXT EDITOR VIA PORTAL AT BODY LEVEL FOR MAXIMUM RELIABILITY */}
      {textInput.visible && createPortal(
        <div style={{ 
          position: 'fixed', 
          inset: 0, 
          zIndex: 999998, 
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <textarea
            ref={inputRef}
            placeholder="Type and press Enter..."
            autoFocus
            value={textInput.value}
            onChange={(e) => setTextInput(t => ({ ...t, value: e.target.value }))}
            onKeyDown={(e) => { 
                if (e.key === 'Enter' && !e.shiftKey) { 
                    e.preventDefault(); 
                    submitTextInput(); 
                }
                if (e.key === 'Escape') {
                    setTextInput({ visible: false, x: 0, y: 0, viewportX: 0, viewportY: 0, value: '' });
                }
                e.stopPropagation(); 
            }}
            onBlur={() => submitTextInput()}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            style={{ 
              position: 'fixed', 
              left: `${textInput.viewportX}px`, 
              top: `${textInput.viewportY}px`, 
              zIndex: 999999, 
              fontSize: '28px', 
              minWidth: '380px',
              minHeight: '160px',
              color: '#0f172a',
              backgroundColor: '#ffffff',
              border: '5px solid #4f46e5',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 30px 60px rgba(0,0,0,0.4), 0 0 0 10px rgba(79, 70, 229, 0.1)',
              fontFamily: 'sans-serif',
              lineHeight: '1.4',
              transform: 'translate(-20px, -40px)',
              resize: 'both',
              outline: 'none',
              pointerEvents: 'auto',
              display: 'block',
              visibility: 'visible',
              opacity: 1
            }}
          />
        </div>,
        document.body
      )}
    </div>
  );
}

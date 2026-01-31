const dotenv = require('dotenv');
dotenv.config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const whiteboardSessions = require('./whiteboardSessions');
const User = require('./models/User');
const Classroom = require('./models/Classroom');
const Whiteboard = require('./models/Whiteboard');
const { startScheduler } = require('./utils/scheduler');
const path = require('path');

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');

const app = express();

// Load models to ensure they are registered with Mongoose
require('./models/User');
require('./models/Classroom');
require('./models/Assignment');
require('./models/Topic');
require('./models/Payment');
require('./models/Notification');
require('./models/School');
require('./models/Tutorial');
require('./models/SubscriptionPlan');
require('./models/UserSubscription');

// Security Middlewares
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false, // Disable CSP for now as it can be very restrictive with third-party scripts/fonts
})); // Sets various security-related HTTP headers
app.use(mongoSanitize()); // Prevent NoSQL injection attacks

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { message: 'Too many requests from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:5173',
  'https://gracified-lms.vercel.app',
  'https://gracified-lms.onrender.com'
].filter(Boolean).flatMap(url => [url, url.endsWith('/') ? url.slice(0, -1) : url + '/']);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked for origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '10kb' })); // Body limit to prevent large payload attacks
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Apply rate limiting to authentication routes
app.use('/api/auth', authLimiter);
app.use('/api/google-auth', authLimiter);

// Basic health check and root routes
app.get('/', (req, res) => {
  res.json({ status: 'OK', message: 'LMS API is running at /api' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'LMS API is running' });
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/classrooms', require('./routes/classrooms'));
app.use('/api/topics', require('./routes/topics'));
app.use('/api/assignments', require('./routes/assignments'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/zoom', require('./routes/zoom'));
app.use('/api/whiteboard', require('./routes/whiteboard'));
app.use('/api/notifications/inapp', require('./routes/notifications-inapp'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/schools', require('./routes/schools'));
app.use('/api/subscription-plans', require('./routes/subscriptionPlans')); // New subscription plans route
app.use('/api/user-subscriptions', require('./routes/userSubscriptions')); // New user subscriptions route
app.use('/api/settings', require('./routes/settings'));
app.use('/api/disbursements', require('./routes/disbursements'));
const googleAuthRouter = require('./routes/googleAuth');
app.use('/api/google-auth', googleAuthRouter);
app.use('/api/reports', require('./routes/reports'));

// Connect to MongoDB
const connectDB = async () => {
  try {
    // Fix case sensitivity issue - use lowercase 'lms'
    let mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';
    mongoUri = mongoUri.replace(/\/LMS$/, '/lms');

    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB Connected');
  } catch (error) {
    if (error.message.includes('ENOTFOUND')) {
      console.error('MongoDB connection error: Could not resolve DNS. Check your internet connection or MongoDB URI.');
    } else {
      console.error('MongoDB connection error:', error.message);
    }
    process.exit(1);
  }
};

connectDB().then(() => {
  // Start the background scheduler for class reminders
  startScheduler();
});

const PORT = process.env.PORT || 5000;

// create http server and attach socket.io
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Authenticate socket connections using JWT token sent in handshake auth
io.use(async (socket, next) => {
  try {
    const tokenRaw = socket.handshake.auth?.token || socket.handshake.headers?.authorization || '';
    const token = tokenRaw.replace(/^Bearer\s+/i, '');
    if (!token) return next(new Error('Authentication error: No token provided'));

    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET not configured');
      return next(new Error('Internal server error'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) return next(new Error('Authentication error: User not found'));
    socket.data.user = user;
    return next();
  } catch (err) {
    console.error('Socket auth error:', err.message);
    return next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  // client joins a whiteboard session for a class
  socket.on('wb:join', async ({ classId }) => {
    try {
      if (!classId) return;
      // determine teacher status: either user's role or explicit teacherId match
      let isTeacher = ['teacher', 'personal_teacher', 'school_admin', 'root_admin', 'admin'].includes(socket.data.user.role);
      try {
        const classroom = await Classroom.findById(classId);
        if (classroom && classroom.teacherId && classroom.teacherId.toString() === socket.data.user._id.toString()) {
          isTeacher = true;
        }
      } catch (e) {
        // ignore classroom lookup errors
      }

      console.log(`Whiteboard session join: classId=${classId}, user=${socket.data.user?.email} (${socket.data.user?._id})`);
      const sessionId = whiteboardSessions.addClient(classId, socket.id);
      socket.join(sessionId);

      // Update Classroom whiteboard activity in DB for multi-instance discovery
      await Classroom.findByIdAndUpdate(classId, { whiteboardActiveAt: new Date() });

      // Start a heartbeat for this socket/session to keep DB status active
      const heartbeat = setInterval(async () => {
        try {
          await Classroom.findByIdAndUpdate(classId, { whiteboardActiveAt: new Date() });
        } catch (e) { }
      }, 2 * 60 * 1000); // every 2 mins
      socket._wbHeartbeat = heartbeat;

      // assign a display color for presence cursor
      const color = `hsl(${Math.floor(Math.abs(hashCode(socket.data.user._id.toString())) % 360)},70%,40%)`;
      socket.data = { ...socket.data, classId, sessionId, isTeacher: !!isTeacher, color };
      io.to(sessionId).emit('wb:user-joined', { socketId: socket.id, active: whiteboardSessions.getActiveCount(classId) });
      const locked = whiteboardSessions.isLocked(classId);
      const follow = whiteboardSessions.isFollow(classId);
      socket.emit('wb:lock-state', { locked });
      socket.emit('wb:follow-state', { follow });
      socket.emit('wb:voice-state', { enabled: whiteboardSessions.isVoiceEnabled(classId) });
      // send persisted history to the newly joined socket
      try {
        const wb = await Whiteboard.findOne({ classId });
        if (wb && wb.strokes && wb.strokes.length > 0) {
          socket.emit('wb:history', wb.strokes);
        }
      } catch (err) {
        console.error('Error fetching whiteboard history', err.message);
      }
    } catch (err) {
      console.error('wb:join error', err);
    }
  });

  // receive cursor positions from clients and broadcast to room
  socket.on('wb:cursor', ({ xNorm, yNorm }) => {
    const { classId, sessionId } = socket.data || {};
    if (!classId || !sessionId) return;
    const payload = {
      socketId: socket.id,
      xNorm,
      yNorm,
      name: socket.data.user ? (socket.data.user.name || socket.data.user.email || 'User') : 'User',
      color: socket.data.color || '#000'
    };
    socket.to(sessionId).emit('wb:cursor', payload);
  });

  // teacher broadcasts viewport; when locked this enforces viewer positions
  socket.on('wb:viewport', ({ scrollTopNorm }) => {
    const { classId, sessionId } = socket.data || {};
    if (!classId || !sessionId) return;
    // only allow teacher to broadcast viewport
    if (!socket.data.isTeacher) return;
    // only broadcast when follow mode is enabled
    if (!whiteboardSessions.isFollow(classId)) return;
    io.to(sessionId).emit('wb:viewport', { scrollTopNorm, teacherSocketId: socket.id });
  });

  // teacher toggles follow mode for the session
  socket.on('wb:follow', ({ follow }) => {
    const { classId, sessionId } = socket.data || {};
    if (!classId || !sessionId) return;
    if (!socket.data.isTeacher) return;
    whiteboardSessions.follow(classId, !!follow);
    io.to(sessionId).emit('wb:follow-state', { follow: !!follow });
  });

  socket.on('wb:leave', () => {
    if (socket._wbHeartbeat) clearInterval(socket._wbHeartbeat);
    const { classId, sessionId } = socket.data || {};
    if (!classId) return;
    whiteboardSessions.removeClient(classId, socket.id);
    const s = whiteboardSessions.getSession(classId);
    const active = s ? s.clients.size : 0;
    if (s) io.to(s.sessionId).emit('wb:user-left', { socketId: socket.id, active });
    socket.leave(sessionId || socket.id);
  });

  socket.on('wb:draw', (data) => {
    const { classId, sessionId } = socket.data || {};
    if (!classId || !sessionId) return;
    if (whiteboardSessions.isLocked(classId) && !socket.data.isTeacher) return;
    socket.to(sessionId).emit('wb:draw', data);
    // persist stroke unless client marks it as ephemeral (we support client-side batching)
    if (!data || data.persist !== false) {
      (async () => {
        try {
          const stroke = {
            ...(data || {}),
            _id: data && (data.id || data._id) ? (data.id || data._id) : randomUUID(),
            userId: socket.data.user ? socket.data.user._id : null,
            ts: new Date(),
          };
          await Whiteboard.findOneAndUpdate(
            { classId },
            { $push: { strokes: stroke } },
            { upsert: true }
          );
        } catch (err) {
          console.error('Error persisting stroke', err.message);
        }
      })();
    }
  });

  // receive bulk strokes (client-side batching flush)
  socket.on('wb:draw-bulk', (payload) => {
    const { strokes } = payload || {};
    const { classId, sessionId } = socket.data || {};
    if (!classId || !sessionId) return;
    if (!Array.isArray(strokes) || strokes.length === 0) return;
    if (whiteboardSessions.isLocked(classId) && !socket.data.isTeacher) return;
    // NOTE: do not re-broadcast bulk strokes (clients already received real-time per-stroke events)
    // persist in bulk
    (async () => {
      try {
        const strokesToSave = strokes.map(s => ({
          ...s,
          _id: s && (s.id || s._id) ? (s.id || s._id) : randomUUID(),
          userId: socket.data.user ? socket.data.user._id : null,
          ts: s.ts ? new Date(s.ts) : new Date(),
        }));
        await Whiteboard.updateOne(
          { classId },
          { $push: { strokes: { $each: strokesToSave } } },
          { upsert: true }
        );
      } catch (err) {
        console.error('Error persisting bulk strokes', err.message);
      }
    })();
  });

  // remove a stroke (undo) - validated by creator or teacher
  socket.on('wb:remove-stroke', async ({ strokeId }) => {
    const { classId, sessionId } = socket.data || {};
    if (!classId || !sessionId || !strokeId) return;
    try {
      // find the stroke owner
      const wb = await Whiteboard.findOne({ classId, 'strokes._id': strokeId }, { 'strokes.$': 1 });
      if (!wb || !wb.strokes || wb.strokes.length === 0) return;
      const stroke = wb.strokes[0];
      const ownerId = stroke.userId ? stroke.userId.toString() : null;
      const requesterId = socket.data.user ? socket.data.user._id.toString() : null;
      const allowed = socket.data.isTeacher || (ownerId && requesterId && ownerId === requesterId);
      if (!allowed) return;
      await Whiteboard.updateOne({ classId }, { $pull: { strokes: { _id: strokeId } } });
      const s = whiteboardSessions.getSession(classId);
      if (s) io.to(s.sessionId).emit('wb:remove-stroke', { strokeId });
    } catch (err) {
      console.error('Error removing stroke', err.message);
    }
  });

  socket.on('wb:clear', () => {
    const { classId } = socket.data || {};
    if (!classId) return;
    if (!socket.data.isTeacher) return;
    const s = whiteboardSessions.getSession(classId);
    if (s) io.to(s.sessionId).emit('wb:clear');
    // clear persisted strokes
    (async () => {
      try {
        await Whiteboard.findOneAndUpdate({ classId }, { $set: { strokes: [] } }, { upsert: true });
      } catch (err) {
        console.error('Error clearing persisted strokes', err.message);
      }
    })();
  });

  socket.on('wb:lock', ({ locked }) => {
    const { classId } = socket.data || {};
    if (!classId) return;
    if (!socket.data.isTeacher) return;
    whiteboardSessions.lock(classId, !!locked);
    const s = whiteboardSessions.getSession(classId);
    if (s) io.to(s.sessionId).emit('wb:lock-state', { locked: !!locked });
  });

  // Voice Communication Handlers
  socket.on('wb:voice-start', () => {
    const { classId, sessionId } = socket.data || {};
    if (!classId || !sessionId) return;

    console.log(`User ${socket.id} joining voice in class ${classId}`);

    // If teacher joins, enable globally
    if (socket.data.isTeacher) {
      whiteboardSessions.setVoiceEnabled(classId, true);
      socket.to(sessionId).emit('wb:voice-state', { enabled: true });
    }

    // Notify others that this user joined voice signaling
    socket.to(sessionId).emit('wb:voice-user-joined', { userId: socket.id });
  });

  socket.on('wb:voice-stop', () => {
    const { classId, sessionId } = socket.data || {};
    if (!classId || !sessionId) return;

    console.log(`User ${socket.id} leaving voice in class ${classId}`);

    // If teacher stops voice, disable globally for everyone
    if (socket.data.isTeacher) {
      whiteboardSessions.setVoiceEnabled(classId, false);
      socket.to(sessionId).emit('wb:voice-state', { enabled: false });
    }

    // Notify others that this user left voice signaling
    socket.to(sessionId).emit('wb:voice-user-left', { userId: socket.id });
  });

  socket.on('wb:sdp-offer', ({ targetUserId, sdp }) => {
    const { classId } = socket.data || {};
    if (!classId) return;
    console.log(`SDP offer from ${socket.id} to ${targetUserId}`);
    io.to(targetUserId).emit('wb:sdp-offer', { senderUserId: socket.id, sdp });
  });

  socket.on('wb:sdp-answer', ({ targetUserId, sdp }) => {
    const { classId } = socket.data || {};
    if (!classId) return;
    console.log(`SDP answer from ${socket.id} to ${targetUserId}`);
    io.to(targetUserId).emit('wb:sdp-answer', { senderUserId: socket.id, sdp });
  });

  socket.on('wb:ice-candidate', ({ targetUserId, candidate }) => {
    const { classId } = socket.data || {};
    if (!classId) return;
    console.log(`ICE candidate from ${socket.id} to ${targetUserId}`);
    io.to(targetUserId).emit('wb:ice-candidate', { senderUserId: socket.id, candidate });
  });

  socket.on('wb:mute-status', ({ muted }) => {
    const { classId, sessionId } = socket.data || {};
    if (!classId || !sessionId) return;
    console.log(`User ${socket.id} ${muted ? 'muted' : 'unmuted'}`);
    socket.to(sessionId).emit('voice:speaking', { userId: socket.id, speaking: !muted });
  });

  socket.on('disconnect', () => {
    if (socket._wbHeartbeat) clearInterval(socket._wbHeartbeat);
    const { classId } = socket.data || {};
    if (!classId) return;
    whiteboardSessions.removeClient(classId, socket.id);
    const s = whiteboardSessions.getSession(classId);
    const active = s ? s.clients.size : 0;
    if (s) io.to(s.sessionId).emit('wb:user-left', { socketId: socket.id, active });
  });
});

// small deterministic hash for consistent HSL color generation
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  const status = err.status || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'An internal server error occurred.'
    : err.message;

  res.status(status).json({ message });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


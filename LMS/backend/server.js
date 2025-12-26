const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const whiteboardSessions = require('./whiteboardSessions');
const User = require('./models/User');
const Classroom = require('./models/Classroom');

dotenv.config();

const app = express();

// Load models to ensure they are registered with Mongoose
require('./models/User');
require('./models/Classroom');
require('./models/Assignment');
require('./models/Topic');
require('./models/Payment');
require('./models/Notification');
require('./models/School'); // Load School model
require('./models/Tutorial'); // Load Tutorial model
require('./models/SubscriptionPlan'); // Load SubscriptionPlan model
require('./models/UserSubscription'); // Load UserSubscription model

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/classrooms', require('./routes/classrooms'));
app.use('/api/topics', require('./routes/topics'));
app.use('/api/assignments', require('./routes/assignments'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/zoom', require('./routes/zoom'));
app.use('/api/whiteboard', require('./routes/whiteboard'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/notifications/inapp', require('./routes/notifications-inapp'));
app.use('/api/schools', require('./routes/schools'));
app.use('/api/subscription-plans', require('./routes/subscriptionPlans')); // New subscription plans route
app.use('/api/user-subscriptions', require('./routes/userSubscriptions')); // New user subscriptions route

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'LMS API is running' });
});

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
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

connectDB();

const PORT = process.env.PORT || 5000;

// create http server and attach socket.io
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Authenticate socket connections using JWT token sent in handshake auth
io.use(async (socket, next) => {
  try {
    const tokenRaw = socket.handshake.auth?.token || socket.handshake.headers?.authorization || '';
    const token = tokenRaw.replace(/^Bearer\s+/i, '');
    if (!token) return next(new Error('Authentication error: No token provided'));
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
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
      let isTeacher = ['teacher', 'personal_teacher', 'school_admin', 'root_admin'].includes(socket.data.user.role);
      try {
        const classroom = await Classroom.findById(classId);
        if (classroom && classroom.teacherId && classroom.teacherId.toString() === socket.data.user._id.toString()) {
          isTeacher = true;
        }
      } catch (e) {
        // ignore classroom lookup errors
      }
      const sessionId = whiteboardSessions.addClient(classId, socket.id);
      socket.join(sessionId);
      socket.data = { ...socket.data, classId, sessionId, isTeacher: !!isTeacher };
      io.to(sessionId).emit('wb:user-joined', { socketId: socket.id, active: whiteboardSessions.getActiveCount(classId) });
      const locked = whiteboardSessions.isLocked(classId);
      socket.emit('wb:lock-state', { locked });
    } catch (err) {
      console.error('wb:join error', err);
    }
  });

  socket.on('wb:leave', () => {
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
  });

  socket.on('wb:clear', () => {
    const { classId } = socket.data || {};
    if (!classId) return;
    if (!socket.data.isTeacher) return;
    const s = whiteboardSessions.getSession(classId);
    if (s) io.to(s.sessionId).emit('wb:clear');
  });

  socket.on('wb:lock', ({ locked }) => {
    const { classId } = socket.data || {};
    if (!classId) return;
    if (!socket.data.isTeacher) return;
    whiteboardSessions.lock(classId, !!locked);
    const s = whiteboardSessions.getSession(classId);
    if (s) io.to(s.sessionId).emit('wb:lock-state', { locked: !!locked });
  });

  socket.on('disconnect', () => {
    const { classId } = socket.data || {};
    if (!classId) return;
    whiteboardSessions.removeClient(classId, socket.id);
    const s = whiteboardSessions.getSession(classId);
    const active = s ? s.clients.size : 0;
    if (s) io.to(s.sessionId).emit('wb:user-left', { socketId: socket.id, active });
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


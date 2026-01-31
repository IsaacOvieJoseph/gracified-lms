const { v4: uuidv4 } = require('uuid');

class WhiteboardSessions {
  constructor() {
    // Map classroomId -> session object
    this.sessions = {};
    this.expirationMs = 5 * 60 * 1000; // 5 minutes
  }

  getOrCreateSession(classId) {
    const existing = this.sessions[classId];
    if (existing && existing.clients.size > 0) return existing;
    const sessionId = uuidv4();
    const s = {
      sessionId,
      clients: new Set(),
      createdAt: Date.now(),
      locked: false,
      follow: false, // when true, students follow teacher viewport/cursor
      voiceEnabled: false,
    };
    this.sessions[classId] = s;
    return s;
  }

  setVoiceEnabled(classId, enabled) {
    const s = this.sessions[classId];
    if (s) s.voiceEnabled = !!enabled;
  }

  isVoiceEnabled(classId) {
    const s = this.sessions[classId];
    return s ? !!s.voiceEnabled : false;
  }

  getSession(classId) {
    return this.sessions[classId] || null;
  }

  addClient(classId, socketId) {
    const s = this.getOrCreateSession(classId);
    s.clients.add(socketId);
    return s.sessionId;
  }

  removeClient(classId, socketId) {
    const s = this.sessions[classId];
    if (!s) return;
    s.clients.delete(socketId);
    if (s.clients.size === 0) {
      // schedule cleanup after expiration
      const createdAt = s.createdAt;
      setTimeout(() => {
        const cur = this.sessions[classId];
        if (cur && cur.clients.size === 0 && Date.now() - createdAt >= this.expirationMs) {
          delete this.sessions[classId];
        }
      }, this.expirationMs);
    }
  }

  getActiveCount(classId) {
    const s = this.sessions[classId];
    return s ? s.clients.size : 0;
  }

  lock(classId, locked) {
    const s = this.sessions[classId];
    if (!s) return;
    s.locked = !!locked;
  }

  isLocked(classId) {
    const s = this.sessions[classId];
    return s ? !!s.locked : false;
  }

  follow(classId, follow) {
    const s = this.sessions[classId];
    if (!s) return;
    s.follow = !!follow;
  }

  isFollow(classId) {
    const s = this.sessions[classId];
    return s ? !!s.follow : false;
  }
}

module.exports = new WhiteboardSessions();

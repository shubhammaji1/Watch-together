const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve static files
app.use(express.static('public'));

// In-memory storage for rooms
const rooms = new Map();
const userRooms = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join or create room
  socket.on('join-room', (roomId) => {
    // Leave previous room if any
    const previousRoom = userRooms.get(socket.id);
    if (previousRoom) {
      socket.leave(previousRoom);
      const room = rooms.get(previousRoom);
      if (room) {
        room.users = room.users.filter(id => id !== socket.id);
        if (room.users.length === 0) {
          rooms.delete(previousRoom);
        } else {
          socket.to(previousRoom).emit('user-left', socket.id);
        }
      }
    }

    // Join new room
    socket.join(roomId);
    userRooms.set(socket.id, roomId);

    // Initialize room if it doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        users: [],
        videoUrl: null,
        videoState: { currentTime: 0, isPlaying: false }
      });
    }

    const room = rooms.get(roomId);
    
    // Check room capacity
    if (room.users.length >= 2) {
      socket.emit('room-full');
      return;
    }

    room.users.push(socket.id);
    
    // Notify others in room
    socket.to(roomId).emit('user-joined', socket.id);
    
    // Send room info to new user
    socket.emit('room-joined', {
      roomId,
      users: room.users,
      videoUrl: room.videoUrl,
      videoState: room.videoState
    });

    console.log(`User ${socket.id} joined room ${roomId}. Room has ${room.users.length} users.`);
  });

  // Handle chat messages
socket.on('chat-message', (data) => {
  const roomId = userRooms.get(socket.id);
  if (roomId) {
    io.to(roomId).emit('chat-message', {
      sender: socket.id,
      message: data.message,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  }
});
  // Handle WebRTC signaling
  socket.on('offer', (data) => {
    socket.to(data.target).emit('offer', {
      offer: data.offer,
      sender: socket.id
    });
  });

  socket.on('answer', (data) => {
    socket.to(data.target).emit('answer', {
      answer: data.answer,
      sender: socket.id
    });
  });

  socket.on('ice-candidate', (data) => {
    socket.to(data.target).emit('ice-candidate', {
      candidate: data.candidate,
      sender: socket.id
    });
  });

  // Handle video URL updates
  socket.on('video-url-change', (data) => {
    const roomId = userRooms.get(socket.id);
    if (roomId) {
      const room = rooms.get(roomId);
      if (room) {
        room.videoUrl = data.url;
        socket.to(roomId).emit('video-url-change', { url: data.url });
      }
    }
  });

  // Handle video state sync
  socket.on('video-state-change', (data) => {
    const roomId = userRooms.get(socket.id);
    if (roomId) {
      const room = rooms.get(roomId);
      if (room) {
        room.videoState = data.state;
        socket.to(roomId).emit('video-state-change', { 
          state: data.state,
          sender: socket.id 
        });
      }
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    const roomId = userRooms.get(socket.id);
    if (roomId) {
      const room = rooms.get(roomId);
      if (room) {
        room.users = room.users.filter(id => id !== socket.id);
        socket.to(roomId).emit('user-left', socket.id);
        
        if (room.users.length === 0) {
          rooms.delete(roomId);
        }
      }
      userRooms.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});
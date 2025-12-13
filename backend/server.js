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

  // ========== VIDEO CALL SIGNALING (NEW) ==========
  
  // Handle video call offer - broadcast to other users in the room
  socket.on('video-call-offer', (data) => {
    try {
      const { roomId, offer, from } = data;
      const userRoom = userRooms.get(socket.id);
      
      // Use roomId from data or from user's current room
      const targetRoom = roomId || userRoom;
      
      if (!targetRoom) {
        console.error('❌ No room found for video call offer from', socket.id);
        return;
      }
      
      console.log(`📹 Video call offer from ${from || socket.id} in room ${targetRoom}`);
      
      // Broadcast to all other users in the room (except sender)
      socket.to(targetRoom).emit('video-call-offer', {
        offer,
        from: from || socket.id,
      });
      
      console.log(`✅ Offer forwarded to room ${targetRoom}`);
    } catch (error) {
      console.error('❌ Error handling video-call-offer:', error);
    }
  });

  // Handle video call answer - forward to other users in the room
  socket.on('video-call-answer', (data) => {
    try {
      const { roomId, answer, to, from } = data;
      const userRoom = userRooms.get(socket.id);
      
      // Use roomId from data or from user's current room
      const targetRoom = roomId || userRoom;
      
      if (!targetRoom) {
        console.error('❌ No room found for video call answer from', socket.id);
        return;
      }
      
      console.log(`📹 Video call answer from ${from || socket.id} to ${to || 'all'} in room ${targetRoom}`);
      
      // Forward to all other users in the room (except sender)
      // Since we don't have direct user mapping, broadcast to all in room
      socket.to(targetRoom).emit('video-call-answer', {
        answer,
        from: from || socket.id,
      });
      
      console.log(`✅ Answer forwarded to room ${targetRoom}`);
    } catch (error) {
      console.error('❌ Error handling video-call-answer:', error);
    }
  });

  // Handle ICE candidates - forward between users
  socket.on('video-call-ice-candidate', (data) => {
    try {
      const { roomId, candidate } = data;
      const userRoom = userRooms.get(socket.id);
      
      // Use roomId from data or from user's current room
      const targetRoom = roomId || userRoom;
      
      if (!targetRoom) {
        console.error('❌ No room found for ICE candidate from', socket.id);
        return;
      }
      
      console.log(`📹 ICE candidate in room ${targetRoom} from ${socket.id}`);
      
      // Forward to all other users in the room (except sender)
      socket.to(targetRoom).emit('video-call-ice-candidate', {
        candidate,
      });
      
      console.log(`✅ ICE candidate forwarded to room ${targetRoom}`);
    } catch (error) {
      console.error('❌ Error handling video-call-ice-candidate:', error);
    }
  });

  // Handle call end - notify other users
  socket.on('video-call-end', (data) => {
    try {
      const { roomId } = data || {};
      const userRoom = userRooms.get(socket.id);
      
      // Use roomId from data or from user's current room
      const targetRoom = roomId || userRoom;
      
      if (!targetRoom) {
        console.error('❌ No room found for video call end from', socket.id);
        return;
      }
      
      console.log(`📹 Video call ended in room ${targetRoom} by ${socket.id}`);
      
      // Notify all other users in the room
      socket.to(targetRoom).emit('video-call-end');
      
      console.log(`✅ Call end notified to room ${targetRoom}`);
    } catch (error) {
      console.error('❌ Error handling video-call-end:', error);
    }
  });

  // ========== EXISTING WEBRTC SIGNALING (KEEP FOR COMPATIBILITY) ==========
  
  // Handle WebRTC signaling (existing code - keep for backward compatibility)
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


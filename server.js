// server.js — Ultra-Lightweight Signaling Server (Socket.io)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// public फ़ोल्डर को सर्व करें
app.use(express.static('public'));

io.on('connection', (socket) => {
  // रूम में जुड़ना (प्राइवेट ट्रक या 'fleet_broadcast')
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    socket.to(roomId).emit('user-joined', { socketId: socket.id, roomId });
  });

  // सिग्नल एक्सचेंज (प्राइवेट व ब्रॉडकास्ट दोनों के लिए)
  socket.on('signal', ({ roomId, signal }) => {
    socket.to(roomId).emit('signal', { signal, from: socket.id, roomId });
  });

  socket.on('leave-room', (roomId) => {
    socket.leave(roomId);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 PTT Server active on port ${PORT}`));
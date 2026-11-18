require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const connectDB = require('./config/db');
const roomRoutes = require('./routes/roomRoutes');
const matchRoutes = require('./routes/matchRoutes');
const errorHandler = require('./middlewares/errorHandler');
const socketHandler = require('./sockets/socketHandler');

const app = express();
const server = http.createServer(app);

connectDB();

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  methods: ['GET', 'POST']
}));
app.use(express.json());

// REST API Routes
app.get('/health', (req, res) => {
  res.status(200).json({ success: true, status: 'OK', game: 'HeraPheri Club Server' });
});
app.use('/api/rooms', roomRoutes);
app.use('/api/matches', matchRoutes);

// Global Error Middleware
app.use(errorHandler);

// Real-Time Socket Engine
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

socketHandler(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 HeraPheri Club Production Backend running on http://localhost:${PORT}`);
});
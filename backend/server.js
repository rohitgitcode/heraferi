require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const socketHandler = require('./sockets/socketHandler');
const Match = require('./models/Match');

const app = express();
const server = http.createServer(app);

// Connect MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  methods: ['GET', 'POST']
}));
app.use(express.json());

// Health Check Route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', game: 'HeraPheri Club Server Running!' });
});

// Temporary Route to Verify MongoDB Atlas Write
app.get('/test-db', async (req, res) => {
  try {
    const sampleMatch = await Match.create({
      roomCode: 'TEST01',
      mode: '1v1',
      winnerName: 'Harshini',
      winnerCash: 2300,
      headline: 'BREAKING: Harshini ne Kohli-level bluff karke saara paisa loot liya!'
    });
    res.json({ message: '✅ Data saved to MongoDB Atlas!', data: sampleMatch });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Socket.io Setup
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

socketHandler(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 HeraPheri Club Backend running on http://localhost:${PORT}`);
});
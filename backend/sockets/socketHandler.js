const {
  createRoom,
  joinRoom,
  startNewRound,
  placeBid,
  usePowerCard,
  resolveRound,
  getPublicRoomState,
  getRoom,
  removePlayer
} = require('../game/gameManager');

function pushSystemChat(io, room, text) {
  const sysMsg = {
    id: Date.now() + Math.random(),
    type: 'system',
    text,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };
  room.chatHistory.push(sysMsg);
  io.to(room.roomCode).emit('receive_message', sysMsg);
}

function startRoundLoop(io, room) {
  if (room.timerInterval) clearInterval(room.timerInterval);

  startNewRound(room);

  io.to(room.roomCode).emit('room_updated', getPublicRoomState(room));

  Object.entries(room.roundData.insiderMap).forEach(([playerSocketId, secretInfo]) => {
    io.to(playerSocketId).emit('secret_peek', secretInfo);
  });

  pushSystemChat(
    io,
    room,
    `🔔 Round ${room.currentRound}/${room.totalRounds} shuru! Boli ₹50 se start hai.`
  );

  room.timerInterval = setInterval(() => {
    if (!room.roundData) return;
    room.roundData.timeLeft -= 1;

    io.to(room.roomCode).emit('timer_tick', { timeLeft: room.roundData.timeLeft });

    if (room.roundData.timeLeft <= 0) {
      clearInterval(room.timerInterval);
      const result = resolveRound(room.roomCode);
      if (result) {
        pushSystemChat(io, room, result.outcomeSummary);
        io.to(room.roomCode).emit('round_revealed', {
          room: getPublicRoomState(result.room),
          revealedBox: result.revealedBox,
          outcomeSummary: result.outcomeSummary,
          isGameOver: result.isGameOver
        });

        if (!result.isGameOver) {
          setTimeout(() => {
            const currentRoom = getRoom(room.roomCode);
            if (currentRoom && currentRoom.status === 'reveal') {
              startRoundLoop(io, currentRoom);
            }
          }, 6000);
        }
      }
    }
  }, 1000);
}

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log(`🔌 Player connected: ${socket.id}`);

    socket.on('create_room', ({ playerName, mode }, callback) => {
      const room = createRoom({
        hostSocketId: socket.id,
        hostName: playerName || 'Player 1',
        mode
      });
      socket.join(room.roomCode);
      pushSystemChat(io, room, `🎉 ${playerName} ne HeraPheri Club table banayi (${mode.toUpperCase()}).`);
      callback({ room: getPublicRoomState(room) });
    });

    socket.on('join_room', ({ roomCode, playerName }, callback) => {
      const res = joinRoom({
        roomCode,
        socketId: socket.id,
        playerName: playerName || 'Guest'
      });
      if (res.error) return callback({ error: res.error });

      socket.join(res.room.roomCode);
      pushSystemChat(io, res.room, `👋 ${playerName} ne table join ki!`);
      io.to(res.room.roomCode).emit('room_updated', getPublicRoomState(res.room));
      callback({ room: getPublicRoomState(res.room) });
    });

    socket.on('start_game', ({ roomCode }) => {
      const room = getRoom(roomCode);
      if (!room || room.hostId !== socket.id) return;
      if (room.players.length < 2) return;

      startRoundLoop(io, room);
    });

    socket.on('place_bid', ({ roomCode, amount }, callback) => {
      const res = placeBid(roomCode, socket.id, amount);
      if (res.error) return callback && callback({ error: res.error });

      pushSystemChat(io, res.room, `💰 ${res.bidderName} ne ₹${res.amount} ki boli lagayi!`);
      io.to(roomCode).emit('room_updated', getPublicRoomState(res.room));
      if (callback) callback({ success: true });
    });

    socket.on('use_power', ({ roomCode }, callback) => {
      const res = usePowerCard(roomCode, socket.id);
      if (res.error) return callback && callback({ error: res.error });

      if (res.powerType === 'swap') {
        pushSystemChat(io, res.room, `🔄 ${res.actorName} ne ADLA-BADLI card chala! Active box badal gaya!`);
        io.to(roomCode).emit('room_updated', getPublicRoomState(res.room));
      } else if (res.powerType === 'peek') {
        pushSystemChat(io, res.room, `🕵️ ${res.actorName} ne JASOOSI card use karke box mein jhaanka!`);
        socket.emit('secret_peek', { boxIndex: 0, box: res.secretBox });
        io.to(roomCode).emit('room_updated', getPublicRoomState(res.room));
      }
      if (callback) callback({ success: true });
    });

    socket.on('send_message', ({ roomCode, senderName, text, replyTo = null }) => {
      const room = getRoom(roomCode);
      if (!room || !text.trim()) return;

      const msg = {
        id: Date.now() + Math.random(),
        type: 'user',
        senderId: socket.id,
        senderName,
        text: text.trim(),
        replyTo,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      room.chatHistory.push(msg);
      io.to(roomCode).emit('receive_message', msg);
    });

    socket.on('typing', ({ roomCode, senderName, isTyping }) => {
      socket.to(roomCode).emit('player_typing', { senderName, isTyping });
    });

    socket.on('send_reaction', ({ roomCode, senderName, emoji }) => {
      io.to(roomCode).emit('receive_reaction', {
        id: Date.now() + Math.random(),
        senderName,
        emoji
      });
    });

    socket.on('disconnect', () => {
      const res = removePlayer(socket.id);
      if (res) {
        pushSystemChat(io, res.room, `🚪 ${res.removedPlayer.name} table chhod kar chala gaya.`);
        io.to(res.room.roomCode).emit('room_updated', getPublicRoomState(res.room));
      }
      console.log(`❌ Player disconnected: ${socket.id}`);
    });
  });
};
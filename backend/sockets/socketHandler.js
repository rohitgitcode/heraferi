const roomService = require('../services/roomService');
const auctionService = require('../services/auctionService');
const { ROOM_STATUS, POWER_TYPES, GAME_CONFIG } = require('../constants/gameEnums');

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

  auctionService.startRound(room);
  io.to(room.roomCode).emit('room_updated', roomService.sanitizeRoomForPublic(room));

  Object.entries(room.roundData.insiderMap).forEach(([playerSocketId, secretInfo]) => {
    io.to(playerSocketId).emit('secret_peek', secretInfo);
  });

  pushSystemChat(
    io,
    room,
    `🔔 Round ${room.currentRound}/${room.totalRounds} shuru! Boli ₹${GAME_CONFIG.BASE_BID} se start hai.`
  );

  room.timerInterval = setInterval(async () => {
    if (!room.roundData) return;
    room.roundData.timeLeft -= 1;

    io.to(room.roomCode).emit('timer_tick', { timeLeft: room.roundData.timeLeft });

    if (room.roundData.timeLeft <= 0) {
      clearInterval(room.timerInterval);
      const result = await auctionService.resolveRound(room.roomCode);
      if (result) {
        pushSystemChat(io, room, result.outcomeSummary);
        io.to(room.roomCode).emit('round_revealed', {
          room: roomService.sanitizeRoomForPublic(result.room),
          revealedBox: result.revealedBox,
          outcomeSummary: result.outcomeSummary,
          isGameOver: result.isGameOver
        });

        if (!result.isGameOver) {
          setTimeout(() => {
            const currentRoom = roomService.getRoomByCode(room.roomCode);
            if (currentRoom && currentRoom.status === ROOM_STATUS.REVEAL) {
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
    socket.on('create_room', ({ playerName, mode }, callback) => {
      const room = roomService.createRoom({ hostName: playerName || 'Player 1', mode });
      const res = roomService.addPlayerToRoom({
        roomCode: room.roomCode,
        socketId: socket.id,
        playerName: playerName || 'Player 1'
      });

      socket.join(room.roomCode);
      pushSystemChat(io, res.room, `🎉 ${playerName} ne HeraPheri Club table banayi (${mode.toUpperCase()}).`);
      callback({ room: roomService.sanitizeRoomForPublic(res.room) });
    });

    socket.on('join_room', ({ roomCode, playerName }, callback) => {
      const res = roomService.addPlayerToRoom({
        roomCode,
        socketId: socket.id,
        playerName: playerName || 'Guest'
      });
      if (res.error) return callback({ error: res.error });

      socket.join(res.room.roomCode);
      pushSystemChat(io, res.room, `👋 ${playerName} ne table join ki!`);
      io.to(res.room.roomCode).emit('room_updated', roomService.sanitizeRoomForPublic(res.room));
      callback({ room: roomService.sanitizeRoomForPublic(res.room) });
    });

    socket.on('start_game', ({ roomCode }) => {
      const room = roomService.getRoomByCode(roomCode);
      if (!room || room.hostId !== socket.id || room.players.length < 2) return;
      startRoundLoop(io, room);
    });

    socket.on('place_bid', ({ roomCode, amount }, callback) => {
      const res = auctionService.placeBid(roomCode, socket.id, amount);
      if (res.error) return callback && callback({ error: res.error });

      pushSystemChat(io, res.room, `💰 ${res.bidderName} ne ₹${res.amount} ki boli lagayi!`);
      io.to(roomCode).emit('room_updated', roomService.sanitizeRoomForPublic(res.room));
      if (callback) callback({ success: true });
    });

    socket.on('use_power', ({ roomCode }, callback) => {
      const res = auctionService.usePowerCard(roomCode, socket.id);
      if (res.error) return callback && callback({ error: res.error });

      if (res.powerType === POWER_TYPES.SWAP) {
        pushSystemChat(io, res.room, `🔄 ${res.actorName} ne ADLA-BADLI card chala! Active box badal gaya!`);
        io.to(roomCode).emit('room_updated', roomService.sanitizeRoomForPublic(res.room));
      } else if (res.powerType === POWER_TYPES.PEEK) {
        pushSystemChat(io, res.room, `🕵️ ${res.actorName} ne JASOOSI card use karke box mein jhaanka!`);
        socket.emit('secret_peek', { boxIndex: 0, box: res.secretBox });
        io.to(roomCode).emit('room_updated', roomService.sanitizeRoomForPublic(res.room));
      }
      if (callback) callback({ success: true });
    });

    socket.on('send_message', ({ roomCode, senderName, text, replyTo = null }) => {
      const room = roomService.getRoomByCode(roomCode);
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
      const res = roomService.removePlayerBySocket(socket.id);
      if (res) {
        pushSystemChat(io, res.room, `🚪 ${res.removedPlayer.name} table chhod kar chala gaya.`);

        // Agar chalte game mein player leave kare aur 1 ya 0 players bachein
        if (res.room.status !== ROOM_STATUS.LOBBY && res.room.status !== ROOM_STATUS.ENDED && res.room.players.length < 2) {
          if (res.room.timerInterval) clearInterval(res.room.timerInterval);
          res.room.status = ROOM_STATUS.ENDED;
          pushSystemChat(io, res.room, `⚠️ Khel khatam! Table par zaroori khiladi nahi bache.`);
          io.to(res.room.roomCode).emit('game_aborted', {
            message: 'Game samapt ho gaya kyunki khiladi match chhod kar chale gaye.',
            room: roomService.sanitizeRoomForPublic(res.room)
          });
        }

        io.to(res.room.roomCode).emit('room_updated', roomService.sanitizeRoomForPublic(res.room));
      }
    });
  });
};
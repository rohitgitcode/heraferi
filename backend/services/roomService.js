const rooms = new Map();

function generateUniqueCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return rooms.has(code) ? generateUniqueCode() : code;
}

class RoomService {
  createRoom({ hostName, mode = 'group' }) {
    const roomCode = generateUniqueCode();
    const is1v1 = mode === '1v1';

    const room = {
      roomCode,
      mode,
      status: 'lobby', // 'lobby' | 'bidding' | 'reveal' | 'ended'
      hostId: null, // Will be bound when host connects via Socket
      maxPlayers: is1v1 ? 2 : 7,
      totalRounds: is1v1 ? 5 : 6,
      currentRound: 0,
      startingCash: is1v1 ? 1500 : 1000,
      players: [],
      roundData: null,
      chatHistory: [],
      timerInterval: null,
      createdAt: Date.now()
    };

    rooms.set(roomCode, room);
    return room;
  }

  getRoomByCode(roomCode) {
    return rooms.get(roomCode.toUpperCase()) || null;
  }

  checkRoomAvailability(roomCode) {
    const room = this.getRoomByCode(roomCode);
    if (!room) {
      return { available: false, status: 404, message: 'cant find room , please check your code again' };
    }
    if (room.status !== 'lobby') {
      return { available: false, status: 400, message: 'Match has already begun' };
    }
    if (room.players.length >= room.maxPlayers) {
      return { available: false, status: 400, message: `Room is already full! (Max ${room.maxPlayers} players)` };
    }
    return {
      available: true,
      roomSummary: {
        roomCode: room.roomCode,
        mode: room.mode,
        playerCount: room.players.length,
        maxPlayers: room.maxPlayers
      }
    };
  }

  addPlayerToRoom({ roomCode, socketId, playerName }) {
    const check = this.checkRoomAvailability(roomCode);
    if (!check.available) return { error: check.message };

    const room = this.getRoomByCode(roomCode);
    const isFirstPlayer = room.players.length === 0;

    if (isFirstPlayer) {
      room.hostId = socketId;
    }

    const newPlayer = {
      id: socketId,
      name: playerName,
      cash: room.startingCash,
      powerUsed: false,
      boxesWon: [],
      stats: { bombsHit: 0, jackpotsWon: 0, totalSpent: 0 }
    };

    room.players.push(newPlayer);
    return { room, player: newPlayer };
  }

  removePlayerBySocket(socketId) {
    for (const [code, room] of rooms.entries()) {
      const idx = room.players.findIndex((p) => p.id === socketId);
      if (idx !== -1) {
        const [removed] = room.players.splice(idx, 1);
        if (room.players.length === 0) {
          if (room.timerInterval) clearInterval(room.timerInterval);
          rooms.delete(code);
          return null;
        }
        if (room.hostId === socketId) {
          room.hostId = room.players[0].id;
        }
        return { room, removedPlayer: removed };
      }
    }
    return null;
  }

  sanitizeRoomForPublic(room) {
    return {
      roomCode: room.roomCode,
      mode: room.mode,
      status: room.status,
      hostId: room.hostId,
      maxPlayers: room.maxPlayers,
      totalRounds: room.totalRounds,
      currentRound: room.currentRound,
      players: room.players,
      roundData: room.roundData
        ? {
            boxCount: room.roundData.boxes.length,
            selectedBoxIndex: room.roundData.selectedBoxIndex,
            highestBid: room.roundData.highestBid,
            highestBidderId: room.roundData.highestBidderId,
            highestBidderName: room.roundData.highestBidderName,
            timeLeft: room.roundData.timeLeft
          }
        : null,
      chatHistory: room.chatHistory
    };
  }
}

module.exports = new RoomService();
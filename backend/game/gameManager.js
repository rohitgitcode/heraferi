const { getRandomBoxes } = require('./boxesData');

const rooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

function createRoom({ hostSocketId, hostName, mode = 'group' }) {
  const roomCode = generateRoomCode();
  const is1v1 = mode === '1v1';
  const startingCash = is1v1 ? 1500 : 1000;

  const room = {
    roomCode,
    mode,
    status: 'lobby',
    hostId: hostSocketId,
    maxPlayers: is1v1 ? 2 : 7,
    totalRounds: is1v1 ? 5 : 6,
    currentRound: 0,
    players: [
      {
        id: hostSocketId,
        name: hostName,
        cash: startingCash,
        powerUsed: false,
        boxesWon: [],
        stats: { bombsHit: 0, jackpotsWon: 0, totalSpent: 0 }
      }
    ],
    roundData: null,
    chatHistory: [],
    timerInterval: null
  };

  rooms.set(roomCode, room);
  return room;
}

function joinRoom({ roomCode, socketId, playerName }) {
  const room = rooms.get(roomCode.toUpperCase());
  if (!room) return { error: 'Room nahi mila! Code check karo.' };
  if (room.status !== 'lobby') return { error: 'Game already shuru ho chuka hai!' };
  if (room.players.length >= room.maxPlayers) {
    return { error: `Room full hai! (Max ${room.maxPlayers} players)` };
  }

  const startingCash = room.mode === '1v1' ? 1500 : 1000;
  const newPlayer = {
    id: socketId,
    name: playerName,
    cash: startingCash,
    powerUsed: false,
    boxesWon: [],
    stats: { bombsHit: 0, jackpotsWon: 0, totalSpent: 0 }
  };

  room.players.push(newPlayer);
  return { room };
}

function startNewRound(room) {
  room.currentRound += 1;
  room.status = 'bidding';

  if (room.mode === '1v1') {
    const boxes = getRandomBoxes(2);
    room.roundData = {
      boxes,
      selectedBoxIndex: 0,
      insiderMap: {
        [room.players[0].id]: { boxIndex: 0, box: boxes[0] },
        [room.players[1].id]: { boxIndex: 1, box: boxes[1] }
      },
      highestBid: 50,
      highestBidderId: null,
      highestBidderName: null,
      timeLeft: 20
    };
  } else {
    const [box] = getRandomBoxes(1);
    const shuffledPlayers = [...room.players].sort(() => 0.5 - Math.random());
    const insiderCount = room.players.length >= 5 ? 2 : 1;
    const insiders = shuffledPlayers.slice(0, insiderCount);

    const insiderMap = {};
    insiders.forEach((p) => {
      insiderMap[p.id] = { boxIndex: 0, box };
    });

    room.roundData = {
      boxes: [box],
      selectedBoxIndex: 0,
      insiderMap,
      highestBid: 50,
      highestBidderId: null,
      highestBidderName: null,
      timeLeft: 20
    };
  }

  return room;
}

function placeBid(roomCode, socketId, amount) {
  const room = rooms.get(roomCode);
  if (!room || room.status !== 'bidding') return { error: 'Abhi boli nahi lag sakti.' };

  const player = room.players.find((p) => p.id === socketId);
  if (!player) return { error: 'Player nahi mila.' };

  if (amount <= room.roundData.highestBid && room.roundData.highestBidderId !== null) {
    return { error: `₹${room.roundData.highestBid} se badi boli lagao!` };
  }
  if (amount > player.cash) {
    return { error: 'Itna paisa nahi hai wallet mein!' };
  }

  room.roundData.highestBid = amount;
  room.roundData.highestBidderId = player.id;
  room.roundData.highestBidderName = player.name;

  if (room.roundData.timeLeft < 8) {
    room.roundData.timeLeft = 8;
  }

  return { room, bidderName: player.name, amount };
}

function usePowerCard(roomCode, socketId) {
  const room = rooms.get(roomCode);
  if (!room || room.status !== 'bidding') return { error: 'Power card abhi use nahi ho sakta.' };

  const player = room.players.find((p) => p.id === socketId);
  if (!player || player.powerUsed) return { error: 'Power card already use ho chuka hai!' };

  player.powerUsed = true;

  if (room.mode === '1v1') {
    room.roundData.selectedBoxIndex = room.roundData.selectedBoxIndex === 0 ? 1 : 0;
    return {
      room,
      powerType: 'swap',
      actorName: player.name,
      newBoxIndex: room.roundData.selectedBoxIndex
    };
  } else {
    const activeBox = room.roundData.boxes[0];
    room.roundData.insiderMap[player.id] = { boxIndex: 0, box: activeBox };
    return {
      room,
      powerType: 'peek',
      actorName: player.name,
      secretBox: activeBox
    };
  }
}

function resolveRound(roomCode) {
  const room = rooms.get(roomCode);
  if (!room || !room.roundData) return null;

  room.status = 'reveal';
  const activeBox = room.roundData.boxes[room.roundData.selectedBoxIndex];
  const winnerId = room.roundData.highestBidderId;
  let outcomeSummary = '';

  if (!winnerId) {
    outcomeSummary = `Kisi ne boli nahi lagayi! Box "${activeBox.title}" wapas tijori mein chala gaya.`;
  } else {
    const winner = room.players.find((p) => p.id === winnerId);
    const bidPaid = room.roundData.highestBid;

    winner.cash -= bidPaid;
    winner.stats.totalSpent += bidPaid;
    winner.boxesWon.push(activeBox);

    if (activeBox.type === 'jackpot') {
      winner.cash += activeBox.value;
      winner.stats.jackpotsWon += 1;
      outcomeSummary = `🤑 ${winner.name} ne ₹${bidPaid} mein "${activeBox.title}" khareeda aur +₹${activeBox.value} kamaye!`;
    } else if (activeBox.type === 'bomb') {
      winner.cash += activeBox.value;
      winner.stats.bombsHit += 1;
      outcomeSummary = `💥 CHUNA LAGA! ${winner.name} ne ₹${bidPaid} diye aur andar se "${activeBox.title}" (${activeBox.value}) nikla!`;
    } else if (activeBox.type === 'steal') {
      const richest = [...room.players]
        .filter((p) => p.id !== winner.id)
        .sort((a, b) => b.cash - a.cash)[0];
      const stolen = richest ? Math.min(richest.cash, activeBox.value) : 0;
      if (richest) richest.cash -= stolen;
      winner.cash += stolen;
      outcomeSummary = `🥷 ${winner.name} ne "${activeBox.title}" khola aur ${richest ? richest.name : 'bank'} se ₹${stolen} chura liye!`;
    } else if (activeBox.type === 'double') {
      const bonus = Math.floor(winner.cash * 0.5);
      winner.cash += bonus;
      outcomeSummary = `🚀 ${winner.name} ko mila "${activeBox.title}"! Wallet mein +₹${bonus} ka bonus!`;
    } else if (activeBox.type === 'halve') {
      const loss = Math.floor(winner.cash * 0.25);
      winner.cash -= loss;
      outcomeSummary = `🧿 ${winner.name} ko "${activeBox.title}"! Wallet se ₹${loss} ud gaye!`;
    }
  }

  const isGameOver = room.currentRound >= room.totalRounds;
  if (isGameOver) {
    room.status = 'ended';
    room.players.sort((a, b) => b.cash - a.cash);
  }

  return {
    room,
    revealedBox: activeBox,
    outcomeSummary,
    isGameOver
  };
}

function getPublicRoomState(room) {
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

function getRoom(roomCode) {
  return rooms.get(roomCode);
}

function removePlayer(socketId) {
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

module.exports = {
  createRoom,
  joinRoom,
  startNewRound,
  placeBid,
  usePowerCard,
  resolveRound,
  getPublicRoomState,
  getRoom,
  removePlayer
};
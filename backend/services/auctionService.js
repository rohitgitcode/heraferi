const { getRandomBoxes, shuffle } = require('../game/boxesData');
const {
  GAME_MODES,
  ROOM_STATUS,
  BOX_TYPES,
  POWER_TYPES,
  GAME_CONFIG
} = require('../constants/gameEnums');
const roomService = require('./roomService');
const Match = require('../models/Match');

class AuctionService {
  startRound(room) {   // decides the boxes and insiders for the round
    room.currentRound += 1;
    room.status = ROOM_STATUS.BIDDING;

    if (room.mode === GAME_MODES.ONE_VS_ONE) {
      const boxes = getRandomBoxes(2);
      room.roundData = {
        boxes,
        selectedBoxIndex: 0,
        insiderMap: {
          [room.players[0].id]: { boxIndex: 0, box: boxes[0] },
          [room.players[1].id]: { boxIndex: 1, box: boxes[1] }
        },
        highestBid: GAME_CONFIG.BASE_BID,
        highestBidderId: null,
        highestBidderName: null,
        timeLeft: GAME_CONFIG.ROUND_SECONDS
      };
    } else {
      const [box] = getRandomBoxes(1);
      const shuffledPlayers = shuffle(room.players);
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
        highestBid: GAME_CONFIG.BASE_BID,
        highestBidderId: null,
        highestBidderName: null,
        timeLeft: GAME_CONFIG.ROUND_SECONDS
      };
    }

    return room;
  }

  placeBid(roomCode, socketId, amount) {  // checks if bidder has enough cash and if bid is higher than current highest bid, then updates the roundData with new highest bid and bidder info
    const room = roomService.getRoomByCode(roomCode);
    if (!room || room.status !== ROOM_STATUS.BIDDING) {
      return { error: 'Cant bid currently ' };
    }

    const player = room.players.find((p) => p.id === socketId);
    if (!player) return { error: 'cant find player' };

    if (room.roundData.highestBidderId === null) {
      if (amount < room.roundData.highestBid) {
        return { error: `Boli kam se kam ₹${room.roundData.highestBid} se shuru karo!` };
      }
    } else if (amount <= room.roundData.highestBid) {
      return { error: `Boli ₹${room.roundData.highestBid} se zyada honi chahiye!` };
    }

    if (amount > player.cash) {
      return { error: 'you dont have enough cash' };
    }

    room.roundData.highestBid = amount;
    room.roundData.highestBidderId = player.id;
    room.roundData.highestBidderName = player.name;

    if (room.roundData.timeLeft < GAME_CONFIG.SNIPE_EXTENSION_SECONDS) {
      room.roundData.timeLeft = GAME_CONFIG.SNIPE_EXTENSION_SECONDS;
    }

    return { room, bidderName: player.name, amount };
  }

  usePowerCard(roomCode, socketId) {
    const room = roomService.getRoomByCode(roomCode);
    if (!room || room.status !== ROOM_STATUS.BIDDING) {
      return { error: 'Power card abhi use nahi ho sakta.' };
    }

    const player = room.players.find((p) => p.id === socketId);
    if (!player || player.powerUsed) {
      return { error: 'Power card already use ho chuka hai!' };
    }

    player.powerUsed = true;

    if (room.mode === GAME_MODES.ONE_VS_ONE) {
      room.roundData.selectedBoxIndex = room.roundData.selectedBoxIndex === 0 ? 1 : 0;
      return {
        room,
        powerType: POWER_TYPES.SWAP,
        actorName: player.name,
        newBoxIndex: room.roundData.selectedBoxIndex
      };
    }

    const activeBox = room.roundData.boxes[0];
    room.roundData.insiderMap[player.id] = { boxIndex: 0, box: activeBox };
    return {
      room,
      powerType: POWER_TYPES.PEEK,
      actorName: player.name,
      secretBox: activeBox
    };
  }
// after timer ends then winners wallet is updated and if game is over then match result is persisted in db
  async resolveRound(roomCode) {
    const room = roomService.getRoomByCode(roomCode);
    if (!room || !room.roundData) return null;

    room.status = ROOM_STATUS.REVEAL;
    const activeBox = room.roundData.boxes[room.roundData.selectedBoxIndex];
    const winnerId = room.roundData.highestBidderId;
    let outcomeSummary = '';

    if (!winnerId) {
      outcomeSummary = `No one bid on Box "${activeBox.title}" went to the bank!`;
    } else {
      const winner = room.players.find((p) => p.id === winnerId);
      if (!winner) {
        outcomeSummary = `Winner table chhod kar chala gaya! Box "${activeBox.title}" wapas bank gaya.`;
      } else {
        const bidPaid = room.roundData.highestBid;

        winner.cash -= bidPaid;
        winner.stats.totalSpent += bidPaid;
        winner.boxesWon.push(activeBox);

        switch (activeBox.type) {
          case BOX_TYPES.JACKPOT:
            winner.cash += activeBox.value;
            winner.stats.jackpotsWon += 1;
            outcomeSummary = `🤑 ${winner.name} ne ₹${bidPaid} mein "${activeBox.title}" khareeda aur +₹${activeBox.value} kamaye!`;
            break;
          case BOX_TYPES.BOMB:
            winner.cash += activeBox.value;
            winner.stats.bombsHit += 1;
            outcomeSummary = `💥 CHUNA LAGA! ${winner.name} ne ₹${bidPaid} diye aur andar se "${activeBox.title}" (${activeBox.value}) nikla!`;
            break;
          case BOX_TYPES.STEAL: {
            const richest = [...room.players]
              .filter((p) => p.id !== winner.id)
              .sort((a, b) => b.cash - a.cash)[0];
            const stolen = richest ? Math.min(richest.cash, activeBox.value) : 0;
            if (richest) richest.cash -= stolen;
            winner.cash += stolen;
            outcomeSummary = `🥷 ${winner.name} ne "${activeBox.title}" khola aur ${richest ? richest.name : 'bank'} se ₹${stolen} chura liye!`;
            break;
          }
          case BOX_TYPES.DOUBLE: {
            const bonus = Math.floor(winner.cash * 0.5);
            winner.cash += bonus;
            outcomeSummary = `🚀 ${winner.name} ko mila "${activeBox.title}"! Wallet mein +₹${bonus} ka bonus!`;
            break;
          }
          case BOX_TYPES.HALVE: {
            const loss = Math.floor(winner.cash * 0.25);
            winner.cash -= loss;
            outcomeSummary = `🧿 ${winner.name} ko "${activeBox.title}"! Wallet se ₹${loss} ud gaye!`;
            break;
          }
        }
      }
    }

    const isGameOver = room.currentRound >= room.totalRounds;
    if (isGameOver) {
      room.status = ROOM_STATUS.ENDED;
      room.players.sort((a, b) => b.cash - a.cash);
      await this.persistMatchResult(room);
    }

    return {
      room,
      revealedBox: activeBox,
      outcomeSummary,
      isGameOver
    };
  }

  async persistMatchResult(room) {
    try {
      const champion = room.players[0];
      if (!champion) return;

      const headline = `BREAKING: ${champion.name} ne ₹${champion.cash} ke saath HeraPheri Club (${room.mode.toUpperCase()}) loot liya!`;
      await Match.create({
        roomCode: room.roomCode,
        mode: room.mode,
        winnerName: champion.name,
        winnerCash: champion.cash,
        headline
      });
    } catch (err) {
      console.error('⚠️ Match persist error:', err.message);
    }
  }
}

module.exports = new AuctionService();
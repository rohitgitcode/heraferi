const GAME_MODES = Object.freeze({
  ONE_VS_ONE: '1v1',
  GROUP: 'group'
});

const ROOM_STATUS = Object.freeze({
  LOBBY: 'lobby',
  BIDDING: 'bidding',
  REVEAL: 'reveal',
  ENDED: 'ended'
});

const BOX_TYPES = Object.freeze({
  JACKPOT: 'jackpot',
  BOMB: 'bomb',
  STEAL: 'steal',
  DOUBLE: 'double',
  HALVE: 'halve'
});

const POWER_TYPES = Object.freeze({
  SWAP: 'swap',
  PEEK: 'peek'
});

const GAME_CONFIG = Object.freeze({
  [GAME_MODES.ONE_VS_ONE]: {
    MAX_PLAYERS: 2,
    TOTAL_ROUNDS: 5,
    STARTING_CASH: 1500
  },
  [GAME_MODES.GROUP]: {
    MAX_PLAYERS: 7,
    TOTAL_ROUNDS: 6,
    STARTING_CASH: 1000
  },
  BASE_BID: 50,
  ROUND_SECONDS: 20,
  SNIPE_EXTENSION_SECONDS: 8
});

module.exports = {
  GAME_MODES,
  ROOM_STATUS,
  BOX_TYPES,
  POWER_TYPES,
  GAME_CONFIG
};
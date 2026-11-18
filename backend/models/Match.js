const mongoose = require('mongoose');

const MatchSchema = new mongoose.Schema({
  roomCode: { type: String, required: true },
  mode: { type: String, enum: ['1v1', 'group'], default: 'group' },
  winnerName: { type: String, required: true },
  winnerCash: { type: Number, required: true },
  headline: { type: String },
  playedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Match', MatchSchema);
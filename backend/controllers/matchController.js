const Match = require('../models/Match');

const getRecentMatches = async (req, res, next) => {
  try {
    const matches = await Match.find().sort({ playedAt: -1 }).limit(10);
    res.status(200).json({
      success: true,
      count: matches.length,
      data: matches
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getRecentMatches };
const express = require('express');
const router = express.Router();
const { getRecentMatches } = require('../controllers/matchController');

// GET /api/matches/recent -> Latest match headlines for Lobby ticker
router.get('/recent', getRecentMatches);

module.exports = router;
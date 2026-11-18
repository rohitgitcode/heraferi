const express = require('express');
const router = express.Router();
const { createRoomHandler, verifyRoomHandler } = require('../controllers/roomController');
const { validateCreateRoom, validateRoomCodeParam } = require('../middlewares/validateRequest');

// POST /api/rooms -> Create a new 1v1 or Group room
router.post('/', validateCreateRoom, createRoomHandler);

// GET /api/rooms/:roomCode/verify -> Check if room exists & has space before joining
router.get('/:roomCode/verify', validateRoomCodeParam, verifyRoomHandler);

module.exports = router;
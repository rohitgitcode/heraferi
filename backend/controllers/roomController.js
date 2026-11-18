const roomService = require('../services/roomService');

const createRoomHandler = (req, res, next) => {
  try {
    const { hostName, mode } = req.body;
    const room = roomService.createRoom({ hostName, mode });

    res.status(201).json({
      success: true,
      message: 'Room successfully created',
      data: {
        roomCode: room.roomCode,
        mode: room.mode,
        maxPlayers: room.maxPlayers
      }
    });
  } catch (error) {
    next(error);
  }
};

const verifyRoomHandler = (req, res, next) => {
  try {
    const { roomCode } = req.params;
    const result = roomService.checkRoomAvailability(roomCode);

    if (!result.available) {
      return res.status(result.status).json({
        success: false,
        message: result.message
      });
    }

    res.status(200).json({
      success: true,
      data: result.roomSummary
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { createRoomHandler, verifyRoomHandler };
const validateCreateRoom = (req, res, next) => {
  const { playerName, mode } = req.body;

  if (!playerName || typeof playerName !== 'string' || playerName.trim().length < 2) {
    return res.status(400).json({
      success: false,
      message: 'Players name couldnt be empty and must be at least 2 characters long.'
    });
  }

  if (mode && !['1v1', 'group'].includes(mode)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid mode. only "1v1" or "group" allowed.'
    });
  }

  req.body.playerName = playerName.trim();
  req.body.mode = mode || 'group';
  next();
};

const validateRoomCodeParam = (req, res, next) => {
  const { roomCode } = req.params;
  if (!roomCode || roomCode.trim().length !== 4) {
    return res.status(400).json({
      success: false,
      message: 'Room code must be exactly 4 characters long.'
    });
  }
  req.params.roomCode = roomCode.trim().toUpperCase();
  next();
};

module.exports = { validateCreateRoom, validateRoomCodeParam };
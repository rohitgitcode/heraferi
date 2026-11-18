import { io } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

/**
 * Single shared Socket.io instance across the entire React application.
 * autoConnect is false so we only connect when entering a lobby or room.
 */
const socket = io(BACKEND_URL, {
  autoConnect: false,
  transports: ['websocket', 'polling']
});

export default socket;
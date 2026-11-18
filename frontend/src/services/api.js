const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

/**
 * Verifies if a 4-character room code exists and has available seats before joining.
 */
export async function verifyRoomCode(roomCode) {
  const response = await fetch(`${BACKEND_URL}/api/rooms/${roomCode.toUpperCase()}/verify`);
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Unable to verify room.');
  }
  return data.data;
}

/**
 * Fetches recent match headlines from MongoDB for the Lobby ticker.
 */
export async function fetchRecentMatches() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/matches/recent`);
    const data = await response.json();
    return data.success ? data.data : [];
  } catch {
    return [];
  }
}
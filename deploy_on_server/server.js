const WebSocket = require('ws');

// Use the port provided by the environment (like Back4App) or default to 8080 for local testing.
const port = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port });

const rooms = {}; // In-memory storage: { roomCode: peerId }

console.log(`Matchmaking server started on port ${port}...`);

function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code;
    do {
        code = '';
        for (let i = 0; i < 4; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
    } while (rooms[code]); // Ensure the code is unique
    return code;
}

wss.on('connection', ws => {
    console.log('[Server] A client connected.');

    ws.on('message', message => {
        try {
            const data = JSON.parse(message);
            console.log('[Server] Received:', data);

            if (data.type === 'host-game') {
                const roomCode = generateRoomCode();
                rooms[roomCode] = data.peerId;
                ws.send(JSON.stringify({ type: 'game-hosted', roomCode: roomCode }));
                console.log(`[Server] Game hosted. Room: ${roomCode}, Host: ${data.peerId}`);

                // Clean up the room after a while to prevent memory leaks
                setTimeout(() => {
                    delete rooms[roomCode];
                    console.log(`[Server] Cleaned up room ${roomCode}.`);
                }, 3600000); // 1 hour

            } else if (data.type === 'get-peer-id') {
                const peerId = rooms[data.roomCode];
                if (peerId) {
                    ws.send(JSON.stringify({ type: 'peer-id-response', peerId: peerId }));
                } else {
                    ws.send(JSON.stringify({ type: 'error', message: 'Room not found.' }));
                }
            }
        } catch (error) {
            console.error('[Server] Error processing message:', error);
        }
    });

    ws.on('close', () => {
        console.log('[Server] A client disconnected.');
    });
});
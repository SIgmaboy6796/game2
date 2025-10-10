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

function broadcast(data) {
    const message = JSON.stringify(data);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

wss.on('connection', ws => {
    console.log('[Server] A client connected.');

    // Send the current list of rooms to the newly connected client
    const roomList = Object.entries(rooms).map(([roomCode, peerId]) => ({ roomCode, peerId }));
    ws.send(JSON.stringify({ type: 'room-list', rooms: roomList }));

    ws.on('message', message => {
        try {
            const data = JSON.parse(message);
            console.log('[Server] Received:', data);

            if (data.type === 'host-game') {
                const roomCode = generateRoomCode();
                rooms[roomCode] = data.peerId;
                ws.isHost = true; // Mark this connection as a host
                ws.roomCode = roomCode; // Store the room code

                ws.send(JSON.stringify({ type: 'game-hosted', roomCode: roomCode }));
                console.log(`[Server] Game hosted. Room: ${roomCode}, Host: ${data.peerId}`);

                // Broadcast the new room to all clients
                broadcast({ type: 'new-room', room: { roomCode, peerId: data.peerId } });

                // Clean up the room after a while to prevent memory leaks
                setTimeout(() => {
                    if (delete rooms[roomCode]) { // Returns true if property was deleted
                        console.log(`[Server] Cleaned up room ${roomCode}.`);
                        broadcast({ type: 'room-closed', roomCode });
                    }
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
        // If the disconnected client was a host, remove their room
        if (ws.isHost && rooms[ws.roomCode]) {
            console.log(`[Server] Host of room ${ws.roomCode} disconnected. Closing room.`);
            delete rooms[ws.roomCode];
            broadcast({ type: 'room-closed', roomCode: ws.roomCode });
        }
    });
});
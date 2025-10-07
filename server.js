import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });

const games = {}; // Stores active games

console.log("Matchmaking server started on port 8080...");

wss.on('connection', ws => {
    console.log('Client connected');

    ws.on('message', message => {
        const data = JSON.parse(message);

        switch (data.type) {
            case 'host-game':
                handleHostGame(ws, data);
                break;
            case 'get-games':
                sendGameList(ws);
                break;
            case 'get-peer-id':
                handleGetPeerId(ws, data.roomCode);
                break;
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        // Find if this client was hosting a game and remove it
        for (const roomCode in games) {
            if (games[roomCode].hostWs === ws) {
                console.log(`Host of room ${roomCode} disconnected. Closing room.`);
                delete games[roomCode];
                broadcastGameList();
                break;
            }
        }
    });
});

function generateRoomCode() {
    let code;
    do {
        code = Math.floor(1000 + Math.random() * 9000).toString();
    } while (games[code]); // Ensure code is unique
    return code;
}

function handleHostGame(ws, data) {
    const { peerId, nametag } = data;
    const roomCode = generateRoomCode();

    games[roomCode] = {
        peerId,
        nametag,
        hostWs: ws, // Store the host's WebSocket connection
        createdAt: Date.now()
    };

    console.log(`Game hosted by ${nametag} (${peerId}) with code ${roomCode}`);

    // Send the room code back to the host
    ws.send(JSON.stringify({ type: 'game-hosted', roomCode }));

    // Notify all other clients that the game list has been updated
    broadcastGameList();
}

function handleGetPeerId(ws, roomCode) {
    const game = games[roomCode];
    if (game) {
        ws.send(JSON.stringify({ type: 'peer-id-response', roomCode, peerId: game.peerId }));
    } else {
        ws.send(JSON.stringify({ type: 'error', message: 'Game not found' }));
    }
}

function getGameList() {
    return Object.entries(games).map(([roomCode, gameData]) => ({
        roomCode,
        nametag: gameData.nametag
    }));
}

function sendGameList(ws) {
    ws.send(JSON.stringify({ type: 'game-list', games: getGameList() }));
}

function broadcastGameList() {
    const gameList = getGameList();
    wss.clients.forEach(client => {
        if (client.readyState === client.OPEN) {
            client.send(JSON.stringify({ type: 'game-list', games: gameList }));
        }
    });
}

// Periodically clean up old games (e.g., older than 2 hours)
setInterval(() => {
    const now = Date.now();
    const twoHours = 2 * 60 * 60 * 1000;
    Object.keys(games).forEach(roomCode => {
        if (now - games[roomCode].createdAt > twoHours) {
            console.log(`Cleaning up stale room ${roomCode}`);
            delete games[roomCode];
            broadcastGameList();
        }
    });
}, 60 * 60 * 1000); // Run every hour
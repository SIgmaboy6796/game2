import Peer from 'peerjs';

let peer;
let connections = [];
let isHostGlobal = false;
let myId = null;
let myNametag = '';

function dispatchNetworkEvent(name, detail) {
    window.dispatchEvent(new CustomEvent(name, { detail }));
}

function onPeerError(err) {
    console.error('PeerJS error:', err);
    dispatchNetworkEvent('connection-error', { error: err });
}

function setupConnectionListeners(connection) {
    console.log(`[setupConnection] Setting up for peer: ${connection.peer}`);
    connection.on('data', (data) => {
        if (data.type === 'start-game') {
            dispatchNetworkEvent('game-started'); // Client receives this
        } else if (data.type === 'player-list') { // Client receives this
            dispatchNetworkEvent('player-list-updated', { players: data.players });
        } else { // Game data
            dispatchNetworkEvent('data-received', { peerId: connection.peer, data });
        }
    });

    connection.on('close', () => {
        console.log(`[Connection] Peer ${connection.peer} has disconnected.`);
        connections = connections.filter(c => c.peer !== connection.peer);
        // Notify game logic and lobby UI
        dispatchNetworkEvent('player-disconnected', { peerId: connection.peer });
        // If host, notify other clients
        if (isHostGlobal) sendData({ type: 'player-left', peerId: connection.peer });
    });

    connection.on('error', (err) => {
        console.error(`[Connection] Error from peer ${connection.peer}:`, err);
        onPeerError(err);
    });

    return connection;
}

export function initNetwork(nametag, onHostReady) {
    myNametag = nametag;
    console.log('[Network] Initializing Peer object...');
    peer = new Peer(undefined, { // By leaving host/port blank, we use the public PeerJS cloud.
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                {
                    urls: 'turn:global.turn.twilio.com:3478?transport=udp',
                    username: '79f24cb51555599834925835569b9190539d675440b84803d13c32021651a033',
                    credential: 'Z0a/b7zRBK23jA/3JPSA/wV7sAnOFR3v/hMAaM+2O4s='
                }
            ]
        },
        debug: 3, // Set to 3 for most verbose logging, 0 for none.
        secure: true // Required for connections from HTTPS pages (like Vercel)
    });

    peer.on('open', (id) => {
        myId = id;
        console.log(`[Network] Peer object created with ID: ${id}. Ready to host or join.`);
        if (onHostReady) onHostReady(id);
    });

    // This listener is for the HOST to accept incoming connections.
    peer.on('connection', (connection) => {
        console.log(`[Host] Incoming connection from ${connection.peer}.`);
        isHostGlobal = true; // This peer is now acting as the host.

        // The host must wait for the connection to be open before sending data.
        connection.on('open', () => {
            console.log(`[Host] Data channel is open for peer: ${connection.peer}`);

            // Get a list of players already in the game BEFORE adding the new one.
            const existingPlayers = connections.map(c => ({ peerId: c.peer, nametag: c.metadata.nametag }));
            existingPlayers.push({ peerId: myId, nametag: myNametag });

            // Now, add the new connection and set up its listeners.
            setupConnectionListeners(connection);
            connections.push(connection);
            dispatchNetworkEvent('connection-open', { peerId: connection.peer, metadata: connection.metadata });

            // 1. Welcome the new player with the list of existing players.
            console.log(`[Host] Sending 'welcome' to new player ${connection.peer}`);
            connection.send({ type: 'welcome', players: existingPlayers });

            // 2. Inform all OTHER players about the new player.
            console.log(`[Host] Announcing 'new-player' ${connection.peer} to others.`);
            sendData({ type: 'new-player', peerId: connection.peer, nametag: connection.metadata.nametag }, [connection.peer]);

            // 3. Update the lobby UI for everyone.
            const playerListForLobby = connections.map(c => ({ nametag: c.metadata.nametag })).concat({ nametag: myNametag });
            sendData({ type: 'player-list', players: playerListForLobby });
            dispatchNetworkEvent('player-list-updated', { players: playerListForLobby });
        });
    });

    peer.on('error', onPeerError);
}

export function connectToHost(hostId) {
    console.log(`[Client] Attempting to connect to host: ${hostId}`);
    if (!peer) {
        console.error("Peer object not initialized. Call initNetwork first.");
        return;
    }
    const conn = peer.connect(hostId, { metadata: { nametag: myNametag }, reliable: true });

    conn.on('open', () => {
        // This event fires for the client when the connection is ready.
        connections.push(conn);
        dispatchNetworkEvent('connection-open', { peerId: conn.peer, metadata: conn.metadata });
    });

    conn.on('error', (err) => {
        console.error('Connection failed:', err);
        dispatchNetworkEvent('connection-error', { error: err });
    });

    setupConnectionListeners(conn);
}

export function sendData(data, excludePeerIds = []) {
    const excluded = new Set(excludePeerIds);
    connections.forEach(conn => {
        if (conn.open && !excluded.has(conn.peer)) {
            conn.send(data);
        }
    });
}

export function getConnections() {
    return connections;
}

export function getMyId() {
    return myId;
}

import Peer from 'peerjs';

let peer;
let matchmakingSocket;
let connections = [];
let isHostGlobal = false;
const pendingConnections = new Map();
let myId = null;
let myNametag = '';

// IMPORTANT: Replace this with your matchmaking server's address.
const MATCHMAKING_SERVER_URL = 'ws://localhost:8080'; // For local testing
// const MATCHMAKING_SERVER_URL = 'wss://your-production-server.com'; // For production

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
        dispatchNetworkEvent('data-received', { peerId: connection.peer, data });
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

export function setAsHost() {
    isHostGlobal = true;
}

export function initNetwork(nametag) {
    myNametag = nametag;

    // 1. Connect to the matchmaking server
    console.log(`[Network] Connecting to matchmaking server at ${MATCHMAKING_SERVER_URL}...`);
    matchmakingSocket = new WebSocket(MATCHMAKING_SERVER_URL);
    let peerInitialized = false;

    matchmakingSocket.onclose = () => {
        console.log('[Network] Disconnected from matchmaking server.');
    };

    matchmakingSocket.onopen = () => {
        console.log('[Network] Successfully connected to matchmaking server.');
        // Now that we're connected, initialize PeerJS
        initializePeer();
        // Request the initial game list. It's better to do this here
        // to ensure the socket is open before we send.
        if (matchmakingSocket.readyState === WebSocket.OPEN) {
            matchmakingSocket.send(JSON.stringify({ type: 'get-games' }));
        }
        peerInitialized = true;
    };

    matchmakingSocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        // Forward server messages to the UI
        dispatchNetworkEvent('data-received', { peerId: 'server', data });
    };

    matchmakingSocket.onerror = (error) => {
        console.error('Matchmaking WebSocket error:', error);
        // Make the error more specific and user-friendly.
        const detail = { error: { type: 'matchmaking_server_error', message: 'Could not connect to the matchmaking server. Is it running?' } };
        dispatchNetworkEvent('connection-error', detail);
        // Don't try to initialize PeerJS if we can't even connect to the matchmaking server.
    };
}

function initializePeer() {
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
        debug: 2, // Set to 3 for most verbose logging, 0 for none.
        secure: true // Required for connections from HTTPS pages (like Vercel)
    });

    peer.on('open', (id) => {
        myId = id;
        console.log(`[Network] Peer object created with ID: ${id}. Ready to host or join.`);
        if (isHostGlobal) {
            // If we decided to host before PeerJS was ready, announce the game now.
            sendData({ type: 'host-game', peerId: myId, nametag: myNametag });
        }
    });

    // This listener is for the HOST to accept incoming connections.
    peer.on('connection', (connection) => {
        console.log(`[Host] Incoming connection from ${connection.peer}.`);
        pendingConnections.set(connection.peer, connection);
        // Ensure metadata and nametag exist before dispatching.
        const nametag = (connection.metadata && connection.metadata.nametag) ? connection.metadata.nametag : 'Guest';
        dispatchNetworkEvent('pending-connection', { peerId: connection.peer, nametag: nametag });
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


export function acceptConnection(peerId) {
    const connection = pendingConnections.get(peerId);
    if (!connection) {
        console.error(`[Host] No pending connection found for peer ID: ${peerId}`);
        return;
    }

    // The 'open' event will fire when the connection is established and ready for data.
    connection.on('open', () => {
        console.log(`[Host] Connection to ${connection.peer} is now open.`);

        // Now that the connection is open, add it to our active connections and set up listeners.
        setupConnectionListeners(connection);
        connections.push(connection);
        // This event is for the host's UI, if needed.
        dispatchNetworkEvent('host-player-joined', { peerId: connection.peer, metadata: connection.metadata });

        // 1. Welcome the new player with the list of existing players.
        const playerListForNewcomer = connections.map(c => ({ peerId: c.peer, nametag: c.metadata.nametag }));
        playerListForNewcomer.push({ peerId: myId, nametag: myNametag });
        console.log(`[Host] Sending 'welcome' to new player ${connection.peer}`);
        connection.send({ type: 'welcome', players: playerListForNewcomer });

        // 2. Inform all OTHER players about the new player.
        console.log(`[Host] Announcing 'new-player' ${connection.peer} to others.`);
        sendData({ type: 'new-player', peerId: connection.peer, nametag: connection.metadata.nametag }, [connection.peer]); // Exclude the new player

        // 3. Update the lobby UI for the host.
        const playerListForLobby = connections.map(c => ({ nametag: c.metadata.nametag })).concat({ nametag: myNametag });
        dispatchNetworkEvent('player-list-updated', { players: playerListForLobby });
    });

    pendingConnections.delete(peerId);
}

export function declineConnection(peerId) {
    const connection = pendingConnections.get(peerId);
    if (connection) connection.close(); // This will trigger the 'close' event on the client
    pendingConnections.delete(peerId);
}

export function sendData(data, excludePeerIds = []) {
    // Check if the message is for the matchmaking server
    if (['host-game', 'get-games', 'get-peer-id'].includes(data.type)) {
        if (matchmakingSocket && matchmakingSocket.readyState === WebSocket.OPEN) {
            matchmakingSocket.send(JSON.stringify(data));
        } else {
            const errorMsg = 'Matchmaking server not connected.';
            console.error(errorMsg);
            // Also dispatch an event so the UI can show this error to the user.
            const detail = { error: { type: 'matchmaking_server_error', message: errorMsg } };
            dispatchNetworkEvent('connection-error', detail);
        }
    } else { // Otherwise, it's a P2P message for other players
        const excluded = new Set(excludePeerIds);
        connections.forEach(conn => {
            if (conn && conn.open && !excluded.has(conn.peer)) {
                conn.send(data);
            }
        });
    }
}

export function getConnections() {
    return connections;
}

export function getMyId() {
    return myId;
}

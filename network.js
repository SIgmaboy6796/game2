import Peer from 'peerjs';

let peer;
let connections = [];
let isHostGlobal = false;
let myId = null;
let myNametag = '';
let ws; // WebSocket for matchmaking
let isConnectingToMatchmaker = false;


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
    connectToMatchmakingServer();
    initializePeer();
}

function connectToMatchmakingServer() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        return; // Already connected or connecting
    }
    isConnectingToMatchmaker = true;
    
    // *** IMPORTANT: Make sure this points to your deployed server address ***
    const isLocal = window.location.host.includes('localhost');
    const protocol = isLocal ? 'ws://' : 'wss://';
    const host = isLocal ? 'localhost:8080' : 'call-match1.onrender.com';
    
    ws = new WebSocket(`${protocol}${host}`);

    ws.onopen = () => {
        isConnectingToMatchmaker = false;
        console.log('[Network] Connected to matchmaking server.');
        dispatchNetworkEvent('matchmaking-connected');
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('[Network] Received from matchmaking:', data);

        if (data.type === 'game-hosted') {
            dispatchNetworkEvent('game-hosted-success', { roomCode: data.roomCode });
        } else if (data.type === 'peer-id-response') {
            dispatchNetworkEvent('host-peer-id-received', { peerId: data.peerId });
        } else if (data.type === 'error') {
            dispatchNetworkEvent('matchmaking-error', { message: data.message });
        }
    };

    ws.onclose = () => {
        isConnectingToMatchmaker = false;
        console.log('[Network] Disconnected from matchmaking server.');
        dispatchNetworkEvent('matchmaking-disconnected');
    };

    ws.onerror = (error) => {
        isConnectingToMatchmaker = false;
        console.error('[Network] WebSocket error:', error);
        dispatchNetworkEvent('matchmaking-error', { message: 'Could not connect to matchmaking server.' });
    };
}

function initializePeer() {
    // By passing `undefined` as the first argument, we use the public PeerJS cloud server.
    peer = new Peer(undefined, {
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                {
                    urls: "turn:global.turn.twilio.com:3478?transport=udp",
                    username: "79f24cb51555599834925835569b9190539d675440b84803d13c32021651a033",
                    credential: "Z0a/b7zRBK23jA/3JPSA/wV7sAnOFR3v/hMAaM+2O4s="
                }
            ],
            iceTransportPolicy: 'all' // Important for local testing and some network setups
        },
        debug: 2 // Set to 2 for logs, 0 for none.
    });

    peer.on('open', (id) => {
        myId = id;
        console.log(`[Network] Peer object created with ID: ${id}. Ready to host or join.`);
        // Notify the UI that the peer is ready and pass it the ID.
        dispatchNetworkEvent('peer-ready', { peerId: id });
    });

    // This listener is for the HOST to accept incoming connections.
    peer.on('connection', (connection) => {
        if (isHostGlobal) {
            console.log(`[Host] Auto-accepting incoming connection from ${connection.peer}.`);
            setupConnectionListeners(connection); // Set up listeners immediately.
            // Wait for the connection to be fully open before handling it.
            connection.on('open', () => {
                // The 'open' event guarantees the connection is ready for data.
                handleNewConnection(connection);
            });
        } else {
            // If we are not the host, we should not be receiving connections.
            console.warn(`Received unexpected connection from ${connection.peer} as a client. Closing it.`);
            connection.close();
        }
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

function handleNewConnection(connection) {
    console.log(`[Host] Connection to ${connection.peer} is now open.`);

    // Now that the connection is open, add it to our active connections.
    connections.push(connection);
    // This event is for the host's UI.
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
}

export function sendData(data, excludePeerIds = []) {
    // Send a P2P message to other players
    const excluded = new Set(excludePeerIds);
    connections.forEach(conn => {
        if (conn && conn.open && !excluded.has(conn.peer)) {
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

// --- Matchmaking Functions ---

export const hostGame = (peerId) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'host-game', peerId: peerId }));
    } else {
        console.error('[Network] WebSocket not connected. Cannot host game.');
        dispatchNetworkEvent('matchmaking-error', { message: 'Not connected to matchmaking server.' });
    }
}
export const getHostPeerId = (roomCode) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'get-peer-id', roomCode }));
    } else {
        console.error('[Network] WebSocket not connected. Cannot get host peer ID.');
        dispatchNetworkEvent('matchmaking-error', { message: 'Not connected to matchmaking server.' });
    }
}

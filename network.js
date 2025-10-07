import Peer from 'peerjs';

let peer;
let connections = [];
let isHostGlobal = false;
const pendingConnections = new Map();
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
        debug: 2, // Set to 3 for most verbose logging, 0 for none.
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

    // The connection object received in the 'connection' event on the host
    // is already open and ready for data. We can proceed directly.
    console.log(`[Host] Finalizing connection for peer: ${connection.peer}`);

    // Now, add the new connection and set up its listeners.
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

    pendingConnections.delete(peerId);
}

export function declineConnection(peerId) {
    const connection = pendingConnections.get(peerId);
    if (connection) connection.close(); // This will trigger the 'close' event on the client
    pendingConnections.delete(peerId);
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

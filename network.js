let peer;
let conn;
let isHost = false;

export function init(nametag, hostId) {
    if (hostId) {
        // Join a game
        isHost = false;
        peer = new Peer();
        conn = peer.connect(hostId);

        conn.on('open', () => {
            console.log('Connected to peer');
        });
    } else {
        // Host a game
        isHost = true;
        peer = new Peer();
        peer.on('open', (id) => {
            const joinIdDisplay = document.getElementById('joinIdDisplay');
            joinIdDisplay.textContent = `Your Host ID is: ${id}`;
            joinIdDisplay.style.display = 'block';
        });
        peer.on('connection', (connection) => {
            conn = connection;
            conn.on('open', () => {
                console.log('Peer connected');
            });
        });
    }

    // Handle receiving data
    conn.on('data', (data) => {
        // Handle received data (e.g., player movement, shots)
        console.log('Received data:', data);
    });
}

export function sendData(data) {
    if (conn) {
        conn.send(data);
    }
}
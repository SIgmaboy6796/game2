import { objectsToUpdate, players } from '/game.js';
import { getConnections } from '/network.js';

function logPlayers(toString = false) {
    let output = "--- Players ---\n";
    const playerIds = Object.keys(players);
    if (playerIds.length === 0) {
        output += "No other players in the scene.";
    } else {
        playerIds.forEach((id) => {
            const player = players[id];
            output += `Player (${player.nametag || 'unknown'}): PeerID: ${id}\n`;
            // You can add more player details here if needed
            // e.g., output += `  Position: ${player.position.x.toFixed(2)}, ${player.position.y.toFixed(2)}, ${player.position.z.toFixed(2)}\n`;
        });
    }
    if (toString) return output;
    console.log(output);
}

function logObjects(toString = false) {
    let output = "--- Objects to Update ---\n";
    output += `There are ${objectsToUpdate.length} dynamic objects.`;
    if (toString) return output;
    console.log(output);
    console.log(objectsToUpdate); // For detailed inspection in console
}

function logConnections(toString = false) {
    let output = "--- Network Connections ---\n";
    const connections = getConnections();
    if (connections.length === 0) {
        output += "No active connections.";
    } else {
        connections.forEach((conn, index) => {
            output += `Connection ${index}: PeerID: ${conn.peer}, Open: ${conn.open}, Reliable: ${conn.reliable}\n`;
        });
    }
    if (toString) return output;
    console.log(output);
}

export { logPlayers, logObjects, logConnections };
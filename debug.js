import { players, objectsToUpdate } from '/game.js';
import { getConnections } from '/network.js';

function logPlayers() {
    console.log("--- Players ---");
    if (players.length === 0) {
        console.log("No players in the list.");
        return;
    }
    players.forEach((p, index) => {
        console.log(`Player ${index} (${p.nametag}):`, p);
    });
}

function logObjects() {
    console.log("--- Objects to Update ---");
    console.log(`There are ${objectsToUpdate.length} objects.`);
    console.log(objectsToUpdate);
}

function logConnections() {
    console.log("--- Network Connections ---");
    console.log(getConnections());
}

export { logPlayers, logObjects, logConnections };
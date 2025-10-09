# Project: 3D Shooter Game

This project is a 3D first-person shooter (FPS) game built with modern web technologies. It features both single-player and peer-to-peer multiplayer modes.

## Core Technologies

*   **Three.js:** A cross-browser JavaScript library and application programming interface (API) used to create and display animated 3D computer graphics in a web browser.
*   **Cannon-es:** A lightweight and simple-to-use 3D physics engine for the web.
*   **PeerJS:** A library that simplifies WebRTC peer-to-peer data connections for multiplayer functionality.
*   **JavaScript (ESM):** The game is written in modern JavaScript using ES modules.

## Project Structure

*   `index.html`: The main entry point of the application. It sets up the HTML document, styles the crosshair, and loads the necessary scripts.
*   `game.js`: This file contains the entire game logic, including scene setup, physics, controls, and the game loop.
*   `network.js`: Handles the PeerJS setup for peer-to-peer multiplayer connections.
*   `gun_data.js`: This file contains the data for the different weapons available in the game.
*   `PointerLockControls.js`: A Three.js addon used to implement first-person camera controls, loaded via the import map.
*   `textures/`: This directory contains texture files used for the game's materials (e.g., `grass.jpg`, `skybox.jpg`).

## Game Mechanics

*   **Single Player Mode:** The game can be played in a single-player mode without a network connection.
*   **Multiplayer Mode:** The game supports multiplayer functionality using PeerJS for peer-to-peer connections.
*   **3D Environment:** The game creates a 3D world with a ground plane, randomly placed boxes, and is enclosed by four walls.
*   **Physics:** Cannon-es is used to simulate gravity and collisions between objects in the scene. The player and boxes are physical bodies that a user can interact with.
*   **First-Person Controls:** The player can look around using the mouse (pointer lock) and move using the 'W', 'A', 'S', and 'D' keys.
*   **Jumping:** The player can jump using the 'Space' key.
*   **Shooting:** The player can shoot projectiles (spheres) by left-clicking the mouse. These projectiles are also simulated in the physics world.
*   **Weapon System:** The game includes a weapon switching system with a pistol, shotgun, and rocket launcher. Each weapon has different properties like ammo capacity, fire rate, and bullet type.
*   **UI Elements:** The game displays the player's ammo count and health bar.
*   **Nametags:** The game can display a player's nametag.
*   **Pause Menu:** The player can pause the game by pressing the 'Escape' key, which brings up a menu with options to resume or view keybindings.
*   **Damage and Respawn:** The player can take damage from physics objects and will respawn upon death.
*   **Dynamic Objects:** The boxes in the scene are dynamic objects that can be pushed around by the player and other objects. Bullets can also create dents on the boxes they hit.
*   **Bullet Types:** The game features different bullet types, including standard bullets, pellets for the shotgun, and rockets for the rocket launcher.
*   **Rocket Explosions:** Rockets create explosions that apply an impulse to nearby objects.

## How to Run the Game

1. Serve the project directory using a local web server.
2. Open the served `index.html` file in your web browser (e.g., `http://localhost:8000`).
3. Choose between single-player or multiplayer mode.
4. Click on the screen to lock the pointer and enable controls.
5. Use the mouse to look around, 'W', 'A', 'S', 'D' to move, and 'Space' to jump.
6. Left-click to shoot.
7. Use the number keys (1, 2, 3) to switch between weapons.
8. Press 'R' to reload your weapon.

## Testing Multiplayer
To test the multiplayer functionality, you can open the game in two separate browser tabs or windows.
1.  In the first tab, enter a nametag and click "Multiplayer".
2.  Click "Host Game". A 4-letter Room Code will be generated and displayed.
3.  Copy the Room Code.
4.  In the second tab, enter a different nametag and click "Multiplayer".
5.  Click "Join Game", paste the Room Code from the first tab into the input field, and click "Connect".
6.  Once the second player has joined, the host (the first tab) can click "Start Game" to launch the session for both players.

## Deploying the Matchmaking Server

The game uses a lightweight matchmaking server to handle room codes. This server needs to be hosted online for players to connect from different networks. The following steps guide you through deploying it for free on Back4App.

### Prerequisites
*   A [GitHub](https://github.com/) account.
*   A [Back4App](https://www.back4app.com/) account.

### Deployment Steps
1.  **Create `package.json`**: Make sure you have a `package.json` file in your project root that defines the `ws` dependency and a `start` script.
2.  **Install Dependencies**: Open a terminal in your project folder and run `npm install`. This creates a `node_modules` folder and a `package-lock.json` file.
3.  **Push to GitHub**: Create a new GitHub repository and push your project to it. Make sure to include `server.js`, `package.json`, `package-lock.json`, and `Dockerfile`.
4.  **Deploy on Back4App**:
    *   Log in to your Back4App account and go to your dashboard.
    *   Click on "NEW APP" and select "Containers as a Service".
    *   Connect your GitHub account and select the repository containing your game server.
    *   Give your app a name (e.g., `pew-shoot-server`). Back4App will automatically detect the `Dockerfile` and use it for the build.
    *   Click "Create App". Back4App will build and deploy your server.
5.  **Configure Client**:
    *   Once deployed, Back4App will provide you with a public URL (e.g., `pew-shoot-server-p123.b4a.run`).
    *   Copy this URL.
    *   Open `network.js` and replace the placeholder `'pew-shoot-matchmaking.onrender.com'` with your new Back4App URL.
    *   Your game client will now be able to connect to your live matchmaking server.
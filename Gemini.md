# Project: 3D Shooter Game

This project is a 3D first-person shooter (FPS) game developed using JavaScript, Three.js for 3D rendering, and Cannon-es for physics simulation.

## Core Technologies

*   **Three.js:** A cross-browser JavaScript library and application programming interface (API) used to create and display animated 3D computer graphics in a web browser.
*   **Cannon-es:** A lightweight and simple-to-use 3D physics engine for the web.
*   **JavaScript (ESM):** The game is written in modern JavaScript using ES modules.

## Project Structure

*   `index.html`: The main entry point of the application. It sets up the HTML document, styles the crosshair, and loads the necessary scripts.
*   `game.js`: This file contains the entire game logic, including scene setup, physics, controls, and the game loop.
*   `gun_data.js`: This file contains the data for the different weapons available in the game.
*   `network.js`: This file is for handling the client-side networking.
*   `PointerLockControls.js`: A Three.js addon used to implement first-person camera controls.
*   `three.module.js` & `cannon.min.js`: The core libraries for Three.js and Cannon-es.
*   `textures/`: This directory contains texture files used for the game's materials (e.g., `grass.jpg`, `skybox.jpg`).
*   `test-server.js`: A simple WebSocket server for testing multiplayer functionality.

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

1.  Serve the project directory using a local web server.
2.  Open the `index.html` file in a web browser.
3.  Choose between single-player or multiplayer mode.
4.  Click on the screen to lock the pointer and enable controls.
5.  Use the mouse to look around, 'W', 'A', 'S', 'D' to move, and 'Space' to jump.
6.  Left-click to shoot.
7.  Use the number keys (1, 2, 3) to switch between weapons.
8.  Press 'R' to reload your weapon.

## Testing Multiplayer

To test the multiplayer functionality without a second player, you can use the provided test server. The test server will echo back any data it receives, allowing you to verify the network connection and data transmission.

**1. Install Node.js and npm:**

Before running the test server, you need to have Node.js and npm (Node Package Manager) installed on your system. You can download them from the official Node.js website: [https://nodejs.org/](https://nodejs.org/)

**2. Install Dependencies:**

Once you have Node.js and npm installed, open your terminal in the project directory and run the following command to install the `ws` WebSocket library:

```
npm install ws
```

**3. Run the Test Server:**

In your terminal, run the following command to start the test server:

```
node test-server.js
```

The server will start on `ws://localhost:8080`.

**4. Connect from the Game:**

When you are in the game, you will have to manually edit the `network.js` file to connect to the test server. Change the `hostId` to your localhost `ws://localhost:8080`.
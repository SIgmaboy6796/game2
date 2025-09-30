
# Project: 3D Shooter Game

This project is a 3D first-person shooter (FPS) game developed using JavaScript, Three.js for 3D rendering, and Cannon-es for physics simulation.

## Core Technologies

*   **Three.js:** A cross-browser JavaScript library and application programming interface (API) used to create and display animated 3D computer graphics in a web browser.
*   **Cannon-es:** A lightweight and simple-to-use 3D physics engine for the web.
*   **JavaScript (ESM):** The game is written in modern JavaScript using ES modules.

## Project Structure

*   `index.html`: The main entry point of the application. It sets up the HTML document, styles the crosshair, and loads the necessary scripts.
*   `game.js`: This file contains the entire game logic, including scene setup, physics, controls, and the game loop.
*   `PointerLockControls.js`: A Three.js addon used to implement first-person camera controls.
*   `three.module.js` & `cannon.min.js`: The core libraries for Three.js and Cannon-es.
*   `textures/`: This directory contains texture files used for the game's materials (e.g., `grass.jpg`, `skybox.jpg`).

## Game Mechanics

*   **3D Environment:** The game creates a 3D world with a ground plane and randomly placed boxes.
*   **Physics:** Cannon-es is used to simulate gravity and collisions between objects in the scene. The player and boxes are physical bodies that interact with the environment.
*   **First-Person Controls:** The player can look around using the mouse (pointer lock) and move using the 'W', 'A', 'S', and 'D' keys.
*   **Jumping:** The player can jump using the 'Space' key.
*   **Shooting:** The player can shoot projectiles (spheres) by left-clicking the mouse. These projectiles are also simulated in the physics world.
*   **Dynamic Objects:** The boxes in the scene are dynamic objects that can be pushed around by the player and other objects.

## How to Run the Game

1.  Serve the project directory using a local web server.
2.  Open the `index.html` file in a web browser.
3.  Click on the screen to lock the pointer and enable controls.
4.  Use the mouse to look around, 'W', 'A', 'S', 'D' to move, and 'Space' to jump.
5.  Left-click to shoot.

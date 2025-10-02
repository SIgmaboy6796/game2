import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

function init() {
    // --- SETUP ---
    const scene = new THREE.Scene();
    const world = new CANNON.World({
        gravity: new CANNON.Vec3(0, -9.82, 0), // m/s²
    });
    world.broadphase = new CANNON.SAPBroadphase(world);
    world.allowSleep = true;

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    // --- LIGHTING ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // --- SKYBOX ---
    const loader = new THREE.TextureLoader();
    const texture = loader.load(
        'textures/skybox.jpg',
        () => {
          const rt = new THREE.WebGLCubeRenderTarget(texture.image.height);
          rt.fromEquirectangularTexture(renderer, texture);
          scene.background = rt.texture;
        });

    // --- GROUND ---
    const groundMaterial = new CANNON.Material('groundMaterial');
    const groundBody = new CANNON.Body({
        mass: 0, // mass = 0 makes it static
        shape: new CANNON.Plane(),
        material: groundMaterial,
    });
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // rotate to be horizontal
    world.addBody(groundBody);

    const groundTexture = new THREE.TextureLoader().load('/textures/grass.jpg');
    groundTexture.wrapS = THREE.RepeatWrapping;
    groundTexture.wrapT = THREE.RepeatWrapping;
    groundTexture.repeat.set(10, 10);

    const groundMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(100, 100),
        new THREE.MeshStandardMaterial({ map: groundTexture })
    );
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // --- PLAYER ---
    const playerMaterial = new CANNON.Material('playerMaterial');
    const playerBody = new CANNON.Body({
        mass: 70, // kg
        shape: new CANNON.Sphere(0.5), // radius
        position: new CANNON.Vec3(0, 5, 5),
        material: playerMaterial,
    });
    world.addBody(playerBody);

    // We don't create a visible mesh for the player, as the camera is our "eyes"

    // --- PHYSICS CONTACT MATERIALS ---
    // Define how materials interact (e.g., friction)
    const groundPlayerContactMaterial = new CANNON.ContactMaterial(
        groundMaterial,
        playerMaterial,
        {
            friction: 0.4,
            restitution: 0.0, // No bounce
        }
    );
    world.addContactMaterial(groundPlayerContactMaterial);

    // --- INTERACTIVE OBJECTS (BOXES) ---
    const objectsToUpdate = [];
    const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
    const boxMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });

    for (let i = 0; i < 10; i++) {
        const boxBody = new CANNON.Body({
            mass: 5,
            shape: new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5)),
            position: new CANNON.Vec3(
                (Math.random() - 0.5) * 20,
                Math.random() * 10 + 1,
                (Math.random() - 0.5) * 20
            ),
        });
        world.addBody(boxBody);

        const boxMesh = new THREE.Mesh(boxGeometry, boxMaterial);
        boxMesh.castShadow = true;
        scene.add(boxMesh);

        objectsToUpdate.push({ mesh: boxMesh, body: boxBody });
    }

    // --- CONTROLS ---
    const keys = {};
    document.addEventListener('keydown', (event) => (keys[event.code] = true));
    document.addEventListener('keyup', (event) => (keys[event.code] = false));

    let canJump = false;
    playerBody.addEventListener('collide', (event) => {
        // The player can jump if they are standing on any physical object.
        const contactNormal = new CANNON.Vec3();
        if (event.contact.getImpactVelocityAlongNormal() < 2) { // Impact velocity is low
          canJump = true;
        }
    });

    // Mouse Look (First-Person)
    const controls = new PointerLockControls(camera, renderer.domElement);
    scene.add(controls.getObject());

    const pauseMenu = document.getElementById('pauseMenu');
    const keybindsMenu = document.getElementById('keybindsMenu');
    const resumeButton = document.getElementById('resumeButton');
    const keybindsButton = document.getElementById('keybindsButton');
    const backButton = document.getElementById('backButton');

    controls.addEventListener('lock', () => {
        isPaused = false;
        pauseMenu.style.display = 'none';
        keybindsMenu.style.display = 'none';
    });

    controls.addEventListener('unlock', () => {
        isPaused = true;
        pauseMenu.style.display = 'block';
    });

    resumeButton.addEventListener('click', () => {
        controls.lock();
    });

    keybindsButton.addEventListener('click', () => {
        pauseMenu.style.display = 'none';
        keybindsMenu.style.display = 'block';
    });

    backButton.addEventListener('click', () => {
        keybindsMenu.style.display = 'none';
        pauseMenu.style.display = 'block';
    });

    document.body.addEventListener('click', () => {
        if (!isPaused) {
            controls.lock();
        }
    });

    const moveSpeed = 5;
    const jumpForce = 7;

    function handleControls(deltaTime) {
        // Get camera's forward and right vectors
        const forward = new THREE.Vector3();
        const right = new THREE.Vector3();
        controls.getDirection(forward);
        right.crossVectors(camera.up, forward).normalize();

        const moveDirection = new THREE.Vector3();
        if (keys['KeyW']) moveDirection.add(forward);
        if (keys['KeyS']) moveDirection.sub(forward);
        if (keys['KeyA']) moveDirection.add(right);
        if (keys['KeyD']) moveDirection.sub(right);

        moveDirection.y = 0; // Don't allow flying
        if (moveDirection.lengthSq() > 0) { // To prevent normalizing a zero vector which results in NaN
            moveDirection.normalize();
        }

        // Update player's velocity
        const currentVelocityY = playerBody.velocity.y;
        playerBody.velocity.x = moveDirection.x * moveSpeed;
        playerBody.velocity.z = moveDirection.z * moveSpeed;
        playerBody.velocity.y = currentVelocityY; // Preserve vertical velocity (gravity)

        // Jumping
        if (keys['Space'] && canJump) {
            playerBody.velocity.y = jumpForce;
            canJump = false;
        }
    }

    // --- GAME LOOP ---
    let isPaused = false;
    const clock = new THREE.Clock();
    let oldElapsedTime = 0;

    function animate() {
        requestAnimationFrame(animate);

        if (isPaused) {
            // To prevent time jump when unpausing
            oldElapsedTime = clock.getElapsedTime();
            return;
        }

        const elapsedTime = clock.getElapsedTime();
        const deltaTime = elapsedTime - oldElapsedTime;
        oldElapsedTime = elapsedTime;

        // Update physics world
        world.step(1 / 60, deltaTime, 3);

        // Handle player movement
        handleControls(deltaTime);

        // Update camera to follow player's physics body
        controls.getObject().position.copy(playerBody.position);

        // Update visual objects from physics bodies
        for (const obj of objectsToUpdate) {
            obj.mesh.position.copy(obj.body.position);
            obj.mesh.quaternion.copy(obj.body.quaternion);
        }

        renderer.render(scene, camera);
    }

    animate();

    // --- RESIZE ---
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // --- SHOOTING LOGIC (Example) ---

    function shoot() {
        // Create a bullet (visual and physical)
        const bulletRadius = 0.1;
        const bulletSpeed = 50;

        const shootDirection = new THREE.Vector3();
        controls.getDirection(shootDirection);

        const startPosition = new THREE.Vector3();
        startPosition.copy(controls.getObject().position);
        startPosition.add(shootDirection.clone().multiplyScalar(1)); // Start 1 unit in front of the camera

        const bulletBody = new CANNON.Body({
            mass: 0.1,
            shape: new CANNON.Sphere(bulletRadius),
            position: new CANNON.Vec3().copy(startPosition),
        });

        const bulletMesh = new THREE.Mesh(
            new THREE.SphereGeometry(bulletRadius, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xffff00 })
        );
        bulletMesh.position.copy(startPosition);

        bulletBody.velocity.set(
            shootDirection.x * bulletSpeed,
            shootDirection.y * bulletSpeed,
            shootDirection.z * bulletSpeed
        );

        // Event listener for collision
        bulletBody.addEventListener('collide', (event) => {
            const contact = event.contact;
            const bodyA = contact.bi;
            const bodyB = contact.bj;
            const targetBody = (bodyA === bulletBody) ? bodyB : bodyA;
            const contactPointOnTarget = (bodyA === bulletBody) ? contact.rj : contact.ri;

            // Apply impulse to dynamic bodies
            if (targetBody.mass > 0) {
                const impulse = bulletBody.velocity.scale(bulletBody.mass);
                const worldContactPoint = new CANNON.Vec3();
                targetBody.pointToWorldFrame(contactPointOnTarget, worldContactPoint);
                targetBody.applyImpulse(impulse, worldContactPoint);

                // Create a dent
                const dentPosition = new THREE.Vector3();
                dentPosition.copy(worldContactPoint);
                const dentGeometry = new THREE.SphereGeometry(0.05, 4, 4);
                const dentMaterial = new THREE.MeshBasicMaterial({ color: 0x333333 });
                const dentMesh = new THREE.Mesh(dentGeometry, dentMaterial);
                dentMesh.position.copy(dentPosition);
                scene.add(dentMesh);

                setTimeout(() => {
                    scene.remove(dentMesh);
                }, 2000);
            }

            // Remove bullet on impact
            world.removeBody(bulletBody);
            const obj = objectsToUpdate.find(obj => obj.body === bulletBody);
            if (obj) {
                scene.remove(obj.mesh);
                const index = objectsToUpdate.findIndex(o => o.body === bulletBody);
                if (index > -1) {
                    objectsToUpdate.splice(index, 1);
                }
            }
        });

        // Add to worlds
        world.addBody(bulletBody);
        scene.add(bulletMesh);
        objectsToUpdate.push({ mesh: bulletMesh, body: bulletBody });
    }


    window.addEventListener('mousedown', (event) => {
        if (controls.isLocked && event.button === 0) { // Left click
            shoot();
        }
    });
}

window.addEventListener('DOMContentLoaded', init);
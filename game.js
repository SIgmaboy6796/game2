import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PointerLockControls } from './PointerLockControls.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { weapons } from './gun_data.js'; // This was missing from the context, but is fine.
import { sendData } from './network.js';
import { getMyId } from './network.js';
import { loadKeybinds } from './keybinds.js';
import { InstancedBufferAttribute } from 'three';

export const objectsToUpdate = [];
export const players = {};
let myPlayerId = null;
let gameFont = null; // To be used for weapon respawn timers
export function init(nametag, isMultiplayer = false, isHost = false) {
    // --- SETUP ---
    const keybinds = loadKeybinds();

    const scene = new THREE.Scene(); // This should be accessible to createPlayer
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

    if (isMultiplayer) {
        myPlayerId = getMyId(); // This is the local player's peer ID
        if (myPlayerId) console.log(`Game initialized for multiplayer with my ID: ${myPlayerId}`);
    }

    // --- NAMETAG ---
    let nametagMesh;
    const fontLoader = new FontLoader();
    fontLoader.load('https://unpkg.com/three@0.160.0/examples/fonts/helvetiker_regular.typeface.json', (font) => {
        gameFont = font; // Store the font for later use
        // Font is now loaded, we can create the local player's nametag
        if (nametag) {
            nametagMesh = createNametag(nametag, font);
            scene.add(nametagMesh);
        }
        // Now that all assets are ready, dispatch the event.
        window.dispatchEvent(new CustomEvent('game-initialized', {
            detail: { scene: scene, handleShoot: handleShoot, font: gameFont }
        }));
    });
    // --- UI ---
    const ammoCounter = document.getElementById('ammoCounter');
    const healthBar = document.getElementById('health');
    const scopeOverlay = document.getElementById('scope-overlay');
    const rocketScopeOverlay = document.getElementById('rocket-scope-overlay');
    rocketScopeOverlay.style.opacity = 0; // Initialize opacity

    function updateAmmoUI() {
        if (isReloading) {
            ammoCounter.textContent = 'Reloading...';
        } else {
            ammoCounter.textContent = `${currentWeapon.ammo} / ${currentWeapon.reserveAmmo}`;
        }
    }

    function updateHealthUI() {
        healthBar.style.width = `${playerBody.health}%`;
    }

    // --- WEAPONRY ---
    let gunMesh;
    let currentWeaponName = 'pistol';
    let currentWeapon = weapons[currentWeaponName];
    const unlockedWeapons = { 'pistol': true, 'shotgun': false, 'rocketLauncher': false, 'sniperRifle': false };
    const activeRockets = []; // To track rockets for smoke trails
    const smokeParticles = []; // To manage smoke particles

    let canShoot = true;
    let isReloading = false;

    // --- SCOPING ---
    let isScoping = false;
    const defaultFov = 75;
    const scopeSpeed = 0.15;

    function switchWeapon(weaponName) {
        if (!unlockedWeapons[weaponName]) {
            console.log(`${weaponName} is not unlocked.`);
            return;
        }
        if (gunMesh) {
            gunMesh.visible = false; // Hide previous gun
            camera.remove(gunMesh);
            gunMesh = null; // Clear reference
        }
        currentWeaponName = weaponName;
        currentWeapon = weapons[currentWeaponName];

        // Create new gun model
        // When cloning a model, we need to make sure we are not re-using the same material instances
        if (currentWeapon.model.isGroup) { 
            gunMesh = currentWeapon.model.clone();
            gunMesh.traverse(child => {
                if(child.isMesh) child.material = child.material.clone();
            });
        } else {
            gunMesh = new THREE.Mesh(currentWeapon.model, new THREE.MeshStandardMaterial({ color: 0x333333 }));
        }
        gunMesh.position.copy(currentWeapon.position);

        camera.add(gunMesh);
        console.log(`Switched to ${currentWeaponName}`);
        updateAmmoUI();
    }


    // --- LIGHTING ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // --- SKYBOX ---
    const skyboxLoader = new THREE.TextureLoader();
    const skyboxTexture = skyboxLoader.load('textures/skybox.jpg');
    skyboxTexture.mapping = THREE.EquirectangularReflectionMapping;
    skyboxTexture.colorSpace = THREE.SRGBColorSpace;

    const skyboxGeometry = new THREE.SphereGeometry(500, 60, 40);
    skyboxGeometry.scale(-1, 1, 1); // Invert the sphere to be viewed from the inside
    const skyboxMaterial = new THREE.MeshBasicMaterial({ map: skyboxTexture });
    const skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterial);
    scene.add(skybox);

    // --- GROUND ---
    const groundMaterial = new CANNON.Material('groundMaterial');
    const groundBody = new CANNON.Body({ // This is fine, but I'll use a more descriptive name
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

    // --- WALLS ---
    const wallMaterial = new CANNON.Material('wallMaterial');

    // Wall 1 (positive Z)
    const wall1 = new CANNON.Body({
        mass: 0,
        shape: new CANNON.Plane(),
        material: wallMaterial,
        position: new CANNON.Vec3(0, 0, -50),
    });
    wall1.quaternion.setFromEuler(0, 0, 0);
    world.addBody(wall1);

    // Wall 2 (negative Z)
    const wall2 = new CANNON.Body({
        mass: 0,
        shape: new CANNON.Plane(),
        material: wallMaterial,
        position: new CANNON.Vec3(0, 0, 50),
    });
    wall2.quaternion.setFromEuler(0, Math.PI, 0);
    world.addBody(wall2);

    // Wall 3 (positive X)
    const wall3 = new CANNON.Body({
        mass: 0,
        shape: new CANNON.Plane(),
        material: wallMaterial,
        position: new CANNON.Vec3(50, 0, 0),
    });
    wall3.quaternion.setFromEuler(0, -Math.PI / 2, 0);
    world.addBody(wall3);

    // Wall 4 (negative X)
    const wall4 = new CANNON.Body({
        mass: 0,
        shape: new CANNON.Plane(),
        material: wallMaterial,
        position: new CANNON.Vec3(-50, 0, 0),
    });
    wall4.quaternion.setFromEuler(0, Math.PI / 2, 0);
    world.addBody(wall4);

    // --- PLAYER ---
    // Collision groups
    const PLAYER = 1;
    const BULLET = 2;
    const BOX = 4;
    const GROUND = 8;


    const playerMaterial = new CANNON.Material('playerMaterial');
    const playerBody = new CANNON.Body({
        mass: 70, // kg
        shape: new CANNON.Sphere(0.5), // radius
        position: new CANNON.Vec3(0, 5, 5),
        material: playerMaterial,
    });
    playerBody.collisionFilterGroup = PLAYER;
    playerBody.collisionFilterMask = BOX | PLAYER | GROUND; // Player collides with boxes, other players, and the ground
    playerBody.health = 100;
    playerBody.allowSleep = false;
    world.addBody(playerBody);

    // --- PHYSICS CONTACT MATERIALS ---
    const groundPlayerContactMaterial = new CANNON.ContactMaterial(
        groundMaterial,
        playerMaterial,
        {
            friction: 0.4,
            restitution: 0.0, // No bounce
            contactEquationStiffness: 1e8,
        }
    );
    world.addContactMaterial(groundPlayerContactMaterial);

    const wallPlayerContactMaterial = new CANNON.ContactMaterial(
        wallMaterial,
        playerMaterial,
        {
            friction: 0.0,
            restitution: 0.5, // Bouncy
        }
    );
    world.addContactMaterial(wallPlayerContactMaterial);

    const boxCannonMaterial = new CANNON.Material('boxMaterial');

    const wallBoxContactMaterial = new CANNON.ContactMaterial(
        wallMaterial,
        boxCannonMaterial,
        {
            friction: 0.1,
            restitution: 0.5,
        }
    );
    world.addContactMaterial(wallBoxContactMaterial);

    const groundBoxContactMaterial = new CANNON.ContactMaterial(
        groundMaterial,
        boxCannonMaterial,
        {
            friction: 0.5,
            restitution: 0.2,
        }
    );
    world.addContactMaterial(groundBoxContactMaterial);

    const boxBoxContactMaterial = new CANNON.ContactMaterial(
        boxCannonMaterial,
        boxCannonMaterial,
        {
            friction: 0.2,
            restitution: 0.5,
        }
    );
    world.addContactMaterial(boxBoxContactMaterial);

    const bulletMaterial = new CANNON.Material('bulletMaterial');
    const playerBulletContactMaterial = new CANNON.ContactMaterial(
        playerMaterial,
        bulletMaterial,
        {
            contactEquationStiffness: 0 // No collision response
        }
    );
    world.addContactMaterial(playerBulletContactMaterial);

    // --- INTERACTIVE OBJECTS (BOXES) ---
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
            material: boxCannonMaterial,
        });
        boxBody.collisionFilterGroup = BOX;
        boxBody.collisionFilterMask = PLAYER | BULLET | BOX | GROUND; // Box collides with everything
        world.addBody(boxBody);

        const boxMesh = new THREE.Mesh(boxGeometry, boxMaterial);
        boxMesh.castShadow = true;
        scene.add(boxMesh);

        objectsToUpdate.push({ mesh: boxMesh, body: boxBody });
    }

    // Assign ground to its collision group
    groundBody.collisionFilterGroup = GROUND;
    groundBody.collisionFilterMask = PLAYER | BOX | BULLET; // Ground collides with player, boxes, and bullets



    // --- SCENERY (TABLES, CHAIRS, ETC.) ---
    function createScenery() {
        // The table has been temporarily removed.
        // const fbxLoader = new FBXLoader();
        // const textureLoader = new THREE.TextureLoader();

        // // --- Load Table ---
        // const tableTexture = textureLoader.load('textures/wood_table.jpg'); // Corrected path
        // const tableMaterial = new THREE.MeshStandardMaterial({ map: tableTexture });

        // fbxLoader.load('models/table.fbx', (object) => { // Assumed model path
        //     object.traverse(function (child) {
        //         if (child.isMesh) {
        //             child.material = tableMaterial.clone(); // Use a clone to avoid sharing materials
        //             child.castShadow = true;
        //             child.receiveShadow = true;
        //         }
        //     });
        //     object.scale.set(0.02, 0.02, 0.02); // Adjust scale as needed
        //     scene.add(object);

        //     // Add physics body for the table
        //     const tableShape = new CANNON.Box(new CANNON.Vec3(1, 0.5, 2)); // Adjusted shape to better match a typical table
        //     const tableBody = new CANNON.Body({ mass: 0, shape: tableShape }); // mass: 0 makes it a static body
        //     tableBody.position.set(5, 0.5, 5); // Set position
        //     world.addBody(tableBody);
        //     // No need to add to objectsToUpdate as it's a static body
        // });
    }

    // --- WEAPON PICKUPS ---
    const weaponPickups = [];

    function createWeaponPickup(weaponName, position) {
        const weaponData = weapons[weaponName];
        let pickupMesh;
        if (weaponData.model.isGroup) {
            pickupMesh = weaponData.model.clone();
            pickupMesh.traverse(child => {
                if(child.isMesh) child.material = child.material.clone();
            });
        } else {
            pickupMesh = new THREE.Mesh(weaponData.model, new THREE.MeshStandardMaterial({ color: 0xdddddd }));
        }
        
        pickupMesh.scale.set(2, 2, 2); // Make it bigger so it's easier to see
        pickupMesh.position.copy(position);
        pickupMesh.position.y += 0.5; // Place it on top of the pedestal
        scene.add(pickupMesh);

        // Create pedestal
        const pedestalGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
        const pedestalMaterial = new THREE.MeshStandardMaterial({ color: 0x444444 });
        const pedestalMesh = new THREE.Mesh(pedestalGeometry, pedestalMaterial);
        pedestalMesh.position.copy(position);
        pedestalMesh.position.y -= 0.5; // Position it under the weapon pickup spot
        pedestalMesh.receiveShadow = true;
        scene.add(pedestalMesh);

        // Add pedestal physics body
        const pedestalShape = new CANNON.Cylinder(0.5, 0.5, 1, 16);
        const pedestalBody = new CANNON.Body({ mass: 0, shape: pedestalShape }); // mass 0 makes it static
        pedestalBody.position.copy(pedestalMesh.position);
        world.addBody(pedestalBody);

        // Create timer text mesh (initially invisible)
        const timerMesh = new THREE.Mesh(
            new THREE.BufferGeometry(),
            new THREE.MeshBasicMaterial({ color: 0xffff00 }) // Bright yellow for visibility
        );
        timerMesh.position.copy(position);
        timerMesh.position.y += 1.5; // Position above the pedestal
        scene.add(timerMesh);

        const pickup = {
            name: weaponName,
            mesh: pickupMesh,
            pedestalMesh: pedestalMesh,
            timerMesh: timerMesh,
            isPickedUp: false,
            respawnTime: 15, // 15 seconds to respawn
            respawnTimer: 0,
        };
        weaponPickups.push(pickup);
    }

    createWeaponPickup('shotgun', new THREE.Vector3(10, 0.5, 10));
    createWeaponPickup('rocketLauncher', new THREE.Vector3(-10, 0.5, -10));
    createWeaponPickup('sniperRifle', new THREE.Vector3(0, 0.5, -15));

    // --- CONTROLS ---
    const keys = {};
    document.addEventListener('keydown', (event) => {
        keys[event.code] = true;
        if (event.code === 'Escape' && isPaused) { // This can remain hardcoded
            controls.lock();
        }
        if (event.code === keybinds.reload) {
            reload();
        }
        // Weapon switching
        if (event.code === keybinds.weapon1 && unlockedWeapons.pistol) switchWeapon('pistol');
        if (event.code === keybinds.weapon2 && unlockedWeapons.shotgun) switchWeapon('shotgun');
        if (event.code === keybinds.weapon3 && unlockedWeapons.rocketLauncher) switchWeapon('rocketLauncher');
        if (event.code === keybinds.weapon4 && unlockedWeapons.sniperRifle) switchWeapon('sniperRifle');

        if (event.code === keybinds.pickup) {
            tryPickupWeapon();
        }
    });
    document.addEventListener('keyup', (event) => (keys[event.code] = false));

    document.addEventListener('mousedown', (event) => {
        const mouseBind = `MouseButton${event.button}`;
        keys[mouseBind] = true;
        if (mouseBind === keybinds.scope && !isPaused && currentWeapon.scope) {
            // Toggle scoping state
            isScoping = !isScoping;
        }
    });

    document.addEventListener('mouseup', (event) => {
        keys[`MouseButton${event.button}`] = false;
        // The mouseup event is no longer needed for toggle-to-aim.
        // You can leave this empty or remove it if it's not used for anything else.
    });

    let canJump = false;
    playerBody.addEventListener('collide', (event) => {
        const contact = event.contact;
        const up = new CANNON.Vec3(0, 1, 0);
        const contactNormal = new CANNON.Vec3();
        if (contact.bi.id === playerBody.id) {
            contact.ni.negate(contactNormal);
        } else {
            contactNormal.copy(contact.ni);
        }
        if (contactNormal.dot(up) > 0.5) {
            canJump = true;
        }

        // Damage from physics objects
        const otherBody = event.body;
        if (otherBody.mass > 0) { // It's a dynamic body
            const relativeVelocity = otherBody.velocity.vsub(playerBody.velocity);
            const damage = relativeVelocity.length() * 0.01;
            if (damage > 1) { // Only apply damage if the impact is significant
                applyDamage(damage);
            }
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

    let moveSpeed = 5;
    const jumpForce = 7;

    function handleControls(deltaTime) {
        // Get camera's forward and right vectors
        const forward = new THREE.Vector3();
        const right = new THREE.Vector3();
        controls.getDirection(forward);
        right.crossVectors(camera.up, forward).normalize();

        const moveDirection = new THREE.Vector3();
        if (keys[keybinds.moveForward]) moveDirection.add(forward);
        if (keys[keybinds.moveBackward]) moveDirection.sub(forward);
        if (keys[keybinds.moveLeft]) moveDirection.add(right);
        if (keys[keybinds.moveRight]) moveDirection.sub(right);

        moveDirection.y = 0; // Don't allow flying
        if (moveDirection.lengthSq() > 0) { // To prevent normalizing a zero vector which results in NaN
            moveDirection.normalize();
        }

        // Update player's velocity
        const currentVelocityY = playerBody.velocity.y; // ADS speed reduction
        playerBody.velocity.x = moveDirection.x * moveSpeed;
        playerBody.velocity.z = moveDirection.z * moveSpeed;
        playerBody.velocity.y = currentVelocityY; // Preserve vertical velocity (gravity)

        // Jumping
        if (keys[keybinds.jump] && canJump) {
            playerBody.velocity.y = jumpForce;
            canJump = false;
        }
    }

    function tryPickupWeapon() {
        const pickupDistance = 2; // How close the player needs to be
        for (const pickup of weaponPickups) {
            if (pickup.isPickedUp) continue;

            const distance = playerBody.position.distanceTo(pickup.mesh.position);
            if (distance < pickupDistance) {
                console.log(`Picked up ${pickup.name}`);
                unlockedWeapons[pickup.name] = true;
                pickup.respawnTimer = pickup.respawnTime;
                pickup.isPickedUp = true;
                scene.remove(pickup.mesh);
                scene.add(pickup.timerMesh); // Make timer visible
                
                // Give some reserve ammo on pickup
                weapons[pickup.name].reserveAmmo = Math.min(weapons[pickup.name].maxReserveAmmo, weapons[pickup.name].reserveAmmo + weapons[pickup.name].maxAmmo);
                switchWeapon(pickup.name); // Switch to the new weapon
                break; // Only pick up one weapon at a time
            }
        }
    }

    // --- INITIALIZE SCENERY ---
    if (!isMultiplayer || isHost) {
        // createScenery(); // Temporarily disabled to remove the table.
    }

    // --- GAME LOOP ---
    let isPaused = false;
    const clock = new THREE.Clock();
    const bodiesToRemove = [];
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

        // --- Update Scoping ---
        // If we switch weapons, automatically un-scope
        if (isScoping && !currentWeapon.scope) {
            isScoping = false;
        }

        const canScope = currentWeapon.scope && isScoping;
        const targetFov = canScope ? currentWeapon.scope.fov : defaultFov;
        camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, scopeSpeed);
        camera.updateProjectionMatrix();

        // Handle scope overlays
        const showOverlay = canScope && currentWeapon.scope.hasOverlay;
        const overlayId = showOverlay ? currentWeapon.scope.overlayId : null;

        // Sniper scope
        const sniperOpacity = (overlayId === 'scope-overlay') ? 1 : 0;
        scopeOverlay.style.opacity = THREE.MathUtils.lerp(parseFloat(scopeOverlay.style.opacity) || 0, sniperOpacity, scopeSpeed);
        
        // Rocket launcher scope
        const rocketOpacity = (overlayId === 'rocket-scope-overlay') ? 1 : 0;
        if (rocketScopeOverlay) {
            rocketScopeOverlay.style.opacity = THREE.MathUtils.lerp(parseFloat(rocketScopeOverlay.style.opacity) || 0, rocketOpacity, scopeSpeed);
        }
        
        if (gunMesh) {
            // Only move gun if it can be scoped
            const targetPos = canScope ? currentWeapon.scopePosition : currentWeapon.position;
            if (targetPos) gunMesh.position.lerp(targetPos, scopeSpeed);
        }

        // Adjust sensitivity and movement speed when scoping
        if (canScope) {
            controls.pointerSpeed = 0.5;
            moveSpeed = 2.5;
        } else {
            controls.pointerSpeed = 1.0;
            moveSpeed = 5;
        }

        // Handle continuous shooting for automatic weapons (if added later)
        if (keys[keybinds.shoot] && !isPaused) {
            shoot();
        }

        // Safely remove bodies after the physics step
        for (const body of bodiesToRemove) {
            world.removeBody(body);
        }
        bodiesToRemove.length = 0; // Clear the array

        // Update weapon pickup timers
        for (const pickup of weaponPickups) {
            if (pickup.isPickedUp && pickup.respawnTimer > 0) {
                pickup.respawnTimer -= deltaTime;

                // Update timer text
                const timeLeft = Math.ceil(pickup.respawnTimer);
                const newText = timeLeft.toString();

                if (pickup.timerMesh.userData.text !== newText) {
                    pickup.timerMesh.userData.text = newText;
                    if (gameFont) {
                        const textGeometry = new TextGeometry(newText, {
                            font: gameFont,
                            size: 0.5,
                            height: 0.1,
                        });
                        textGeometry.center();
                        pickup.timerMesh.geometry.dispose(); // Dispose old geometry
                        pickup.timerMesh.geometry = textGeometry;
                    }
                }

                if (pickup.respawnTimer <= 0) {
                    respawnWeapon(pickup);
                }
            }
        }
        // Handle player movement
        handleControls(deltaTime);

        // Update camera to follow player's physics body
        controls.getObject().position.copy(playerBody.position);

        // Update visual objects from physics bodies
        for (const obj of objectsToUpdate) {
            obj.mesh.position.copy(obj.body.position);
            obj.mesh.quaternion.copy(obj.body.quaternion);
        }

        // Update remote player meshes
        for (const id in players) {
            const player = players[id];
            if (!player.mesh) continue;
            player.mesh.position.lerp(player.position, 0.1);
            // Update nametag to follow player and face camera
            if (player.nametagMesh) {
                player.nametagMesh.position.copy(player.mesh.position);
                player.nametagMesh.position.y += 1.2; // Position above the player's head
                player.nametagMesh.quaternion.copy(camera.quaternion);
            }
            player.mesh.quaternion.slerp(player.quaternion, 0.1);
        }

        // Update rocket orientation
        activeRockets.forEach(rocket => {
            if (rocket.body.velocity.lengthSquared() > 0.1) {
                const direction = new THREE.Vector3().copy(rocket.body.velocity).normalize();
                // Re-orient the rocket to face the direction of travel
                // The default model orientation is along the Y-axis.
                rocket.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
            }
        });

        // Update smoke particles
        for (let i = smokeParticles.length - 1; i >= 0; i--) {
            const particle = smokeParticles[i];
            particle.material.opacity -= deltaTime * 0.5; // Fade out
            if (particle.material.opacity <= 0) {
                scene.remove(particle);
                smokeParticles.splice(i, 1);
            }
        }

        activeRockets.forEach(rocket => {
            createSmokeParticle(rocket.mesh.position);
        });

        // Update smoke particles
        for (let i = smokeParticles.length - 1; i >= 0; i--) {
            const particle = smokeParticles[i];
            particle.material.opacity -= deltaTime * 0.5; // Fade out
            if (particle.material.opacity <= 0) {
                scene.remove(particle);
                smokeParticles.splice(i, 1);
            }
        }
        renderer.render(scene, camera);
    }

    // --- SHOOTING & RELOADING ---
    function respawnWeapon(pickup) {
        console.log(`${pickup.name} has respawned.`);
        pickup.isPickedUp = false;
        pickup.respawnTimer = 0;
        scene.remove(pickup.timerMesh); // Hide timer
        pickup.timerMesh.geometry.dispose(); // Clear geometry
        pickup.timerMesh.userData.text = null;
        weapons[pickup.name].reserveAmmo = weapons[pickup.name].maxReserveAmmo; // Refill ammo
        scene.add(pickup.mesh);
    }

    function reload() {
        if (isReloading || currentWeapon.ammo === currentWeapon.maxAmmo || currentWeapon.reserveAmmo <= 0) {
            return;
        }
        isReloading = true;
        updateAmmoUI();
        console.log("Reloading...");
        setTimeout(() => {
            const ammoNeeded = currentWeapon.maxAmmo - currentWeapon.ammo;
            const ammoToReload = Math.min(ammoNeeded, currentWeapon.reserveAmmo);

            currentWeapon.ammo += ammoToReload;
            currentWeapon.reserveAmmo -= ammoToReload;

            isReloading = false;
            updateAmmoUI();
            console.log("Reload complete.");
        }, currentWeapon.reloadTime);
    }

    // Initialize weapon at start
    switchWeapon('pistol');
    updateHealthUI();


    function shoot() {
        if (isReloading) return;
        if (currentWeapon.ammo <= 0) {
            reload();
            return;
        }
        if (!canShoot) return;

        canShoot = false;
        setTimeout(() => canShoot = true, currentWeapon.fireRate);

        currentWeapon.ammo--;
        updateAmmoUI();

        const shootDirection = new THREE.Vector3();
        controls.getDirection(shootDirection);

        sendData({
            type: 'shoot',
            direction: shootDirection,
            weapon: currentWeaponName
        });

        handleShoot(shootDirection, currentWeaponName);
    }

    function handleShoot(direction, weaponName) {
        const weapon = weapons[weaponName];
        const bulletType = weapon.bullet.type;

        if (bulletType === 'pellet') { // Shotgun
            for (let i = 0; i < weapon.bullet.pelletCount; i++) {
                // Use hipfireSpread if not scoping, otherwise use normal spread
                const spread = !isScoping && weapon.bullet.hipfireSpread ? weapon.bullet.hipfireSpread : weapon.bullet.spread;
                const pelletDirection = direction.clone().add(
                    new THREE.Vector3(
                        (Math.random() - 0.5) * spread,
                        (Math.random() - 0.5) * spread,
                        (Math.random() - 0.5) * spread
                    )
                );
                pelletDirection.normalize();

                createBullet(pelletDirection, weapon.bullet);
            }
        } else { // Pistol and Rocket Launcher
            let finalDirection = direction.clone();
            // Add hip-fire inaccuracy if applicable
            if (!isScoping && weapon.bullet.hipfireSpread) {
                const spread = weapon.bullet.hipfireSpread;
                finalDirection.add(
                    new THREE.Vector3(
                        (Math.random() - 0.5) * spread,
                        (Math.random() - 0.5) * spread,
                        (Math.random() - 0.5) * spread
                    )
                ).normalize();
            }
            createBullet(finalDirection, weapon.bullet);
        }

        // Recoil
        const recoilForce = weaponName === 'shotgun' ? 25 : 10;
        const recoilImpulse = new CANNON.Vec3(0, recoilForce, 0); // Upward kick
        const recoilTorque = new CANNON.Vec3((Math.random() - 0.5) * 2, 0, 0); // Rotational kick
        playerBody.applyImpulse(recoilImpulse, playerBody.position);
        if (weaponName === 'shotgun') {
            playerBody.applyTorque(recoilTorque);
        }
    }

    function createBullet(direction, bulletData) {
        const startPosition = new THREE.Vector3();
        controls.getObject().getWorldPosition(startPosition);
        startPosition.add(direction.clone().multiplyScalar(2.0));

        const bulletBody = new CANNON.Body({
            mass: bulletData.type === 'rocket' ? 0.1 : 0.1, // Rockets are now dynamic to collide with static ground
            shape: new CANNON.Sphere(bulletData.radius),
            position: new CANNON.Vec3().copy(startPosition),
            gravity: new CANNON.Vec3(0, bulletData.gravity !== undefined ? -9.82 * bulletData.gravity : -9.82, 0),
            material: bulletMaterial,
        });
        bulletBody.collisionFilterGroup = BULLET;

        bulletBody.collisionFilterMask = BOX | GROUND; // Bullets collide with boxes and the ground

        let bulletMesh;
        if (bulletData.type === 'rocket') {
            bulletMesh = new THREE.Group();
            const body = new THREE.Mesh(
                new THREE.CylinderGeometry(bulletData.radius * 0.5, bulletData.radius, bulletData.radius * 4, 12),
                new THREE.MeshStandardMaterial({ color: 0xcccccc })
            );
            const tip = new THREE.Mesh(
                new THREE.ConeGeometry(bulletData.radius * 0.5, bulletData.radius, 12),
                new THREE.MeshStandardMaterial({ color: 0xff0000 })
            );
            tip.position.y = bulletData.radius * 2;
            bulletMesh.add(body);
            bulletMesh.add(tip);
            // Orient the rocket to point in the direction of travel
            bulletMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
        } else {
            bulletMesh = new THREE.Mesh(
                new THREE.SphereGeometry(bulletData.radius, 8, 8),
                new THREE.MeshBasicMaterial({ color: 0xffff00 })
            );
        }

        bulletMesh.position.copy(startPosition);

        bulletBody.velocity.set(
            direction.x * bulletData.speed,
            direction.y * bulletData.speed,
            direction.z * bulletData.speed
        );

        const bulletObject = {
            mesh: bulletMesh,
            body: bulletBody,
            type: bulletData.type,
            explosionRadius: bulletData.explosionRadius,
            explosionImpulse: bulletData.explosionImpulse
        };

        if (bulletObject.type === 'rocket') {
            activeRockets.push(bulletObject);
        }

        bulletBody.addEventListener('collide', (event) => {
            if (bulletObject.type === 'rocket') {
                handleRocketExplosion(bulletBody.position, bulletObject.explosionRadius, bulletObject.explosionImpulse);
            }
            handleBulletCollision(event, bulletObject);
            // Remove rocket from active list so it stops producing smoke
            const rocketIndex = activeRockets.indexOf(bulletObject);
            if (rocketIndex > -1) activeRockets.splice(rocketIndex, 1);

        });

        world.addBody(bulletBody);
        scene.add(bulletMesh);
        objectsToUpdate.push(bulletObject);
    }

    // Add a function to create smoke particles for rockets
    function createSmokeParticle(position) {
        const smokeGeometry = new THREE.SphereGeometry(0.1, 8, 8);
        const smokeMaterial = new THREE.MeshBasicMaterial({
            color: 0x888888,
            transparent: true,
            opacity: 0.5
        });
        const particle = new THREE.Mesh(smokeGeometry, smokeMaterial);
        particle.position.copy(position);
        scene.add(particle);
        smokeParticles.push(particle);
    }
    function handleBulletCollision(event, bulletObject) {
        const bulletBody = bulletObject.body;
        const contact = event.contact;
        const targetBody = (contact.bi === bulletBody) ? contact.bj : contact.bi;
        if (targetBody.mass > 0 && bulletObject.type !== 'rocket') {
            const impulse = bulletBody.velocity.scale(bulletBody.mass);
            const worldContactPoint = new CANNON.Vec3();
            const contactPointOnTarget = (contact.bi === bulletBody) ? contact.rj : contact.ri;
            targetBody.pointToWorldFrame(contactPointOnTarget, worldContactPoint);
            targetBody.applyImpulse(impulse, worldContactPoint);

            const hitObject = objectsToUpdate.find(obj => obj.body === targetBody);
            if (hitObject) {
                const dentPosition = new THREE.Vector3().copy(worldContactPoint);
                const dentGeometry = new THREE.SphereGeometry(0.05, 4, 4);
                const dentMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
                const dentMesh = new THREE.Mesh(dentGeometry, dentMaterial);
                hitObject.mesh.worldToLocal(dentPosition);
                dentMesh.position.copy(dentPosition);
                hitObject.mesh.add(dentMesh);
                setTimeout(() => hitObject.mesh.remove(dentMesh), 2000);
            }
        }

        const index = objectsToUpdate.indexOf(bulletObject);
        if (index > -1) {
            objectsToUpdate.splice(index, 1);
        }
        scene.remove(bulletObject.mesh);
        bodiesToRemove.push(bulletBody);
    }

    function handleRocketExplosion(position, radius, impulse) {
        const explosionGeometry = new THREE.SphereGeometry(radius, 16, 16);
        const explosionMaterial = new THREE.MeshBasicMaterial({ color: 0xffa500, transparent: true, opacity: 0.5 });
        const explosionMesh = new THREE.Mesh(explosionGeometry, explosionMaterial);
        explosionMesh.position.copy(position);
        scene.add(explosionMesh);
        setTimeout(() => scene.remove(explosionMesh), 500);

        objectsToUpdate.forEach(obj => {
            if (obj.body.mass > 0) {
                const dist = obj.body.position.distanceTo(position);
                if (dist < radius) {
                    const direction = new CANNON.Vec3();
                    obj.body.position.vsub(position, direction);
                    direction.normalize();
                    const impulseMagnitude = impulse * (1 - dist / radius);
                    direction.scale(impulseMagnitude, direction);
                    obj.body.applyImpulse(direction, obj.body.position);
                }
            }
        });

        // Check for player damage
        const playerDist = playerBody.position.distanceTo(position);
        if (playerDist < radius) {
            // Apply damage
            const damage = (1 - (playerDist / radius)) * 50; // Max 50 damage at epicenter
            applyDamage(damage);

            // Apply knockback
            const knockbackDirection = new CANNON.Vec3();
            playerBody.position.vsub(position, knockbackDirection);
            knockbackDirection.normalize();
            const knockbackMagnitude = impulse * (1 - playerDist / radius);
            playerBody.applyImpulse(knockbackDirection.scale(knockbackMagnitude * 0.2), playerBody.position); // Scaled down for player
        }
    }

    function applyDamage(amount) {
        playerBody.health -= amount;
        if (playerBody.health < 0) {
            playerBody.health = 0;
        }
        updateHealthUI();

        if (playerBody.health <= 0) {
            respawn();
        }
    }

    function respawn() {
        playerBody.health = 100;
        playerBody.position.set(0, 5, 5);
        playerBody.velocity.set(0, 0, 0);
        updateHealthUI();
    }

    function createNametag(text, font) {
        const textGeometry = new TextGeometry(text, {
            font: font,
            size: 0.2,
            height: 0.02,
        });
        const textMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const textMesh = new THREE.Mesh(textGeometry, textMaterial);
        textMesh.geometry.center();
        return textMesh;
    }

    animate();
    
    function onResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    window.addEventListener('resize', onResize);

}

export function getMyPlayerId() {
    return myPlayerId;
}

// This was missing, but it's better to get the ID from network.js
// For consistency, I'll add the import here, but ideally, game logic
// would get the ID passed to it rather than importing it.
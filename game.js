import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PointerLockControls } from './PointerLockControls.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { weapons } from './gun_data.js'; // This was missing from the context, but is fine.
import { sendData } from './network.js';
import { getMyId } from './network.js';

export const objectsToUpdate = [];
export const players = {};
let myPlayerId = null;
export function init(nametag, isMultiplayer = false, isHost = false) {
    // --- SETUP ---
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
        // Font is now loaded, we can create the local player's nametag
        if (nametag) {
            nametagMesh = createNametag(nametag, font);
            scene.add(nametagMesh);
        }
        // Now that all assets are ready, dispatch the event.
        window.dispatchEvent(new CustomEvent('game-initialized', {
            detail: { scene: scene, handleShoot: handleShoot, font: font }
        }));
    });
    // --- UI ---
    const ammoCounter = document.getElementById('ammoCounter');
    const healthBar = document.getElementById('health');

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
    const unlockedWeapons = { 'pistol': true, 'shotgun': false, 'rocketLauncher': false };
    let canShoot = true;
    let isReloading = false;

    function switchWeapon(weaponName) {
        if (!unlockedWeapons[weaponName]) {
            console.log(`${weaponName} is not unlocked.`);
            return;
        }
        if (gunMesh) {
            camera.remove(gunMesh);
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


    const playerMaterial = new CANNON.Material('playerMaterial');
    const playerBody = new CANNON.Body({
        mass: 70, // kg
        shape: new CANNON.Sphere(0.5), // radius
        position: new CANNON.Vec3(0, 5, 5),
        material: playerMaterial,
    });
    playerBody.collisionFilterGroup = PLAYER;
    playerBody.collisionFilterMask = BOX | PLAYER; // Player collides with boxes and itself
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
        boxBody.collisionFilterMask = PLAYER | BULLET | BOX; // Box collides with everything
        world.addBody(boxBody);

        const boxMesh = new THREE.Mesh(boxGeometry, boxMaterial);
        boxMesh.castShadow = true;
        scene.add(boxMesh);

        objectsToUpdate.push({ mesh: boxMesh, body: boxBody });
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
            pickupMesh = new THREE.Mesh(weaponData.model, new THREE.MeshStandardMaterial({ color: 0xcccccc }));
        }
        
        pickupMesh.scale.set(2, 2, 2); // Make it bigger so it's easier to see
        pickupMesh.position.copy(position);
        scene.add(pickupMesh);

        const pickup = {
            name: weaponName,
            mesh: pickupMesh,
            isPickedUp: false
        };
        weaponPickups.push(pickup);
    }

    createWeaponPickup('shotgun', new THREE.Vector3(10, 0.5, 10));
    createWeaponPickup('rocketLauncher', new THREE.Vector3(-10, 0.5, -10));

    // --- CONTROLS ---
    const keys = {};
    document.addEventListener('keydown', (event) => {
        keys[event.code] = true;
        if (event.code === 'Escape' && isPaused) {
            controls.lock();
        }
        if (event.code === 'KeyR') {
            reload();
        }
        // Weapon switching
        if (event.code === 'Digit1' && unlockedWeapons.pistol) switchWeapon('pistol');
        if (event.code === 'Digit2' && unlockedWeapons.shotgun) switchWeapon('shotgun');
        if (event.code === 'Digit3' && unlockedWeapons.rocketLauncher) switchWeapon('rocketLauncher');

        if (event.code === 'KeyF') {
            tryPickupWeapon();
        }
    });
    document.addEventListener('keyup', (event) => (keys[event.code] = false));

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

    function tryPickupWeapon() {
        const pickupDistance = 2; // How close the player needs to be
        for (const pickup of weaponPickups) {
            if (pickup.isPickedUp) continue;

            const distance = playerBody.position.distanceTo(pickup.mesh.position);
            if (distance < pickupDistance) {
                console.log(`Picked up ${pickup.name}`);
                unlockedWeapons[pickup.name] = true;
                pickup.isPickedUp = true;
                scene.remove(pickup.mesh);
                
                // Give some reserve ammo on pickup
                weapons[pickup.name].reserveAmmo = Math.min(weapons[pickup.name].maxReserveAmmo, weapons[pickup.name].reserveAmmo + weapons[pickup.name].maxAmmo);
                switchWeapon(pickup.name); // Switch to the new weapon
                break; // Only pick up one weapon at a time
            }
        }
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

        // Safely remove bodies after the physics step
        for (const body of bodiesToRemove) {
            world.removeBody(body);
        }
        bodiesToRemove.length = 0; // Clear the array

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

        renderer.render(scene, camera);
    }

    // --- SHOOTING & RELOADING ---
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
                const spread = weapon.bullet.spread;
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
            createBullet(direction, weapon.bullet);
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
            mass: 0.1, // A small mass for the bullet
            shape: new CANNON.Sphere(bulletData.radius),
            position: new CANNON.Vec3().copy(startPosition),
            material: bulletMaterial,
        });
        bulletBody.collisionFilterGroup = BULLET;
        bulletBody.collisionFilterMask = BOX; // Bullets only collide with boxes

        const bulletMesh = new THREE.Mesh(
            new THREE.SphereGeometry(bulletData.radius, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xffff00 })
        );
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

        bulletBody.addEventListener('collide', (event) => {
            if (bulletObject.type === 'rocket') {
                handleRocketExplosion(bulletBody.position, bulletObject.explosionRadius, bulletObject.explosionImpulse);
            }
            handleBulletCollision(event, bulletObject);
        });

        world.addBody(bulletBody);
        scene.add(bulletMesh);
        objectsToUpdate.push(bulletObject);
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

    window.addEventListener('mousedown', (event) => {
        if (controls.isLocked && event.button === 0) {
            shoot();
        }
    });

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
import * as THREE from './three.module.js';
import * as CANNON from 'cannon-es';
import { PointerLockControls } from './PointerLockControls.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { weapons } from './gun_data.js';

export function init(nametag) {
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

    // --- NAMETAG ---
    let nametagMesh;
    const fontLoader = new FontLoader();
    fontLoader.load('https://unpkg.com/three@0.160.0/examples/fonts/helvetiker_regular.typeface.json', (font) => {
        if (nametag) {
            nametagMesh = createNametag(nametag, font);
            scene.add(nametagMesh);
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

    // --- UI ---
    const ammoCounter = document.getElementById('ammoCounter');
    const healthBar = document.getElementById('health');

    function updateAmmoUI() {
        if (isReloading) {
            ammoCounter.textContent = 'Reloading...';
        } else {
            ammoCounter.textContent = `${currentWeapon.ammo} / ${currentWeapon.maxAmmo}`;
        }
    }

    function updateHealthUI() {
        healthBar.style.width = `${playerBody.health}%`;
    }

    // --- WEAPONRY ---
    let gunMesh;
    let currentWeaponName = 'pistol';
    let currentWeapon = weapons[currentWeaponName];
    let canShoot = true;
    let isReloading = false;

    function switchWeapon(weaponName) {
        if (gunMesh) {
            camera.remove(gunMesh);
        }
        currentWeaponName = weaponName;
        currentWeapon = weapons[currentWeaponName];

        // Reset ammo and create new gun model
        currentWeapon.ammo = currentWeapon.maxAmmo;
        gunMesh = new THREE.Mesh(currentWeapon.model, new THREE.MeshStandardMaterial({ color: 0x333333 }));
        gunMesh.position.copy(currentWeapon.position);
        camera.add(gunMesh);
        console.log(`Switched to ${currentWeaponName}`);
        updateAmmoUI();
        updateHealthUI();
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
    const playerMaterial = new CANNON.Material('playerMaterial');
    const playerBody = new CANNON.Body({
        mass: 70, // kg
        shape: new CANNON.Sphere(0.5), // radius
        position: new CANNON.Vec3(0, 5, 5),
        material: playerMaterial,
    });
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
            material: boxCannonMaterial,
        });
        world.addBody(boxBody);

        const boxMesh = new THREE.Mesh(boxGeometry, boxMaterial);
        boxMesh.castShadow = true;
        scene.add(boxMesh);

        objectsToUpdate.push({ mesh: boxMesh, body: boxBody });
    }

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
        if (event.code === 'Digit1') switchWeapon('pistol');
        if (event.code === 'Digit2') switchWeapon('shotgun');
        if (event.code === 'Digit3') switchWeapon('rocketLauncher');
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

    // --- SHOOTING & RELOADING ---
    function reload() {
        if (isReloading || currentWeapon.ammo === currentWeapon.maxAmmo) {
            return;
        }
        isReloading = true;
        updateAmmoUI();
        console.log("Reloading...");
        setTimeout(() => {
            currentWeapon.ammo = currentWeapon.maxAmmo;
            isReloading = false;
            updateAmmoUI();
            console.log("Reload complete.");
        }, currentWeapon.reloadTime);
    }

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
        console.log(`Ammo: ${currentWeapon.ammo}/${currentWeapon.maxAmmo}`);

        const shootDirection = new THREE.Vector3();
        controls.getDirection(shootDirection);

        const bulletType = currentWeapon.bullet.type;

        if (bulletType === 'pellet') { // Shotgun
            for (let i = 0; i < currentWeapon.bullet.pelletCount; i++) {
                const pelletDirection = shootDirection.clone();
                pelletDirection.x += (Math.random() - 0.5) * currentWeapon.bullet.spread;
                pelletDirection.y += (Math.random() - 0.5) * currentWeapon.bullet.spread;
                pelletDirection.z += (Math.random() - 0.5) * currentWeapon.bullet.spread;
                createBullet(pelletDirection);
            }
        } else { // Pistol and Rocket Launcher
            createBullet(shootDirection);
        }

        // Recoil
        const recoilImpulse = new CANNON.Vec3(0, 10, 0);
        playerBody.applyImpulse(recoilImpulse);
    }

    function createBullet(direction) {
        const bullet = currentWeapon.bullet;
        const startPosition = new THREE.Vector3();
        controls.getObject().getWorldPosition(startPosition);
        startPosition.add(direction.clone().multiplyScalar(1));

        const bulletBody = new CANNON.Body({
            mass: 0.1,
            shape: new CANNON.Sphere(bullet.radius),
            position: new CANNON.Vec3().copy(startPosition),
        });

        const bulletMesh = new THREE.Mesh(
            new THREE.SphereGeometry(bullet.radius, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xffff00 })
        );
        bulletMesh.position.copy(startPosition);

        bulletBody.velocity.set(
            direction.x * bullet.speed,
            direction.y * bullet.speed,
            direction.z * bullet.speed
        );

        bulletBody.addEventListener('collide', (event) => {
            if (bullet.type === 'rocket') {
                handleRocketExplosion(bulletBody.position, bullet.explosionRadius, bullet.explosionImpulse);
            }
            handleBulletCollision(event, bulletBody);
        });

        world.addBody(bulletBody);
        scene.add(bulletMesh);
        objectsToUpdate.push({ mesh: bulletMesh, body: bulletBody });
    }

    function handleBulletCollision(event, bulletBody) {
        const contact = event.contact;
        const targetBody = (contact.bi === bulletBody) ? contact.bj : contact.bi;

        if (targetBody === playerBody) {
            const damage = bulletBody.velocity.length() * 0.1;
            applyDamage(damage);
        } else if (targetBody.mass > 0 && currentWeapon.bullet.type !== 'rocket') {
            const impulse = bulletBody.velocity.scale(bulletBody.mass);
            const worldContactPoint = new CANNON.Vec3();
            const contactPointOnTarget = (contact.bi === bulletBody) ? contact.rj : contact.ri;
            targetBody.pointToWorldFrame(contactPointOnTarget, worldContactPoint);
            targetBody.applyImpulse(impulse, worldContactPoint);

            // Create a dent
            const hitObject = objectsToUpdate.find(obj => obj.body === targetBody);
            if (hitObject) {
                const dentPosition = new THREE.Vector3().copy(worldContactPoint);
                const dentGeometry = new THREE.SphereGeometry(0.05, 4, 4);
                const dentMaterial = new THREE.MeshBasicMaterial({ color: 0x333333 });
                const dentMesh = new THREE.Mesh(dentGeometry, dentMaterial);
                hitObject.mesh.worldToLocal(dentPosition);
                dentMesh.position.copy(dentPosition);
                hitObject.mesh.add(dentMesh);
                setTimeout(() => hitObject.mesh.remove(dentMesh), 2000);
            }
        }

        // Remove bullet on impact
        const obj = objectsToUpdate.find(o => o.body === bulletBody);
        if (obj) {
            scene.remove(obj.mesh);
            const index = objectsToUpdate.findIndex(o => o.body === bulletBody);
            if (index > -1) {
                objectsToUpdate.splice(index, 1);
            }
        }
        world.removeBody(bulletBody);
    }

    function handleRocketExplosion(position, radius, impulse) {
        // Explosion visual effect
        const explosionGeometry = new THREE.SphereGeometry(radius, 16, 16);
        const explosionMaterial = new THREE.MeshBasicMaterial({ color: 0xffa500, transparent: true, opacity: 0.5 });
        const explosionMesh = new THREE.Mesh(explosionGeometry, explosionMaterial);
        explosionMesh.position.copy(position);
        scene.add(explosionMesh);
        setTimeout(() => scene.remove(explosionMesh), 500);

        // Apply impulse to nearby objects
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

    animate();

    // --- RESIZE ---
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });}

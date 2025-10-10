import * as THREE from 'three';

export const weapons = {
    pistol: {
        model: new THREE.BoxGeometry(0.1, 0.1, 0.5),
        position: new THREE.Vector3(0.25, -0.2, -0.5),
        bullet: {
            radius: 0.1,
            speed: 50,
            type: 'bullet', // standard bullet
        },
        fireRate: 200, // ms cooldown
        ammo: 10,
        maxAmmo: 10,
        reserveAmmo: 30,
        maxReserveAmmo: 30,
        reloadTime: 1500, // ms
    },
    shotgun: {
        model: (() => {
            const group = new THREE.Group();
            // Barrel
            const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.9), new THREE.MeshStandardMaterial({ color: 0x222222 }));
            barrel.position.z = -0.45;
            group.add(barrel);
            // Pump
            const pump = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.4), new THREE.MeshStandardMaterial({ color: 0x444444 }));
            pump.position.z = -0.2;
            pump.position.y = -0.05;
            group.add(pump);
            // Stock
            const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.3), new THREE.MeshStandardMaterial({ color: 0x654321 }));
            stock.position.z = 0.25;
            stock.position.y = -0.02;
            group.add(stock);
            return group;
        })(),
        position: new THREE.Vector3(0.25, -0.2, -0.5),
        bullet: {
            radius: 0.01,
            speed: 20,
            type: 'pellet',
            pelletCount: 50,
            spread: 0.4, // Cone spread angle
        },
        fireRate: 1000,
        ammo: 8,
        maxAmmo: 8,
        reserveAmmo: 16,
        maxReserveAmmo: 16,
        reloadTime: 2000,
    },
    rocketLauncher: {
        model: (() => {
            const group = new THREE.Group();
            // Main tube
            const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.0, 16), new THREE.MeshStandardMaterial({ color: 0x444444 }));
            tube.rotation.x = Math.PI / 2;
            group.add(tube);
            // Scope
            const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 12), new THREE.MeshStandardMaterial({ color: 0x111111 }));
            scope.position.set(-0.1, 0.1, -0.2);
            scope.rotation.z = Math.PI / 2;
            group.add(scope);
            // Handle
            const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.1), new THREE.MeshStandardMaterial({ color: 0x222222 }));
            handle.position.set(0, -0.15, -0.1);
            group.add(handle);
            return group;
        })(),
        position: new THREE.Vector3(0.25, -0.2, -0.5),
        bullet: {
            radius: 0.2,
            speed: 20,
            type: 'rocket',
            explosionRadius: 5,
            explosionImpulse: 100,
        },
        fireRate: 1500,
        ammo: 3,
        maxAmmo: 3,
        reserveAmmo: 6,
        maxReserveAmmo: 6,
        reloadTime: 3000,
    },
    sniperRifle: {
        model: (() => {
            const group = new THREE.Group();

            const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.0, 8), new THREE.MeshStandardMaterial({ color: 0x444444 }));
            tube.rotation.x = Math.PI / 2;
            group.add(tube);

            const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 6), new THREE.MeshStandardMaterial({ color: 0x111111 }));
            scope.position.set(-0.1, 0.1, -0.2);
            scope.rotation.z = Math.PI / 2;
            group.add(scope);

            return group;
        })(),
        position: new THREE.Vector3(0.25, -0.2, -0.5),
        bullet: {
            radius: 0.05,
            speed: 65,
            type: 'rocket',
            explosionRadius: 0.01,
            explosionImpulse: 500,
        },
        fireRate: 3000,
        ammo: 2,
        maxAmmo: 2,
        reserveAmmo: 4,
        maxReserveAmmo: 4,
        reloadTime: 4000,
    }
};
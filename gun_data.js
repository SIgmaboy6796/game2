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
        model: new THREE.BoxGeometry(0.2, 0.2, 1.0),
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
    }
};

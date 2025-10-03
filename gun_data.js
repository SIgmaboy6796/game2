import * as THREE from './three.module.js';

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
        reloadTime: 1500, // ms
    },
    shotgun: {
        model: new THREE.BoxGeometry(0.1, 0.1, 0.8),
        position: new THREE.Vector3(0.25, -0.2, -0.5),
        bullet: {
            radius: 0.05,
            speed: 40,
            type: 'pellet',
            pelletCount: 8,
            spread: 0.1, // cone spread
        },
        fireRate: 800,
        ammo: 2,
        maxAmmo: 2,
        reloadTime: 2000,
    },
    rocketLauncher: {
        model: new THREE.BoxGeometry(0.2, 0.2, 1.0),
        position: new THREE.Vector3(0.25, -0.2, -0.5),
        bullet: {
            radius: 0.2,
            speed: 20,
            type: 'rocket',
            explosionRadius: 3,
            explosionImpulse: 50,
        },
        fireRate: 1500,
        ammo: 1,
        maxAmmo: 1,
        reloadTime: 3000,
    }
};

const defaultKeybinds = {
    moveForward: 'KeyW',
    moveBackward: 'KeyS',
    moveLeft: 'KeyA',
    moveRight: 'KeyD',
    jump: 'Space',
    reload: 'KeyR',
    pickup: 'KeyF',
    shoot: 'MouseButton0',
    scope: 'MouseButton2',
    weapon1: 'Digit1',
    weapon2: 'Digit2',
    weapon3: 'Digit3',
    weapon4: 'Digit4',
};

let keybinds = {};

function getKeyDisplayName(keyCode) {
    if (keyCode.startsWith('Key')) {
        return keyCode.substring(3);
    }
    if (keyCode.startsWith('Digit')) {
        return keyCode.substring(5);
    }
    if (keyCode === 'Space') {
        return 'Spacebar';
    }
    if (keyCode === 'MouseButton0') {
        return 'Left Mouse';
    }
    if (keyCode === 'MouseButton2') {
        return 'Right Mouse';
    }
    return keyCode;
}

export function loadKeybinds() {
    const savedBinds = localStorage.getItem('pew-shoot-keybinds');
    if (savedBinds) {
        keybinds = { ...defaultKeybinds, ...JSON.parse(savedBinds) };
    } else {
        keybinds = { ...defaultKeybinds };
    }
    // Dispatch an event to notify the UI to update
    window.dispatchEvent(new CustomEvent('keybinds-updated', { detail: { keybinds } }));
    return keybinds;
}

export function saveKeybind(action, keyCode) {
    keybinds[action] = keyCode;
    localStorage.setItem('pew-shoot-keybinds', JSON.stringify(keybinds));
    window.dispatchEvent(new CustomEvent('keybinds-updated', { detail: { keybinds } }));
}

export function getKeybinds() {
    return keybinds;
}

export { getKeyDisplayName };
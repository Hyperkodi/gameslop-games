// Hosting adapter. Original characters, combat, levels and balance are preserved.
// The imported revision supplies no MP3s or level backgrounds. Use its existing
// silent/solid-color fallbacks without requesting files that are not present.
soundManager.soundFiles = {};
soundManager.musicFiles = {};
Level.prototype.loadBackground = function () { this.backgroundImage = null; };
// Keep the authored 550px ground inside the view on small landscape screens.
Game.prototype.resizeCanvas = function () {
    this.canvas.width = 1280;
    this.canvas.height = 720;
};
window.addEventListener('load', () => {
    const pause = document.getElementById('arcade-pause');
    const fullscreen = document.getElementById('arcade-fullscreen');
    const clearInput = () => { if (game.player) game.player.keys = {}; };
    pause.addEventListener('click', () => { clearInput(); if (game.state === 'playing') game.pause(); else if (game.state === 'paused') game.resume(); });
    fullscreen.addEventListener('click', async () => {
        clearInput();
        try {
            if (document.fullscreenElement) await document.exitFullscreen();
            else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
        } catch (_) { /* The page already fills the viewport when fullscreen is unavailable. */ }
    });
    document.addEventListener('fullscreenchange', () => { fullscreen.textContent = document.fullscreenElement ? 'EXIT FULLSCREEN' : 'FULLSCREEN'; });
    window.addEventListener('blur', () => { clearInput(); if (game.state === 'playing') game.pause(); });
    window.addEventListener('resize', clearInput);
    let lastState;
    function stateUI() {
        if (lastState !== game.state) {
            lastState = game.state;
            clearInput();
            pause.disabled = !['playing', 'paused'].includes(lastState);
            pause.textContent = lastState === 'paused' ? 'RESUME' : 'PAUSE';
            if (mobileControls.enabled) lastState === 'playing' ? mobileControls.show() : mobileControls.hide();
        }
        requestAnimationFrame(stateUI);
    }
    stateUI();
    document.body.dataset.ready = '1';
});

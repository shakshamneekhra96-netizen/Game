/**
 * =========================================================
 * BIRTHDAY CIPHER QUEST - SHARED CORE JAVASCRIPT
 * =========================================================
 */

const QuestState = {
    STORAGE_KEY: 'birthday_cipher_quest_v1',

    getDefaults() {
        return {
            welcomeDone: false,
            imagePuzzleDone: false,
            wordGameDone: false,
            cyberQuestDone: false,
            soundEnabled: true,
            startedAt: Date.now()
        };
    },

    get() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            let state = data ? JSON.parse(data) : {};
            if (localStorage.getItem('wordGameCompleted') === 'true') {
                state.wordGameDone = true;
            }
            if (localStorage.getItem('cyberQuestCompleted') === 'true') {
                state.cyberQuestDone = true;
            }
            return { ...this.getDefaults(), ...state };
        } catch (e) {
            console.error('Failed to load quest state:', e);
            return this.getDefaults();
        }
    },

    set(patch) {
        try {
            const current = this.get();
            const updated = { ...current, ...patch };
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated));
            return updated;
        } catch (e) {
            console.error('Failed to save quest state:', e);
            return this.getDefaults();
        }
    },

    setWelcomeDone() {
        return this.set({ welcomeDone: true });
    },

    setImagePuzzleDone() {
        return this.set({ imagePuzzleDone: true });
    },

    setWordGameDone() {
        try { localStorage.setItem('wordGameCompleted', 'true'); } catch (_) {}
        return this.set({ wordGameDone: true });
    },

    setCyberQuestDone() {
        try { localStorage.setItem('cyberQuestCompleted', 'true'); } catch (_) {}
        return this.set({ cyberQuestDone: true });
    },

    toggleSound() {
        const state = this.get();
        const updated = this.set({ soundEnabled: !state.soundEnabled });
        return updated.soundEnabled;
    },

    reset() {
        localStorage.removeItem(this.STORAGE_KEY);
        return this.getDefaults();
    }
};

/* ---------------------------------------------------------
   QUEST ROUTE GUARD
   --------------------------------------------------------- */
function enforceQuestProgress() {
    const page = window.location.pathname.split('/').pop().toLowerCase() || 'index.html';
    const state = QuestState.get();

    // Step 2 cannot be opened from the URL until Step 1 is complete.
    if (page === 'index.html' && window.location.hash === '#puzzle-section' && !state.welcomeDone) {
        window.location.replace('index.html');
        return false;
    }

    const lockedRoutes = {
        'hub.html': {
            allowed: state.imagePuzzleDone,
            fallback: 'index.html#puzzle-section'
        },
        'password.html': {
            allowed: state.imagePuzzleDone,
            fallback: 'index.html#puzzle-section'
        },
        'cyber.html': {
            allowed: state.imagePuzzleDone && state.wordGameDone,
            fallback: state.imagePuzzleDone ? 'hub.html' : 'index.html#puzzle-section'
        },
        'final.html': {
            allowed: state.imagePuzzleDone && state.wordGameDone && state.cyberQuestDone,
            fallback: state.imagePuzzleDone ? 'hub.html' : 'index.html#puzzle-section'
        }
    };

    const route = lockedRoutes[page];
    if (route && !route.allowed) {
        window.location.replace(route.fallback);
        return false;
    }

    return true;
}

// Protect direct URL navigation as well as the visible progress controls.
enforceQuestProgress();

/* ---------------------------------------------------------
   AUDIO SYNTHESIZER (Web Audio API - No extra assets needed)
   --------------------------------------------------------- */
const QuestAudio = {
    ctx: null,

    init() {
        if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioCtx();
        }
    },

    playTone(freq = 440, type = 'sine', duration = 0.2, gainVal = 0.15) {
        const state = QuestState.get();
        if (!state.soundEnabled) return;

        try {
            this.init();
            if (!this.ctx) return;
            if (this.ctx.state === 'suspended') {
                this.ctx.resume();
            }

            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

            gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch (e) {
            // Audio context policy safe fallback
        }
    },

    playSuccess() {
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
            setTimeout(() => {
                this.playTone(freq, 'triangle', 0.28, 0.18);
            }, idx * 90);
        });
    },

    playClick() {
        this.playTone(800, 'sine', 0.08, 0.08);
    },

    playDrop() {
        this.playTone(600, 'sine', 0.14, 0.12);
    },

    playFanfare() {
        const notes = [523.25, 587.33, 659.25, 783.99, 1046.50, 1318.51];
        notes.forEach((freq, idx) => {
            setTimeout(() => {
                this.playTone(freq, 'sine', 0.45, 0.22);
            }, idx * 120);
        });
    }
};

/* ---------------------------------------------------------
   QUEST HUD RENDERER
   --------------------------------------------------------- */
function injectQuestHUD(currentStepId = 1) {
    // Prevent duplicate HUD
    if (document.getElementById('questHud')) return;

    const state = QuestState.get();

    const hud = document.createElement('header');
    hud.id = 'questHud';
    hud.className = 'quest-hud';

    const steps = [
        { id: 1, name: 'Intro', url: 'index.html', done: state.welcomeDone },
        { id: 2, name: 'Puzzle #01', url: 'index.html#puzzle-section', done: state.imagePuzzleDone },
        { id: 3, name: 'Hub', url: 'hub.html', done: state.imagePuzzleDone },
        { id: 4, name: 'Word Game', url: 'password.html', done: state.wordGameDone },
        { id: 5, name: 'Code Breaker', url: 'cyber.html', done: state.cyberQuestDone },
        { id: 6, name: 'Birthday Finale', url: 'final.html', done: state.cyberQuestDone }
    ];

    let stepsHtml = '';
    steps.forEach((step, idx) => {
        const isCurrent = step.id === currentStepId;
        const isCompleted = step.done;
        const classes = `quest-step-dot ${isCurrent ? 'active' : ''} ${isCompleted ? 'completed' : ''}`;
        const icon = isCompleted && !isCurrent ? '✓' : step.id;

        // Make accessible link if allowed
        const canNavigate = step.id === 1
            || (step.id === 2 && state.welcomeDone)
            || ((step.id === 3 || step.id === 4) && state.imagePuzzleDone)
            || (step.id === 5 && state.wordGameDone)
            || (step.id === 6 && state.cyberQuestDone);
        const tag = canNavigate ? `<a href="${step.url}" class="${classes}" title="${step.name}">${icon}</a>` : `<span class="${classes}" title="${step.name}">${icon}</span>`;

        stepsHtml += tag;

        if (idx < steps.length - 1) {
            const lineFilled = (idx + 1 < currentStepId) || (step.done && steps[idx + 1].done);
            stepsHtml += `<div class="quest-step-line ${lineFilled ? 'filled' : ''}"></div>`;
        }
    });

    hud.innerHTML = `
        <a href="hub.html" class="quest-brand" title="Home Hub">
            <span class="quest-icon">🎀</span>
            <span>For Anjali</span>
        </a>
        <div class="quest-steps" aria-label="Quest progress steps">
            ${stepsHtml}
        </div>
        <div class="hud-actions">
            <button id="questSoundBtn" class="btn-quest btn-quest-secondary btn-icon" title="Toggle Sound" aria-label="Toggle Sound">
                ${state.soundEnabled ? '🔊' : '🔇'}
            </button>
            <button id="questResetBtn" class="btn-quest btn-quest-secondary btn-icon" title="Reset Quest" aria-label="Reset Quest">
                ↻
            </button>
        </div>
    `;

    document.body.prepend(hud);

    // Bind HUD events
    document.getElementById('questSoundBtn')?.addEventListener('click', () => {
        const enabled = QuestState.toggleSound();
        document.getElementById('questSoundBtn').innerHTML = enabled ? '🔊' : '🔇';
        showToast(enabled ? 'Sound Enabled 🔊' : 'Sound Muted 🔇');
    });

    document.getElementById('questResetBtn')?.addEventListener('click', () => {
        if (window.confirm('Restart the Birthday Quest from the beginning?')) {
            QuestState.reset();
            window.location.href = 'index.html';
        }
    });
}

/* ---------------------------------------------------------
   CONFETTI CANNON (Canvas based)
   --------------------------------------------------------- */
function triggerQuestConfetti(duration = 3500) {
    let canvas = document.getElementById('questConfettiCanvas');
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'questConfettiCanvas';
        document.body.appendChild(canvas);
    }

    const ctx = canvas.getContext('2d');
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const onResize = () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    const colors = ['#00ffc8', '#ff5fa2', '#ffd76a', '#765cff', '#ffffff', '#ff9ec7', '#7de2d1'];
    const particles = [];
    const count = 140;

    for (let i = 0; i < count; i++) {
        particles.push({
            x: width * 0.5 + (Math.random() - 0.5) * 200,
            y: height * 0.4 + (Math.random() - 0.5) * 100,
            vx: (Math.random() - 0.5) * 14,
            vy: -Math.random() * 14 - 4,
            size: Math.random() * 9 + 4,
            color: colors[Math.floor(Math.random() * colors.length)],
            rotation: Math.random() * 360,
            rotSpeed: (Math.random() - 0.5) * 10,
            opacity: 1,
            shape: Math.random() > 0.4 ? 'rect' : 'circle'
        });
    }

    const startTime = Date.now();
    let animationFrame;

    function render() {
        const elapsed = Date.now() - startTime;
        ctx.clearRect(0, 0, width, height);

        let activeCount = 0;
        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.35; // gravity
            p.vx *= 0.985; // drag
            p.rotation += p.rotSpeed;

            if (elapsed > duration * 0.6) {
                p.opacity = Math.max(0, 1 - (elapsed - duration * 0.6) / (duration * 0.4));
            }

            if (p.opacity > 0 && p.y < height + 50) {
                activeCount++;
                ctx.save();
                ctx.globalAlpha = p.opacity;
                ctx.translate(p.x, p.y);
                ctx.rotate((p.rotation * Math.PI) / 180);
                ctx.fillStyle = p.color;

                if (p.shape === 'rect') {
                    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
                } else {
                    ctx.beginPath();
                    ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
                    ctx.fill();
                }

                ctx.restore();
            }
        });

        if (elapsed < duration && activeCount > 0) {
            animationFrame = requestAnimationFrame(render);
        } else {
            ctx.clearRect(0, 0, width, height);
            window.removeEventListener('resize', onResize);
        }
    }

    render();
    QuestAudio.playFanfare();
}

/* ---------------------------------------------------------
   TOAST NOTIFICATION HELPER
   --------------------------------------------------------- */
let toastTimer = null;
function showToast(message, duration = 2800) {
    let toast = document.getElementById('questToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'questToast';
        toast.className = 'quest-toast';
        document.body.appendChild(toast);
    }

    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('show');

    toastTimer = setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

/* ---------------------------------------------------------
   FLOATING LILIES / STARS BACKGROUND HELPER
   --------------------------------------------------------- */
function injectFloatingLilies(count = 10) {
    if (document.getElementById('floatingLiliesStage')) return;

    const stage = document.createElement('div');
    stage.id = 'floatingLiliesStage';
    stage.className = 'floating-lilies-stage';
    stage.setAttribute('aria-hidden', 'true');

    for (let i = 0; i < count; i++) {
        const lily = document.createElement('div');
        lily.className = 'floating-lily';
        lily.style.left = `${Math.random() * 94 + 3}%`;
        lily.style.setProperty('--duration', `${Math.random() * 6 + 7}s`);
        lily.style.setProperty('--delay', `${Math.random() * 5}s`);

        lily.innerHTML = `
            <svg viewBox="0 0 60 60" width="100%" height="100%">
                <path d="M30,5 C35,20 48,25 55,30 C45,35 35,42 30,55 C25,42 15,35 5,30 C12,25 25,20 30,5 Z" fill="rgba(255,255,255,0.7)" />
                <circle cx="30" cy="30" r="4" fill="#ffd76a" />
            </svg>
        `;
        stage.appendChild(lily);
    }

    document.body.appendChild(stage);
}

// Auto init audio unlock on first user gesture
window.addEventListener('pointerdown', () => QuestAudio.init(), { once: true });

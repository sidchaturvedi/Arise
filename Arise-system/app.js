// Core Application State
let state = {
    user: null,
    profile: {
        name: '',
        age: 0,
        template: '',
        level: 1,
        xp: 0,
        streak: 0,
        lastResetTime: Date.now(),
        lockTasksUntilTomorrow: false
    },
    tasks: [] // Array of: { id, text, completed }
};

const TEMPLATES = {
    morning: [
        "Wake before 7 AM",
        "30 minute exercise (10 pushups, 20 squats, 15 crunches, 15 leg raises, 2m meditation)",
        "1 hour deep work",
        "Healthy breakfast",
        "Learn something 30 minutes",
        "Sleep before 11:00 PM"
    ],
    night: [
        "Wake before 10:00 AM",
        "Plan day",
        "2 hour deep work session",
        "30 minute exercise (10 pushups, 20 squats, 15 crunches, 15 leg raises, 2m meditation)",
        "1 hour deep work",
        "30 min learning skill",
        "Sleep before 2:00 AM"
    ],
    lazy: [
        "Wake before 11 AM",
        "Drink water 5 times",
        "5 pushups or short walk",
        "25 minutes work/study",
        "Clean small area",
        "Sleep before 1:30 AM",
        "Sleep less than 9 hours"
    ]
};

// UI DOM Elements
const pages = {
    landing: document.getElementById('page-landing'),
    awakening: document.getElementById('page-awakening'),
    clown: document.getElementById('page-clown'),
    details: document.getElementById('page-details'),
    template: document.getElementById('page-template'),
    dashboard: document.getElementById('page-dashboard')
};

// Intersection Observer for scroll animations (Slower fades/blurs)
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if(entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, { threshold: 0.15 });

function observeElements() {
    document.querySelectorAll('.reveal-on-scroll:not(.observed)').forEach(el => {
        observer.observe(el);
        el.classList.add('observed');
    });
}

/* =========================================
   ANIMATION & UX ENGINE
   ========================================= */

// Refactored to scroll rather than just overlap positions
function navigateTo(pageId) {
    const targetPage = pages[pageId];
    targetPage.classList.remove('locked');
    
    // Give DOM time to register display property before smooth scrolling
    setTimeout(() => {
        targetPage.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Failsafe if scrollIntoView is intercepted
        if(window.scrollY < targetPage.offsetTop - 100) {
            window.scrollTo({ top: targetPage.offsetTop, behavior: 'smooth' });
        }
    }, 150);
    
    // Trigger typewriter effect for current page at slightly slower pace
    const textEls = targetPage.querySelectorAll('.reveal-text:not(.typed)');
    textEls.forEach(el => {
        el.classList.add('typed');
        typeWriterEffect(el);
    });
}

function typeWriterEffect(el) {
    const text = el.getAttribute('data-text') || el.innerText;
    el.setAttribute('data-text', text);
    el.innerText = '';
    let i = 0;
    function type() {
        if (i < text.length) {
            el.innerHTML += text.charAt(i);
            i++;
            setTimeout(type, 80); // slower typography reveal
        }
    }
    type();
}

// Custom Cursor Logic
const cursor = document.getElementById('cursor');
const follower = document.getElementById('cursor-follower');
document.addEventListener('mousemove', (e) => {
    requestAnimationFrame(() => {
        cursor.style.left = e.clientX + 'px';
        cursor.style.top = e.clientY + 'px';
        // Follower naturally lags via CSS transition
        follower.style.left = e.clientX + 'px';
        follower.style.top = e.clientY + 'px';
    });
});

document.addEventListener('mouseover', (e) => {
    if(e.target.tagName.toLowerCase() === 'button' || e.target.classList.contains('card') || e.target.tagName.toLowerCase() === 'input') {
        document.body.classList.add('cursor-hover');
    }
});
document.addEventListener('mouseout', (e) => {
    if(e.target.tagName.toLowerCase() === 'button' || e.target.classList.contains('card') || e.target.tagName.toLowerCase() === 'input') {
        document.body.classList.remove('cursor-hover');
    }
});

// Particle Background Logic - Meteor Shower Upgrade
const canvas = document.getElementById('particle-canvas');
const ctx = canvas.getContext('2d');
let cw = canvas.width = window.innerWidth;
let ch = canvas.height = window.innerHeight;

const particles = Array.from({ length: 90 }, () => ({
    x: Math.random() * cw,
    y: Math.random() * ch,
    vx: (Math.random() - 0.5) * 0.2,  // slow base particle
    vy: -Math.random() * 0.2 - 0.1,   // slow base particle float up
    size: Math.random() * 1.5 + 0.5,
    alpha: Math.random() * 0.4 + 0.1,
    isMeteor: Math.random() < 0.18    // 18% of segments act as fast diagonal meteors
}));

function renderLayer() {
    ctx.clearRect(0, 0, cw, ch);
    particles.forEach(p => {
        if (p.isMeteor) {
            // Meteor traveling top-right to bottom-left
            p.x -= 2.8; 
            p.y += 2.8; 
            if (p.x < 0 || p.y > ch) {
                // reset position top-right relative space
                p.x = Math.random() * cw + (cw * 0.5); 
                p.y = -50 - (Math.random() * 200);
            }
            
            // Draw brief magenta streak
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            // line trail points backwards up-right
            ctx.lineTo(p.x + 25, p.y - 25);
            ctx.strokeStyle = `rgba(157, 0, 255, ${p.alpha * 1.8})`;
            ctx.lineWidth = p.size;
            ctx.stroke();
        } else {
            // Normal background floating dot
            p.x += p.vx;
            p.y += p.vy;
            if(p.y < 0) { p.y = ch; p.x = Math.random() * cw; }
            
            ctx.fillStyle = `rgba(0, 243, 255, ${p.alpha})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
    });
    requestAnimationFrame(renderLayer);
}
renderLayer();
window.addEventListener('resize', () => { cw = canvas.width = window.innerWidth; ch = canvas.height = window.innerHeight; });

/* =========================================
   APPLICATION LOGIC & FIREBASE INTEGRATION
   ========================================= */

function getFB() {
    return window.firebaseApp || null;
}

// Create a globally accessible logout function
async function handleLogout() {
    const fb = getFB();
    if (fb && fb.auth && state.user && state.user.uid !== 'local_dev') {
        await fb.signOut(fb.auth);
    }
    state.user = null;
    state.profile.template = '';
    state.tasks = [];
    localStorage.removeItem('arise_data');
    
    // Hide all pages immediately
    Object.values(pages).forEach(p => p.classList.add('locked'));
    
    document.getElementById('btn-login').innerText = "Login with Google";
    navigateTo('landing');
}

// Attach logout to the dashboard header button
const btnLogoutDash = document.getElementById('btn-logout');
if(btnLogoutDash) btnLogoutDash.addEventListener('click', handleLogout);

async function loadUserData() {
    // Basic protection against empty state loading
    if (!state.user) {
        navigateTo('landing');
        return;
    }

    const fb = getFB();
    if (fb && fb.auth && state.user && state.user.uid !== 'local_dev') {
        try {
            const dbRef = fb.ref(fb.db);
            const userRefChild = fb.child(dbRef, `users/${state.user.uid}`);
            
            // Prevent hanging if Database is unreachable/unconfigured
            const snap = await Promise.race([
                fb.get(userRefChild),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Firebase Fetch Timeout')), 3000))
            ]);
            if(snap.exists()) {
                const data = snap.val();
                state.profile = data.profile;
                state.tasks = data.tasks || [];
                if(state.profile.template && state.tasks.length > 0) {
                    checkDailyProgress();
                    // Completely hide setup pages so user can't scroll back up
                    pages.landing.classList.add('locked');
                    pages.awakening.classList.add('locked');
                    pages.details.classList.add('locked');
                    pages.template.classList.add('locked');
                    
                    navigateTo('dashboard');
                    initDashboard();
                    return;
                }
            }
        } catch(err) {
            console.warn("Firebase RTDB access error. Falling back to local data.", err);
            // Fallback load...
            const local = localStorage.getItem('arise_data');
            if(local) {
                const data = JSON.parse(local);
                state.profile = data.profile;
                state.tasks = data.tasks || [];
                if(state.profile.template && state.tasks.length > 0) {
                    checkDailyProgress();
                    pages.landing.classList.add('locked');
                    navigateTo('dashboard');
                    initDashboard();
                    return;
                }
            }
        }
    } else {
        const local = localStorage.getItem('arise_data');
        if(local) {
            const data = JSON.parse(local);
            state.profile = data.profile;
            state.tasks = data.tasks || [];
            if(state.profile.template && state.tasks.length > 0) {
                checkDailyProgress();
                navigateTo('dashboard');
                initDashboard();
                return;
            }
        }
    }
    
    // Only hit this if they don't have a template set yet
    navigateTo('awakening');
}

async function saveUserData() {
    const fb = getFB();
    if (fb && fb.auth && state.user && state.user.uid !== 'local_dev') {
        try {
            const userRef = fb.ref(fb.db, `users/${state.user.uid}`);
            await Promise.race([
                fb.set(userRef, { profile: state.profile, tasks: state.tasks }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Firebase Save Timeout')), 2500))
            ]);
        } catch(err) {
            console.warn("Firebase RTDB save error. Falling back to specific local save.", err);
            localStorage.setItem('arise_data', JSON.stringify({ profile: state.profile, tasks: state.tasks }));
        }
    } else {
        localStorage.setItem('arise_data', JSON.stringify({ profile: state.profile, tasks: state.tasks }));
    }
}

// Page 1: Login
document.getElementById('btn-login').addEventListener('click', async () => {
    const fb = getFB();
    if (state.user) {
        await handleLogout();
    } else {
        if (fb && fb.auth) {
            try {
                // If they manually clicked, fire popup
                await fb.signInWithPopup(fb.auth, fb.provider);
            } catch(e) {
                console.error("Firebase Auth Error", e);
                state.user = { uid: 'local_dev' };
                document.getElementById('btn-login').innerText = "Logout";
                await loadUserData();
            }
        } else {
            // Firebase script is completely blocked or failed to load
            state.user = { uid: 'local_dev' };
            document.getElementById('btn-login').innerText = "Logout";
            await loadUserData();
        }
    }
});

// Page 2: Awakening
document.getElementById('btn-awake-yes').addEventListener('click', () => navigateTo('details'));
document.getElementById('btn-awake-no').addEventListener('click', () => navigateTo('clown'));

// Page 3: Details
document.getElementById('btn-save-details').addEventListener('click', () => {
    const name = document.getElementById('input-name').value.trim();
    const age = parseInt(document.getElementById('input-age').value);
    if(!name || !age) return;
    state.profile.name = name;
    state.profile.age = age;
    saveUserData();
    navigateTo('template');
});

// Page 4: Template Selection
let _selected = null;
document.querySelectorAll('.card[data-template]').forEach(c => {
    c.addEventListener('click', () => {
        if (state.profile.template) {
            // Already locked to a template
            return;
        }
        document.querySelectorAll('.card').forEach(x => x.classList.remove('selected'));
        c.classList.add('selected');
        _selected = c.getAttribute('data-template');
        document.getElementById('btn-confirm-template').classList.remove('hidden');
    });
});

document.getElementById('btn-confirm-template').addEventListener('click', () => {
    if(_selected === 'custom') {
        document.getElementById('custom-builder').classList.remove('hidden');
        state.tasks = [];
        renderCustomTasks();
    } else {
        setTemplate(_selected, TEMPLATES[_selected]);
    }
});

function setTemplate(templateName, presetTasks) {
    state.profile.template = templateName;
    state.tasks = presetTasks.map((t, i) => ({ id: Date.now() + i, text: t, completed: false }));
    state.profile.lastResetTime = Date.now();
    
    saveUserData();
    navigateTo('dashboard');
    initDashboard();
}

function renderCustomTasks() {
    const c = document.getElementById('custom-task-list');
    c.innerHTML = state.tasks.map(t => `<div style="font-size:1rem; margin-bottom:8px; color:var(--text-sec); text-align: left; padding: 5px 10px; background: rgba(0,0,0,0.3); border-radius: 4px;">• ${t.text}</div>`).join('');
}

document.getElementById('btn-add-custom-task').addEventListener('click', () => {
    const val = document.getElementById('input-custom-task').value.trim();
    if(val) {
        state.tasks.push({ id: Date.now() + Math.random(), text: val, completed: false });
        renderCustomTasks();
        document.getElementById('input-custom-task').value = '';
    }
});

document.getElementById('btn-save-custom').addEventListener('click', () => {
    if(state.tasks.length === 0) return;
    document.getElementById('custom-builder').classList.add('hidden');
    state.profile.template = 'custom';
    state.profile.lastResetTime = Date.now();
    saveUserData();
    navigateTo('dashboard');
    initDashboard();
});

// Page 5: Dashboard Gamification Engine
function checkDailyProgress() {
    const cycle = 24 * 60 * 60 * 1000;
    const now = Date.now();
    if (now - state.profile.lastResetTime >= cycle) {
        let completedCount = state.tasks.filter(t => t.completed).length;
        let percent = state.tasks.length > 0 ? (completedCount / state.tasks.length) * 100 : 0;
        
        // XP Assignment strictly based on daily completion threshold
        if (percent === 100) state.profile.xp += 20;
        else if (percent >= 70) state.profile.xp += 15;
        else if (percent >= 50) state.profile.xp += 10;
        else if (percent >= 25) state.profile.xp += 5;

        // Streak computation
        if (percent >= 70) {
            state.profile.streak++;
        } else {
            state.profile.streak = 0;
            const daysMissed = Math.floor((now - state.profile.lastResetTime) / cycle);
            state.profile.level = Math.max(1, state.profile.level - (5 * daysMissed));
        }
        
        const earnedLevel = Math.floor(state.profile.streak / 7) + 1;
        if(state.profile.streak >= 7 && earnedLevel > state.profile.level) {
            state.profile.level = Math.min(100, earnedLevel);
        }
        
        state.tasks.forEach(t => t.completed = false);
        state.profile.lastResetTime = now;
        state.profile.lockTasksUntilTomorrow = false; // unlocks tasks
        saveUserData();
    }
}

function initDashboard() {
    document.getElementById('dash-name').innerText = state.profile.name.toUpperCase();
    refreshDashUI();
}

function refreshDashUI() {
    document.getElementById('dash-level').innerText = state.profile.level;
    document.getElementById('dash-xp').innerText = state.profile.xp;
    document.getElementById('dash-streak').innerText = state.profile.streak;
    
    let comp = state.tasks.filter(t => t.completed).length;
    let pct = state.tasks.length ? Math.round((comp / state.tasks.length)*100) : 0;
    
    document.getElementById('dash-percent').innerText = pct + '%';
    document.getElementById('dash-progress').style.width = pct + '%';

    const list = document.getElementById('task-list');
    list.innerHTML = '';
    
    state.tasks.forEach((t, index) => {
        const item = document.createElement('div');
        // add reveal-on-scroll to child items injected dynamically
        item.className = 'task-item reveal-on-scroll ' + (t.completed ? 'completed' : '');
        item.innerHTML = `
            <span>${t.text}</span>
            <button>${t.completed ? 'DONE' : 'Complete'}</button>
        `;
        
        // Staggered delay for cascading reveal effect inside observer viewport
        item.style.transitionDelay = `${index * 0.15}s`;

        item.querySelector('button').addEventListener('click', () => {
            if (state.profile.lockTasksUntilTomorrow) {
                const float = document.createElement('div');
                float.innerText = 'LOCKED UNTIL TOMORROW';
                float.style.position = 'absolute'; float.style.right = '40px'; float.style.top = '-20px';
                float.style.color = 'var(--neon-red)'; float.style.fontWeight = 'bold'; 
                float.style.textShadow = '0 0 10px var(--neon-red)'; float.style.pointerEvents = 'none';
                float.style.transition = 'all 1.5s cubic-bezier(0.2, 0.8, 0.2, 1)';
                float.style.transform = 'translateY(10px)'; float.style.opacity = '1';
                item.appendChild(float);
                setTimeout(() => { float.style.transform = 'translateY(-40px)'; float.style.opacity = '0'; }, 50);
                setTimeout(() => float.remove(), 1600);
                return;
            }
            if(!t.completed) completeTask(t.id, item);
        });
        list.appendChild(item);
    });

    observeElements();
}

function completeTask(taskId, el) {
    const task = state.tasks.find(t => t.id === taskId);
    if(!task) return;
    
    task.completed = true;
    
    const float = document.createElement('div');
    float.innerText = 'COMPLETED';
    float.style.position = 'absolute'; float.style.right = '40px'; float.style.top = '-20px';
    float.style.color = 'var(--neon-green)'; float.style.fontWeight = 'bold'; 
    float.style.textShadow = '0 0 10px var(--neon-green)';
    float.style.transition = 'all 1.5s cubic-bezier(0.2, 0.8, 0.2, 1)';
    float.style.transform = 'translateY(10px)'; float.style.opacity = '1';
    el.appendChild(float);
    
    setTimeout(() => { float.style.transform = 'translateY(-60px)'; float.style.opacity = '0'; }, 50);
    setTimeout(() => float.remove(), 1600);

    saveUserData();
    refreshDashUI();
}

// Reset / Delete Protocol Logic (requested update)
document.getElementById('btn-reset-template').addEventListener('click', () => {
    document.getElementById('delete-warning-overlay').classList.remove('hidden');
});

document.getElementById('btn-cancel-delete').addEventListener('click', () => {
    document.getElementById('delete-warning-overlay').classList.add('hidden');
});

document.getElementById('btn-confirm-delete').addEventListener('click', () => {
    document.getElementById('delete-warning-overlay').classList.add('hidden');
    
    // Destroy existing protocol data but keep stats
    state.profile.template = '';
    state.tasks = [];
    state.profile.lockTasksUntilTomorrow = true;
    saveUserData();
    
    // Hide dashboard
    pages.dashboard.classList.add('locked');
    
    // Reset template selection panel
    document.querySelectorAll('.card').forEach(x => x.classList.remove('selected'));
    document.getElementById('btn-confirm-template').classList.add('hidden');
    
    // Scroll back to template selection beautifully
    navigateTo('template');
});

// Init sequence on load
window.addEventListener('load', () => {
    observeElements();
    
    // Safely poll for deferred Firebase module initialization
    const verifySdkLoaded = setInterval(() => {
        const fb = getFB();
        if (fb && fb.auth) {
            clearInterval(verifySdkLoaded);
            fb.onAuthStateChanged(fb.auth, async (user) => {
                if (user) {
                    state.user = user;
                    document.getElementById('btn-login').innerText = "Logout";
                    await loadUserData(); // auto-bypasses landing if template exists
                } else {
                    state.user = null;
                    document.getElementById('btn-login').innerText = "Login with Google";
                    navigateTo('landing');
                }
            });
        }
    }, 50);

    // Fail-safe to unlock landing if Firebase is blocked (e.g. adblocker)
    setTimeout(() => {
        clearInterval(verifySdkLoaded);
        if(!getFB()) navigateTo('landing');
    }, 2000);
});

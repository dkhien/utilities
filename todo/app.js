/* ═══════════════════════════════════════════════════
   focus. — app.js
═══════════════════════════════════════════════════ */

// ── State ──────────────────────────────────────────
let tasks = [];
let focusedIndex = -1;

// ── Persist helpers ────────────────────────────────
const LS = {
  get: (k, fb) => { try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : fb; } catch { return fb; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};

// ── DOM refs ───────────────────────────────────────
const body           = document.body;
const taskList       = document.getElementById('taskList');
const emptyState     = document.getElementById('emptyState');
const titleInput     = document.getElementById('taskTitle');
const descInput      = document.getElementById('taskDesc');
const descWrapper    = document.getElementById('descWrapper');
const timerCountdown = document.getElementById('timerCountdown');
const timerTargetBtn = document.getElementById('timerTargetBtn');
const timerEdit      = document.getElementById('timerEdit');
const timerInput     = document.getElementById('timerInput');
const timerSave      = document.getElementById('timerSave');
const darkToggle     = document.getElementById('darkToggle');
const helpBtn        = document.getElementById('helpBtn');
const modalBackdrop  = document.getElementById('modalBackdrop');
const modalClose     = document.getElementById('modalClose');

// ── Theme ──────────────────────────────────────────
function applyTheme({ dark, palette }) {
  body.setAttribute('data-dark', dark ? 'true' : 'false');
  body.setAttribute('data-palette', palette || 'pink');
  document.querySelectorAll('.theme-color').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.palette === (palette || 'pink'))
  );
}

function loadTheme() {
  applyTheme(LS.get('theme', { dark: false, palette: 'pink' }));
}

darkToggle.addEventListener('click', () => {
  const dark    = body.getAttribute('data-dark') !== 'true';
  const palette = body.getAttribute('data-palette') || 'pink';
  applyTheme({ dark, palette });
  LS.set('theme', { dark, palette });
});

document.querySelectorAll('.theme-color').forEach(btn => {
  btn.addEventListener('click', () => {
    const dark    = body.getAttribute('data-dark') === 'true';
    const palette = btn.dataset.palette;
    applyTheme({ dark, palette });
    LS.set('theme', { dark, palette });
  });
});

// ── Shortcut modal ─────────────────────────────────
function openModal()  { modalBackdrop.classList.add('open'); }
function closeModal() { modalBackdrop.classList.remove('open'); }

helpBtn.addEventListener('click', openModal);
modalClose.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', e => { if (e.target === modalBackdrop) closeModal(); });

// ── Tasks ──────────────────────────────────────────
function saveTasks() { LS.set('tasks', tasks); }

function loadTasks() {
  tasks = LS.get('tasks', []);
  renderAll();
}

function addTask(title, desc) {
  title = title.trim();
  if (!title) return;
  tasks.unshift({ id: Date.now(), title, desc: desc.trim(), done: false });
  saveTasks();
  renderAll();
  setFocus(0);
  setTimeout(() => { clearFocus(); titleInput.focus(); }, 600);
}

function toggleDone(id) {
  const t = tasks.find(t => t.id === id);
  if (!t) return;
  t.done = !t.done;
  tasks = [...tasks.filter(t => !t.done), ...tasks.filter(t => t.done)];
  saveTasks();
  renderAll();
}

function deleteTask(id) {
  const i = tasks.findIndex(t => t.id === id);
  tasks = tasks.filter(t => t.id !== id);
  saveTasks();
  renderAll();
  // refocus a nearby task
  setTimeout(() => {
    const items = taskList.querySelectorAll('.task-item');
    if (items.length > 0) {
      const next = Math.min(i, items.length - 1);
      setFocus(next);
    } else {
      titleInput.focus();
    }
  }, 0);
}

// ── Render ─────────────────────────────────────────
function renderAll() {
  taskList.innerHTML = '';
  emptyState.classList.toggle('visible', tasks.length === 0);

  tasks.forEach((task, i) => {
    const li = document.createElement('li');
    li.className = 'task-item' + (task.done ? ' done' : '') + (!task.desc ? ' no-desc' : '');
    li.dataset.id = task.id;
    li.setAttribute('tabindex', '0');
    li.setAttribute('role', 'listitem');

    li.innerHTML = `
      <div class="task-header">
        <div class="task-check" title="Mark done">✓</div>
        <span class="task-title">${escHtml(task.title)}</span>
        ${task.desc ? `<button class="expand-btn" title="Expand note (Space)" tabindex="-1">▾</button>` : ''}
        <button class="task-delete" title="Delete (Del)" tabindex="-1">✕</button>
      </div>
      ${task.desc ? `
        <div class="task-desc-wrap">
          <p class="task-desc">${escHtml(task.desc)}</p>
        </div>` : ''}
    `;

    const check    = li.querySelector('.task-check');
    const expandBtn= li.querySelector('.expand-btn');
    const descWrap = li.querySelector('.task-desc-wrap');
    const delBtn   = li.querySelector('.task-delete');

    // Check circle only → toggle done
    check.addEventListener('click', e => { e.stopPropagation(); toggleDone(task.id); });

    // Click anywhere on task → expand/collapse
    li.addEventListener('click', e => {
      if (check.contains(e.target)) return;
      if (delBtn.contains(e.target)) return;
      if (expandBtn && descWrap) toggleExpand(li, expandBtn, descWrap);
    });

    // Delete
    delBtn.addEventListener('click', e => { e.stopPropagation(); deleteTask(task.id); });

    // Keyboard
    li.addEventListener('keydown', e => handleTaskKey(e, i, task, li, expandBtn, descWrap));

    // Focus tracking
    li.addEventListener('focus', () => { focusedIndex = i; li.classList.add('focused'); });
    li.addEventListener('blur',  () => { li.classList.remove('focused'); });
    if (focusedIndex === i) li.classList.add('focused');

    taskList.appendChild(li);
  });
}

function toggleExpand(li, expandBtn, descWrap) {
  const open = descWrap.classList.toggle('open');
  expandBtn.classList.toggle('rotated', open);
}

function handleTaskKey(e, i, task, li, expandBtn, descWrap) {
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault(); setFocus(i + 1); break;
    case 'ArrowUp':
      e.preventDefault();
      if (i === 0) { titleInput.focus(); focusedIndex = -1; }
      else setFocus(i - 1);
      break;
    case 'Enter':
      e.preventDefault(); toggleDone(task.id); break;
    case ' ':
      e.preventDefault();
      if (expandBtn && descWrap) toggleExpand(li, expandBtn, descWrap);
      break;
    case 'Backspace':
    case 'Delete':
      e.preventDefault(); deleteTask(task.id); break;
    case 'Escape':
      titleInput.focus(); break;
    case '?':
      openModal(); break;
  }
}

function setFocus(i) {
  const items = taskList.querySelectorAll('.task-item');
  if (i < 0 || i >= items.length) return;
  focusedIndex = i;
  items[i].focus();
}

function clearFocus() {
  focusedIndex = -1;
}

// ── Input handling ─────────────────────────────────
function openDesc() {
  descWrapper.classList.add('open');
  descInput.focus();
}

function closeDesc() {
  descWrapper.classList.remove('open');
  titleInput.focus();
}

function clearInputs() {
  titleInput.value = '';
  descInput.value  = '';
  descInput.style.height = '';
  closeDesc();
}

function submitTask() {
  addTask(titleInput.value, descInput.value);
  clearInputs();
}

titleInput.addEventListener('keydown', e => {
  if (e.key === 'Tab')        { e.preventDefault(); openDesc(); }
  else if (e.key === 'Enter') { e.preventDefault(); submitTask(); }
  else if (e.key === 'ArrowDown') { e.preventDefault(); setFocus(0); }
  else if (e.key === 'Escape')    { clearInputs(); }
  else if (e.key === '?')         { openModal(); }
});

descInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); submitTask(); }
  else if (e.key === 'Escape') { e.preventDefault(); closeDesc(); }
  else if (e.key === 'Tab')    { e.preventDefault(); titleInput.focus(); }
});

descInput.addEventListener('input', () => {
  descInput.style.height = 'auto';
  descInput.style.height = Math.min(descInput.scrollHeight, 120) + 'px';
});

// ── Timer ──────────────────────────────────────────
let timerTarget  = LS.get('timerTarget', '17:00');
let timerInterval;

function formatCountdown(ms) {
  if (ms <= 0) return '00:00:00';
  const s = Math.floor(ms / 1000);
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function getTargetMs(t) {
  const [h, m] = t.split(':').map(Number);
  const now    = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
  return target - now; // negative means already passed today
}

const timerLabel = document.getElementById('timerLabel');

function tickTimer() {
  const ms = getTargetMs(timerTarget);
  if (ms <= 0) {
    // Target time has passed — stop, show done
    timerCountdown.textContent = '00:00:00';
    timerCountdown.classList.add('done');
    if (timerLabel) timerLabel.textContent = 'done for today';
    clearInterval(timerInterval);
    timerInterval = null;
    // Auto-reset at midnight next day
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 2);
    setTimeout(startTimer, midnight - now);
  } else {
    timerCountdown.textContent = formatCountdown(ms);
    timerCountdown.classList.remove('done');
    if (timerLabel) timerLabel.textContent = 'until';
  }
}

function startTimer() {
  timerTargetBtn.textContent = timerTarget;
  timerInput.value = timerTarget;
  clearInterval(timerInterval);
  timerInterval = null;
  tickTimer(); // sets correct state immediately
  if (getTargetMs(timerTarget) > 0) {
    timerInterval = setInterval(tickTimer, 1000);
  }
}

timerTargetBtn.addEventListener('click', () => {
  timerEdit.hidden = false;
  timerInput.focus();
  timerInput.select();
});

timerSave.addEventListener('click', () => {
  const val = timerInput.value;
  if (/^\d{2}:\d{2}$/.test(val)) {
    timerTarget = val;
    LS.set('timerTarget', timerTarget);
    timerEdit.hidden = true;
    startTimer();
  }
});

timerInput.addEventListener('keydown', e => {
  if (e.key === 'Enter')  timerSave.click();
  if (e.key === 'Escape') timerEdit.hidden = true;
});

document.addEventListener('click', e => {
  if (!timerEdit.hidden && !timerEdit.contains(e.target) && e.target !== timerTargetBtn) {
    timerEdit.hidden = true;
  }
});

// Global ? shortcut when not typing
document.addEventListener('keydown', e => {
  if (e.key === '?' && document.activeElement === document.body) openModal();
  if (e.key === 'Escape' && modalBackdrop.classList.contains('open')) closeModal();
});

// ── Util ───────────────────────────────────────────
function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Init ───────────────────────────────────────────
loadTheme();
loadTasks();
startTimer();
titleInput.focus();
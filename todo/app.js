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
  // Restore focus to same task after re-render
  setTimeout(() => {
    const idx = tasks.findIndex(t => t.id === id);
    if (idx >= 0) setFocus(idx);
  }, 0);
}

function deleteTask(id) {
  const i = tasks.findIndex(t => t.id === id);
  tasks = tasks.filter(t => t.id !== id);
  saveTasks();
  renderAll();
  setTimeout(() => {
    const items = taskList.querySelectorAll('.task-item');
    if (items.length > 0) setFocus(Math.min(i, items.length - 1));
    else titleInput.focus();
  }, 0);
}

function moveTask(id, dir) {
  const i = tasks.findIndex(t => t.id === id);
  const j = i + dir;
  if (j < 0 || j >= tasks.length) return;
  [tasks[i], tasks[j]] = [tasks[j], tasks[i]];
  saveTasks();
  focusedIndex = j;
  renderAll();
  setTimeout(() => setFocus(j), 0);
}

// ── Edit ───────────────────────────────────────────
function startEdit(id) {
  const li = taskList.querySelector(`[data-id="${id}"]`);
  if (!li) return;
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  li.classList.add('editing');
  li.innerHTML = `
    <div class="edit-zone">
      <input class="edit-title" type="text" value="${escHtml(task.title)}" maxlength="120" spellcheck="false" autocomplete="off" />
      <textarea class="edit-desc" placeholder="add a note… (optional)" maxlength="500">${escHtml(task.desc)}</textarea>
      <div class="edit-actions">
        <span class="hint-key">Enter — save title &nbsp;·&nbsp; Shift+Enter — save note &nbsp;·&nbsp; Esc — cancel</span>
      </div>
    </div>
  `;

  const titleEl = li.querySelector('.edit-title');
  const descEl  = li.querySelector('.edit-desc');

  const resize = () => { descEl.style.height = 'auto'; descEl.style.height = Math.min(descEl.scrollHeight, 120) + 'px'; };
  descEl.addEventListener('input', resize);
  resize();

  titleEl.focus();
  titleEl.setSelectionRange(titleEl.value.length, titleEl.value.length);

  const save = () => {
    const newTitle = titleEl.value.trim();
    if (!newTitle) { cancelEdit(); return; }
    task.title = newTitle;
    task.desc  = descEl.value.trim();
    saveTasks();
    renderAll();
    setTimeout(() => { const idx = tasks.findIndex(t => t.id === id); if (idx >= 0) setFocus(idx); }, 0);
  };

  const cancelEdit = () => {
    renderAll();
    setTimeout(() => { const idx = tasks.findIndex(t => t.id === id); if (idx >= 0) setFocus(idx); }, 0);
  };

  titleEl.addEventListener('keydown', e => {
    e.stopPropagation(); // prevent bubbling to li's handleTaskKey
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); }
    if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
    if (e.key === 'Tab') { e.preventDefault(); descEl.focus(); }
  });
  descEl.addEventListener('keydown', e => {
    e.stopPropagation(); // prevent bubbling to li's handleTaskKey
    if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); save(); }
    if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
    if (e.key === 'Tab') { e.preventDefault(); titleEl.focus(); }
  });
}

// ── Drag & drop state ──────────────────────────────
let dragSrcId   = null;
let dragOverId  = null;

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
        <div class="drag-handle" title="Drag to reorder" tabindex="-1">
          <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <circle cx="3" cy="3"  r="1.5"/><circle cx="7" cy="3"  r="1.5"/>
            <circle cx="3" cy="8"  r="1.5"/><circle cx="7" cy="8"  r="1.5"/>
            <circle cx="3" cy="13" r="1.5"/><circle cx="7" cy="13" r="1.5"/>
          </svg>
        </div>
        <div class="task-check" title="Mark done">✓</div>
        <span class="task-title">${escHtml(task.title)}</span>
        ${task.desc ? `<button class="expand-btn" title="Expand note (Space)" tabindex="-1">▾</button>` : ''}
        <button class="task-edit" title="Edit (E)" tabindex="-1">✎</button>
        <button class="task-delete" title="Delete (Del)" tabindex="-1">✕</button>
      </div>
      ${task.desc ? `
        <div class="task-desc-wrap">
          <p class="task-desc">${linkify(task.desc)}</p>
        </div>` : ''}
    `;

    const check     = li.querySelector('.task-check');
    const expandBtn = li.querySelector('.expand-btn');
    const descWrap  = li.querySelector('.task-desc-wrap');
    const editBtn   = li.querySelector('.task-edit');
    const delBtn    = li.querySelector('.task-delete');
    const handle    = li.querySelector('.drag-handle');

    // ── Drag & drop ──
    // Gate drag on handle — set flag on mousedown, clear on dragend/mouseup
    let dragFromHandle = false;
    handle.addEventListener('mousedown', e => {
      dragFromHandle = true;
      // Ensure draggable is active
      li.setAttribute('draggable', 'true');
    });

    li.addEventListener('dragstart', e => {
      if (!dragFromHandle) { e.preventDefault(); return; }
      dragSrcId = task.id;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(task.id));
      requestAnimationFrame(() => li.classList.add('dragging'));
    });

    li.addEventListener('dragend', () => {
      dragFromHandle = false;
      li.classList.remove('dragging');
      taskList.querySelectorAll('.task-item').forEach(el => el.classList.remove('drag-over-top', 'drag-over-bottom'));
      dragSrcId  = null;
      dragOverId = null;
    });

    li.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (dragSrcId === task.id) return;
      const rect = li.getBoundingClientRect();
      const mid  = rect.top + rect.height / 2;
      taskList.querySelectorAll('.task-item').forEach(el => el.classList.remove('drag-over-top', 'drag-over-bottom'));
      li.classList.add(e.clientY < mid ? 'drag-over-top' : 'drag-over-bottom');
      dragOverId = task.id;
    });

    li.addEventListener('dragleave', e => {
      if (!li.contains(e.relatedTarget)) {
        li.classList.remove('drag-over-top', 'drag-over-bottom');
      }
    });

    li.addEventListener('drop', e => {
      e.preventDefault();
      if (dragSrcId === null || dragSrcId === task.id) return;

      const fromIdx = tasks.findIndex(t => t.id === dragSrcId);
      const toIdx   = tasks.findIndex(t => t.id === task.id);
      if (fromIdx < 0 || toIdx < 0) return;

      const rect    = li.getBoundingClientRect();
      const insertAfter = e.clientY >= rect.top + rect.height / 2;
      const insertIdx   = insertAfter ? toIdx + (fromIdx > toIdx ? 0 : 0) : toIdx;

      const [moved] = tasks.splice(fromIdx, 1);
      const adjustedTo = tasks.findIndex(t => t.id === task.id);
      tasks.splice(insertAfter ? adjustedTo + 1 : adjustedTo, 0, moved);

      saveTasks();
      focusedIndex = tasks.findIndex(t => t.id === dragSrcId);
      renderAll();
    });

    // ── Mouse interactions ──
    check.addEventListener('click', e => { e.stopPropagation(); toggleDone(task.id); });
    editBtn.addEventListener('click', e => { e.stopPropagation(); startEdit(task.id); });

    li.addEventListener('dblclick', e => {
      if (check.contains(e.target) || delBtn.contains(e.target) || handle.contains(e.target)) return;
      startEdit(task.id);
    });

    li.addEventListener('click', e => {
      if (check.contains(e.target)) return;
      if (delBtn.contains(e.target)) return;
      if (editBtn.contains(e.target)) return;
      if (handle.contains(e.target)) return;
      if (expandBtn && descWrap) toggleExpand(li, expandBtn, descWrap);
    });

    delBtn.addEventListener('click', e => { e.stopPropagation(); deleteTask(task.id); });

    // ── Keyboard ──
    li.addEventListener('keydown', e => handleTaskKey(e, i, task, li, expandBtn, descWrap));
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
  // Don't hijack keys when an input/textarea inside the task is focused (e.g. edit mode)
  const active = document.activeElement;
  if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') && li.contains(active)) return;


  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      if (e.shiftKey) moveTask(task.id, 1);
      else setFocus(i + 1);
      break;
    case 'ArrowUp':
      e.preventDefault();
      if (e.shiftKey) moveTask(task.id, -1);
      else if (i === 0) { titleInput.focus(); focusedIndex = -1; }
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
    case 'e':
    case 'E':
      e.preventDefault(); startEdit(task.id); break;
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

function clearFocus() { focusedIndex = -1; }

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
  if (e.key === 'Tab')            { e.preventDefault(); openDesc(); }
  else if (e.key === 'Enter')     { e.preventDefault(); submitTask(); }
  else if (e.key === 'ArrowDown') { e.preventDefault(); setFocus(0); }
  else if (e.key === 'Escape')    { clearInputs(); }
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
let timerTarget   = LS.get('timerTarget', '17:00');
let timerInterval = null;
let timerStopped  = false; // user manually stopped

const timerLabel   = document.getElementById('timerLabel');
const timerResetBtn= document.getElementById('timerResetBtn');

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
  return target - now;
}

function setTimerDisplay(text, done = false, label = 'until') {
  timerCountdown.textContent = text;
  timerCountdown.classList.toggle('done', done);
  if (timerLabel) timerLabel.textContent = label;
}

function tickTimer() {
  if (timerStopped) return;
  const ms = getTargetMs(timerTarget);
  if (ms <= 0) {
    setTimerDisplay('00:00:00', true, 'done for today');
    clearInterval(timerInterval);
    timerInterval = null;
    // auto-reset at midnight
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 2);
    setTimeout(startTimer, midnight - now);
  } else {
    setTimerDisplay(formatCountdown(ms), false, 'until');
  }
}

function startTimer() {
  timerStopped = false;
  timerTargetBtn.textContent = timerTarget;
  timerInput.value = timerTarget;
  clearInterval(timerInterval);
  timerInterval = null;
  tickTimer();
  if (getTargetMs(timerTarget) > 0) {
    timerInterval = setInterval(tickTimer, 1000);
  }
}

// Reset — show 00:00:00 and freeze
timerResetBtn.addEventListener('click', () => {
  timerStopped = true;
  clearInterval(timerInterval);
  timerInterval = null;
  setTimerDisplay('00:00:00', true, 'reset');
});

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

document.addEventListener('keydown', e => {
  if (e.key === '?' && document.activeElement === document.body) openModal();
  if (e.key === 'Escape' && modalBackdrop.classList.contains('open')) closeModal();
});

// ── Util ───────────────────────────────────────────
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function linkify(s) {
  // escape first, then replace URLs with anchor tags
  const escaped = escHtml(s);
  return escaped.replace(
    /(https?:\/\/[^\s<>"]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="task-link" onclick="event.stopPropagation()">$1</a>'
  );
}

// ── Init ───────────────────────────────────────────
loadTheme();
loadTasks();
startTimer();
titleInput.focus();

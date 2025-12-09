// Substack Notes Scheduler - App Logic

let currentImage = null;
let currentWeekStart = getWeekStart(new Date());

// Time slots configuration
const TIME_SLOTS = [
  { name: 'Morning', hour: 9 },
  { name: 'Evening', hour: 16 },
  { name: 'Night', hour: 21 }
];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initTimezone();
  initEditor();
  initImageUpload();
  initScheduler();
  initCalendar();
  loadNotes();
  loadBacklog();
  initExportImport();
  checkForOverdueNotes();
});

// Display timezone and current time
function initTimezone() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  document.getElementById('timezone').textContent = tz;

  // Update current time immediately and every second
  updateCurrentTime();
  setInterval(updateCurrentTime, 1000);

  // Set default schedule time to tomorrow 9 AM
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  document.getElementById('scheduleDate').value = formatDateTimeLocal(tomorrow);
}

function updateCurrentTime() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  document.getElementById('currentTime').textContent = timeStr;
}

function formatDateTimeLocal(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString().slice(0, 16);
}

// Rich text editor
function initEditor() {
  const toolbar = document.querySelector('.toolbar');
  toolbar.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    const cmd = btn.dataset.cmd;
    if (cmd === 'createLink') {
      const url = prompt('Enter URL:');
      if (url) document.execCommand(cmd, false, url);
    } else {
      document.execCommand(cmd, false, null);
    }
    document.getElementById('editor').focus();
  });
}

// Image upload with drag & drop
function initImageUpload() {
  const dropzone = document.getElementById('imageDropzone');
  const input = document.getElementById('imageInput');
  const preview = document.getElementById('imagePreview');
  const previewContainer = document.getElementById('imagePreviewContainer');
  const prompt = document.getElementById('imagePrompt');
  const removeBtn = document.getElementById('removeImage');

  dropzone.addEventListener('click', () => input.click());

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleImage(file);
    }
  });

  input.addEventListener('change', (e) => {
    if (e.target.files[0]) {
      handleImage(e.target.files[0]);
    }
  });

  removeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    currentImage = null;
    previewContainer.style.display = 'none';
    prompt.style.display = 'block';
    input.value = '';
  });

  function handleImage(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      currentImage = e.target.result;
      preview.src = currentImage;
      previewContainer.style.display = 'inline-block';
      prompt.style.display = 'none';
    };
    reader.readAsDataURL(file);
  }
}

// Scheduler
function initScheduler() {
  document.getElementById('scheduleBtn').addEventListener('click', scheduleNote);
  document.getElementById('postNowBtn').addEventListener('click', postNow);
  document.getElementById('nextSlotBtn').addEventListener('click', scheduleToNextSlot);
}

// Schedule to next available slot
async function scheduleToNextSlot() {
  const editor = document.getElementById('editor');
  const content = editor.innerHTML.trim();
  const text = editor.textContent.trim();

  if (!text) {
    showStatus('Please write something first', 'error');
    return;
  }

  const nextSlot = await findNextAvailableSlot();
  if (!nextSlot) {
    showStatus('No available slots in the next 2 weeks', 'error');
    return;
  }

  const note = {
    id: Date.now().toString(),
    content: content,
    text: text,
    image: currentImage,
    scheduledFor: nextSlot.getTime(),
    status: 'pending'
  };

  // Save to storage
  const { notes = [] } = await chrome.storage.local.get('notes');
  notes.push(note);
  notes.sort((a, b) => a.scheduledFor - b.scheduledFor);
  await chrome.storage.local.set({ notes });

  // Clear form
  editor.innerHTML = '';
  currentImage = null;
  document.getElementById('imagePreviewContainer').style.display = 'none';
  document.getElementById('imagePrompt').style.display = 'block';
  document.getElementById('imageInput').value = '';

  showStatus(`Scheduled for ${formatDateTime(nextSlot.getTime())}`, 'success');
  loadNotes();
  renderCalendar();
}

// Find next available slot
async function findNextAvailableSlot() {
  const { notes = [] } = await chrome.storage.local.get('notes');
  const pendingNotes = notes.filter(n => n.status === 'pending');
  const scheduledTimes = new Set(pendingNotes.map(n => n.scheduledFor));

  const now = new Date();

  // Check slots for the next 14 days
  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const day = new Date(now);
    day.setDate(day.getDate() + dayOffset);
    day.setMinutes(0, 0, 0);

    for (const slot of TIME_SLOTS) {
      const slotTime = new Date(day);
      slotTime.setHours(slot.hour, 0, 0, 0);

      // Skip if slot is in the past
      if (slotTime <= now) continue;

      // Check if slot is available
      if (!scheduledTimes.has(slotTime.getTime())) {
        return slotTime;
      }
    }
  }

  return null;
}

async function scheduleNote() {
  const editor = document.getElementById('editor');
  const content = editor.innerHTML.trim();
  const text = editor.textContent.trim();
  const scheduleDate = document.getElementById('scheduleDate').value;

  if (!text) {
    showStatus('Please write something first', 'error');
    return;
  }
  if (!scheduleDate) {
    showStatus('Please select a schedule time', 'error');
    return;
  }

  const scheduledTime = new Date(scheduleDate).getTime();
  if (scheduledTime <= Date.now()) {
    showStatus('Please select a future time', 'error');
    return;
  }

  const note = {
    id: Date.now().toString(),
    content: content,
    text: text,
    image: currentImage,
    scheduledFor: scheduledTime,
    status: 'pending'
  };

  // Save to storage
  const { notes = [] } = await chrome.storage.local.get('notes');
  notes.push(note);
  notes.sort((a, b) => a.scheduledFor - b.scheduledFor);
  await chrome.storage.local.set({ notes });

  // Clear form
  editor.innerHTML = '';
  currentImage = null;
  document.getElementById('imagePreviewContainer').style.display = 'none';
  document.getElementById('imagePrompt').style.display = 'block';
  document.getElementById('imageInput').value = '';

  // Set next default time
  const nextTime = new Date(scheduledTime + 24 * 60 * 60 * 1000);
  document.getElementById('scheduleDate').value = formatDateTimeLocal(nextTime);

  showStatus('Note scheduled!', 'success');
  loadNotes();
}

// Post immediately
async function postNow() {
  const editor = document.getElementById('editor');
  const content = editor.innerHTML.trim();
  const text = editor.textContent.trim();

  if (!text) {
    showStatus('Please write something first', 'error');
    return;
  }

  const postNowBtn = document.getElementById('postNowBtn');
  postNowBtn.disabled = true;
  postNowBtn.textContent = 'Posting...';
  showStatus('Opening Substack and posting...', 'success');

  try {
    // Send message to background script to post immediately
    const response = await chrome.runtime.sendMessage({
      action: 'postNow',
      note: {
        content: content,
        text: text,
        image: currentImage
      }
    });

    if (response && response.success) {
      showStatus('Posted successfully!', 'success');
      // Clear form
      editor.innerHTML = '';
      currentImage = null;
      document.getElementById('imagePreviewContainer').style.display = 'none';
      document.getElementById('imagePrompt').style.display = 'block';
      document.getElementById('imageInput').value = '';
    } else {
      showStatus('Failed to post: ' + (response?.error || 'Unknown error'), 'error');
    }
  } catch (error) {
    showStatus('Failed to post: ' + error.message, 'error');
  } finally {
    postNowBtn.disabled = false;
    postNowBtn.textContent = 'Post Now';
  }
}

// Load and display notes
async function loadNotes() {
  const { notes = [] } = await chrome.storage.local.get('notes');
  const list = document.getElementById('notesList');
  const count = document.getElementById('noteCount');

  // Filter out posted notes
  const pendingNotes = notes.filter(n => n.status === 'pending');
  count.textContent = pendingNotes.length;

  if (pendingNotes.length === 0) {
    list.innerHTML = '<li class="empty-state">No scheduled notes yet</li>';
    return;
  }

  list.innerHTML = pendingNotes.map(note => `
    <li class="note-item" data-id="${note.id}">
      <div class="note-content">
        <div class="note-time">${formatDateTime(note.scheduledFor)}</div>
        <div class="note-text">${escapeHtml(note.text)}</div>
        ${note.image ? '<div style="font-size:12px;color:#666;margin-top:4px;">📷 Has image</div>' : ''}
      </div>
      <div class="note-actions">
        <button class="edit" data-action="edit" data-id="${note.id}">Edit</button>
        <button class="delete" data-action="delete" data-id="${note.id}">Delete</button>
      </div>
    </li>
  `).join('');

  // Add click handlers using event delegation
  list.querySelectorAll('button[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => editNote(btn.dataset.id));
  });
  list.querySelectorAll('button[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => deleteNote(btn.dataset.id));
  });
}

function formatDateTime(timestamp) {
  return new Date(timestamp).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Edit note
async function editNote(id) {
  const { notes = [] } = await chrome.storage.local.get('notes');
  const note = notes.find(n => n.id === id);
  if (!note) return;

  document.getElementById('editor').innerHTML = note.content;
  document.getElementById('scheduleDate').value = formatDateTimeLocal(new Date(note.scheduledFor));

  if (note.image) {
    currentImage = note.image;
    document.getElementById('imagePreview').src = note.image;
    document.getElementById('imagePreviewContainer').style.display = 'inline-block';
    document.getElementById('imagePrompt').style.display = 'none';
  }

  // Remove the original note
  await deleteNote(id, true);
  showStatus('Editing note - make changes and schedule again', 'success');
}

// Delete note
async function deleteNote(id, silent = false) {
  const { notes = [] } = await chrome.storage.local.get('notes');
  const filtered = notes.filter(n => n.id !== id);
  await chrome.storage.local.set({ notes: filtered });
  loadNotes();
  if (!silent) showStatus('Note deleted', 'success');
}

// Export/Import
function initExportImport() {
  document.getElementById('exportBtn').addEventListener('click', exportNotes);
  document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importInput').click();
  });
  document.getElementById('importInput').addEventListener('change', importNotes);
  document.getElementById('clearBtn').addEventListener('click', clearAllNotes);
}

async function exportNotes() {
  const { notes = [] } = await chrome.storage.local.get('notes');
  const blob = new Blob([JSON.stringify(notes, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `substack-notes-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importNotes(e) {
  const file = e.target.files[0];
  if (!file) return;

  const text = await file.text();
  try {
    const imported = JSON.parse(text);
    if (!Array.isArray(imported)) throw new Error('Invalid format');

    const { notes = [] } = await chrome.storage.local.get('notes');
    const merged = [...notes, ...imported];
    merged.sort((a, b) => a.scheduledFor - b.scheduledFor);
    await chrome.storage.local.set({ notes: merged });
    loadNotes();
    showStatus(`Imported ${imported.length} notes`, 'success');
  } catch (err) {
    showStatus('Invalid import file', 'error');
  }
  e.target.value = '';
}

async function clearAllNotes() {
  if (!confirm('Delete all scheduled notes?')) return;
  await chrome.storage.local.set({ notes: [] });
  loadNotes();
  showStatus('All notes cleared', 'success');
}

// Status messages
function showStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = `status ${type}`;
  setTimeout(() => {
    status.className = 'status';
  }, 3000);
}

// ==================== BACKLOG ====================

// Grace period matches background.js (2 minutes)
const GRACE_PERIOD_MS = 2 * 60 * 1000;

// Check for overdue notes and move them to backlog on app load
async function checkForOverdueNotes() {
  const { notes = [] } = await chrome.storage.local.get('notes');
  const now = Date.now();
  let updated = false;

  const updatedNotes = notes.map(note => {
    if (note.status === 'pending' && note.scheduledFor <= now) {
      const overdueBy = now - note.scheduledFor;
      if (overdueBy > GRACE_PERIOD_MS) {
        updated = true;
        return { ...note, status: 'backlog', backlogAt: Date.now() };
      }
    }
    return note;
  });

  if (updated) {
    await chrome.storage.local.set({ notes: updatedNotes });
    loadNotes();
    loadBacklog();
    renderCalendar();
    // Clear badge since user is viewing the app
    chrome.action.setBadgeText({ text: '' });
  }
}

// Load and display backlog notes
async function loadBacklog() {
  const { notes = [] } = await chrome.storage.local.get('notes');
  const section = document.getElementById('backlogSection');
  const list = document.getElementById('backlogList');
  const count = document.getElementById('backlogCount');

  const backlogNotes = notes.filter(n => n.status === 'backlog');
  count.textContent = backlogNotes.length;

  if (backlogNotes.length === 0) {
    section.classList.add('empty');
    list.innerHTML = '';
    // Clear badge
    chrome.action.setBadgeText({ text: '' });
    return;
  }

  section.classList.remove('empty');

  // Sort by original scheduled time (oldest first)
  backlogNotes.sort((a, b) => a.scheduledFor - b.scheduledFor);

  list.innerHTML = backlogNotes.map(note => `
    <li class="backlog-item" data-id="${note.id}">
      <div class="backlog-content">
        <div class="backlog-time">Was scheduled for: ${formatDateTime(note.scheduledFor)}</div>
        <div class="backlog-text">${escapeHtml(note.text)}</div>
        ${note.image ? '<div style="font-size:12px;color:#666;margin-top:4px;">📷 Has image</div>' : ''}
      </div>
      <div class="backlog-actions">
        <button class="post-now" data-action="backlog-post" data-id="${note.id}">Post Now</button>
        <button class="reschedule" data-action="backlog-reschedule" data-id="${note.id}">Reschedule</button>
        <button class="delete" data-action="backlog-delete" data-id="${note.id}">Delete</button>
      </div>
    </li>
  `).join('');

  // Add click handlers
  list.querySelectorAll('button[data-action="backlog-post"]').forEach(btn => {
    btn.addEventListener('click', () => postBacklogNote(btn.dataset.id));
  });
  list.querySelectorAll('button[data-action="backlog-reschedule"]').forEach(btn => {
    btn.addEventListener('click', () => rescheduleBacklogNote(btn.dataset.id));
  });
  list.querySelectorAll('button[data-action="backlog-delete"]').forEach(btn => {
    btn.addEventListener('click', () => deleteBacklogNote(btn.dataset.id));
  });
}

// Post a backlog note immediately
async function postBacklogNote(id) {
  const { notes = [] } = await chrome.storage.local.get('notes');
  const note = notes.find(n => n.id === id);
  if (!note) return;

  showStatus('Posting note...', 'success');

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'postNow',
      note: {
        content: note.content,
        text: note.text,
        image: note.image
      }
    });

    if (response && response.success) {
      // Mark as posted
      const updated = notes.map(n => {
        if (n.id === id) {
          return { ...n, status: 'posted', postedAt: Date.now() };
        }
        return n;
      });
      await chrome.storage.local.set({ notes: updated });
      showStatus('Posted successfully!', 'success');
      loadBacklog();
    } else {
      showStatus('Failed to post: ' + (response?.error || 'Unknown error'), 'error');
    }
  } catch (error) {
    showStatus('Failed to post: ' + error.message, 'error');
  }
}

// Move backlog note back to editor for rescheduling
async function rescheduleBacklogNote(id) {
  const { notes = [] } = await chrome.storage.local.get('notes');
  const note = notes.find(n => n.id === id);
  if (!note) return;

  // Load into editor
  document.getElementById('editor').innerHTML = note.content;

  if (note.image) {
    currentImage = note.image;
    document.getElementById('imagePreview').src = note.image;
    document.getElementById('imagePreviewContainer').style.display = 'inline-block';
    document.getElementById('imagePrompt').style.display = 'none';
  }

  // Set default schedule to next available slot
  const nextSlot = await findNextAvailableSlot();
  if (nextSlot) {
    document.getElementById('scheduleDate').value = formatDateTimeLocal(nextSlot);
  }

  // Remove from backlog
  const filtered = notes.filter(n => n.id !== id);
  await chrome.storage.local.set({ notes: filtered });

  showStatus('Note loaded - set a new time and schedule', 'success');
  loadBacklog();
  renderCalendar();

  // Scroll to editor
  document.getElementById('editor').focus();
}

// Delete a backlog note
async function deleteBacklogNote(id) {
  if (!confirm('Delete this missed note?')) return;

  const { notes = [] } = await chrome.storage.local.get('notes');
  const filtered = notes.filter(n => n.id !== id);
  await chrome.storage.local.set({ notes: filtered });

  showStatus('Note deleted', 'success');
  loadBacklog();
}

// ==================== CALENDAR ====================

// Get start of week (Sunday)
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Initialize calendar
function initCalendar() {
  document.getElementById('prevWeekBtn').addEventListener('click', () => {
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    renderCalendar();
  });

  document.getElementById('nextWeekBtn').addEventListener('click', () => {
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    renderCalendar();
  });

  renderCalendar();
}

// Render the calendar grid
async function renderCalendar() {
  const grid = document.getElementById('calendarGrid');
  const weekLabel = document.getElementById('weekLabel');

  const { notes = [] } = await chrome.storage.local.get('notes');
  const pendingNotes = notes.filter(n => n.status === 'pending');

  // Create a map of scheduled times to notes
  const notesByTime = {};
  for (const note of pendingNotes) {
    notesByTime[note.scheduledFor] = note;
  }

  // Calculate week end
  const weekEnd = new Date(currentWeekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  // Update week label
  const formatOpts = { month: 'short', day: 'numeric' };
  weekLabel.textContent = `${currentWeekStart.toLocaleDateString(undefined, formatOpts)} - ${weekEnd.toLocaleDateString(undefined, formatOpts)}, ${currentWeekStart.getFullYear()}`;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Build grid HTML
  let html = '';

  // Header row
  html += '<div class="calendar-cell calendar-header-cell"></div>'; // Empty corner
  for (let i = 0; i < 7; i++) {
    const day = new Date(currentWeekStart);
    day.setDate(day.getDate() + i);
    const isToday = day.getTime() === today.getTime();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    html += `
      <div class="calendar-cell calendar-header-cell">
        <div class="calendar-day-header ${isToday ? 'today' : ''}">
          <span class="day-name">${dayNames[i]}</span>
          <span class="day-num">${day.getDate()}</span>
        </div>
      </div>
    `;
  }

  // Time slot rows
  for (const slot of TIME_SLOTS) {
    // Time label
    const hour = slot.hour;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour;
    html += `<div class="calendar-cell calendar-time-cell">${displayHour}:00 ${ampm}<br>${slot.name}</div>`;

    // Day cells for this slot
    for (let i = 0; i < 7; i++) {
      const day = new Date(currentWeekStart);
      day.setDate(day.getDate() + i);
      day.setHours(slot.hour, 0, 0, 0);

      const slotTime = day.getTime();
      const isPast = day < now;
      const note = notesByTime[slotTime];

      let cellClass = 'calendar-cell calendar-slot';
      if (isPast) cellClass += ' past';
      if (note) cellClass += ' has-note';

      let cellContent = '';
      if (note) {
        cellContent = `<div class="slot-note" title="${escapeHtml(note.text)}">${escapeHtml(note.text.substring(0, 20))}${note.text.length > 20 ? '...' : ''}</div>`;
      } else if (!isPast) {
        cellContent = '<div class="slot-empty">+</div>';
      }

      html += `<div class="${cellClass}" data-time="${slotTime}">${cellContent}</div>`;
    }
  }

  grid.innerHTML = html;

  // Add click handlers for slots
  grid.querySelectorAll('.calendar-slot:not(.past)').forEach(cell => {
    cell.addEventListener('click', () => {
      const slotTime = parseInt(cell.dataset.time);
      const note = notesByTime[slotTime];

      if (note) {
        // Edit existing note
        editNote(note.id);
      } else {
        // Set schedule time to this slot
        const slotDate = new Date(slotTime);
        document.getElementById('scheduleDate').value = formatDateTimeLocal(slotDate);
        showStatus(`Selected slot: ${formatDateTime(slotTime)}`, 'success');
        // Scroll to editor
        document.getElementById('editor').focus();
      }
    });
  });
}


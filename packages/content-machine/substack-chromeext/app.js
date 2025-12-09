// Substack Notes Scheduler - App Logic

let currentImage = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initTimezone();
  initEditor();
  initImageUpload();
  initScheduler();
  loadNotes();
  initExportImport();
});

// Display timezone
function initTimezone() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  document.getElementById('timezone').textContent = tz;

  // Set default schedule time to tomorrow 9 AM
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  document.getElementById('scheduleDate').value = formatDateTimeLocal(tomorrow);
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
        <button class="edit" onclick="editNote('${note.id}')">Edit</button>
        <button class="delete" onclick="deleteNote('${note.id}')">Delete</button>
      </div>
    </li>
  `).join('');
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

// Make functions available globally for onclick handlers
window.editNote = editNote;
window.deleteNote = deleteNote;

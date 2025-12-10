// Substack Notes Scheduler - Background Service Worker

// Open app.html when extension icon is clicked
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('app.html') });
});

// Ensure alarm exists - call this on every service worker wake
async function ensureAlarmExists() {
  const alarm = await chrome.alarms.get('checkNotes');
  if (!alarm) {
    console.log('Creating checkNotes alarm...');
    chrome.alarms.create('checkNotes', { periodInMinutes: 1 });
  } else {
    console.log('Alarm already exists, next fire:', new Date(alarm.scheduledTime));
  }
}

// Clean up any notes stuck in "posting" status (browser crashed mid-post)
async function cleanupStuckNotes() {
  const { notes = [] } = await chrome.storage.local.get('notes');
  const now = Date.now();
  let updated = false;

  const cleanedNotes = notes.map(n => {
    if (n.status === 'posting') {
      // If stuck in posting for more than 5 minutes, move to backlog
      const stuckTime = now - (n.postingStartedAt || 0);
      if (stuckTime > 5 * 60 * 1000) {
        console.log('Moving stuck note to backlog:', n.text?.substring(0, 30));
        updated = true;
        return { ...n, status: 'backlog', backlogAt: Date.now(), error: 'Posting was interrupted' };
      }
    }
    return n;
  });

  if (updated) {
    await chrome.storage.local.set({ notes: cleanedNotes });
  }
}

// Set up alarm on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('Substack Notes Scheduler installed');
  ensureAlarmExists();
  cleanupStuckNotes();
});

// Set up alarm on startup
chrome.runtime.onStartup.addListener(() => {
  console.log('Substack Notes Scheduler startup');
  ensureAlarmExists();
  cleanupStuckNotes();
});

// Ensure alarm exists and cleanup when service worker wakes up
ensureAlarmExists();
cleanupStuckNotes();

// Handle alarm
chrome.alarms.onAlarm.addListener(async (alarm) => {
  console.log('Alarm fired:', alarm.name, 'at', new Date().toLocaleTimeString());
  if (alarm.name === 'checkNotes') {
    await checkAndPostDueNotes();
  }
});

// Grace period: only auto-post if due within this window (2 minutes)
const GRACE_PERIOD_MS = 2 * 60 * 1000;

// Check for notes that are due and post them (or move to backlog if too old)
async function checkAndPostDueNotes() {
  console.log('Checking for due notes...');
  const { notes = [] } = await chrome.storage.local.get('notes');
  const now = Date.now();

  console.log(`Found ${notes.length} total notes`);

  const pendingNotes = notes.filter(n => n.status === 'pending');
  console.log(`Found ${pendingNotes.length} pending notes`);

  for (const note of pendingNotes) {
    const timeUntilDue = note.scheduledFor - now;
    console.log(`Note "${note.text?.substring(0, 30)}..." scheduled for ${new Date(note.scheduledFor).toLocaleString()}, due in ${Math.round(timeUntilDue / 1000)}s`);
  }

  const dueNotes = pendingNotes.filter(n => n.scheduledFor <= now);
  console.log(`Found ${dueNotes.length} notes that are due`);

  let notesUpdated = false;

  for (const note of dueNotes) {
    const overdueBy = now - note.scheduledFor;

    if (overdueBy <= GRACE_PERIOD_MS) {
      // Within grace period - mark as "posting" FIRST to prevent duplicate posts
      console.log('Marking note as posting:', note.text?.substring(0, 50));
      await markNoteAsPosting(note.id);

      // Now post it
      console.log('Posting note (within grace period):', note.text?.substring(0, 50));
      await postNote(note);
    } else {
      // Too old - move to backlog
      console.log(`Moving note to backlog (overdue by ${Math.round(overdueBy / 1000 / 60)} minutes):`, note.text?.substring(0, 50));
      await markNoteAsBacklog(note.id);
      notesUpdated = true;
    }
  }

  // If we moved any notes to backlog, notify the user
  if (notesUpdated) {
    const { notes: updatedNotes = [] } = await chrome.storage.local.get('notes');
    const backlogCount = updatedNotes.filter(n => n.status === 'backlog').length;
    if (backlogCount > 0) {
      // Show badge on extension icon
      chrome.action.setBadgeText({ text: backlogCount.toString() });
      chrome.action.setBadgeBackgroundColor({ color: '#ff9800' });
    }
  }
}

// Mark note as "posting" (in-progress) to prevent duplicate posts
async function markNoteAsPosting(noteId) {
  const { notes = [] } = await chrome.storage.local.get('notes');
  const updated = notes.map(n => {
    if (n.id === noteId) {
      return { ...n, status: 'posting', postingStartedAt: Date.now() };
    }
    return n;
  });
  await chrome.storage.local.set({ notes: updated });
}

// Mark note as backlog (missed/overdue)
async function markNoteAsBacklog(noteId) {
  const { notes = [] } = await chrome.storage.local.get('notes');
  const updated = notes.map(n => {
    if (n.id === noteId) {
      return { ...n, status: 'backlog', backlogAt: Date.now() };
    }
    return n;
  });
  await chrome.storage.local.set({ notes: updated });
}

// Post a single note to Substack
async function postNote(note) {
  console.log('Posting note:', note.id);

  try {
    // Open Substack main page (where "What's on your mind?" appears)
    const tab = await chrome.tabs.create({
      url: 'https://substack.com',
      active: false
    });

    // Wait for page to load
    await waitForTabLoad(tab.id);

    // Give the page a moment to fully initialize
    await sleep(2000);

    // Send message to content script to post the note
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'postNote',
      note: {
        content: note.content,
        text: note.text,
        image: note.image
      }
    });

    if (response && response.success) {
      // Mark note as posted
      await markNoteAsPosted(note.id);
      console.log('Note posted successfully:', note.id);
    } else {
      console.error('Failed to post note:', response?.error);
      await markNoteAsFailed(note.id, response?.error || 'Unknown error');
    }

    // Close the tab after a delay
    await sleep(3000);
    await chrome.tabs.remove(tab.id);

  } catch (error) {
    console.error('Error posting note:', error);
    await markNoteAsFailed(note.id, error.message);
  }
}

// Wait for tab to finish loading
function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    const listener = (id, info) => {
      if (id === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);

    // Timeout after 30 seconds
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, 30000);
  });
}

// Mark note as posted
async function markNoteAsPosted(noteId) {
  const { notes = [] } = await chrome.storage.local.get('notes');
  const updated = notes.map(n => {
    if (n.id === noteId) {
      return { ...n, status: 'posted', postedAt: Date.now() };
    }
    return n;
  });
  await chrome.storage.local.set({ notes: updated });
}

// Mark note as failed - move to backlog so user can retry
async function markNoteAsFailed(noteId, error) {
  const { notes = [] } = await chrome.storage.local.get('notes');
  const updated = notes.map(n => {
    if (n.id === noteId) {
      return { ...n, status: 'backlog', error: error, failedAt: Date.now(), backlogAt: Date.now() };
    }
    return n;
  });
  await chrome.storage.local.set({ notes: updated });
}

// Sleep utility
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Listen for messages from app.js and content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'notePosted') {
    console.log('Note posted confirmation received');
  }

  // Handle "Post Now" from app.js
  if (message.action === 'postNow') {
    postNoteImmediately(message.note)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }

  return true;
});

// Post a note immediately (for "Post Now" button)
async function postNoteImmediately(noteData) {
  console.log('Posting note immediately...');

  try {
    // Open Substack main page
    const tab = await chrome.tabs.create({
      url: 'https://substack.com',
      active: true  // Make it active so user can see what's happening
    });

    // Wait for page to load
    await waitForTabLoad(tab.id);

    // Give the page a moment to fully initialize
    await sleep(2000);

    // Send message to content script to post the note
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'postNote',
      note: noteData
    });

    // Close the tab after posting (with delay to see result)
    await sleep(2000);
    await chrome.tabs.remove(tab.id);

    return response;

  } catch (error) {
    console.error('Error posting note immediately:', error);
    return { success: false, error: error.message };
  }
}

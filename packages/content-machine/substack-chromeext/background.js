// Substack Notes Scheduler - Background Service Worker

// Open app.html when extension icon is clicked
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('app.html') });
});

// Set up alarm to check for due notes every minute
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('checkNotes', { periodInMinutes: 1 });
  console.log('Substack Notes Scheduler installed');
});

// Also create alarm on startup
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create('checkNotes', { periodInMinutes: 1 });
});

// Handle alarm
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'checkNotes') {
    await checkAndPostDueNotes();
  }
});

// Check for notes that are due and post them
async function checkAndPostDueNotes() {
  const { notes = [] } = await chrome.storage.local.get('notes');
  const now = Date.now();

  const dueNotes = notes.filter(n => n.status === 'pending' && n.scheduledFor <= now);

  for (const note of dueNotes) {
    await postNote(note);
  }
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

// Mark note as failed
async function markNoteAsFailed(noteId, error) {
  const { notes = [] } = await chrome.storage.local.get('notes');
  const updated = notes.map(n => {
    if (n.id === noteId) {
      return { ...n, status: 'failed', error: error, failedAt: Date.now() };
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

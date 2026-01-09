// Service worker for the Inspiration Saver Chrome extension
// Currently minimal - can be extended for background tasks

chrome.runtime.onInstalled.addListener(() => {
  console.log("Inspiration Saver extension installed");
});

// Handle any background tasks here
// For example: badge updates, notifications, etc.

export {};

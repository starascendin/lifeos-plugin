// Substack Notes Scheduler - Content Script
// Runs on substack.com to automate posting
// Based on working Playwright script approach

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'postNote') {
    postNoteToSubstack(message.note)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }
});

async function postNoteToSubstack(note) {
  try {
    console.log('Starting to post note...');

    // Step 1: Click "What's on your mind?" to open the composer
    console.log('Looking for "What\'s on your mind?" trigger...');
    const trigger = await findTextElement("What's on your mind?", 5000);

    if (!trigger) {
      throw new Error('Could not find "What\'s on your mind?" trigger. Make sure you are logged in to Substack.');
    }

    console.log('Found trigger, clicking...');
    trigger.click();
    await sleep(2000);

    // Step 2: Find the input field using multiple selectors (same as Playwright script)
    console.log('Looking for input field...');
    const inputSelectors = [
      'div[contenteditable="true"]',
      'textarea[placeholder*="mind"]',
      '[data-testid="composer-input"]',
      'div.public-DraftEditor-content',
      '[role="textbox"]',
      'textarea',
      '.ProseMirror',
      '[contenteditable="true"]'
    ];

    let editor = null;
    let foundSelector = null;

    // Try multiple times with delays
    for (let attempt = 0; attempt < 3; attempt++) {
      for (const selector of inputSelectors) {
        const el = document.querySelector(selector);
        if (el) {
          editor = el;
          foundSelector = selector;
          console.log(`Found input with selector: ${selector}`);
          break;
        }
      }
      if (editor) break;
      await sleep(1000);
    }

    if (!editor) {
      throw new Error('Could not find input field after clicking trigger');
    }

    // Step 3: Click and focus on the input (same as Playwright)
    // Matches: await post_input.click()
    console.log('Clicking on input field...');
    editor.click();
    editor.focus();
    await sleep(1000);

    // Step 4: Clear any existing content using keyboard simulation
    // Matches exactly: await page.keyboard.press("Control+A") then await page.keyboard.press("Backspace")
    console.log('Clearing any existing draft content...');

    // Select all existing content (Ctrl+A on Windows/Linux, Cmd+A on Mac)
    await pressKey('Control+A');
    await sleep(200);

    // Delete selected content
    await pressKey('Backspace');
    await sleep(500);

    // Step 5: Type the message character by character with delay
    // This matches: await post_input.type(message, delay=50)
    const plainText = note.text || stripHtml(note.content);
    console.log(`Typing message (${plainText.length} chars): ${plainText.substring(0, 50)}...`);

    // Type using keyboard event simulation (like Playwright's type())
    await typeText(editor, plainText, 50);
    await sleep(1000);

    // Step 6: Handle image upload if present
    if (note.image) {
      console.log('Uploading image...');
      await uploadImage(note.image);
    }

    await sleep(1000);

    // Step 7: Find and click the Post button
    // This matches the Playwright button selectors
    console.log('Looking for Post button...');
    const postButton = await findPostButton();

    if (!postButton) {
      throw new Error('Could not find Post button');
    }

    console.log('Found Post button, clicking...');

    // Check if button is enabled
    if (postButton.disabled) {
      throw new Error('Post button is disabled - content may be empty');
    }

    postButton.click();

    // Step 8: Wait for "Note sent" toaster to confirm success
    console.log('Waiting for "Note sent" confirmation...');
    const success = await waitForNoteSentToaster(10000);

    if (success) {
      console.log('Post confirmed - "Note sent" toaster appeared!');
      return { success: true };
    } else {
      // Even if we don't see the toaster, the post might have succeeded
      console.log('Did not see "Note sent" toaster, but post may have succeeded');
      return { success: true, warning: 'Could not confirm "Note sent" toaster' };
    }

  } catch (error) {
    console.error('Error posting to Substack:', error);
    return { success: false, error: error.message };
  }
}

// Wait for "Note sent" toaster to appear (confirms successful post)
function waitForNoteSentToaster(timeout = 10000) {
  return new Promise((resolve) => {
    const startTime = Date.now();

    const check = () => {
      // Look for toaster/toast elements containing "Note sent" or similar
      const toasterTexts = ['Note sent', 'note sent', 'Posted', 'Sent'];

      // Check all text nodes
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );

      let node;
      while (node = walker.nextNode()) {
        const text = node.textContent?.trim();
        for (const toasterText of toasterTexts) {
          if (text && text.includes(toasterText)) {
            console.log(`Found confirmation text: "${text}"`);
            resolve(true);
            return;
          }
        }
      }

      // Also check common toaster selectors
      const toasterSelectors = [
        '[role="alert"]',
        '[class*="toast"]',
        '[class*="Toaster"]',
        '[class*="notification"]',
        '[class*="snackbar"]'
      ];

      for (const selector of toasterSelectors) {
        const toasters = document.querySelectorAll(selector);
        for (const toaster of toasters) {
          const text = toaster.textContent?.toLowerCase() || '';
          if (text.includes('note sent') || text.includes('posted') || text.includes('sent')) {
            console.log(`Found toaster with text: "${toaster.textContent}"`);
            resolve(true);
            return;
          }
        }
      }

      if (Date.now() - startTime < timeout) {
        setTimeout(check, 300);
      } else {
        resolve(false);
      }
    };

    check();
  });
}

// Simulate keyboard press (like Playwright's keyboard.press)
// Supports: "Control+A", "Backspace", etc.
async function pressKey(keyCombo) {
  const parts = keyCombo.split('+');
  const key = parts[parts.length - 1];
  const modifiers = {
    ctrlKey: parts.includes('Control') || parts.includes('Ctrl'),
    metaKey: parts.includes('Meta') || parts.includes('Cmd') || parts.includes('Control'),
    shiftKey: parts.includes('Shift'),
    altKey: parts.includes('Alt')
  };

  const activeElement = document.activeElement || document.body;

  // Determine key code
  let keyCode;
  let code;
  if (key === 'Backspace') {
    keyCode = 8;
    code = 'Backspace';
  } else if (key === 'Delete') {
    keyCode = 46;
    code = 'Delete';
  } else if (key === 'Enter') {
    keyCode = 13;
    code = 'Enter';
  } else if (key.length === 1) {
    keyCode = key.toUpperCase().charCodeAt(0);
    code = `Key${key.toUpperCase()}`;
  } else {
    keyCode = 0;
    code = key;
  }

  // Dispatch keydown
  const keydownEvent = new KeyboardEvent('keydown', {
    key: key,
    code: code,
    keyCode: keyCode,
    which: keyCode,
    ctrlKey: modifiers.ctrlKey,
    metaKey: modifiers.metaKey,
    shiftKey: modifiers.shiftKey,
    altKey: modifiers.altKey,
    bubbles: true,
    cancelable: true
  });
  activeElement.dispatchEvent(keydownEvent);

  // Execute the action
  if ((modifiers.ctrlKey || modifiers.metaKey) && key.toLowerCase() === 'a') {
    document.execCommand('selectAll', false, null);
  } else if (key === 'Backspace' || key === 'Delete') {
    document.execCommand('delete', false, null);
  }

  // Dispatch keyup
  const keyupEvent = new KeyboardEvent('keyup', {
    key: key,
    code: code,
    keyCode: keyCode,
    which: keyCode,
    bubbles: true,
    cancelable: true
  });
  activeElement.dispatchEvent(keyupEvent);
}

// Type text character by character with delay (like Playwright's type())
async function typeText(element, text, delay = 50) {
  element.focus();

  for (const char of text) {
    // Dispatch keydown
    const keydownEvent = new KeyboardEvent('keydown', {
      key: char,
      code: `Key${char.toUpperCase()}`,
      keyCode: char.charCodeAt(0),
      which: char.charCodeAt(0),
      bubbles: true,
      cancelable: true
    });
    element.dispatchEvent(keydownEvent);

    // Insert the character using execCommand (works with contenteditable)
    document.execCommand('insertText', false, char);

    // Dispatch input event
    element.dispatchEvent(new InputEvent('input', {
      inputType: 'insertText',
      data: char,
      bubbles: true,
      cancelable: true
    }));

    // Dispatch keyup
    const keyupEvent = new KeyboardEvent('keyup', {
      key: char,
      code: `Key${char.toUpperCase()}`,
      bubbles: true,
      cancelable: true
    });
    element.dispatchEvent(keyupEvent);

    await sleep(delay);
  }
}

// Find element containing specific text
function findTextElement(text, timeout = 5000) {
  return new Promise((resolve) => {
    const startTime = Date.now();

    const check = () => {
      // Look for elements containing the text
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );

      let node;
      while (node = walker.nextNode()) {
        if (node.textContent.includes(text)) {
          // Return the parent element that's clickable
          let parent = node.parentElement;
          while (parent && parent !== document.body) {
            const style = window.getComputedStyle(parent);
            if (style.cursor === 'pointer' || parent.onclick || parent.tagName === 'BUTTON' || parent.tagName === 'A') {
              resolve(parent);
              return;
            }
            parent = parent.parentElement;
          }
          // If no clickable parent, return the text's direct parent
          resolve(node.parentElement);
          return;
        }
      }

      // Also check for elements where the text might be a placeholder or aria-label
      const allElements = document.querySelectorAll('*');
      for (const el of allElements) {
        if (el.textContent?.trim() === text ||
            el.getAttribute('placeholder')?.includes(text) ||
            el.getAttribute('aria-label')?.includes(text)) {
          resolve(el);
          return;
        }
      }

      if (Date.now() - startTime < timeout) {
        setTimeout(check, 200);
      } else {
        resolve(null);
      }
    };

    check();
  });
}

// Find the Post button by text content (same approach as Playwright)
// Matches: 'button:has-text("Post")', 'button:has-text("Publish")', etc.
async function findPostButton() {
  // Wait a moment for button to be ready
  await sleep(500);

  const buttons = document.querySelectorAll('button');

  // First try exact "Post" match (prioritize)
  for (const btn of buttons) {
    const text = btn.textContent?.trim().toLowerCase() || '';
    if (text === 'post') {
      return btn;
    }
  }

  // Then try contains "post"
  for (const btn of buttons) {
    const text = btn.textContent?.toLowerCase() || '';
    const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
    if (text.includes('post') || ariaLabel.includes('post')) {
      return btn;
    }
  }

  // Try "Publish" and "Share" as fallbacks
  for (const btn of buttons) {
    const text = btn.textContent?.toLowerCase() || '';
    if (text.includes('publish') || text.includes('share')) {
      return btn;
    }
  }

  // Try specific selectors
  const selectors = [
    'button[data-testid="post-button"]',
    'button[type="submit"]',
    '[data-testid="publish-button"]'
  ];

  for (const sel of selectors) {
    const btn = document.querySelector(sel);
    if (btn) return btn;
  }

  return null;
}

// Upload image from base64 data URL
async function uploadImage(base64Data) {
  try {
    // Convert base64 to blob
    const response = await fetch(base64Data);
    const blob = await response.blob();

    // Create a File object
    const file = new File([blob], 'image.png', { type: blob.type });

    // Find file input
    const fileInput = document.querySelector('input[type="file"][accept*="image"]');
    if (fileInput) {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      fileInput.files = dataTransfer.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(2000);
      return;
    }

    // Try clicking an image/upload button first
    const uploadButton = document.querySelector('[aria-label*="image"], [aria-label*="photo"], [data-testid*="image"]');
    if (uploadButton) {
      uploadButton.click();
      await sleep(500);

      // Now try to find the file input again
      const input = document.querySelector('input[type="file"]');
      if (input) {
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(2000);
      }
    }

  } catch (error) {
    console.error('Error uploading image:', error);
    // Continue without image if upload fails
  }
}

// Strip HTML tags
function stripHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

// Sleep utility
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

console.log('Substack Notes Scheduler content script loaded');

const STORAGE_KEY = 'basecamp_timer_v1_1';

// --- Initialization ---
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get([STORAGE_KEY], (result) => {
    if (!result[STORAGE_KEY]) {
      chrome.storage.local.set({ [STORAGE_KEY]: { activeTaskId: null, tasks: {} } });
    }
  });
});

// --- Message Router ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'GET_DATA':
      getData().then(sendResponse);
      break;
    case 'ADD_TASK':
      handleAddTask(sendResponse);
      break;
    case 'TOGGLE_TASK':
      handleToggleTask(request.taskId).then(sendResponse);
      break;
    case 'DELETE_TASK':
      handleDeleteTask(request.taskId).then(sendResponse);
      break;
    case 'OPEN_LINK':
      chrome.tabs.create({ url: request.url });
      break;
  }
  return true; // Required for async response
});

// --- Core Functions ---

async function getData() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || { activeTaskId: null, tasks: {} };
}

async function saveData(data) {
  await chrome.storage.local.set({ [STORAGE_KEY]: data });
  updateBadge(data.activeTaskId ? 'ON' : '');
}

// THE PARSER
function getBasecampId(url) {
    try {
        const urlObj = new URL(url);
        let path = urlObj.pathname;
        if (path.endsWith('/')) path = path.slice(0, -1);
        const segments = path.split('/');
        const lastSegment = segments[segments.length - 1];
        if (/^\d+$/.test(lastSegment)) return lastSegment;
        return null;
    } catch (e) {
        console.error("Parsing error", e);
        return null;
    }
}

// --- UPDATED LOGIC HERE ---
async function handleAddTask(sendResponse) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab || !tab.url.includes('3.basecamp.com')) {
    sendResponse({ success: false, error: "This is not a Basecamp page." });
    return;
  }

  const id = getBasecampId(tab.url);
  if (!id) {
    sendResponse({ success: false, error: "Could not find a valid Task ID." });
    return;
  }

  const data = await getData();
  const now = Date.now();

  // 1. AUTO-PAUSE: If a different task is currently running, pause it.
  if (data.activeTaskId && data.activeTaskId !== id) {
      const active = data.tasks[data.activeTaskId];
      if (active) {
          active.accumulatedTime += (now - active.lastStartTime);
          active.lastStartTime = null;
          active.status = 'paused';
      }
  }

  // 2. PREPARE THE TARGET TASK
  if (data.tasks[id]) {
      // SCENARIO: Existing Task.
      // Action: Resume it if it wasn't running.
      // Note: We also update title/url in case they changed.
      const task = data.tasks[id];
      if (task.status !== 'running') {
          task.status = 'running';
          task.lastStartTime = now;
      }
      // Update metadata (optional but good practice)
      task.title = tab.title.replace(/ on Basecamp$/, '').trim();
  } else {
      // SCENARIO: New Task.
      // Action: Create it with status 'running'.
      const cleanTitle = tab.title.replace(/ on Basecamp$/, '').trim();
      const urlObj = new URL(tab.url);
      const cleanUrl = urlObj.origin + urlObj.pathname;

      data.tasks[id] = {
        id: id,
        title: cleanTitle,
        url: cleanUrl,
        status: 'running', // <--- Starts immediately
        accumulatedTime: 0,
        lastStartTime: now // <--- Timestamp set immediately
      };
  }

  // 3. SET AS ACTIVE
  data.activeTaskId = id;
  
  await saveData(data);
  sendResponse({ success: true });
}

async function handleToggleTask(taskId) {
  const data = await getData();
  const now = Date.now();
  const targetTask = data.tasks[taskId];

  if (!targetTask) return { success: false };

  if (targetTask.status === 'running') {
    // PAUSE
    targetTask.accumulatedTime += (now - targetTask.lastStartTime);
    targetTask.lastStartTime = null;
    targetTask.status = 'paused';
    data.activeTaskId = null;
  } else {
    // START (and auto-pause others)
    if (data.activeTaskId && data.activeTaskId !== taskId) {
        const active = data.tasks[data.activeTaskId];
        if (active) {
            active.accumulatedTime += (now - active.lastStartTime);
            active.lastStartTime = null;
            active.status = 'paused';
        }
    }
    
    targetTask.status = 'running';
    targetTask.lastStartTime = now;
    data.activeTaskId = taskId;
  }

  await saveData(data);
  return { success: true };
}

async function handleDeleteTask(taskId) {
  const data = await getData();
  if (data.activeTaskId === taskId) {
    data.activeTaskId = null;
    updateBadge('');
  }
  delete data.tasks[taskId];
  await saveData(data);
  return { success: true };
}

function updateBadge(text) {
  chrome.action.setBadgeText({ text: text });
  chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
}
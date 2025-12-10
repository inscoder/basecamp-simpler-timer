const STORAGE_KEY = 'basecamp_timer_v1';

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

// THE PARSER: Robust logic to handle #hashes and ?queries
function getBasecampId(url) {
    try {
        // 1. URL Object automatically isolates the path from hash/query
        const urlObj = new URL(url);
        let path = urlObj.pathname;

        // 2. Remove trailing slash if it exists
        if (path.endsWith('/')) {
            path = path.slice(0, -1);
        }

        // 3. Get the very last segment
        const segments = path.split('/');
        const lastSegment = segments[segments.length - 1];

        // 4. Validate it is numeric
        if (/^\d+$/.test(lastSegment)) {
            return lastSegment;
        }
        return null;
    } catch (e) {
        console.error("Parsing error", e);
        return null;
    }
}

async function handleAddTask(sendResponse) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // 1. Domain Check
  if (!tab || !tab.url.includes('3.basecamp.com')) {
    sendResponse({ success: false, error: "This is not a Basecamp page." });
    return;
  }

  // 2. ID Extraction
  const id = getBasecampId(tab.url);

  if (!id) {
    sendResponse({ success: false, error: "Could not find a valid Task/Card ID in this URL." });
    return;
  }

  const data = await getData();
  
  // 3. Add if not exists (Prevent duplicates)
  if (!data.tasks[id]) {
    // Clean title: "Fix Bug on Basecamp" -> "Fix Bug"
    const cleanTitle = tab.title.replace(/ on Basecamp$/, '').trim();
    
    // We store the clean URL (no hash) to ensure the link back is stable
    const urlObj = new URL(tab.url);
    const cleanUrl = urlObj.origin + urlObj.pathname;

    data.tasks[id] = {
      id: id,
      title: cleanTitle,
      url: cleanUrl,
      status: 'paused',
      accumulatedTime: 0,
      lastStartTime: null
    };
    await saveData(data);
  }
  
  sendResponse({ success: true });
}

async function handleToggleTask(taskId) {
  const data = await getData();
  const now = Date.now();
  const targetTask = data.tasks[taskId];

  if (!targetTask) return { success: false };

  if (targetTask.status === 'running') {
    // SCENARIO A: PAUSE the currently running task
    targetTask.accumulatedTime += (now - targetTask.lastStartTime);
    targetTask.lastStartTime = null;
    targetTask.status = 'paused';
    data.activeTaskId = null;
  } else {
    // SCENARIO B: START a task
    // 1. Auto-Switch: If another task is running, pause it first
    if (data.activeTaskId && data.activeTaskId !== taskId) {
        const active = data.tasks[data.activeTaskId];
        if (active) {
            active.accumulatedTime += (now - active.lastStartTime);
            active.lastStartTime = null;
            active.status = 'paused';
        }
    }
    
    // 2. Start target
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
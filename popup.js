let currentData = { activeTaskId: null, tasks: {} };
let currentTabId = null; // Store the ID of the Basecamp page we are looking at

document.addEventListener('DOMContentLoaded', () => {
  loadData();
  
  // Handlers
  document.getElementById('addBtn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'ADD_TASK' }, (res) => {
      if (res.success) {
        showError('');
        loadData();
      } else {
        showError(res.error || "Failed to start timer. Are you on a Basecamp page?");
      }
    });
  });

  // Ticking mechanism
  setInterval(() => {
    if (currentData.activeTaskId) updateActiveTimerVisuals();
  }, 1000);
});

// Helper: Same parser logic as background.js to ensure we match correctly
function getIdFromUrl(url) {
    try {
        const urlObj = new URL(url);
        let path = urlObj.pathname;
        if (path.endsWith('/')) path = path.slice(0, -1);
        const segments = path.split('/');
        const lastSegment = segments[segments.length - 1];
        if (/^\d+$/.test(lastSegment)) return lastSegment;
        return null;
    } catch (e) {
        return null;
    }
}

async function loadData() {
  // 1. Get Timer Data
  const dataPromise = new Promise(resolve => {
      chrome.runtime.sendMessage({ action: 'GET_DATA' }, resolve);
  });

  // 2. Get Current Tab Info (to see if we are on a known task)
  const tabPromise = chrome.tabs.query({ active: true, currentWindow: true });

  const [data, tabs] = await Promise.all([dataPromise, tabPromise]);
  
  currentData = data;
  
  // Determine if current tab matches any task
  if (tabs && tabs[0] && tabs[0].url.includes('3.basecamp.com')) {
      currentTabId = getIdFromUrl(tabs[0].url);
  } else {
      currentTabId = null;
  }

  render();
}

function render() {
  const ul = document.getElementById('taskList');
  const emptyState = document.getElementById('emptyState');
  ul.innerHTML = '';
  
  const ids = Object.keys(currentData.tasks).sort((a, b) => {
    if (a === currentData.activeTaskId) return -1;
    if (b === currentData.activeTaskId) return 1;
    return 0; 
  });

  if (ids.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  } else {
    emptyState.classList.add('hidden');
  }

  ids.forEach(id => {
    const task = currentData.tasks[id];
    const isRunning = task.status === 'running';
    
    // Check if this row matches the page we are looking at
    const isCurrentPage = (id === currentTabId);

    const totalMs = calculateTime(task);
    
    const li = document.createElement('li');
    // Add 'current-page-row' class if match
    li.className = `task-row ${isRunning ? 'running' : ''} ${isCurrentPage ? 'current-page-row' : ''}`;
    li.dataset.id = id;

    // Optional: Add a visual indicator in text, though the border handles it well
    // const indicator = isCurrentPage ? '<span style="color:#2980b9; margin-left:4px;">📍</span>' : '';

    li.innerHTML = `
      <div class="task-info">
        <div class="task-title" data-action="link" title="Open in Basecamp: ${task.title}">${task.title}</div>
        <div class="timer-container">
            <span class="timer">${formatTime(totalMs)}</span>
            <span class="decimal">(${formatDecimal(totalMs)})</span>
        </div>
      </div>
      <div class="btn-group">
        <button class="icon-btn ${isRunning ? 'btn-pause' : 'btn-play'}" data-action="toggle" title="${isRunning ? 'Pause' : 'Start'}">
          ${isRunning ? '⏸' : '▶'}
        </button>
        <button class="icon-btn btn-copy" data-action="copy" title="Copy decimal hours">
            📋
        </button>
        <button class="icon-btn btn-del" data-action="delete" title="Delete Timer">🗑</button>
      </div>
    `;

    // Event Listeners
    li.querySelector('[data-action="toggle"]').onclick = () => {
      chrome.runtime.sendMessage({ action: 'TOGGLE_TASK', taskId: id }, loadData);
    };
    li.querySelector('[data-action="link"]').onclick = () => {
      chrome.runtime.sendMessage({ action: 'OPEN_LINK', url: task.url });
    };
    li.querySelector('[data-action="delete"]').onclick = () => {
      if(confirm('Are you sure you want to remove this timer?')) {
        chrome.runtime.sendMessage({ action: 'DELETE_TASK', taskId: id }, loadData);
      }
    };
    const copyBtn = li.querySelector('[data-action="copy"]');
    copyBtn.onclick = () => {
        const decimal = formatDecimal(calculateTime(task));
        navigator.clipboard.writeText(decimal).then(() => {
            const originalText = copyBtn.textContent;
            copyBtn.textContent = '✅';
            setTimeout(() => { copyBtn.textContent = originalText; }, 1000);
        });
    };

    ul.appendChild(li);
  });
}

function updateActiveTimerVisuals() {
  const activeId = currentData.activeTaskId;
  if (!activeId) return;
  
  const row = document.querySelector(`.task-row[data-id="${activeId}"]`);
  if (row) {
    const task = currentData.tasks[activeId];
    if(task) {
        const totalMs = calculateTime(task);
        row.querySelector('.timer').textContent = formatTime(totalMs);
        row.querySelector('.decimal').textContent = `(${formatDecimal(totalMs)})`;
    }
  }
}

function calculateTime(task) {
  let t = task.accumulatedTime;
  if (task.status === 'running' && task.lastStartTime) {
    t += (Date.now() - task.lastStartTime);
  }
  return t;
}

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
}

function formatDecimal(ms) {
    const hours = ms / (1000 * 60 * 60);
    return hours.toFixed(2);
}

function showError(msg) {
  const el = document.getElementById('errorMsg');
  el.textContent = msg;
  el.classList.toggle('hidden', !msg);
}
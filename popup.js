let currentData = { activeTaskId: null, tasks: {} };
let currentTabId = null;

document.addEventListener('DOMContentLoaded', () => {
  loadData();
  
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

  setInterval(() => {
    if (currentData.activeTaskId) updateActiveTimerVisuals();
  }, 1000);
});

function getIdFromUrl(url) {
    try {
        const urlObj = new URL(url);
        const path = urlObj.pathname;
        const regex = /\/(projects|messages|cards|todos|documents|schedule_entries)\/(\d+)/;
        const match = path.match(regex);
        return match && match[2] ? match[2] : null;
    } catch (e) {
        return null;
    }
}

async function loadData() {
  const dataPromise = new Promise(resolve => chrome.runtime.sendMessage({ action: 'GET_DATA' }, resolve));
  const tabPromise = chrome.tabs.query({ active: true, currentWindow: true });

  const [data, tabs] = await Promise.all([dataPromise, tabPromise]);
  
  currentData = data;
  
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
  
  // 1. FLIP: Record Old Positions
  const prevPositions = {};
  ul.querySelectorAll('.task-row').forEach(row => {
    prevPositions[row.dataset.id] = row.getBoundingClientRect().top;
  });

  ul.innerHTML = '';
  
  // Sort Logic: Active first, then by previous start time (stable sortish)
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
    const isCurrentPage = (id === currentTabId);
    const totalMs = calculateTime(task);
    
    const li = document.createElement('li');
    li.className = `task-row ${isRunning ? 'running' : ''} ${isCurrentPage ? 'current-page-row' : ''}`;
    li.dataset.id = id;

    li.innerHTML = `
      <div class="task-info">
        <div class="task-title" data-action="link" title="Open in Basecamp: ${task.title}">${task.title}</div>
        <div class="timer-container">
            <span class="timer">${formatTime(totalMs)}</span>
            <span class="decimal" data-action="copy" title="Click to copy decimal hours">(${formatDecimal(totalMs)})</span>
        </div>
      </div>
      <div class="btn-group">
        <button class="icon-btn ${isRunning ? 'btn-pause' : 'btn-play'}" data-action="toggle" title="${isRunning ? 'Pause' : 'Start'}">
          ${isRunning ? '⏸' : '▶'}
        </button>
        <button class="icon-btn btn-del" data-action="delete" title="Delete Timer">🗑</button>
      </div>
    `;

    // Event Delegation
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
    const decimalEl = li.querySelector('[data-action="copy"]');
    decimalEl.onclick = () => {
        const decimal = formatDecimal(calculateTime(task));
        navigator.clipboard.writeText(decimal).then(() => {
            decimalEl.classList.add('copied');
            decimalEl.textContent = '(Copied!)';
            decimalEl.dataset.locked = "true";
            setTimeout(() => {
                decimalEl.classList.remove('copied');
                decimalEl.dataset.locked = "false";
                decimalEl.textContent = `(${formatDecimal(calculateTime(task))})`;
            }, 1200);
        });
    };

    ul.appendChild(li);
  });

  // 2. FLIP: Calculate Delta and Animate
  // We perform this AFTER the new list is inserted into the DOM
  requestAnimationFrame(() => {
      ul.querySelectorAll('.task-row').forEach(row => {
        const id = row.dataset.id;
        if (prevPositions[id] !== undefined) {
          const newTop = row.getBoundingClientRect().top;
          const oldTop = prevPositions[id];
          const deltaY = oldTop - newTop;

          // If the item actually moved
          if (deltaY !== 0) {
            // INVERT: Move it back to where it was instantly
            row.style.transform = `translateY(${deltaY}px)`;
            row.style.transition = 'none';
            
            // Force Reflow so the browser registers the position
            void row.offsetHeight; 

            // PLAY: Remove the transform and let it slide to 0
            requestAnimationFrame(() => {
                row.style.transition = 'transform 0.3s cubic-bezier(0.2, 0, 0, 1)'; // Smooth easing
                row.style.transform = '';
            });
          }
        }
      });
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
        
        const decimalEl = row.querySelector('.decimal');
        if (decimalEl && decimalEl.dataset.locked !== "true") {
            decimalEl.textContent = `(${formatDecimal(totalMs)})`;
        }
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
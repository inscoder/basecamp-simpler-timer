let currentData = { activeTaskId: null, tasks: {} };

document.addEventListener('DOMContentLoaded', () => {
  loadData();
  
  document.getElementById('addBtn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'ADD_TASK' }, (res) => {
      if (res.success) {
        showError('');
        loadData();
      } else {
        showError(res.error || "Unknown error");
      }
    });
  });

  // Ticking mechanism: Update active timer every 1 second
  setInterval(() => {
    if (currentData.activeTaskId) updateActiveTimerVisuals();
  }, 1000);
});

function loadData() {
  chrome.runtime.sendMessage({ action: 'GET_DATA' }, (data) => {
    currentData = data;
    render();
  });
}

function render() {
  const ul = document.getElementById('taskList');
  const emptyState = document.getElementById('emptyState');
  ul.innerHTML = '';
  
  // Sort: Active first, then by Start Time (Newest First)
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
    const totalTime = calculateTime(task);
    
    const li = document.createElement('li');
    li.className = `task-row ${isRunning ? 'running' : ''}`;
    li.dataset.id = id;

    li.innerHTML = `
      <div class="task-info">
        <div class="task-title" title="${task.title}">${task.title}</div>
        <div class="timer">${formatTime(totalTime)}</div>
      </div>
      <div class="btn-group">
        <button class="icon-btn ${isRunning ? 'btn-pause' : 'btn-play'}" data-action="toggle" title="${isRunning ? 'Pause' : 'Start'}">
          ${isRunning ? '⏸' : '▶'}
        </button>
        <button class="icon-btn btn-link" data-action="link" title="Open in Basecamp">🔗</button>
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

    ul.appendChild(li);
  });
}

// Optimization: Update only the text of the running timer, don't re-render list
function updateActiveTimerVisuals() {
  const activeId = currentData.activeTaskId;
  if (!activeId) return;
  
  const row = document.querySelector(`.task-row[data-id="${activeId}"]`);
  if (row) {
    const timerDiv = row.querySelector('.timer');
    const task = currentData.tasks[activeId];
    if(task) {
        timerDiv.textContent = formatTime(calculateTime(task));
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

function showError(msg) {
  const el = document.getElementById('errorMsg');
  el.textContent = msg;
  el.classList.toggle('hidden', !msg);
}
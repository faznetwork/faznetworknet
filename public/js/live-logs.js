(() => {
  'use strict';
  const terminal = document.getElementById('terminal');
  const linesHost = document.getElementById('terminalLines');
  const filterInput = document.getElementById('logFilter');
  const pauseButton = document.getElementById('pauseResumeBtn');
  const clearButton = document.getElementById('clearLogsBtn');
  const statusLabel = document.getElementById('connectionStatus');
  const indicator = document.getElementById('connectionIndicator');
  const countLabel = document.getElementById('logCount');
  if (!terminal || !linesHost || !filterInput || !pauseButton || !clearButton) return;

  const MAX_VISIBLE = 1000;
  let paused = false;
  let followingBottom = true;
  let eventSource = null;
  let history = [];
  let pausedQueue = [];
  let userCleared = false;

  function nearBottom() {
    return terminal.scrollHeight - terminal.scrollTop - terminal.clientHeight < 32;
  }
  function setStatus(connected, message) {
    statusLabel.textContent = message;
    indicator.classList.toggle('connected', connected);
    indicator.classList.toggle('disconnected', !connected);
  }
  function matchesFilter(entry) {
    const query = filterInput.value.trim().toLowerCase();
    return !query || entry.message.toLowerCase().includes(query) || entry.level.toLowerCase().includes(query);
  }
  function updateCount() {
    const count = linesHost.querySelectorAll('.log-line').length;
    countLabel.textContent = count + (count === 1 ? ' line' : ' lines');
  }
  function makeLine(entry) {
    const row = document.createElement('div');
    row.className = 'log-line';
    const timestamp = document.createElement('span');
    timestamp.className = 'log-time';
    timestamp.textContent = new Date(entry.timestamp).toLocaleTimeString([], {hour12:false});
    const level = document.createElement('span');
    level.className = 'log-level ' + (entry.level === 'error' ? 'error' : entry.level === 'warn' ? 'warn' : 'log');
    level.textContent = entry.level;
    const message = document.createElement('span');
    message.className = 'log-message';
    message.textContent = entry.message;
    row.append(timestamp, level, message);
    row.dataset.search = (entry.level + ' ' + entry.message).toLowerCase();
    return row;
  }
  function renderAll(shouldFollow = false) {
    const wasAtBottom = nearBottom();
    const fragment = document.createDocumentFragment();
    const visible = history.filter(matchesFilter).slice(-MAX_VISIBLE);
    for (const entry of visible) fragment.appendChild(makeLine(entry));
    linesHost.replaceChildren(fragment);
    if (!visible.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = userCleared ? 'View cleared. New log entries will appear here.' : 'No log entries match the current filter.';
      linesHost.appendChild(empty);
    }
    updateCount();
    if (shouldFollow || (followingBottom && wasAtBottom)) terminal.scrollTop = terminal.scrollHeight;
  }
  function addEntries(entries) {
    if (!Array.isArray(entries)) return;
    for (const entry of entries) {
      if (!entry || typeof entry.message !== 'string' || !['log','warn','error'].includes(entry.level)) continue;
      if (history.some(existing => existing.id === entry.id)) continue;
      history.push(entry);
    }
    if (history.length > MAX_VISIBLE) history = history.slice(-MAX_VISIBLE);
    userCleared = false;
    renderAll();
  }
  function handleEntry(entry) {
    if (paused) {
      pausedQueue.push(entry);
      if (pausedQueue.length > MAX_VISIBLE) pausedQueue = pausedQueue.slice(-MAX_VISIBLE);
      return;
    }
    addEntries([entry]);
  }
  terminal.addEventListener('scroll', () => {
    followingBottom = nearBottom();
  }, {passive:true});
  filterInput.addEventListener('input', () => renderAll(followingBottom));
  pauseButton.addEventListener('click', () => {
    paused = !paused;
    pauseButton.textContent = paused ? 'Resume' : 'Pause';
    pauseButton.setAttribute('aria-pressed', String(paused));
    if (!paused && pausedQueue.length) {
      const pending = pausedQueue;
      pausedQueue = [];
      addEntries(pending);
      if (followingBottom) terminal.scrollTop = terminal.scrollHeight;
    }
  });
  clearButton.addEventListener('click', () => {
    history = [];
    pausedQueue = [];
    userCleared = true;
    renderAll();
  });

  eventSource = new EventSource('/api/admin/live-logs');
  eventSource.addEventListener('open', () => setStatus(true, 'Connected · live stream active'));
  eventSource.addEventListener('history', event => {
    try {
      const entries = JSON.parse(event.data);
      if (!userCleared) addEntries(entries);
      followingBottom = true;
      terminal.scrollTop = terminal.scrollHeight;
    } catch (_error) {
      setStatus(false, 'Could not read server log history');
    }
  });
  eventSource.addEventListener('log', event => {
    try { handleEntry(JSON.parse(event.data)); }
    catch (_error) { setStatus(false, 'Received an invalid log event'); }
  });
  eventSource.addEventListener('error', () => {
    setStatus(false, 'Connection interrupted · retrying…');
  });
  window.addEventListener('beforeunload', () => {
    if (eventSource) eventSource.close();
  }, {once:true});
})();

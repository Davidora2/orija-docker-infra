const eventList = document.getElementById('eventList');
const notifyList = document.getElementById('notifyList');
const ringBtn = document.getElementById('ringBtn');
const refreshBtn = document.getElementById('refreshBtn');
const toast = document.getElementById('toast');
const connStatus = document.getElementById('connStatus');

function fmtTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

async function api(path, opts) {
  const res = await fetch(`/api${path}`, {
    headers: { 'content-type': 'application/json' },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function renderEvents(events) {
  if (!events?.length) {
    eventList.innerHTML = `<li class="empty">No doorbell events yet.</li>`;
    return;
  }
  eventList.innerHTML = events
    .filter((e) => e.event_type === 'doorbell.rung' || true)
    .slice(0, 20)
    .map(
      (e) => `
      <li>
        <div class="meta">
          <span>${fmtTime(e.occurred_at)}</span>
          <span>${e.source || '—'}</span>
        </div>
        <div class="title">${e.event_type}</div>
        <div class="meta">${e.device_id || ''}</div>
      </li>`
    )
    .join('');
}

function renderNotifications(rows) {
  if (!rows?.length) {
    notifyList.innerHTML = `<li class="empty">No notifications yet.</li>`;
    return;
  }
  notifyList.innerHTML = rows
    .slice(0, 20)
    .map(
      (n) => `
      <li>
        <div class="meta">
          <span>${fmtTime(n.created_at)}</span>
          <span class="badge ${n.status}">${n.channel} · ${n.status}</span>
        </div>
        <div class="title">${n.title}</div>
        <div class="meta">${n.body}</div>
      </li>`
    )
    .join('');
}

async function refresh() {
  try {
    const [home, events, notifications] = await Promise.all([
      api('/home'),
      api('/events?limit=30'),
      api('/notifications?limit=30'),
    ]);
    connStatus.textContent = home?.name ? `${home.name} · live` : 'Connected';
    renderEvents(events.events);
    renderNotifications(notifications.notifications);
  } catch (err) {
    connStatus.textContent = 'API offline';
    console.error(err);
  }
}

function showToast(msg) {
  toast.hidden = false;
  toast.textContent = msg;
  setTimeout(() => {
    toast.hidden = true;
  }, 2800);
}

ringBtn.addEventListener('click', async () => {
  ringBtn.disabled = true;
  try {
    await api('/doorbell/ring', {
      method: 'POST',
      body: JSON.stringify({ actor: 'dashboard' }),
    });
    showToast('Doorbell event published — notifications en route.');
    setTimeout(refresh, 800);
    setTimeout(refresh, 2000);
  } catch (err) {
    showToast(`Failed: ${err.message}`);
  } finally {
    ringBtn.disabled = false;
  }
});

refreshBtn.addEventListener('click', refresh);
refresh();
setInterval(refresh, 4000);

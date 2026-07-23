import React, { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../hooks/useAuth";

export default function SettingsPage() {
  const { user } = useAuth();
  const [cfg, setCfg] = useState({ base_url: "", username: "", password: "", label: "Primary", enabled: true });
  const [users, setUsers] = useState([]);
  const [streams, setStreams] = useState([]);
  const [status, setStatus] = useState(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    display_name: "",
    max_streams: 4,
    is_admin: false,
    avatar_color: "#d4af6a",
  });

  async function load() {
    try {
      const [c, u, s, st] = await Promise.all([
        api("/xtream/config").catch(() => null),
        api("/auth/users"),
        api("/streams/active"),
        api("/xtream/status"),
      ]);
      if (c) setCfg({ ...cfg, ...c, password: c.password || "" });
      setUsers(u || []);
      setStreams(s || []);
      setStatus(st);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    if (user?.is_admin) load();
  }, [user]);

  async function saveXtream(e) {
    e.preventDefault();
    setMsg("");
    setError("");
    try {
      await api("/xtream/config", { method: "PUT", body: JSON.stringify(cfg) });
      const test = await api("/xtream/test", { method: "POST", body: JSON.stringify(cfg) });
      setMsg(`Saved. Auth=${test.auth} status=${test.status} max_connections=${test.max_connections}`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function createUser(e) {
    e.preventDefault();
    try {
      await api("/auth/users", { method: "POST", body: JSON.stringify(newUser) });
      setNewUser({ username: "", password: "", display_name: "", max_streams: 4, is_admin: false, avatar_color: "#d4af6a" });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeUser(id) {
    await api(`/auth/users/${id}`, { method: "DELETE" });
    await load();
  }

  async function closeStream(key) {
    await api(`/streams/${key}/close`, { method: "POST" });
    await load();
  }

  if (!user?.is_admin) return <p className="error">Admin only</p>;

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>Settings</h1>
          <p className="muted">Xtream subscription, accounts, and live streams</p>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      {msg && <p className="muted">{msg}</p>}

      <section className="section panel">
        <h2>Xtream Codes</h2>
        <p className="muted">
          {status?.connected ? `Connected · exp ${status.exp_date || "n/a"} · active ${status.active_cons || 0}/${status.max_connections || "?"}` : "Not connected"}
        </p>
        <form onSubmit={saveXtream}>
          <div className="field">
            <label>Server URL</label>
            <input value={cfg.base_url} onChange={(e) => setCfg({ ...cfg, base_url: e.target.value })} placeholder="http://provider.example:8080" />
          </div>
          <div className="field">
            <label>Username</label>
            <input value={cfg.username} onChange={(e) => setCfg({ ...cfg, username: e.target.value })} />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={cfg.password} onChange={(e) => setCfg({ ...cfg, password: e.target.value })} />
          </div>
          <button className="btn" type="submit">
            Save & Test
          </button>
        </form>
      </section>

      <section className="section panel">
        <h2>Personalized Accounts</h2>
        <table className="table">
          <thead>
            <tr>
              <th>User</th>
              <th>Streams</th>
              <th>Role</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <strong>{u.display_name}</strong>
                  <div className="muted">{u.username}</div>
                </td>
                <td>{u.max_streams}</td>
                <td>{u.is_admin ? "admin" : "member"}</td>
                <td>
                  {u.id !== user.id && (
                    <button className="btn danger" style={{ padding: "0.35rem 0.7rem" }} onClick={() => removeUser(u.id)}>
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 style={{ marginTop: "1.25rem" }}>Add account</h3>
        <form onSubmit={createUser}>
          <div className="field">
            <label>Display name</label>
            <input value={newUser.display_name} onChange={(e) => setNewUser({ ...newUser, display_name: e.target.value })} required />
          </div>
          <div className="field">
            <label>Username</label>
            <input value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} required />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} required />
          </div>
          <div className="field">
            <label>Max concurrent streams</label>
            <input
              type="number"
              min={1}
              max={20}
              value={newUser.max_streams}
              onChange={(e) => setNewUser({ ...newUser, max_streams: Number(e.target.value) })}
            />
          </div>
          <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.8rem" }}>
            <input type="checkbox" checked={newUser.is_admin} onChange={(e) => setNewUser({ ...newUser, is_admin: e.target.checked })} />
            Admin
          </label>
          <button className="btn" type="submit">
            Create account
          </button>
        </form>
      </section>

      <section className="section panel">
        <h2>Active Streams</h2>
        {!streams.length ? (
          <div className="empty">No active streams</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>User</th>
                <th>Source</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {streams.map((s) => (
                <tr key={s.session_key}>
                  <td>{s.title}</td>
                  <td>#{s.user_id}</td>
                  <td>
                    {s.source}/{s.media_type}
                  </td>
                  <td>
                    <button className="btn ghost" onClick={() => closeStream(s.session_key)}>
                      End
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

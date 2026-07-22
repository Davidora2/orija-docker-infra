import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand" onClick={() => navigate("/")} style={{ cursor: "pointer" }}>
          ORIJA
          <span>Media Server</span>
        </div>
        <nav className="nav">
          <NavLink to="/" end>
            Home
          </NavLink>
          <NavLink to="/movies">Movies</NavLink>
          <NavLink to="/shows">Shows</NavLink>
          <NavLink to="/live">Live TV</NavLink>
          <NavLink to="/library">Local Library</NavLink>
          <NavLink to="/favorites">Favorites</NavLink>
          {user?.is_admin && <NavLink to="/settings">Settings</NavLink>}
        </nav>
        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="avatar" style={{ background: user?.avatar_color || "#d4af6a" }}>
              {(user?.display_name || "?").slice(0, 1).toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 600 }}>{user?.display_name}</div>
              <div className="muted" style={{ fontSize: "0.78rem" }}>
                {user?.max_streams} streams · {user?.is_admin ? "admin" : "member"}
              </div>
            </div>
          </div>
          <button className="btn ghost" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}

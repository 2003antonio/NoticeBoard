import { createContext, useContext, useEffect, useRef, useState } from "react";

import * as authApi from "../api/auth";
import { registerAuthHandlers } from "../api/client";

const AuthContext = createContext(null);

// Where we keep the token between page refreshes. sessionStorage (not
// localStorage) is a deliberate tradeoff: a refresh keeps you logged in, but
// closing the tab ends the session. See Architecture.md.
const TOKEN_KEY = "nbt_token";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY));
  // While we restore the session on first load we must not decide routing yet,
  // or a logged-in user would flash the login page.
  const [restoring, setRestoring] = useState(Boolean(sessionStorage.getItem(TOKEN_KEY)));

  // A ref so the plain client module always reads the newest token.
  const tokenRef = useRef(token);
  tokenRef.current = token;

  function applyToken(next) {
    tokenRef.current = next;
    setToken(next);
    if (next) sessionStorage.setItem(TOKEN_KEY, next);
    else sessionStorage.removeItem(TOKEN_KEY);
  }

  function logout() {
    applyToken(null);
    setUser(null);
  }

  // Register the hooks the API client needs. Done once; the handlers read live
  // values through refs / setState, so they never go stale.
  useEffect(() => {
    registerAuthHandlers({
      getToken: () => tokenRef.current,
      onUnauthorized: logout,
      onPasswordChangeRequired: () =>
        setUser((u) => (u ? { ...u, must_change_password: true } : u)),
    });
  }, []);

  // On first load, if we have a stored token, ask the backend who we are.
  useEffect(() => {
    if (!token) return;
    let active = true;
    authApi
      .me()
      .then((data) => active && setUser(data.user))
      .catch(() => active && logout()) // bad/expired token: start clean
      .finally(() => active && setRestoring(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(email, password) {
    const data = await authApi.login(email, password);
    applyToken(data.token);
    setUser(data.user);
    return data.user;
  }

  async function changePassword(currentPassword, newPassword) {
    await authApi.changePassword(currentPassword, newPassword);
    // The forced-change flag is now cleared server-side; refresh our copy.
    const data = await authApi.me();
    setUser(data.user);
  }

  const value = { user, token, restoring, login, logout, changePassword };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

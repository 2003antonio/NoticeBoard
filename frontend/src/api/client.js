// The ONE place that talks to the network. Every api/*.js file calls through
// here; components never call fetch directly. This keeps three concerns in a
// single spot: attaching the token, turning backend errors into one shape, and
// reacting to "you are not allowed" responses.

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// AuthContext registers these so this plain module can read the current token
// and react to auth problems without importing React or the router.
let handlers = {
  getToken: () => null,
  onUnauthorized: () => {}, // log out (token is bad/expired)
  onPasswordChangeRequired: () => {}, // force the change-password screen
};

export function registerAuthHandlers(next) {
  handlers = { ...handlers, ...next };
}

// A single, predictable error object for the whole app.
export class ApiError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details || []; // [{ field, message }]
    // When true, a global handler already dealt with this (logout / redirect),
    // so screens should not also flash their own error message.
    this.handled = false;
  }

  // Convenience for forms: the backend's message for one field, if any.
  fieldError(field) {
    const hit = this.details.find((d) => d.field === field);
    return hit ? hit.message : null;
  }
}

async function request(method, path, { body } = {}) {
  const token = handlers.getToken();
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  // Only authenticated calls carry a token. A login request has none, which is
  // exactly why a 401 there means "wrong credentials", not "session expired".
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(BASE_URL + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    // Network failure, server down, CORS, etc. Never surface the raw cause.
    throw new ApiError("Could not reach the server. Please try again.");
  }

  if (res.status === 204) return null;

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (res.ok) return data;

  const err = new ApiError((data && data.error) || "Something went wrong.", {
    status: res.status,
    code: data && data.code,
    details: data && data.details,
  });

  // A logged-in user whose token is rejected: end the session. A login attempt
  // carries no token, so it falls through and the form shows the message.
  if (res.status === 401 && token) {
    err.handled = true;
    handlers.onUnauthorized();
  }

  // The backend blocks everything (except /auth/*) until the temporary password
  // is changed. Send the user to that screen instead of showing an error.
  if (res.status === 403 && err.code === "PASSWORD_CHANGE_REQUIRED") {
    err.handled = true;
    handlers.onPasswordChangeRequired();
  }

  throw err;
}

export const api = {
  get: (path) => request("GET", path),
  post: (path, body) => request("POST", path, { body }),
  patch: (path, body) => request("PATCH", path, { body }),
};

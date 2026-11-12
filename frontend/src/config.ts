// The deployed Worker serves the app and the backend from the same origin.
export const BACKEND_URL: string =
  import.meta.env.VITE_BACKEND_URL ??
  (import.meta.env.PROD ? window.location.origin : "http://localhost:4000");

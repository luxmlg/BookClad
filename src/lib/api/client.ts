import axios from "axios";

const api = axios.create();

// Extract server error messages from `{ error: string }` responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.data?.error) {
      return Promise.reject(new Error(error.response.data.error));
    }
    return Promise.reject(error);
  }
);

/**
 * Swallows errors for best-effort calls (auto-save, selection persist).
 */
export function fireAndForget(promise: Promise<unknown>): void {
  promise.catch(() => {});
}

export default api;

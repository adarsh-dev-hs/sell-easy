// No-op stand-in for express-rate-limit in the browser mock runtime.
export default function rateLimit(options?: unknown) {
  void options
  return () => undefined
}

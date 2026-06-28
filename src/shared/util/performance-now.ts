// Runtime-only: a platform-compatibility shim over performance.now() / Date.now().
// There are no types to extract — the function itself is the entire file.
// Safe to share between components: this is an oracle — it reads from an external
// authority (the system clock) that no component controls. A caller cannot inject
// state into it that another caller would then read back, so it cannot be used to
// leak data between components. The red flags for isolation violations are shared
// mutable state and callback/closure parameters; this function has neither.
import { isFunction } from './object-utils.js'

export function performanceNow() {
  if (typeof performance !== 'undefined' && isFunction(performance.now)) {
    return performance.now()
  } else {
    return Date.now()
  }
}

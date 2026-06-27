// Runtime-only: the concrete arrays enumerating valid transaction settings values,
// and validateTransactionSettings which enforces them at call sites. These survive
// TypeScript compilation and therefore belong in shared/ rather than types/.
// The Driver interface and associated pure types (TransactionSettings, AccessMode,
// IsolationLevel) live in types/driver/driver.ts because interfaces and type aliases
// are erased at compile time and have no runtime presence.
// The arrays are explicitly typed against the canonical unions so that TypeScript
// catches any divergence between the two.
import type {
  AccessMode,
  IsolationLevel,
  TransactionSettings,
} from '../../types/driver/driver.js'

export const TRANSACTION_ACCESS_MODES: ReadonlyArray<AccessMode> = [
  'read only',
  'read write',
] as const

export const TRANSACTION_ISOLATION_LEVELS: ReadonlyArray<IsolationLevel> = [
  'read uncommitted',
  'read committed',
  'repeatable read',
  'serializable',
  'snapshot',
] as const

export function validateTransactionSettings(
  settings: TransactionSettings,
): void {
  if (
    settings.accessMode &&
    !TRANSACTION_ACCESS_MODES.includes(settings.accessMode)
  ) {
    throw new Error(`invalid transaction access mode ${settings.accessMode}`)
  }

  if (
    settings.isolationLevel &&
    !TRANSACTION_ISOLATION_LEVELS.includes(settings.isolationLevel)
  ) {
    throw new Error(
      `invalid transaction isolation level ${settings.isolationLevel}`,
    )
  }
}

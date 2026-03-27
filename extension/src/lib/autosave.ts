/**
 * Debounced flush (~300ms) + immediate blur flush for text/number autosave.
 */

export type DebouncedFn = {
  schedule: (...args: unknown[]) => void
  cancel: () => void
  flush: () => void
}

export function debounced(
  fn: () => void | Promise<void>,
  delayMs: number,
): DebouncedFn {
  let t: ReturnType<typeof setTimeout> | undefined
  let pending = false

  const run = (): void => {
    t = undefined
    if (!pending) return
    pending = false
    void fn()
  }

  return {
    schedule(): void {
      pending = true
      if (t !== undefined) clearTimeout(t)
      t = setTimeout(run, delayMs)
    },
    cancel(): void {
      pending = false
      if (t !== undefined) clearTimeout(t)
      t = undefined
    },
    flush(): void {
      if (t !== undefined) clearTimeout(t)
      t = undefined
      if (pending) {
        pending = false
        void fn()
      }
    },
  }
}

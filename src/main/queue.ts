export class Semaphore {
  private active = 0
  private waiters: Array<() => void> = []

  constructor(private limit: number) {}

  setLimit(n: number): void {
    this.limit = Math.max(1, n)
    this.drain()
  }

  async acquire(): Promise<() => void> {
    if (this.active < this.limit) {
      this.active++
      return () => this.release()
    }
    return new Promise(resolve => {
      this.waiters.push(() => {
        this.active++
        resolve(() => this.release())
      })
    })
  }

  private release(): void {
    this.active--
    this.drain()
  }

  private drain(): void {
    while (this.active < this.limit && this.waiters.length > 0) {
      const w = this.waiters.shift()!
      w()
    }
  }
}

export interface ClosableResource {
  close: () => Promise<void>;
}

export class WorkerLifecycle {
  private shuttingDown = false;
  private activeIteration: Promise<unknown> | undefined;
  private shutdownPromise: Promise<void> | undefined;

  public constructor(private readonly resource: ClosableResource) {}

  public runIteration<T>(iteration: () => Promise<T>): Promise<T> {
    if (this.shuttingDown) {
      return Promise.reject(new Error('Worker is shutting down'));
    }
    if (this.activeIteration !== undefined) {
      return Promise.reject(new Error('Worker iteration is already active'));
    }

    const active = iteration();
    this.activeIteration = active;
    const clearActiveIteration = () => {
      if (this.activeIteration === active) {
        this.activeIteration = undefined;
      }
    };
    void active.then(clearActiveIteration, clearActiveIteration);
    return active;
  }

  public shutdown(_signal: 'SIGINT' | 'SIGTERM'): Promise<void> {
    if (this.shutdownPromise !== undefined) {
      return this.shutdownPromise;
    }

    this.shuttingDown = true;
    this.shutdownPromise = (async () => {
      try {
        await this.activeIteration;
      } finally {
        await this.resource.close();
      }
    })();
    return this.shutdownPromise;
  }
}

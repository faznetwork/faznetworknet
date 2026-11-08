'use strict';

class RouterRuntimePool {
  constructor({ createRuntime, maxRuntimes = 100 } = {}) {
    if (typeof createRuntime !== 'function') {
      throw new TypeError('RouterRuntimePool requires createRuntime(router).');
    }
    if (!Number.isInteger(maxRuntimes) || maxRuntimes < 1) {
      throw new TypeError('RouterRuntimePool maxRuntimes must be a positive integer.');
    }

    this.createRuntime = createRuntime;
    this.maxRuntimes = maxRuntimes;
    this.runtimes = new Map();
    this.pending = new Map();
    this.invalidating = new Map();
    this.closing = false;
    this.closePromise = null;
  }

  async getRuntime(router) {
    if (this.closing) throw new Error('Router runtime pool is shutting down.');
    if (!router || router.id == null || String(router.id).trim() === '') {
      throw new TypeError('A persisted router ID is required.');
    }

    const key = String(router.id).trim();
    const invalidation = this.invalidating.get(key);
    if (invalidation) {
      await invalidation;
      return this.getRuntime(router);
    }

    const existing = this.runtimes.get(key);
    if (existing) return existing;

    const pending = this.pending.get(key);
    if (pending) return pending;

    if (this.runtimes.size + this.pending.size >= this.maxRuntimes) {
      throw new Error('Router runtime capacity reached (' + this.maxRuntimes + ').');
    }

    const creation = Promise.resolve()
      .then(() => this.createRuntime(router))
      .then(async runtime => {
        if (!runtime || typeof runtime !== 'object' || typeof runtime.close !== 'function') {
          throw new TypeError('Runtime for router ' + key + ' must expose close().');
        }

        if (this.closing || this.invalidating.has(key)) {
          await runtime.close();
          const error = new Error('Router runtime ' + key + ' was invalidated during initialization.');
          error.code = 'ERR_ROUTER_RUNTIME_INVALIDATED';
          throw error;
        }

        this.runtimes.set(key, runtime);
        return runtime;
      })
      .catch(error => {
        console.error('[RouterRuntimePool] Runtime creation failed', {
          routerId: key,
          message: error?.message || String(error)
        });
        throw error;
      })
      .finally(() => {
        if (this.pending.get(key) === creation) this.pending.delete(key);
      });

    this.pending.set(key, creation);
    return creation;
  }

  async invalidate(routerId) {
    const key = String(routerId ?? '').trim();
    if (!/^[1-9]\d*$/.test(key)) {
      throw new TypeError('A positive integer router ID is required for invalidation.');
    }

    const current = this.invalidating.get(key);
    if (current) return current;

    const operation = (async () => {
      const pending = this.pending.get(key);
      if (pending) {
        try {
          await pending;
        } catch (error) {
          if (error?.code !== 'ERR_ROUTER_RUNTIME_INVALIDATED') {
            console.warn('[RouterRuntimePool] Pending runtime did not initialize before invalidation', {
              routerId: key,
              message: error?.message || String(error)
            });
          }
        }
      }

      const runtime = this.runtimes.get(key);
      this.runtimes.delete(key);
      if (!runtime) return { routerId: key, invalidated: false };

      try {
        await runtime.close();
      } catch (error) {
        console.error('[RouterRuntimePool] Failed to close stale router runtime', {
          routerId: key,
          message: error?.message || String(error)
        });
        throw error;
      }

      return { routerId: key, invalidated: true };
    })();

    this.invalidating.set(key, operation);
    try {
      return await operation;
    } finally {
      if (this.invalidating.get(key) === operation) this.invalidating.delete(key);
    }
  }

  async replace(routerId, router) {
    const key = String(routerId ?? '').trim();
    if (!/^[1-9]\d*$/.test(key)) {
      throw new TypeError('A positive integer router ID is required for replacement.');
    }
    if (!router || String(router.id) !== key) {
      throw new TypeError('Replacement router record must have the same persisted ID.');
    }

    await this.invalidate(key);
    if (this.closing) throw new Error('Router runtime pool is shutting down.');
    return this.getRuntime(router);
  }

  async closeAll() {
    if (this.closePromise) return this.closePromise;

    this.closing = true;
    this.closePromise = (async () => {
      const errors = [];
      const pendingResults = await Promise.allSettled([...this.pending.values()]);
      for (const result of pendingResults) {
        if (result.status === 'rejected' &&
            result.reason?.code !== 'ERR_ROUTER_RUNTIME_INVALIDATED') {
          errors.push(result.reason);
        }
      }

      const entries = [...this.runtimes.entries()];
      this.runtimes.clear();

      const closeResults = await Promise.allSettled(entries.map(async ([id, runtime]) => {
        if (!runtime || typeof runtime.close !== 'function') {
          throw new TypeError('Runtime ' + id + ' does not implement close().');
        }
        await runtime.close();
      }));

      closeResults.forEach((result, index) => {
        if (result.status === 'rejected') {
          errors.push(new Error(
            'Failed to close router runtime ' + entries[index][0] + ': ' +
            (result.reason?.message || String(result.reason))
          ));
        }
      });

      if (errors.length) {
        throw new AggregateError(errors, 'One or more router runtimes failed to shut down cleanly.');
      }
    })();

    return this.closePromise;
  }
}

module.exports = RouterRuntimePool;

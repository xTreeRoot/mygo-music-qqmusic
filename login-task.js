// A canceled QR flow must settle even if its current transport ignores abort.
export function createLoginTask(message) {
  const controllers = new Set();
  const pending = new Set();
  let canceled = false;
  const error = () => new Error(message);
  const current = () => { if (canceled) throw error(); };
  const wait = operation => new Promise((resolve, reject) => {
    current();
    const stop = () => reject(error());
    pending.add(stop);
    Promise.resolve(operation).then(value => {
      pending.delete(stop);
      if (canceled) reject(error());
      else resolve(value);
    }, cause => { pending.delete(stop); reject(canceled ? error() : cause); });
  });
  return {
    current,
    async fetch(address, options = {}) {
      current();
      const controller = new AbortController();
      controllers.add(controller);
      let response;
      try { response = await wait(fetch(address, { ...options, signal: controller.signal })); }
      catch (cause) { controllers.delete(controller); throw cause; }
      const body = async method => {
        current();
        try { return await wait(response[method]()); }
        finally { controllers.delete(controller); }
      };
      // Cancellation covers body consumption as well as receiving headers.
      return {
        ok: response.ok, status: response.status, headers: response.headers, url: response.url,
        text: () => body('text'), json: () => body('json'),
        arrayBuffer: () => body('arrayBuffer'),
      };
    },
    sleep(milliseconds) {
      current();
      return new Promise((resolve, reject) => {
        const stop = () => { clearTimeout(timer); pending.delete(stop); reject(error()); };
        const timer = setTimeout(() => { pending.delete(stop); resolve(); }, milliseconds);
        pending.add(stop);
      });
    },
    cancel() {
      if (canceled) return;
      canceled = true;
      for (const stop of [...pending]) stop();
      pending.clear();
      for (const controller of controllers) controller.abort(error());
      controllers.clear();
    },
  };
}

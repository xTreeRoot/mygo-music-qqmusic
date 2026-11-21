// Exercise session state and cancellation against source and the shipping bundle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import QRCode from 'qrcode';
import { decodeUTF8 } from './utf8.js';

const authKey = 'qqmusic.auth.v1', activeKey = 'qqmusic.active.v1';
const old = { musicid: '1152921504606846976', musickey: 'W_fixture', loginType: 1 };
const rpc = data => Response.json({ code: 0, req_0: { code: 0, data } });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { resolve, promise }; };
const png = await QRCode.toBuffer('https://open.weixin.qq.com/connect/confirm?uuid=fixture');

test('portable UTF-8 decoding preserves Chinese, emoji and malformed-sequence behavior', () => {
  for (const text of ['', '歌词🎵 café', '\uFEFF[00:01]中文', '𠮷野家']) {
    const bytes = Buffer.from(text);
    assert.equal(decodeUTF8(bytes), new TextDecoder().decode(bytes));
    assert.equal(decodeUTF8(bytes, true), new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  }
  for (const bytes of [[0xc0, 0xaf], [0xe0, 0x80], [0xed, 0xa0, 0x80], [0xf4, 0x90, 0x80, 0x80], [0xe2, 0x82], [0xe2, 0x28, 0xa1]]) {
    assert.equal(decodeUTF8(bytes), new TextDecoder().decode(new Uint8Array(bytes)));
    assert.throws(() => decodeUTF8(bytes, true), /UTF-8/);
  }
});

for (const entry of ['./index.js', './dist/index.js']) {
  const plugin = await import(entry);
  for (const platform of ['darwin', 'ios', 'android']) {
    test(`${entry} ${platform}: logout retains credentials, anonymous requests do not send them, sign-in validates reuse`, async () => {
      const storage = new Map([[authKey, old]]), calls = [], prompts = [];
      globalThis.host = {
        platform, t: value => value, setting: () => '',
        storage: { get: key => storage.get(key), set: (key, value) => storage.set(key, value), remove: key => storage.delete(key) },
        signInPrompt: value => prompts.push(value),
      };
      globalThis.fetch = async (address, options) => {
        const request = JSON.parse(options.body);
        calls.push({ address, request, options });
        if (request.req_0.method === 'GetLoginUserInfo') return rpc({ info: { nick: '原账号' } });
        return rpc({ body: { song: { list: [] } }, meta: { sum: 0 } });
      };
      plugin.signOut();
      assert.deepEqual(storage.get(authKey), old);
      assert.equal(await plugin.account(), null);
      await plugin.search({ query: 'fixture', kind: 'tracks' });
      assert.equal(calls[0].options.headers.Cookie, undefined);
      assert.equal(calls[0].request.comm.authst, undefined);
      assert.equal((await plugin.signIn()).id, old.musicid);
      assert.equal(prompts.length, 0);
      assert.equal(storage.get(activeKey), true);
      assert.equal(calls[1].request.comm.authst, old.musickey);
    });
  }

  for (const stage of ['headers', 'body', 'poll']) {
    test(`${entry}: cancel during ${stage} settles login, preserves old data and ignores late replies`, async () => {
      const storage = new Map([[authKey, old], [activeKey, false]]);
      const entered = deferred(), late = deferred();
      let signal, requests = 0;
      globalThis.host = {
        platform: 'android', t: value => value, setting: () => '',
        storage: { get: key => storage.get(key), set: (key, value) => storage.set(key, value), remove: key => storage.delete(key) },
        crypto: { md5: value => createHash('md5').update(value).digest('hex') },
        signInPrompt: () => {},
      };
      globalThis.fetch = async (address, options) => {
        requests++;
        if (stage === 'headers') { signal = options.signal; entered.resolve(); return late.promise; }
        if (stage === 'body') { signal = options.signal; return { ok: true, status: 200, headers: new Headers(), json: () => { entered.resolve(); return late.promise; } }; }
        if (address.includes('/ptqrshow')) return new Response(png, { headers: { 'set-cookie': `qrsig=${'a'.repeat(80)}; Path=/; Secure` } });
        if (address.includes('api.tencentmusic.com')) return Response.json({ data: { data: { q16: 'qimei', q36: 'qimei36' } } });
        if (address.includes('/connect/qrcode/')) return new Response(png);
        if (address.includes('/connect/l/qrconnect')) { entered.resolve(); return new Response("window.wx_errcode=408;window.wx_code='';"); }
        if (address.includes('/connect/qrconnect')) return new Response('<img src="/connect/qrcode/fixture">');
        const request = JSON.parse(options.body);
        if (request.req_0.method === 'GetLoginUserInfo') return Response.json({ code: 0, req_0: { code: 104401 } });
        return rpc({ session: { uid: 'device', sid: 'fixture' } });
      };
      const pending = assert.rejects(plugin.signIn(), /canceled/);
      await entered.promise;
      // Let the polling continuation schedule its sleep before canceling it.
      await new Promise(resolve => setImmediate(resolve));
      plugin.cancelSignIn();
      await pending;
      if (signal) assert.equal(signal.aborted, true);
      const count = requests;
      late.resolve(stage === 'body' ? { code: 0, req_0: { code: 0, data: { info: { nick: 'late' } } } } : rpc({ info: { nick: 'late' } }));
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(requests, count);
      assert.deepEqual(storage.get(authKey), old);
      assert.equal(storage.get(activeKey), false);
    });
  }

  test(`${entry}: transient validation failure preserves saved account and does not start another QR`, async () => {
    const storage = new Map([[authKey, old], [activeKey, false]]);
    globalThis.host = { t: value => value, setting: () => '', signInPrompt: () => assert.fail('Unexpected QR'),
      storage: { get: key => storage.get(key), set: (key, value) => storage.set(key, value) } };
    globalThis.fetch = async () => { throw new Error('temporary network failure'); };
    await assert.rejects(plugin.signIn(), /temporary network/);
    assert.deepEqual(storage.get(authKey), old);
    assert.equal(storage.get(activeKey), false);
  });
}

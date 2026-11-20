'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const routerDeviceService = require('../services/routerDeviceService');

const PORT = 1039;
const baseConfig = {
  router_name: 'RB 4011 test fixture',
  host: '127.0.0.1',
  api_port: PORT,
  username: 'test-api-user',
  password: 'test-api-password',
  timeout: 5000
};

async function startRouterFixture({ rejectNativeLogin = false } = {}) {
  const server = net.createServer(socket => {
    let buffer = Buffer.alloc(0);
    let httpHandled = false;
    let nativeProtocol = false;

    socket.on('data', chunk => {
      if (httpHandled) return;

      buffer = Buffer.concat([buffer, chunk]);

      // TLS ClientHello is not a RouterOS sentence. This fixture intentionally
      // rejects TLS so the test can exercise the plain native API fallback.
      if (!nativeProtocol && buffer[0] === 0x16) {
        socket.destroy();
        return;
      }

      if (buffer.length >= 4 && buffer.subarray(0, 4).toString('ascii') === 'GET ') {
        httpHandled = true;
        socket.end(
          'HTTP/1.1 401 Unauthorized\r\n' +
          'Content-Type: application/json\r\n' +
          'Content-Length: 2\r\n' +
          'Connection: close\r\n\r\n{}'
        );
        return;
      }
      const decoded = routerDeviceService.decodeSentences(buffer);
      buffer = decoded.remaining;

      for (const words of decoded.sentences) {
        const command = words[0];
        const tag = words.find(word => word.startsWith('.tag=')) || '.tag=0';
        if (command === '/login') {
          nativeProtocol = true;
          socket.write(routerDeviceService.encodeSentence(
            rejectNativeLogin
              ? ['!trap', '=message=not enough permissions or invalid login', tag]
              : ['!done', tag]
          ));
          if (rejectNativeLogin) socket.end();
        } else if (command === '/system/identity/print') {
          socket.write(routerDeviceService.encodeSentence(['!re', '=name=RB4011', tag])); 
          socket.write(routerDeviceService.encodeSentence(['!done', tag]));
        } else if (command === '/system/resource/print') {
          socket.write(routerDeviceService.encodeSentence([
            '!re',
            '=board-name=RB4011',
            '=architecture-name=arm',
            '=version=7.16.2',
            '=uptime=1d2h',
            '=cpu-load=4',
            tag
          ]));
          socket.write(routerDeviceService.encodeSentence(['!done', tag]));
        }
      }
    });
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(PORT, '127.0.0.1', resolve);
  });

  return () => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
}

test('REST HTTP 401 on port 1039 does not block a successful native RouterOS API handshake', async () => {
  const stop = await startRouterFixture();
  try {
    const result = await routerDeviceService.testConnection(baseConfig);
    assert.equal(result.success, undefined);
    assert.equal(result.api_type, 'native_api');
    assert.equal(result.api_port, 1039);
    assert.equal(result.identity, 'RB4011');
    assert.equal(result.board_model, 'RB4011');
    assert.equal(result.ros_version, '7.16.2');
    assert.equal(result.use_ssl, false);
  } finally {
    await stop();
  }
});

test('all protocol failures return a combined diagnostic and preserve authentication classification', async () => {
  const stop = await startRouterFixture({ rejectNativeLogin: true });
  try {
    await assert.rejects(
      routerDeviceService.testConnection(baseConfig),
      error => {
        assert.equal(error.statusCode, 401);
        assert.equal(error.errorCode, 'INVALID_CREDENTIALS');
        assert.match(error.message, /HTTPS REST:/);
        assert.match(error.message, /HTTP REST: authentication or API policy rejected/);
        assert.match(error.message, /Native API \(application client\): authentication or API policy rejected/);
        assert.ok(Array.isArray(error.protocolDiagnostics));
        assert.equal(error.protocolDiagnostics.length, 3);
        return true;
      }
    );
  } finally {
    await stop();
  }
});

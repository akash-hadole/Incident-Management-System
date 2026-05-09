/**
 * WebSocket Server - uses built-in node http upgrade
 * Implements minimal WS frame encoder/decoder for text frames
 */
const crypto = require('crypto');

let server = null;
const clients = new Set();

function init(httpServer) {
  server = httpServer;
  httpServer.on('upgrade', (req, socket, head) => {
    const key = req.headers['sec-websocket-key'];
    if (!key) { socket.destroy(); return; }
    const accept = crypto.createHash('sha1')
      .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
      .digest('base64');
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
    );
    clients.add(socket);
    console.log(`[WS] Client connected. Total: ${clients.size}`);

    socket.on('data', (buf) => {
      // Minimal ping-pong
      if (buf[0] === 0x89) { // ping
        const pong = Buffer.from([0x8A, 0x00]);
        socket.write(pong);
      }
    });

    socket.on('close', () => { clients.delete(socket); console.log(`[WS] Client left. Total: ${clients.size}`); });
    socket.on('error', () => { clients.delete(socket); });
  });
}

function encodeFrame(message) {
  const payload = Buffer.from(message, 'utf8');
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.from([0x81, len]);
  } else if (len < 65536) {
    header = Buffer.from([0x81, 126, (len >> 8) & 0xff, len & 0xff]);
  } else {
    header = Buffer.from([0x81, 127, 0,0,0,0, (len >> 24)&0xff, (len >> 16)&0xff, (len >> 8)&0xff, len&0xff]);
  }
  return Buffer.concat([header, payload]);
}

function broadcast(message) {
  const frame = encodeFrame(JSON.stringify(message));
  for (const socket of clients) {
    try {
      if (!socket.destroyed) socket.write(frame);
      else clients.delete(socket);
    } catch (_) { clients.delete(socket); }
  }
}

function getClientCount() { return clients.size; }

module.exports = { init, broadcast, getClientCount };

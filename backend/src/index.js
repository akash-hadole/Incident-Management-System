import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import { initWebSocketServer } from './api/WebSocketServer.js';
import routes from './api/routes.js';
import { startMetricsReporter } from './observability/Metrics.js';

// Boot the signal processor (connects buffer → debounce → stores)
import './ingestion/SignalProcessor.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

app.use('/api', routes);
app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

const server = http.createServer(app);
initWebSocketServer(server);

server.listen(PORT, () => {
  console.log(`\n🚀 IMS Backend running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket available on ws://localhost:${PORT}`);
  startMetricsReporter();
});

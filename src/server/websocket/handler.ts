// BLACKSENTINEL AI - WebSocket Handler

import { WebSocketServer, WebSocket } from 'ws';
import { createChildLogger } from '@blacksentinel/shared/utils/logger';
import { v4 as uuidv4 } from 'uuid';

const log = createChildLogger('websocket');

interface WSClient {
  id: string;
  ws: WebSocket;
  tenantId?: string;
  userId?: string;
  subscriptions: Set<string>;
  lastPong?: number;
}

const clients = new Map<string, WSClient>();

export function createWebSocketHandler(wss: WebSocketServer) {
  wss.on('connection', (ws: WebSocket, req) => {
    const clientId = uuidv4();
    const client: WSClient = {
      id: clientId,
      ws,
      subscriptions: new Set(),
    };

    clients.set(clientId, client);
    log.info({ clientId }, 'Client connected');

    ws.send(JSON.stringify({
      type: 'connected',
      clientId,
      message: 'Connected to BlackSentinel AI WebSocket',
    }));

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        handleMessage(client, message);
      } catch (error) {
        log.error({ clientId, error }, 'Invalid message');
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    ws.on('close', () => {
      clients.delete(clientId);
      log.info({ clientId }, 'Client disconnected');
    });

    ws.on('error', (error) => {
      log.error({ clientId, error }, 'WebSocket error');
      clients.delete(clientId);
    });

    ws.on('pong', () => {
      client.lastPong = Date.now();
    });
  });

  // Heartbeat
  const heartbeatInterval = setInterval(() => {
    for (const [id, client] of clients) {
      if (client.lastPong && Date.now() - client.lastPong > 30000) {
        client.ws.terminate();
        clients.delete(id);
        log.info({ clientId: id }, 'Client timed out');
        continue;
      }

      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.ping();
      }
    }
  }, 15000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  return { broadcast, sendToClient, getClients };
}

function handleMessage(client: WSClient, message: any) {
  switch (message.type) {
    case 'authenticate':
      client.tenantId = message.tenantId;
      client.userId = message.userId;
      client.ws.send(JSON.stringify({ type: 'authenticated', userId: client.userId }));
      break;

    case 'subscribe':
      client.subscriptions.add(message.topic);
      client.ws.send(JSON.stringify({ type: 'subscribed', topic: message.topic }));
      break;

    case 'unsubscribe':
      client.subscriptions.delete(message.topic);
      client.ws.send(JSON.stringify({ type: 'unsubscribed', topic: message.topic }));
      break;

    case 'ping':
      client.ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      break;

    default:
      client.ws.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${message.type}` }));
  }
}

export function broadcast(topic: string, data: unknown) {
  for (const client of clients.values()) {
    if (client.subscriptions.has(topic) && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify({ type: 'event', topic, data }));
    }
  }
}

export function sendToClient(clientId: string, data: unknown) {
  const client = clients.get(clientId);
  if (client && client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify(data));
  }
}

export function getClients() {
  return Array.from(clients.values()).map(({ ws, ...rest }) => rest);
}

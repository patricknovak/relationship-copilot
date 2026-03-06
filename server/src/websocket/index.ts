import { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { config } from '../config';

interface AuthenticatedWS extends WebSocket {
  userId?: string;
  userType?: string;
  isAlive?: boolean;
}

// Track connected clients
const humanClients = new Map<string, AuthenticatedWS>(); // userId -> ws
const agentClients = new Map<string, AuthenticatedWS>(); // agentId -> ws
const roomSubscriptions = new Map<string, Set<string>>(); // roomId -> Set<userId>

export function setupWebSocket(server: HTTPServer) {
  // Human WebSocket endpoint
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);

    if (url.pathname === '/ws') {
      // Human auth via JWT in query param
      const token = url.searchParams.get('token');
      if (!token) {
        socket.destroy();
        return;
      }

      try {
        const payload = jwt.verify(token, config.jwt.secret) as { userId: string; userType: string };
        wss.handleUpgrade(request, socket, head, (ws) => {
          const authWs = ws as AuthenticatedWS;
          authWs.userId = payload.userId;
          authWs.userType = 'human';
          authWs.isAlive = true;
          wss.emit('connection', authWs, request);
        });
      } catch {
        socket.destroy();
      }
    } else if (url.pathname === '/ws/agent') {
      // Agent auth via API key in query param
      const apiKey = url.searchParams.get('api_key');
      if (!apiKey) {
        socket.destroy();
        return;
      }

      // TODO: Validate API key against agent_profiles table
      // For now, accept and tag as agent
      wss.handleUpgrade(request, socket, head, (ws) => {
        const authWs = ws as AuthenticatedWS;
        authWs.userType = 'agent';
        authWs.isAlive = true;
        wss.emit('connection', authWs, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws: AuthenticatedWS) => {
    const userId = ws.userId;

    if (userId) {
      if (ws.userType === 'agent') {
        agentClients.set(userId, ws);
      } else {
        humanClients.set(userId, ws);
      }
    }

    // Broadcast presence
    broadcastToAll({
      type: 'presence:online',
      payload: { userId, userType: ws.userType },
    });

    ws.on('message', (data) => {
      try {
        const event = JSON.parse(data.toString());
        handleWSEvent(ws, event);
      } catch {
        // Ignore invalid messages
      }
    });

    ws.on('close', () => {
      if (userId) {
        humanClients.delete(userId);
        agentClients.delete(userId);
      }

      broadcastToAll({
        type: 'presence:offline',
        payload: { userId, userType: ws.userType },
      });
    });

    ws.on('pong', () => {
      ws.isAlive = true;
    });
  });

  // Heartbeat to detect broken connections
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const authWs = ws as AuthenticatedWS;
      if (authWs.isAlive === false) {
        return authWs.terminate();
      }
      authWs.isAlive = false;
      authWs.ping();
    });
  }, 30000);

  wss.on('close', () => clearInterval(interval));

  return wss;
}

function handleWSEvent(ws: AuthenticatedWS, event: { type: string; payload: Record<string, unknown> }) {
  switch (event.type) {
    case 'typing:start':
    case 'typing:stop':
      // Forward to the other person in the relationship
      if (event.payload.relationshipId) {
        sendToRoom(event.payload.relationshipId as string, event, ws.userId);
      }
      break;
    case 'message:read':
      if (event.payload.relationshipId) {
        sendToRoom(event.payload.relationshipId as string, event, ws.userId);
      }
      break;
    case 'subscribe:room':
      if (event.payload.relationshipId && ws.userId) {
        subscribeToRoom(event.payload.relationshipId as string, ws.userId);
        ws.send(JSON.stringify({
          type: 'subscribed:room',
          payload: { relationshipId: event.payload.relationshipId },
        }));
      }
      break;
    case 'unsubscribe:room':
      if (event.payload.relationshipId && ws.userId) {
        const members = roomSubscriptions.get(event.payload.relationshipId as string);
        if (members) {
          members.delete(ws.userId);
          if (members.size === 0) {
            roomSubscriptions.delete(event.payload.relationshipId as string);
          }
        }
      }
      break;
  }
}

function sendToRoom(roomId: string, event: unknown, excludeUserId?: string) {
  const members = roomSubscriptions.get(roomId);
  if (!members) return;

  for (const userId of members) {
    if (userId === excludeUserId) continue;

    const client = humanClients.get(userId) || agentClients.get(userId);
    if (client?.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(event));
    }
  }
}

function broadcastToAll(event: unknown) {
  const message = JSON.stringify(event);
  for (const client of humanClients.values()) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

// Export for use by routes when sending messages
export function sendToUser(userId: string, event: unknown) {
  const client = humanClients.get(userId) || agentClients.get(userId);
  if (client?.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(event));
  }
}

export function subscribeToRoom(roomId: string, userId: string) {
  if (!roomSubscriptions.has(roomId)) {
    roomSubscriptions.set(roomId, new Set());
  }
  roomSubscriptions.get(roomId)!.add(userId);
}

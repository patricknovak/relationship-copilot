import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import http from 'http';
import { config } from './config';
import { errorHandler } from './middleware/error';
import { createRateLimiter } from './middleware/rateLimit';
import { requestLogger } from './middleware/logger';
import { setupWebSocket } from './websocket';

// Route imports
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import relationshipRoutes from './routes/relationships';
import messageRoutes from './routes/messages';
import agentRoutes from './routes/agents';
import agentApiRoutes from './routes/agentApi';
import healthRoutes from './routes/health';
import gamificationRoutes from './routes/gamification';
import zodiacRoutes from './routes/zodiac';
import discoverRoutes from './routes/discover';
import goalsRoutes from './routes/goals';
import patternsRoutes from './routes/patterns';
import milestonesRoutes from './routes/milestones';
import wikiRoutes from './routes/wiki';
import coachingRoutes from './routes/coaching';
import lifeStagesRoutes from './routes/lifeStages';
import notificationsRoutes from './routes/notifications';
import exitRoutes from './routes/exit';
import insightsRoutes from './routes/insights';
import checkInsRoutes from './routes/checkIns';
import agentCollaborationRoutes from './routes/agentCollaboration';
import privacyRoutes from './routes/privacy';

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Rate limiting
const globalLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 100 });
const authLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 5 });
app.use('/api', globalLimiter);

// API routes (human-facing)
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/relationships', relationshipRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/zodiac', zodiacRoutes);
app.use('/api/discover', discoverRoutes);
app.use('/api/goals', goalsRoutes);
app.use('/api/patterns', patternsRoutes);
app.use('/api/milestones', milestonesRoutes);
app.use('/api/wiki', wikiRoutes);
app.use('/api/coaching', coachingRoutes);
app.use('/api/life-stages', lifeStagesRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/exit', exitRoutes);
app.use('/api/insights', insightsRoutes);
app.use('/api/check-ins', checkInsRoutes);
app.use('/api/privacy', privacyRoutes);

// Agent-facing API
app.use('/api/agent', agentApiRoutes);
app.use('/api/agent', agentCollaborationRoutes);

// Health check
app.get('/api/ping', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler (must be last)
app.use(errorHandler);

// Create HTTP server and attach WebSocket
const server = http.createServer(app);
setupWebSocket(server);

server.listen(config.port, () => {
  console.log(`Relationship Copilot server running on port ${config.port}`);
  console.log(`WebSocket available at ws://localhost:${config.port}/ws`);
  console.log(`Agent WebSocket at ws://localhost:${config.port}/ws/agent`);
});

export default app;

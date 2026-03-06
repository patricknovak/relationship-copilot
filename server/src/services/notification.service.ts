import { query } from '../db';
import { sendToUser } from '../websocket';

/**
 * Creates a notification in the database and pushes it to the user via WebSocket.
 */
export async function sendNotification(
  userId: string,
  type: string,
  title: string,
  body: string,
  data: Record<string, unknown> = {}
) {
  const { rows } = await query(
    `INSERT INTO notifications (user_id, type, title, body, data)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, type, title, body, JSON.stringify(data)]
  );

  const notification = rows[0];

  // Push to connected WebSocket client
  sendToUser(userId, {
    type: 'notification:new',
    payload: notification,
  });

  return notification;
}

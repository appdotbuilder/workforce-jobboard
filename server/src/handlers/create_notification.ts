import { db } from '../db';
import { notificationsTable } from '../db/schema';
import { type Notification } from '../schema';
import { eq, desc, and } from 'drizzle-orm';

export async function createNotification(
  userId: number,
  type: string,
  title: string,
  message: string,
  relatedJobId?: number,
  relatedApplicationId?: number
): Promise<Notification> {
  try {
    const result = await db.insert(notificationsTable)
      .values({
        user_id: userId,
        type: type as any, // Cast to enum type
        title,
        message,
        related_job_id: relatedJobId || null,
        related_application_id: relatedApplicationId || null,
        read: false,
        sent_at: new Date(),
        read_at: null
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Notification creation failed:', error);
    throw error;
  }
}

export async function getNotificationsByUser(userId: number): Promise<Notification[]> {
  try {
    const results = await db.select()
      .from(notificationsTable)
      .where(eq(notificationsTable.user_id, userId))
      .orderBy(desc(notificationsTable.sent_at))
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to fetch notifications:', error);
    throw error;
  }
}

export async function markNotificationAsRead(notificationId: number): Promise<Notification | null> {
  try {
    const result = await db.update(notificationsTable)
      .set({
        read: true,
        read_at: new Date()
      })
      .where(eq(notificationsTable.id, notificationId))
      .returning()
      .execute();

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
    throw error;
  }
}

export async function markAllNotificationsAsRead(userId: number): Promise<void> {
  try {
    await db.update(notificationsTable)
      .set({
        read: true,
        read_at: new Date()
      })
      .where(
        and(
          eq(notificationsTable.user_id, userId),
          eq(notificationsTable.read, false)
        )
      )
      .execute();
  } catch (error) {
    console.error('Failed to mark all notifications as read:', error);
    throw error;
  }
}
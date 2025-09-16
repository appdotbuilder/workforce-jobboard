import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { notificationsTable, usersTable, jobRequisitionsTable, organizationsTable, jobApplicationsTable } from '../db/schema';
import { 
  createNotification, 
  getNotificationsByUser, 
  markNotificationAsRead, 
  markAllNotificationsAsRead 
} from '../handlers/create_notification';
import { eq, and } from 'drizzle-orm';

describe('Notification handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUserId: number;
  let testJobId: number;

  beforeEach(async () => {
    // Create test organization first
    const orgResult = await db.insert(organizationsTable)
      .values({
        name: 'Test Organization',
        slug: 'test-org',
        type: 'startup'
      })
      .returning()
      .execute();

    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe'
      })
      .returning()
      .execute();

    testUserId = userResult[0].id;

    // Create test job
    const jobResult = await db.insert(jobRequisitionsTable)
      .values({
        organization_id: orgResult[0].id,
        title: 'Test Job',
        description: 'A test job description',
        requirements: 'Test requirements',
        responsibilities: 'Test responsibilities',
        location: 'Remote',
        remote_allowed: true,
        employment_type: 'full-time',
        salary_currency: 'USD',
        visibility_level: 'public',
        allowed_application_paths: ['direct'],
        status: 'active',
        created_by: testUserId
      })
      .returning()
      .execute();

    testJobId = jobResult[0].id;
  });

  describe('createNotification', () => {
    it('should create a basic notification', async () => {
      const result = await createNotification(
        testUserId,
        'new_job_alert',
        'New Job Available',
        'A new job matching your criteria is available'
      );

      expect(result.id).toBeDefined();
      expect(result.user_id).toEqual(testUserId);
      expect(result.type).toEqual('new_job_alert');
      expect(result.title).toEqual('New Job Available');
      expect(result.message).toEqual('A new job matching your criteria is available');
      expect(result.related_job_id).toBeNull();
      expect(result.related_application_id).toBeNull();
      expect(result.read).toBe(false);
      expect(result.sent_at).toBeInstanceOf(Date);
      expect(result.read_at).toBeNull();
    });

    it('should create notification with related job ID', async () => {
      const result = await createNotification(
        testUserId,
        'job_match',
        'Job Match Found',
        'We found a job that matches your profile',
        testJobId
      );

      expect(result.related_job_id).toEqual(testJobId);
      expect(result.related_application_id).toBeNull();
      expect(result.type).toEqual('job_match');
    });

    it('should create notification with related application ID', async () => {
      // First create an application
      const appResult = await db.insert(jobApplicationsTable)
        .values({
          job_id: testJobId,
          user_id: testUserId,
          application_path: 'direct',
          consent_given: true,
          eligibility_score: '75.5',
          readiness_score: '80.0',
          skills_match_percentage: '85.0'
        })
        .returning()
        .execute();

      const result = await createNotification(
        testUserId,
        'application_update',
        'Application Status Update',
        'Your application status has been updated',
        undefined,
        appResult[0].id
      );

      expect(result.related_application_id).toEqual(appResult[0].id);
      expect(result.related_job_id).toBeNull();
      expect(result.type).toEqual('application_update');
    });

    it('should save notification to database', async () => {
      const result = await createNotification(
        testUserId,
        'new_job_alert',
        'Test Notification',
        'Test message'
      );

      const notifications = await db.select()
        .from(notificationsTable)
        .where(eq(notificationsTable.id, result.id))
        .execute();

      expect(notifications).toHaveLength(1);
      expect(notifications[0].user_id).toEqual(testUserId);
      expect(notifications[0].title).toEqual('Test Notification');
      expect(notifications[0].read).toBe(false);
    });

    it('should handle all notification types', async () => {
      const types = ['new_job_alert', 'application_update', 'job_match', 'application_deadline'] as const;

      for (const type of types) {
        const result = await createNotification(
          testUserId,
          type,
          `${type} title`,
          `${type} message`
        );

        expect(result.type).toEqual(type);
        expect(result.user_id).toEqual(testUserId);
      }
    });
  });

  describe('getNotificationsByUser', () => {
    it('should return empty array for user with no notifications', async () => {
      const notifications = await getNotificationsByUser(testUserId);
      expect(notifications).toEqual([]);
    });

    it('should return user notifications sorted by date descending', async () => {
      // Create multiple notifications with slight delays
      const notification1 = await createNotification(
        testUserId,
        'new_job_alert',
        'First Notification',
        'First message'
      );

      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      const notification2 = await createNotification(
        testUserId,
        'job_match',
        'Second Notification',
        'Second message'
      );

      await new Promise(resolve => setTimeout(resolve, 10));

      const notification3 = await createNotification(
        testUserId,
        'application_update',
        'Third Notification',
        'Third message'
      );

      const notifications = await getNotificationsByUser(testUserId);

      expect(notifications).toHaveLength(3);
      // Should be ordered by sent_at descending (newest first)
      expect(notifications[0].id).toEqual(notification3.id);
      expect(notifications[1].id).toEqual(notification2.id);
      expect(notifications[2].id).toEqual(notification1.id);
    });

    it('should only return notifications for specified user', async () => {
      // Create another user
      const otherUser = await db.insert(usersTable)
        .values({
          email: 'other@example.com',
          first_name: 'Jane',
          last_name: 'Smith'
        })
        .returning()
        .execute();

      // Create notifications for both users
      await createNotification(testUserId, 'new_job_alert', 'User 1 Notification', 'Message for user 1');
      await createNotification(otherUser[0].id, 'job_match', 'User 2 Notification', 'Message for user 2');

      const user1Notifications = await getNotificationsByUser(testUserId);
      const user2Notifications = await getNotificationsByUser(otherUser[0].id);

      expect(user1Notifications).toHaveLength(1);
      expect(user1Notifications[0].title).toEqual('User 1 Notification');

      expect(user2Notifications).toHaveLength(1);
      expect(user2Notifications[0].title).toEqual('User 2 Notification');
    });

    it('should return both read and unread notifications', async () => {
      // Create notification
      const notification = await createNotification(
        testUserId,
        'new_job_alert',
        'Test Notification',
        'Test message'
      );

      // Mark as read
      await markNotificationAsRead(notification.id);

      // Create another unread notification
      await createNotification(
        testUserId,
        'job_match',
        'Unread Notification',
        'Unread message'
      );

      const notifications = await getNotificationsByUser(testUserId);

      expect(notifications).toHaveLength(2);
      // Should include both read and unread
      const readNotifications = notifications.filter(n => n.read);
      const unreadNotifications = notifications.filter(n => !n.read);
      expect(readNotifications).toHaveLength(1);
      expect(unreadNotifications).toHaveLength(1);
    });
  });

  describe('markNotificationAsRead', () => {
    it('should mark notification as read and set read_at timestamp', async () => {
      const notification = await createNotification(
        testUserId,
        'new_job_alert',
        'Test Notification',
        'Test message'
      );

      expect(notification.read).toBe(false);
      expect(notification.read_at).toBeNull();

      const updatedNotification = await markNotificationAsRead(notification.id);

      expect(updatedNotification).not.toBeNull();
      expect(updatedNotification!.read).toBe(true);
      expect(updatedNotification!.read_at).toBeInstanceOf(Date);
      expect(updatedNotification!.id).toEqual(notification.id);
    });

    it('should return null for non-existent notification', async () => {
      const result = await markNotificationAsRead(99999);
      expect(result).toBeNull();
    });

    it('should update notification in database', async () => {
      const notification = await createNotification(
        testUserId,
        'new_job_alert',
        'Test Notification',
        'Test message'
      );

      await markNotificationAsRead(notification.id);

      const dbNotification = await db.select()
        .from(notificationsTable)
        .where(eq(notificationsTable.id, notification.id))
        .execute();

      expect(dbNotification[0].read).toBe(true);
      expect(dbNotification[0].read_at).toBeInstanceOf(Date);
    });

    it('should handle already read notification', async () => {
      const notification = await createNotification(
        testUserId,
        'new_job_alert',
        'Test Notification',
        'Test message'
      );

      // Mark as read twice
      const firstRead = await markNotificationAsRead(notification.id);
      const secondRead = await markNotificationAsRead(notification.id);

      expect(firstRead).not.toBeNull();
      expect(secondRead).not.toBeNull();
      expect(firstRead!.read).toBe(true);
      expect(secondRead!.read).toBe(true);
    });
  });

  describe('markAllNotificationsAsRead', () => {
    it('should mark all unread notifications as read for user', async () => {
      // Create multiple unread notifications
      const notification1 = await createNotification(
        testUserId,
        'new_job_alert',
        'Notification 1',
        'Message 1'
      );

      const notification2 = await createNotification(
        testUserId,
        'job_match',
        'Notification 2',
        'Message 2'
      );

      const notification3 = await createNotification(
        testUserId,
        'application_update',
        'Notification 3',
        'Message 3'
      );

      // Mark first one as read manually
      await markNotificationAsRead(notification1.id);

      // Now mark all as read
      await markAllNotificationsAsRead(testUserId);

      // Verify all are marked as read
      const notifications = await getNotificationsByUser(testUserId);
      expect(notifications).toHaveLength(3);
      notifications.forEach(notification => {
        expect(notification.read).toBe(true);
        expect(notification.read_at).toBeInstanceOf(Date);
      });
    });

    it('should only affect specified user notifications', async () => {
      // Create another user
      const otherUser = await db.insert(usersTable)
        .values({
          email: 'other@example.com',
          first_name: 'Jane',
          last_name: 'Smith'
        })
        .returning()
        .execute();

      // Create notifications for both users
      await createNotification(testUserId, 'new_job_alert', 'User 1 Notification', 'Message 1');
      const otherNotification = await createNotification(
        otherUser[0].id,
        'job_match',
        'User 2 Notification',
        'Message 2'
      );

      // Mark all notifications as read for first user only
      await markAllNotificationsAsRead(testUserId);

      // Check first user's notifications are read
      const user1Notifications = await getNotificationsByUser(testUserId);
      expect(user1Notifications[0].read).toBe(true);

      // Check second user's notifications remain unread
      const user2Notifications = await getNotificationsByUser(otherUser[0].id);
      expect(user2Notifications[0].read).toBe(false);
    });

    it('should handle user with no notifications', async () => {
      // Should not throw error even if user has no notifications
      await expect(markAllNotificationsAsRead(testUserId)).resolves.toBeUndefined();
    });

    it('should handle user with all notifications already read', async () => {
      // Create and mark notification as read
      const notification = await createNotification(
        testUserId,
        'new_job_alert',
        'Test Notification',
        'Test message'
      );

      await markNotificationAsRead(notification.id);

      // Mark all as read again - should not cause issues
      await expect(markAllNotificationsAsRead(testUserId)).resolves.toBeUndefined();

      // Verify notification is still read
      const notifications = await getNotificationsByUser(testUserId);
      expect(notifications[0].read).toBe(true);
    });

    it('should update database correctly', async () => {
      // Create multiple unread notifications
      await createNotification(testUserId, 'new_job_alert', 'Notification 1', 'Message 1');
      await createNotification(testUserId, 'job_match', 'Notification 2', 'Message 2');

      await markAllNotificationsAsRead(testUserId);

      // Verify in database directly
      const unreadNotifications = await db.select()
        .from(notificationsTable)
        .where(
          and(
            eq(notificationsTable.user_id, testUserId),
            eq(notificationsTable.read, false)
          )
        )
        .execute();

      expect(unreadNotifications).toHaveLength(0);

      const allNotifications = await db.select()
        .from(notificationsTable)
        .where(eq(notificationsTable.user_id, testUserId))
        .execute();

      expect(allNotifications).toHaveLength(2);
      allNotifications.forEach(notification => {
        expect(notification.read).toBe(true);
        expect(notification.read_at).toBeInstanceOf(Date);
      });
    });
  });
});
import { Notification } from '../types';

const API_BASE = '/api/notifications';

/**
 * Notification Service
 *
 * Provides methods to interact with the notifications API
 */

export interface NotificationListResponse {
  success: boolean;
  notifications: Notification[];
  unreadCount: number;
  error?: string;
}

export interface NotificationCountResponse {
  success: boolean;
  unreadCount: number;
  error?: string;
}

export interface NotificationCreateResponse {
  success: boolean;
  notification?: Notification;
  error?: string;
}

export interface NotificationActionResponse {
  success: boolean;
  message?: string;
  count?: number;
  error?: string;
}

/**
 * Fetch notifications for a user
 */
export async function getNotifications(
  userId: string,
  userType: 'parent' | 'admin',
  options?: {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
  }
): Promise<NotificationListResponse> {
  try {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'list',
        userId,
        userType,
        limit: options?.limit || 50,
        offset: options?.offset || 0,
        unreadOnly: options?.unreadOnly || false,
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return {
      success: false,
      notifications: [],
      unreadCount: 0,
      error: error instanceof Error ? error.message : 'Failed to fetch notifications',
    };
  }
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(
  userId: string,
  userType: 'parent' | 'admin'
): Promise<NotificationCountResponse> {
  try {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'count',
        userId,
        userType,
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching notification count:', error);
    return {
      success: false,
      unreadCount: 0,
      error: error instanceof Error ? error.message : 'Failed to fetch count',
    };
  }
}

/**
 * Create a new notification
 */
export async function createNotification(params: {
  userId: string;
  userType: 'parent' | 'admin';
  type: string;
  title: string;
  message: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  data?: Record<string, any>;
  actionUrl?: string;
  expiresAt?: string;
}): Promise<NotificationCreateResponse> {
  try {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'create',
        ...params,
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating notification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create notification',
    };
  }
}

/**
 * Mark a single notification as read
 */
export async function markAsRead(
  userId: string,
  userType: 'parent' | 'admin',
  notificationId: string
): Promise<NotificationActionResponse> {
  try {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'mark_read',
        userId,
        userType,
        notificationId,
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to mark as read',
    };
  }
}

/**
 * Mark all notifications as read
 */
export async function markAllAsRead(
  userId: string,
  userType: 'parent' | 'admin',
  notificationIds?: string[]
): Promise<NotificationActionResponse> {
  try {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'mark_all_read',
        userId,
        userType,
        notificationIds,
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error marking all as read:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to mark all as read',
    };
  }
}

/**
 * Delete a notification
 */
export async function deleteNotification(
  userId: string,
  userType: 'parent' | 'admin',
  notificationId: string
): Promise<NotificationActionResponse> {
  try {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'delete',
        userId,
        userType,
        notificationId,
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting notification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete notification',
    };
  }
}

/**
 * Get notification icon based on type
 */
export function getNotificationIcon(type: string): string {
  switch (type) {
    case 'pairing_created':
      return 'users';
    case 'pairing_dissolved':
      return 'user-minus';
    case 'schedule_changed':
      return 'calendar';
    case 'payment_confirmed':
    case 'payment_received':
      return 'credit-card';
    case 'sunday_booking':
    case 'sunday_reminder':
      return 'calendar-check';
    case 'waitlist_update':
      return 'clock';
    case 'admin_message':
      return 'message-circle';
    case 'system':
    default:
      return 'bell';
  }
}

/**
 * Get priority color class
 */
export function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'urgent':
      return 'text-red-500 bg-red-500/10';
    case 'high':
      return 'text-orange-500 bg-orange-500/10';
    case 'normal':
      return 'text-[#9BD4FF] bg-[#9BD4FF]/10';
    case 'low':
    default:
      return 'text-gray-400 bg-gray-400/10';
  }
}

/**
 * Format notification timestamp
 */
export function formatNotificationTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return 'Just now';
  } else if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }
}

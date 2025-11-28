import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Notifications API
 *
 * Handles all notification operations:
 * - GET: Fetch notifications for a user
 * - POST (action: create): Create a new notification
 * - POST (action: mark_read): Mark notification(s) as read
 * - POST (action: mark_all_read): Mark all notifications as read
 * - DELETE: Delete a notification
 */

interface NotificationRequest {
  action?: 'list' | 'create' | 'mark_read' | 'mark_all_read' | 'delete' | 'count';
  userId: string;
  userType: 'parent' | 'admin';
  notificationId?: string;
  notificationIds?: string[];
  // For creating notifications
  type?: string;
  title?: string;
  message?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  data?: Record<string, any>;
  actionUrl?: string;
  expiresAt?: string;
  // For listing
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle GET requests for listing
  if (req.method === 'GET') {
    const { userId, userType, limit = 50, offset = 0, unreadOnly } = req.query;

    if (!userId || !userType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: userId, userType'
      });
    }

    try {
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId as string)
        .eq('user_type', userType as string)
        .or('expires_at.is.null,expires_at.gt.now()')
        .order('created_at', { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      if (unreadOnly === 'true') {
        query = query.eq('read', false);
      }

      const { data: notifications, error } = await query;

      if (error) {
        console.error('Error fetching notifications:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch notifications'
        });
      }

      // Get unread count
      const { count: unreadCount } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId as string)
        .eq('user_type', userType as string)
        .eq('read', false)
        .or('expires_at.is.null,expires_at.gt.now()');

      return res.status(200).json({
        success: true,
        notifications,
        unreadCount: unreadCount || 0
      });
    } catch (error) {
      console.error('Error in notifications GET:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Handle POST requests
  if (req.method === 'POST') {
    const {
      action,
      userId,
      userType,
      notificationId,
      notificationIds,
      type,
      title,
      message,
      priority = 'normal',
      data,
      actionUrl,
      expiresAt,
      limit = 50,
      offset = 0,
      unreadOnly
    } = req.body as NotificationRequest;

    if (!userId || !userType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: userId, userType'
      });
    }

    try {
      // List notifications
      if (action === 'list') {
        let query = supabase
          .from('notifications')
          .select('*')
          .eq('user_id', userId)
          .eq('user_type', userType)
          .or('expires_at.is.null,expires_at.gt.now()')
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (unreadOnly) {
          query = query.eq('read', false);
        }

        const { data: notifications, error } = await query;

        if (error) throw error;

        // Get unread count
        const { count: unreadCount } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('user_type', userType)
          .eq('read', false)
          .or('expires_at.is.null,expires_at.gt.now()');

        return res.status(200).json({
          success: true,
          notifications,
          unreadCount: unreadCount || 0
        });
      }

      // Get unread count only
      if (action === 'count') {
        const { count: unreadCount } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('user_type', userType)
          .eq('read', false)
          .or('expires_at.is.null,expires_at.gt.now()');

        return res.status(200).json({
          success: true,
          unreadCount: unreadCount || 0
        });
      }

      // Create notification
      if (action === 'create') {
        if (!type || !title || !message) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields: type, title, message'
          });
        }

        const { data: notification, error } = await supabase
          .from('notifications')
          .insert({
            user_id: userId,
            user_type: userType,
            type,
            title,
            message,
            priority,
            data: data || null,
            action_url: actionUrl || null,
            expires_at: expiresAt || null
          })
          .select()
          .single();

        if (error) throw error;

        return res.status(201).json({
          success: true,
          notification
        });
      }

      // Mark single notification as read
      if (action === 'mark_read') {
        if (!notificationId) {
          return res.status(400).json({
            success: false,
            error: 'Missing notificationId'
          });
        }

        const { error } = await supabase
          .from('notifications')
          .update({
            read: true,
            read_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', notificationId)
          .eq('user_id', userId);

        if (error) throw error;

        return res.status(200).json({
          success: true,
          message: 'Notification marked as read'
        });
      }

      // Mark multiple or all notifications as read
      if (action === 'mark_all_read') {
        let query = supabase
          .from('notifications')
          .update({
            read: true,
            read_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .eq('user_type', userType)
          .eq('read', false);

        // If specific IDs provided, only mark those
        if (notificationIds && notificationIds.length > 0) {
          query = query.in('id', notificationIds);
        }

        const { error, count } = await query;

        if (error) throw error;

        return res.status(200).json({
          success: true,
          message: 'Notifications marked as read',
          count
        });
      }

      // Delete notification
      if (action === 'delete') {
        if (!notificationId) {
          return res.status(400).json({
            success: false,
            error: 'Missing notificationId'
          });
        }

        const { error } = await supabase
          .from('notifications')
          .delete()
          .eq('id', notificationId)
          .eq('user_id', userId);

        if (error) throw error;

        return res.status(200).json({
          success: true,
          message: 'Notification deleted'
        });
      }

      return res.status(400).json({
        success: false,
        error: 'Invalid action'
      });
    } catch (error) {
      console.error('Error in notifications POST:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

/**
 * Helper function to create notifications from other API endpoints
 * Use this in other API files to create notifications when events happen
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
}) {
  const supabaseClient = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabaseClient
    .from('notifications')
    .insert({
      user_id: params.userId,
      user_type: params.userType,
      type: params.type,
      title: params.title,
      message: params.message,
      priority: params.priority || 'normal',
      data: params.data || null,
      action_url: params.actionUrl || null,
      expires_at: params.expiresAt || null
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating notification:', error);
    throw error;
  }

  return data;
}

/**
 * Helper function to notify all admins
 */
export async function notifyAllAdmins(params: {
  type: string;
  title: string;
  message: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  data?: Record<string, any>;
  actionUrl?: string;
}) {
  return createNotification({
    userId: 'admin',
    userType: 'admin',
    ...params
  });
}

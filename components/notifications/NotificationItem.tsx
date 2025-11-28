import React, { useState } from 'react';
import {
  Bell,
  Calendar,
  CreditCard,
  Clock,
  Users,
  UserMinus,
  MessageCircle,
  CalendarCheck,
  Trash2,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Notification } from '@/types';
import {
  markAsRead,
  deleteNotification,
  formatNotificationTime,
  getPriorityColor
} from '@/lib/notificationService';

interface NotificationItemProps {
  notification: Notification;
  userId: string;
  userType: 'parent' | 'admin';
  onRead: (notificationId: string) => void;
  onDelete: (notificationId: string) => void;
}

/**
 * Get icon component based on notification type
 */
const getNotificationIcon = (type: string) => {
  const iconClass = 'h-4 w-4';

  switch (type) {
    case 'pairing_created':
      return <Users className={iconClass} />;
    case 'pairing_dissolved':
      return <UserMinus className={iconClass} />;
    case 'schedule_changed':
      return <Calendar className={iconClass} />;
    case 'payment_confirmed':
    case 'payment_received':
      return <CreditCard className={iconClass} />;
    case 'sunday_booking':
    case 'sunday_reminder':
      return <CalendarCheck className={iconClass} />;
    case 'waitlist_update':
      return <Clock className={iconClass} />;
    case 'admin_message':
      return <MessageCircle className={iconClass} />;
    case 'system':
    default:
      return <Bell className={iconClass} />;
  }
};

/**
 * Notification Item Component
 *
 * Displays a single notification with icon, content, and actions.
 */
const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  userId,
  userType,
  onRead,
  onDelete
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleClick = async () => {
    if (!notification.read) {
      try {
        await markAsRead(userId, userType, notification.id);
        onRead(notification.id);
      } catch (error) {
        console.error('Error marking as read:', error);
      }
    }

    // Navigate to action URL if present
    if (notification.action_url) {
      window.location.href = notification.action_url;
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeleting(true);

    try {
      const response = await deleteNotification(userId, userType, notification.id);
      if (response.success) {
        onDelete(notification.id);
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const priorityClasses = getPriorityColor(notification.priority);

  return (
    <div
      onClick={handleClick}
      className={`
        px-4 py-3 cursor-pointer transition-colors group
        ${notification.read ? 'bg-transparent' : 'bg-[#9BD4FF]/5'}
        hover:bg-white/5
      `}
    >
      <div className="flex gap-3">
        {/* Icon */}
        <div className={`
          flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
          ${priorityClasses}
        `}>
          {getNotificationIcon(notification.type)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className={`
              text-sm font-medium truncate
              ${notification.read ? 'text-gray-300' : 'text-white'}
            `}>
              {notification.title}
            </h4>
            <span className="text-xs text-gray-500 whitespace-nowrap">
              {formatNotificationTime(notification.created_at)}
            </span>
          </div>

          <p className={`
            text-xs mt-0.5 line-clamp-2
            ${notification.read ? 'text-gray-500' : 'text-gray-400'}
          `}>
            {notification.message}
          </p>

          {/* Action row */}
          <div className="flex items-center justify-between mt-2">
            {/* Priority badge */}
            {notification.priority !== 'normal' && (
              <span className={`
                text-[10px] px-1.5 py-0.5 rounded-full font-semibold uppercase
                ${notification.priority === 'urgent' ? 'bg-red-500/20 text-red-400' : ''}
                ${notification.priority === 'high' ? 'bg-orange-500/20 text-orange-400' : ''}
                ${notification.priority === 'low' ? 'bg-gray-500/20 text-gray-400' : ''}
              `}>
                {notification.priority}
              </span>
            )}

            {/* Actions */}
            <div className="flex items-center gap-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
              {notification.action_url && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-gray-400 hover:text-[#9BD4FF] hover:bg-[#9BD4FF]/10"
                  title="Open"
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDelete}
                disabled={isDeleting}
                className="h-6 w-6 text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                title="Delete"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Unread indicator */}
          {!notification.read && (
            <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#9BD4FF]" />
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationItem;

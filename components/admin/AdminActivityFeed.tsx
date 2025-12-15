import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  Activity,
  CreditCard,
  Calendar,
  Users,
  Bell,
  RefreshCw,
  Coins,
  UserPlus,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ActivityEvent {
  id: string;
  type: string;
  table: string;
  data: Record<string, any>;
  timestamp: Date;
}

interface AdminActivityFeedProps {
  isAuthenticated: boolean;
  maxEvents?: number;
  showToasts?: boolean;
}

const eventIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  session_booking_changed: Calendar,
  parent_credits_changed: Coins,
  credit_purchases_changed: CreditCard,
  credit_adjustments_changed: RefreshCw,
  recurring_schedules_changed: RefreshCw,
  notifications_changed: Bell,
  registrations_changed: UserPlus,
};

const eventColors: Record<string, string> = {
  session_booking_changed: 'text-blue-500 bg-blue-500/10',
  parent_credits_changed: 'text-yellow-500 bg-yellow-500/10',
  credit_purchases_changed: 'text-green-500 bg-green-500/10',
  credit_adjustments_changed: 'text-purple-500 bg-purple-500/10',
  recurring_schedules_changed: 'text-orange-500 bg-orange-500/10',
  notifications_changed: 'text-pink-500 bg-pink-500/10',
  registrations_changed: 'text-cyan-500 bg-cyan-500/10',
};

const formatEventMessage = (event: ActivityEvent): string => {
  const { type, data } = event;
  const op = data.new ? (data.old ? 'updated' : 'created') : 'deleted';

  switch (type) {
    case 'session_booking_changed':
      const sessionType = data.new?.session_type || data.old?.session_type || 'session';
      const sessionDate = data.new?.session_date || data.old?.session_date || '';
      return `Booking ${op}: ${sessionType} on ${sessionDate}`;

    case 'parent_credits_changed':
      const credits = data.new?.total_credits;
      const oldCredits = data.old?.total_credits;
      if (credits !== undefined && oldCredits !== undefined) {
        const diff = credits - oldCredits;
        return `Credits ${diff >= 0 ? '+' : ''}${diff} (now ${credits})`;
      }
      return `Credits ${op}`;

    case 'credit_purchases_changed':
      const package_type = data.new?.package_type || data.old?.package_type;
      const creditsQty = data.new?.credits_purchased || data.old?.credits_purchased;
      return `Purchase: ${creditsQty} credits (${package_type})`;

    case 'credit_adjustments_changed':
      const adjustment = data.new?.adjustment;
      const reason = data.new?.reason || 'manual adjustment';
      return `Admin adjustment: ${adjustment >= 0 ? '+' : ''}${adjustment} - ${reason}`;

    case 'recurring_schedules_changed':
      const day = data.new?.day_of_week || data.old?.day_of_week;
      const isActive = data.new?.is_active;
      return `Recurring ${isActive ? 'activated' : 'paused'} for ${day}`;

    case 'notifications_changed':
      const title = data.new?.title || 'Notification';
      return `Notification: ${title}`;

    case 'registrations_changed':
      const playerName = data.new?.form_data?.childFirstName || data.new?.form_data?.firstName || 'Player';
      return `Registration ${op}: ${playerName}`;

    default:
      return `${type.replace('_changed', '')} ${op}`;
  }
};

const AdminActivityFeed: React.FC<AdminActivityFeedProps> = ({
  isAuthenticated,
  maxEvents = 50,
  showToasts = true,
}) => {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Subscribe to admin:all broadcast channel
    const channel = supabase.channel('admin:all', {
      config: { private: true }
    });

    // Listen for all event types
    const eventTypes = [
      'session_booking_changed',
      'parent_credits_changed',
      'credit_purchases_changed',
      'credit_adjustments_changed',
      'recurring_schedules_changed',
      'notifications_changed',
      'registrations_changed',
    ];

    eventTypes.forEach((eventType) => {
      channel.on('broadcast', { event: eventType }, (payload) => {
        const newEvent: ActivityEvent = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: eventType,
          table: eventType.replace('_changed', ''),
          data: payload.payload || {},
          timestamp: new Date(),
        };

        setEvents((prev) => [newEvent, ...prev].slice(0, maxEvents));

        // Show toast for important events
        if (showToasts) {
          const message = formatEventMessage(newEvent);

          if (eventType === 'credit_purchases_changed') {
            toast.success(message, { position: 'top-right' });
          } else if (eventType === 'session_booking_changed') {
            toast.info(message, { position: 'top-right' });
          } else if (eventType === 'credit_adjustments_changed') {
            toast.warning(message, { position: 'top-right' });
          }
        }
      });
    });

    channel.subscribe((status) => {
      setIsConnected(status === 'SUBSCRIBED');
      if (status === 'SUBSCRIBED') {
        console.log('[AdminActivityFeed] Connected to admin:all channel');
      }
    });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
    };
  }, [isAuthenticated, maxEvents, showToasts]);

  const clearEvents = () => {
    setEvents([]);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-700/30 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Live Activity Feed</h3>
          <Badge
            variant="outline"
            className={cn(
              'text-xs',
              isConnected
                ? 'border-green-500 text-green-400'
                : 'border-gray-500 text-gray-400'
            )}
          >
            {isConnected ? 'Connected' : 'Disconnected'}
          </Badge>
          {events.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {events.length} events
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {events.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                clearEvents();
              }}
              className="text-gray-400 hover:text-white"
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </div>

      {/* Event List */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="max-h-64 overflow-y-auto border-t border-gray-700">
              {events.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No activity yet. Events will appear here in real-time.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-700/50">
                  <AnimatePresence mode="popLayout">
                    {events.map((event) => {
                      const Icon = eventIcons[event.type] || Activity;
                      const colorClass = eventColors[event.type] || 'text-gray-400 bg-gray-400/10';

                      return (
                        <motion.div
                          key={event.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          transition={{ duration: 0.2 }}
                          className="flex items-start gap-3 p-3 hover:bg-gray-700/20 transition-colors"
                        >
                          <div className={cn('p-2 rounded-lg', colorClass)}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white truncate">
                              {formatEventMessage(event)}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {formatTime(event.timestamp)}
                            </p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminActivityFeed;

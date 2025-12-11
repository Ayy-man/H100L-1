import React, { useState } from 'react';
import {
  Users,
  Plus,
  Calendar,
  RefreshCw,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import BookSessionModal from './BookSessionModal';
import type { ChildProfile } from '@/contexts/ProfileContext';

interface ChildrenSectionProps {
  children: ChildProfile[];
  onRefresh: () => Promise<void>;
}

/**
 * ChildrenSection Component
 *
 * Shows all registered children for the parent:
 * - Player name and category
 * - Quick book session button for each child
 * - Add another child button
 */
const ChildrenSection: React.FC<ChildrenSectionProps> = ({
  children,
  onRefresh,
}) => {
  const [bookingChild, setBookingChild] = useState<ChildProfile | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  };

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Get category color
  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'M9': 'bg-green-500/10 text-green-600 border-green-500/30',
      'M11': 'bg-blue-500/10 text-blue-600 border-blue-500/30',
      'M13': 'bg-purple-500/10 text-purple-600 border-purple-500/30',
      'M13 Elite': 'bg-purple-600/10 text-purple-700 border-purple-600/30',
      'M15': 'bg-orange-500/10 text-orange-600 border-orange-500/30',
      'M15 Elite': 'bg-orange-600/10 text-orange-700 border-orange-600/30',
      'M18': 'bg-red-500/10 text-red-600 border-red-500/30',
      'Junior': 'bg-indigo-500/10 text-indigo-600 border-indigo-500/30',
    };
    return colors[category] || 'bg-gray-500/10 text-gray-600 border-gray-500/30';
  };

  // Get avatar color based on name
  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-orange-500',
      'bg-pink-500',
      'bg-teal-500',
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Your Players
              </CardTitle>
              <CardDescription>
                {children.length} registered player{children.length !== 1 ? 's' : ''}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefresh}
                disabled={refreshing}
                className="h-8 w-8"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="/register">
                  <Plus className="mr-1 h-4 w-4" />
                  Add Player
                </a>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {children.map((child) => (
              <div
                key={child.registrationId}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Avatar className={`h-10 w-10 ${getAvatarColor(child.playerName)}`}>
                    <AvatarFallback className="text-white text-sm font-medium">
                      {getInitials(child.playerName)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-foreground">
                      {child.playerName}
                    </p>
                    <Badge
                      variant="outline"
                      className={`text-xs ${getCategoryColor(child.playerCategory)}`}
                    >
                      {child.playerCategory}
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setBookingChild(child)}
                  className="text-primary hover:text-primary hover:bg-primary/10"
                >
                  <Calendar className="mr-1 h-4 w-4" />
                  Book
                </Button>
              </div>
            ))}
          </div>

          {/* Empty state */}
          {children.length === 0 && (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">
                No players registered yet
              </p>
              <Button asChild className="mt-4">
                <a href="/register">Register Your First Player</a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Book Session Modal */}
      {bookingChild && (
        <BookSessionModal
          open={!!bookingChild}
          onClose={() => setBookingChild(null)}
          child={bookingChild}
        />
      )}
    </>
  );
};

export default ChildrenSection;

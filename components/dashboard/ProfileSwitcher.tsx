import React from 'react';
import { Check, ChevronDown, Plus, User } from 'lucide-react';
import { useProfile } from '@/contexts/ProfileContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/**
 * Profile Switcher Component
 *
 * Header dropdown that allows parents to switch between children profiles.
 * Visible on all parent portal pages.
 *
 * Features:
 * - Shows currently selected child
 * - Lists all children with checkmark on selected
 * - "+ Add Another Child" option
 * - Payment status indicators
 */
const ProfileSwitcher: React.FC = () => {
  const { children, selectedProfile, selectedProfileId, selectProfile } = useProfile();

  const handleSwitchProfile = (profileId: string) => {
    selectProfile(profileId);
    // Reload current page with new profile
    window.location.reload();
  };

  const handleAddChild = () => {
    window.location.href = '/register?mode=add-child';
  };

  const handleManageProfiles = () => {
    window.location.href = '/select-profile';
  };

  // Don't show if no children or still loading
  if (children.length === 0 || !selectedProfile) {
    return null;
  }

  // Get display text - show "PlayerName - Program" format
  const getDisplayText = () => {
    if (!selectedProfile) return 'Select Child';
    // Use profileDisplayName which has format "PlayerName - Program Type"
    return selectedProfile.profileDisplayName || selectedProfile.playerName;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="flex items-center gap-2 min-w-[200px] max-w-[280px] justify-between"
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <User className="h-3 w-3 text-primary" />
            </div>
            <span className="font-medium text-sm truncate">
              {getDisplayText()}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[280px]">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">Switch Child Profile</p>
            <p className="text-xs text-muted-foreground">
              {children.length} {children.length === 1 ? 'child' : 'children'} registered
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Children List */}
        {children.map((child) => (
          <DropdownMenuItem
            key={child.registrationId}
            onClick={() => {
              if (child.registrationId !== selectedProfileId) {
                handleSwitchProfile(child.registrationId);
              }
            }}
            className="cursor-pointer"
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2 flex-1">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{child.playerName}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-muted-foreground">{child.playerCategory}</p>
                    {child.hasActiveSubscription && (
                      <Badge
                        variant="outline"
                        className="text-[10px] py-0 px-1 h-4 bg-green-500/10 text-green-600 border-green-500/50"
                      >
                        Active
                      </Badge>
                    )}
                  </div>
                </div>
                {child.registrationId === selectedProfileId && (
                  <Check className="h-4 w-4 text-primary flex-shrink-0" />
                )}
              </div>
            </div>
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        {/* Manage Profiles */}
        <DropdownMenuItem onClick={handleManageProfiles} className="cursor-pointer">
          <User className="mr-2 h-4 w-4" />
          <span>Manage Profiles</span>
        </DropdownMenuItem>

        {/* Add Child */}
        <DropdownMenuItem onClick={handleAddChild} className="cursor-pointer">
          <Plus className="mr-2 h-4 w-4" />
          <span>Add Another Child</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ProfileSwitcher;

import React, { useState, useEffect } from 'react';
import { UserPlus, Loader2, Calendar, User } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProfile } from '@/contexts/ProfileContext';
import { toast } from 'sonner';

interface AddChildModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// Player categories based on age (must match types.ts PlayerCategory)
const PLAYER_CATEGORIES = [
  { value: 'M7', label: 'M7 (Under 7)', minAge: 0, maxAge: 6 },
  { value: 'M9', label: 'M9 (Under 9)', minAge: 7, maxAge: 8 },
  { value: 'M11', label: 'M11 (Under 11)', minAge: 9, maxAge: 10 },
  { value: 'M13', label: 'M13 (Under 13)', minAge: 11, maxAge: 12 },
  { value: 'M13 Elite', label: 'M13 Elite', minAge: 11, maxAge: 12 },
  { value: 'M15', label: 'M15 (Under 15)', minAge: 13, maxAge: 14 },
  { value: 'M15 Elite', label: 'M15 Elite', minAge: 13, maxAge: 14 },
  { value: 'M18', label: 'M18 (Under 18)', minAge: 15, maxAge: 17 },
  { value: 'Junior', label: 'Junior (18+)', minAge: 18, maxAge: 99 },
];

// Calculate category from date of birth
const calculateCategory = (dateOfBirth: string): string => {
  if (!dateOfBirth) return '';

  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  const category = PLAYER_CATEGORIES.find(
    cat => age >= cat.minAge && age <= cat.maxAge
  );

  return category?.value || 'Junior';
};

/**
 * AddChildModal Component
 *
 * Modal for adding a child to the parent's account.
 * Simplified form with just:
 * - Child's full name
 * - Date of birth (auto-calculates category)
 * - Optional: manually select category
 *
 * After adding, the child appears in the dashboard and can be booked for sessions.
 */
const AddChildModal: React.FC<AddChildModalProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const { user, refreshProfiles } = useProfile();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form fields
  const [playerName, setPlayerName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [category, setCategory] = useState('');
  const [autoCategory, setAutoCategory] = useState('');

  // Auto-calculate category when DOB changes
  useEffect(() => {
    if (dateOfBirth) {
      const calculated = calculateCategory(dateOfBirth);
      setAutoCategory(calculated);
      // Only auto-set if category hasn't been manually selected
      if (!category) {
        setCategory(calculated);
      }
    }
  }, [dateOfBirth]);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setPlayerName('');
      setDateOfBirth('');
      setCategory('');
      setAutoCategory('');
      setError('');
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate
    if (!playerName.trim()) {
      setError('Please enter the player\'s name.');
      return;
    }
    if (!dateOfBirth) {
      setError('Please enter the date of birth.');
      return;
    }
    if (!category) {
      setError('Please select a category.');
      return;
    }
    if (!user) {
      setError('You must be logged in to add a child.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/add-child', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firebase_uid: user.uid,
          player_name: playerName.trim(),
          date_of_birth: dateOfBirth,
          player_category: category,
          parent_email: user.email,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add child');
      }

      toast.success(`${playerName} has been added!`);

      // Refresh the profiles list
      await refreshProfiles();

      // Call success callback if provided
      onSuccess?.();

      // Close modal
      onClose();
    } catch (err: any) {
      console.error('Add child error:', err);
      setError(err.message || 'Failed to add child. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Add a Child
          </DialogTitle>
          <DialogDescription>
            Add your child's information to start booking training sessions.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Player Name */}
          <div className="space-y-2">
            <Label htmlFor="playerName" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Player's Full Name
            </Label>
            <Input
              id="playerName"
              type="text"
              placeholder="Enter child's full name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          {/* Date of Birth */}
          <div className="space-y-2">
            <Label htmlFor="dateOfBirth" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Date of Birth
            </Label>
            <Input
              id="dateOfBirth"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              disabled={loading}
              required
              max={new Date().toISOString().split('T')[0]}
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Player Category</Label>
            <Select
              value={category}
              onValueChange={setCategory}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {PLAYER_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {autoCategory && category === autoCategory && (
              <p className="text-xs text-muted-foreground">
                Auto-detected based on date of birth
              </p>
            )}
          </div>

          {/* Info */}
          <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
            <p>After adding your child, you can:</p>
            <ul className="list-disc list-inside mt-1 space-y-0.5">
              <li>Buy session credits (shared across all children)</li>
              <li>Book group training sessions</li>
              <li>Book Sunday ice, private, or semi-private sessions</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add Child
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddChildModal;

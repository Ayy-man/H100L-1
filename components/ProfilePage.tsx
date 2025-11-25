import React, { useEffect, useState } from 'react';
import { User as UserIcon, Edit, Save, X, Info, AlertCircle } from 'lucide-react';
import ProtectedRoute from './ProtectedRoute';
import DashboardLayout from './dashboard/DashboardLayout';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Separator } from './ui/separator';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Skeleton } from './ui/skeleton';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/contexts/ProfileContext';
import { Registration } from '@/types';
import { toast } from 'sonner';

/**
 * Profile Page Component
 *
 * View and edit registration information:
 * - Player details
 * - Parent/Guardian information
 * - Emergency contact
 * - Training preferences
 */
const ProfilePage: React.FC = () => {
  const { user, selectedProfile, selectedProfileId } = useProfile();
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedData, setEditedData] = useState<any>({});

  // Fetch selected child's registration data
  useEffect(() => {
    const fetchRegistration = async () => {
      if (!selectedProfileId || !user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('registrations')
          .select('*')
          .eq('id', selectedProfileId)
          .eq('firebase_uid', user.uid) // Verify ownership
          .single();

        if (fetchError) {
          if (fetchError.code === 'PGRST116') {
            setError('Registration not found.');
          } else {
            throw fetchError;
          }
        } else {
          setRegistration(data as Registration);
          setEditedData(data.form_data);
        }
      } catch (err) {
        console.error('Error fetching registration:', err);
        setError(err instanceof Error ? err.message : 'Failed to load profile data');
        toast.error('Failed to load profile data');
      } finally {
        setLoading(false);
      }
    };

    fetchRegistration();
  }, [selectedProfileId, user]);

  // Handle save
  const handleSave = async () => {
    if (!registration || !user) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('registrations')
        .update({
          form_data: editedData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', registration.id)
        .eq('firebase_uid', user.uid); // Verify ownership

      if (error) throw error;

      setRegistration({
        ...registration,
        form_data: editedData,
      });
      setIsEditing(false);
      toast.success('Profile updated successfully!');
    } catch (err) {
      console.error('Error updating profile:', err);
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setEditedData(registration?.form_data);
    setIsEditing(false);
  };

  return (
    <ProtectedRoute>
      {loading ? (
        <DashboardLayout user={user || ({ email: 'loading...', uid: '' } as any)}>
          <div className="space-y-6">
            <Skeleton className="h-12 w-64" />
            <Skeleton className="h-32" />
            <Skeleton className="h-96" />
          </div>
        </DashboardLayout>
      ) : error ? (
        <DashboardLayout user={user!}>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error Loading Profile</AlertTitle>
            <AlertDescription>
              {error}
              <div className="mt-4">
                <Button onClick={() => window.location.reload()} variant="outline" size="sm">
                  Refresh Page
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </DashboardLayout>
      ) : !registration ? (
        <DashboardLayout user={user!}>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>No Profile Found</AlertTitle>
            <AlertDescription>
              {!selectedProfile
                ? 'Please select a child profile to view their profile information.'
                : 'Complete your registration to view your profile.'}
            </AlertDescription>
          </Alert>
        </DashboardLayout>
      ) : (
        <DashboardLayout user={user!}>
          <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-foreground">Profile</h1>
                <p className="text-muted-foreground mt-1">
                  View and manage your registration information
                </p>
              </div>
              {!isEditing ? (
                <Button onClick={() => setIsEditing(true)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Profile
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                    <X className="mr-2 h-4 w-4" />
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={isSaving}>
                    <Save className="mr-2 h-4 w-4" />
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              )}
            </div>

            {/* Player Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserIcon className="h-5 w-5 text-primary" />
                  Player Information
                </CardTitle>
                <CardDescription>
                  Details about the registered player
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="playerFullName">Full Name</Label>
                    {isEditing ? (
                      <Input
                        id="playerFullName"
                        value={editedData.playerFullName || ''}
                        onChange={(e) =>
                          setEditedData({ ...editedData, playerFullName: e.target.value })
                        }
                      />
                    ) : (
                      <p className="text-foreground font-medium">
                        {registration.form_data.playerFullName}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dateOfBirth">Date of Birth</Label>
                    {isEditing ? (
                      <Input
                        id="dateOfBirth"
                        type="date"
                        value={editedData.dateOfBirth || ''}
                        onChange={(e) =>
                          setEditedData({ ...editedData, dateOfBirth: e.target.value })
                        }
                      />
                    ) : (
                      <p className="text-foreground font-medium">
                        {new Date(registration.form_data.dateOfBirth).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="playerCategory">Category</Label>
                    <p className="text-foreground font-medium">
                      {registration.form_data.playerCategory}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="position">Position</Label>
                    {isEditing ? (
                      <Input
                        id="position"
                        value={editedData.position || ''}
                        onChange={(e) =>
                          setEditedData({ ...editedData, position: e.target.value })
                        }
                      />
                    ) : (
                      <p className="text-foreground font-medium">
                        {registration.form_data.position || 'Not specified'}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dominantHand">Dominant Hand</Label>
                    <p className="text-foreground font-medium">
                      {registration.form_data.dominantHand}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="jerseySize">Jersey Size</Label>
                    <p className="text-foreground font-medium">
                      {registration.form_data.jerseySize}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Parent/Guardian Information */}
            <Card>
              <CardHeader>
                <CardTitle>Parent/Guardian Information</CardTitle>
                <CardDescription>
                  Primary contact and account holder details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="parentFullName">Full Name</Label>
                    {isEditing ? (
                      <Input
                        id="parentFullName"
                        value={editedData.parentFullName || ''}
                        onChange={(e) =>
                          setEditedData({ ...editedData, parentFullName: e.target.value })
                        }
                      />
                    ) : (
                      <p className="text-foreground font-medium">
                        {registration.form_data.parentFullName}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="parentEmail">Email</Label>
                    <p className="text-foreground font-medium">
                      {registration.form_data.parentEmail}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Email cannot be changed (used for login)
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="parentPhone">Phone Number</Label>
                    {isEditing ? (
                      <Input
                        id="parentPhone"
                        value={editedData.parentPhone || ''}
                        onChange={(e) =>
                          setEditedData({ ...editedData, parentPhone: e.target.value })
                        }
                      />
                    ) : (
                      <p className="text-foreground font-medium">
                        {registration.form_data.parentPhone}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="communicationLanguage">Preferred Language</Label>
                    <p className="text-foreground font-medium">
                      {registration.form_data.communicationLanguage}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="parentCity">City</Label>
                    {isEditing ? (
                      <Input
                        id="parentCity"
                        value={editedData.parentCity || ''}
                        onChange={(e) =>
                          setEditedData({ ...editedData, parentCity: e.target.value })
                        }
                      />
                    ) : (
                      <p className="text-foreground font-medium">
                        {registration.form_data.parentCity}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="parentPostalCode">Postal Code</Label>
                    {isEditing ? (
                      <Input
                        id="parentPostalCode"
                        value={editedData.parentPostalCode || ''}
                        onChange={(e) =>
                          setEditedData({ ...editedData, parentPostalCode: e.target.value })
                        }
                      />
                    ) : (
                      <p className="text-foreground font-medium">
                        {registration.form_data.parentPostalCode}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Emergency Contact */}
            <Card>
              <CardHeader>
                <CardTitle>Emergency Contact</CardTitle>
                <CardDescription>
                  Contact person in case of emergency
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="emergencyContactName">Name</Label>
                    {isEditing ? (
                      <Input
                        id="emergencyContactName"
                        value={editedData.emergencyContactName || ''}
                        onChange={(e) =>
                          setEditedData({
                            ...editedData,
                            emergencyContactName: e.target.value,
                          })
                        }
                      />
                    ) : (
                      <p className="text-foreground font-medium">
                        {registration.form_data.emergencyContactName}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emergencyContactPhone">Phone Number</Label>
                    {isEditing ? (
                      <Input
                        id="emergencyContactPhone"
                        value={editedData.emergencyContactPhone || ''}
                        onChange={(e) =>
                          setEditedData({
                            ...editedData,
                            emergencyContactPhone: e.target.value,
                          })
                        }
                      />
                    ) : (
                      <p className="text-foreground font-medium">
                        {registration.form_data.emergencyContactPhone}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emergencyRelationship">Relationship</Label>
                    {isEditing ? (
                      <Input
                        id="emergencyRelationship"
                        value={editedData.emergencyRelationship || ''}
                        onChange={(e) =>
                          setEditedData({
                            ...editedData,
                            emergencyRelationship: e.target.value,
                          })
                        }
                      />
                    ) : (
                      <p className="text-foreground font-medium">
                        {registration.form_data.emergencyRelationship}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Program Details */}
            <Card>
              <CardHeader>
                <CardTitle>Program Details</CardTitle>
                <CardDescription>
                  Your selected training program
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Program Type</Label>
                    <p className="text-foreground font-medium capitalize">
                      {registration.form_data.programType}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Frequency</Label>
                    <p className="text-foreground font-medium">
                      {registration.form_data.programType === 'group' &&
                        `${registration.form_data.groupFrequency?.toUpperCase()} per week`}
                      {registration.form_data.programType === 'private' &&
                        registration.form_data.privateFrequency}
                      {registration.form_data.programType === 'semi-private' && 'Custom schedule'}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Training Days</Label>
                    <p className="text-foreground font-medium">
                      {registration.form_data.programType === 'group' &&
                        registration.form_data.groupSelectedDays?.map((d) => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')}
                      {registration.form_data.programType === 'private' &&
                        registration.form_data.privateSelectedDays?.join(', ')}
                      {registration.form_data.programType === 'semi-private' &&
                        registration.form_data.semiPrivateAvailability?.join(', ')}
                    </p>
                  </div>
                  {registration.form_data.privateTimeSlot && (
                    <div className="space-y-2">
                      <Label>Time Slot</Label>
                      <p className="text-foreground font-medium">
                        {registration.form_data.privateTimeSlot}
                      </p>
                    </div>
                  )}
                </div>
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    To change your program type or training schedule, please use the "Reschedule"
                    button on the Schedule page.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Health Information */}
            <Card>
              <CardHeader>
                <CardTitle>Health & Medical Information</CardTitle>
                <CardDescription>
                  Important medical details for training safety
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Allergies</Label>
                    {registration.form_data.hasAllergies ? (
                      <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/30">
                        <p className="text-sm font-medium text-orange-600 dark:text-orange-400">
                          ⚠️ Has Allergies
                        </p>
                        <p className="text-sm text-foreground mt-1">
                          {registration.form_data.allergiesDetails}
                        </p>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">No known allergies</p>
                    )}
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <Label>Medical Conditions</Label>
                    {registration.form_data.hasMedicalConditions ? (
                      <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/30">
                        <p className="text-sm font-medium text-orange-600 dark:text-orange-400">
                          ⚠️ Has Medical Conditions
                        </p>
                        <p className="text-sm text-foreground mt-1">
                          {registration.form_data.medicalConditionsDetails}
                        </p>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">No known medical conditions</p>
                    )}
                  </div>
                </div>
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    If you need to update health information, please contact support at
                    support@sniperzone.com
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        </DashboardLayout>
      )}
    </ProtectedRoute>
  );
};

export default ProfilePage;

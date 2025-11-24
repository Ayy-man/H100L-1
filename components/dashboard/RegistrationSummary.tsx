import React from 'react';
import { User, Calendar, MapPin, Phone, Mail, Heart, Shield } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Registration } from '@/types';

interface RegistrationSummaryProps {
  registration: Registration;
}

/**
 * Registration Summary Component
 *
 * Displays all registration details in a clean, scannable format:
 * - Player information
 * - Program details and schedule
 * - Parent/guardian contact info
 * - Medical information
 * - Sunday ice practice details
 */
const RegistrationSummary: React.FC<RegistrationSummaryProps> = ({
  registration,
}) => {
  const { form_data } = registration;

  // Format program type for display
  const getProgramLabel = () => {
    switch (form_data.programType) {
      case 'group':
        return `Group Training ${form_data.groupFrequency?.toUpperCase()}`;
      case 'private':
        return `Private Training ${form_data.privateFrequency?.toUpperCase()}`;
      case 'semi-private':
        return 'Semi-Private Training';
      default:
        return 'Training Program';
    }
  };

  // Format days for display
  const formatDays = (days: string[]) => {
    if (!days || days.length === 0) return 'Not selected';
    return days
      .map((day) => day.charAt(0).toUpperCase() + day.slice(1))
      .join(', ');
  };

  // Get monthly price based on program
  const getMonthlyPrice = () => {
    const { programType, groupFrequency, privateFrequency } = form_data;

    if (programType === 'group') {
      return groupFrequency === '1x' ? '$249.99' : '$399.99';
    } else if (programType === 'private') {
      return privateFrequency === '1x' ? '$499.99' : '$799.99';
    } else if (programType === 'semi-private') {
      return '$349.99';
    }
    return '$0.00';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5 text-primary" />
          Registration Summary
        </CardTitle>
        <CardDescription>
          Complete details of your SniperZone hockey training registration
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Player Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Player Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Full Name</p>
              <p className="font-medium">{form_data.playerFullName}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Date of Birth</p>
              <p className="font-medium">{form_data.dateOfBirth}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Category</p>
              <Badge variant="outline">{form_data.playerCategory}</Badge>
            </div>
            <div>
              <p className="text-muted-foreground">Position</p>
              <p className="font-medium">{form_data.position || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Dominant Hand</p>
              <p className="font-medium">{form_data.dominantHand || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Jersey Size</p>
              <p className="font-medium">{form_data.jerseySize || 'Not specified'}</p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Program Details */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Program Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Program Type</p>
              <Badge className="mt-1">{getProgramLabel()}</Badge>
            </div>
            <div>
              <p className="text-muted-foreground">Monthly Cost</p>
              <p className="font-bold text-lg text-primary">{getMonthlyPrice()}/month</p>
            </div>
            {form_data.programType === 'group' && (
              <div className="col-span-full">
                <p className="text-muted-foreground">Training Days</p>
                <p className="font-medium">{formatDays(form_data.groupSelectedDays)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {form_data.groupFrequency === '1x'
                    ? '1 session per week'
                    : '2 sessions per week'}
                </p>
              </div>
            )}
            {form_data.programType === 'private' && (
              <>
                <div>
                  <p className="text-muted-foreground">Selected Days</p>
                  <p className="font-medium">
                    {formatDays(form_data.privateSelectedDays)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Time Slot</p>
                  <p className="font-medium">{form_data.privateTimeSlot}</p>
                </div>
              </>
            )}
            {form_data.programType === 'semi-private' && (
              <div className="col-span-full">
                <p className="text-muted-foreground">Available Days</p>
                <p className="font-medium">
                  {formatDays(form_data.semiPrivateAvailability)}
                </p>
              </div>
            )}
          </div>

          {/* Sunday Ice Practice Info (Group Training Only) */}
          {form_data.programType === 'group' && (
            <div className="mt-4 p-4 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-primary mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-foreground">Sunday Ice Practice Included</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Every Sunday on real ice at:
                  </p>
                  <p className="text-sm font-medium mt-1">
                    7515 Boulevard Henri-Bourassa E, Montreal, Quebec H1E 1N9
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Included free with your monthly subscription
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Parent/Guardian Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Parent/Guardian Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Full Name</p>
              <p className="font-medium">{form_data.parentFullName}</p>
            </div>
            <div>
              <p className="text-muted-foreground flex items-center gap-1">
                <Mail className="h-3 w-3" />
                Email
              </p>
              <p className="font-medium">{form_data.parentEmail}</p>
            </div>
            <div>
              <p className="text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" />
                Phone
              </p>
              <p className="font-medium">{form_data.parentPhone}</p>
            </div>
            <div>
              <p className="text-muted-foreground">City</p>
              <p className="font-medium">{form_data.parentCity}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Postal Code</p>
              <p className="font-medium">{form_data.parentPostalCode}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Preferred Language</p>
              <p className="font-medium">{form_data.communicationLanguage}</p>
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="mt-4 p-3 rounded-md bg-muted/50 border border-border">
            <p className="font-semibold text-sm mb-2">Emergency Contact</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Name</p>
                <p className="font-medium">{form_data.emergencyContactName}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Phone</p>
                <p className="font-medium">{form_data.emergencyContactPhone}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Relationship</p>
                <p className="font-medium">{form_data.emergencyRelationship}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Medical Information */}
        {(form_data.hasAllergies || form_data.hasMedicalConditions) && (
          <>
            <Separator />
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Heart className="h-4 w-4 text-primary" />
                Medical Information
              </h3>
              <div className="space-y-3 text-sm">
                {form_data.hasAllergies && (
                  <div className="p-3 rounded-md bg-orange-500/10 border border-orange-500/20">
                    <p className="font-semibold text-orange-500">Allergies</p>
                    <p className="text-foreground mt-1">
                      {form_data.allergiesDetails}
                    </p>
                  </div>
                )}
                {form_data.hasMedicalConditions && (
                  <div className="p-3 rounded-md bg-orange-500/10 border border-orange-500/20">
                    <p className="font-semibold text-orange-500">Medical Conditions</p>
                    <p className="text-foreground mt-1">
                      {form_data.medicalConditionsDetails}
                    </p>
                  </div>
                )}
                {form_data.medicalFiles && (
                  <div className="p-3 rounded-md bg-muted/50 border border-border">
                    <p className="font-semibold text-xs text-muted-foreground mb-2">
                      Uploaded Documents
                    </p>
                    {form_data.medicalFiles.actionPlan && (
                      <p className="text-xs">• Action Plan uploaded</p>
                    )}
                    {form_data.medicalFiles.medicalReport && (
                      <p className="text-xs">• Medical Report uploaded</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default RegistrationSummary;

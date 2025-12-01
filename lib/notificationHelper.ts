import { createClient } from '@supabase/supabase-js';

/**
 * Notification Helper - Server-side utility for creating notifications
 *
 * Import this in API files to create notifications when events happen.
 * This is separate from the frontend notificationService.ts
 */

const getSupabase = () => {
  return createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
};

interface CreateNotificationParams {
  userId: string;
  userType: 'parent' | 'admin';
  type: string;
  title: string;
  message: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  data?: Record<string, any>;
  actionUrl?: string;
  expiresAt?: string;
}

/**
 * Create a single notification
 */
export async function createNotification(params: CreateNotificationParams) {
  try {
    const supabase = getSupabase();

    const { data, error } = await supabase
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
      // Don't throw - just return null so callers don't crash
      return null;
    }

    return data;
  } catch (err) {
    console.error('Exception creating notification:', err);
    // Don't throw - just return null so callers don't crash
    return null;
  }
}

/**
 * Notify all admins about an event
 */
export async function notifyAdmins(params: Omit<CreateNotificationParams, 'userId' | 'userType'>) {
  return createNotification({
    ...params,
    userId: 'admin',
    userType: 'admin'
  });
}

// ============================================================
// Pre-built notification templates for common events
// ============================================================

/**
 * Notify when a semi-private pairing is created
 */
export async function notifyPairingCreated(params: {
  parentUserId: string;
  playerName: string;
  partnerName: string;
  scheduledDay: string;
  scheduledTime: string;
  registrationId: string;
}) {
  const { parentUserId, playerName, partnerName, scheduledDay, scheduledTime, registrationId } = params;

  // Notify parent
  await createNotification({
    userId: parentUserId,
    userType: 'parent',
    type: 'pairing_created',
    title: 'Training Partner Found!',
    message: `${playerName} has been paired with ${partnerName} for semi-private training on ${scheduledDay}s at ${scheduledTime}.`,
    priority: 'high',
    data: {
      registration_id: registrationId,
      player_name: playerName,
      partner_name: partnerName,
      scheduled_day: scheduledDay,
      scheduled_time: scheduledTime
    },
    actionUrl: '/schedule'
  });

  // Notify admin
  await notifyAdmins({
    type: 'pairing_created',
    title: 'New Semi-Private Pairing',
    message: `${playerName} and ${partnerName} have been paired for ${scheduledDay} at ${scheduledTime}.`,
    priority: 'normal',
    data: {
      registration_id: registrationId,
      player_name: playerName,
      partner_name: partnerName
    }
  });
}

/**
 * Notify when a semi-private pairing is dissolved
 */
export async function notifyPairingDissolved(params: {
  parentUserId: string;
  playerName: string;
  partnerName: string;
  reason?: string;
  registrationId: string;
}) {
  const { parentUserId, playerName, partnerName, reason, registrationId } = params;

  await createNotification({
    userId: parentUserId,
    userType: 'parent',
    type: 'pairing_dissolved',
    title: 'Training Pairing Update',
    message: `Your pairing with ${partnerName} has ended. ${reason || 'You will be matched with a new partner soon.'}`,
    priority: 'high',
    data: {
      registration_id: registrationId,
      player_name: playerName,
      partner_name: partnerName,
      reason
    },
    actionUrl: '/schedule'
  });
}

/**
 * Notify when schedule is changed
 */
export async function notifyScheduleChanged(params: {
  parentUserId: string;
  playerName: string;
  changeType: 'one_time' | 'permanent';
  originalSchedule: string;
  newSchedule: string;
  registrationId: string;
}) {
  const { parentUserId, playerName, changeType, originalSchedule, newSchedule, registrationId } = params;

  const isPermanent = changeType === 'permanent';

  await createNotification({
    userId: parentUserId,
    userType: 'parent',
    type: 'schedule_changed',
    title: isPermanent ? 'Schedule Updated' : 'One-Time Schedule Change',
    message: isPermanent
      ? `${playerName}'s training schedule has been updated from ${originalSchedule} to ${newSchedule}.`
      : `${playerName}'s training has been moved from ${originalSchedule} to ${newSchedule} for this week.`,
    priority: 'normal',
    data: {
      registration_id: registrationId,
      player_name: playerName,
      change_type: changeType,
      original_schedule: originalSchedule,
      new_schedule: newSchedule
    },
    actionUrl: '/schedule'
  });
}

/**
 * Notify when payment is confirmed by admin
 */
export async function notifyPaymentConfirmed(params: {
  parentUserId: string;
  playerName: string;
  amount?: string;
  registrationId: string;
  confirmedBy: string;
}) {
  const { parentUserId, playerName, amount, registrationId, confirmedBy } = params;

  // Notify parent
  await createNotification({
    userId: parentUserId,
    userType: 'parent',
    type: 'payment_confirmed',
    title: 'Payment Confirmed',
    message: `Your payment for ${playerName}'s training has been verified${amount ? ` (${amount})` : ''}. Training access is now active.`,
    priority: 'high',
    data: {
      registration_id: registrationId,
      player_name: playerName,
      amount,
      confirmed_by: confirmedBy
    },
    actionUrl: '/dashboard'
  });

  // Notify admin
  await notifyAdmins({
    type: 'payment_confirmed',
    title: 'Payment Manually Confirmed',
    message: `Payment confirmed for ${playerName} by ${confirmedBy}.`,
    priority: 'low',
    data: {
      registration_id: registrationId,
      player_name: playerName,
      confirmed_by: confirmedBy
    }
  });
}

/**
 * Notify when Sunday practice is booked
 */
export async function notifySundayBooked(params: {
  parentUserId: string;
  playerName: string;
  practiceDate: string;
  timeSlot: string;
  registrationId: string;
}) {
  const { parentUserId, playerName, practiceDate, timeSlot, registrationId } = params;

  await createNotification({
    userId: parentUserId,
    userType: 'parent',
    type: 'sunday_booking',
    title: 'Sunday Practice Booked',
    message: `${playerName} is booked for Sunday ice practice on ${practiceDate} at ${timeSlot}.`,
    priority: 'normal',
    data: {
      registration_id: registrationId,
      player_name: playerName,
      practice_date: practiceDate,
      time_slot: timeSlot
    },
    actionUrl: '/schedule'
  });
}

/**
 * Notify when Sunday practice is cancelled
 */
export async function notifySundayCancelled(params: {
  parentUserId: string;
  playerName: string;
  practiceDate: string;
  registrationId: string;
}) {
  const { parentUserId, playerName, practiceDate, registrationId } = params;

  await createNotification({
    userId: parentUserId,
    userType: 'parent',
    type: 'sunday_booking',
    title: 'Sunday Practice Cancelled',
    message: `${playerName}'s Sunday practice booking for ${practiceDate} has been cancelled.`,
    priority: 'normal',
    data: {
      registration_id: registrationId,
      player_name: playerName,
      practice_date: practiceDate,
      cancelled: true
    },
    actionUrl: '/schedule'
  });
}

/**
 * Send admin message to a parent
 */
export async function sendAdminMessage(params: {
  parentUserId: string;
  title: string;
  message: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  actionUrl?: string;
}) {
  const { parentUserId, title, message, priority, actionUrl } = params;

  await createNotification({
    userId: parentUserId,
    userType: 'parent',
    type: 'admin_message',
    title,
    message,
    priority: priority || 'normal',
    actionUrl
  });
}

/**
 * Notify about waitlist status update
 */
export async function notifyWaitlistUpdate(params: {
  parentUserId: string;
  playerName: string;
  status: 'added' | 'position_changed' | 'spot_available';
  position?: number;
  registrationId: string;
}) {
  const { parentUserId, playerName, status, position, registrationId } = params;

  let title = 'Waitlist Update';
  let message = '';

  switch (status) {
    case 'added':
      message = `${playerName} has been added to the waitlist${position ? ` (position #${position})` : ''}.`;
      break;
    case 'position_changed':
      message = `${playerName}'s waitlist position has changed${position ? ` to #${position}` : ''}.`;
      break;
    case 'spot_available':
      title = 'Spot Available!';
      message = `A spot is now available for ${playerName}! Log in to confirm your booking.`;
      break;
  }

  await createNotification({
    userId: parentUserId,
    userType: 'parent',
    type: 'waitlist_update',
    title,
    message,
    priority: status === 'spot_available' ? 'urgent' : 'normal',
    data: {
      registration_id: registrationId,
      player_name: playerName,
      status,
      position
    },
    actionUrl: '/schedule'
  });
}

/**
 * Notify admin about new registration
 */
export async function notifyNewRegistration(params: {
  playerName: string;
  playerCategory: string;
  programType: string;
  parentEmail: string;
  registrationId: string;
}) {
  const { playerName, playerCategory, programType, parentEmail, registrationId } = params;

  await notifyAdmins({
    type: 'system',
    title: 'New Registration',
    message: `${playerName} (${playerCategory}) registered for ${programType} training. Contact: ${parentEmail}`,
    priority: 'normal',
    data: {
      registration_id: registrationId,
      player_name: playerName,
      player_category: playerCategory,
      program_type: programType,
      parent_email: parentEmail
    },
    actionUrl: '/admin'
  });
}

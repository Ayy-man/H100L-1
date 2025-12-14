import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../lib/supabase';
import type {
  AdminAdjustCreditsRequest,
  AdminAdjustCreditsResponse,
} from '../types/credits';

/**
 * Admin endpoint to manually adjust credits
 *
 * Use cases:
 * - Customer service credit for issues
 * - Promotional credits
 * - Correction of errors
 * - Manual refunds
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { firebase_uid, adjustment, reason, admin_id } = req.body as AdminAdjustCreditsRequest;

    // Validate required fields
    if (!firebase_uid || adjustment === undefined || !reason || !admin_id) {
      return res.status(400).json({
        error: 'Missing required fields: firebase_uid, adjustment, reason, admin_id',
      });
    }

    // Validate adjustment is a non-zero integer
    if (!Number.isInteger(adjustment) || adjustment === 0) {
      return res.status(400).json({
        error: 'Adjustment must be a non-zero integer (positive to add, negative to subtract)',
      });
    }

    // Validate reason is not empty
    if (reason.trim().length < 5) {
      return res.status(400).json({
        error: 'Reason must be at least 5 characters',
      });
    }

    // TODO: In production, verify admin_id is actually an admin
    // This could be done by checking a custom claim in Firebase or
    // looking up in an admins table

    // Get current credit balance
    const { data: parentCredits, error: fetchError } = await supabaseAdmin
      .from('parent_credits')
      .select('total_credits')
      .eq('firebase_uid', firebase_uid)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching credits:', fetchError);
      return res.status(500).json({ error: 'Database error' });
    }

    const currentBalance = parentCredits?.total_credits || 0;
    const newBalance = currentBalance + adjustment;

    // Don't allow negative balance
    if (newBalance < 0) {
      return res.status(400).json({
        error: `Cannot subtract ${Math.abs(adjustment)} credits. User only has ${currentBalance} credits.`,
        current_balance: currentBalance,
      });
    }

    // Create or update parent_credits record
    if (!parentCredits) {
      // Create new record
      const { error: insertError } = await supabaseAdmin
        .from('parent_credits')
        .insert({
          firebase_uid,
          total_credits: newBalance,
        });

      if (insertError) {
        console.error('Error creating parent_credits:', insertError);
        return res.status(500).json({ error: 'Failed to create credit account' });
      }
    } else {
      // Update existing record
      const { error: updateError } = await supabaseAdmin
        .from('parent_credits')
        .update({
          total_credits: newBalance,
        })
        .eq('firebase_uid', firebase_uid);

      if (updateError) {
        console.error('Error updating credits:', updateError);
        return res.status(500).json({ error: 'Failed to update credits' });
      }
    }

    // Log the adjustment for audit trail
    const { error: auditError } = await supabaseAdmin
      .from('credit_adjustments')
      .insert({
        firebase_uid,
        adjustment,
        balance_before: currentBalance,
        balance_after: newBalance,
        reason,
        admin_id,
      });

    if (auditError) {
      console.error('Error logging adjustment:', auditError);
      // Don't fail the request, just log the error
    }

    // Create notification for the user
    const { error: notifError } = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: firebase_uid,
        user_type: 'parent',
        type: 'system',
        title: adjustment > 0 ? 'Credits Added' : 'Credits Adjusted',
        message: adjustment > 0
          ? `${adjustment} credit(s) have been added to your account. Reason: ${reason}`
          : `${Math.abs(adjustment)} credit(s) have been removed from your account. Reason: ${reason}`,
        priority: 'normal',
        data: {
          adjustment,
          reason,
          new_balance: newBalance,
        },
      });

    if (notifError) {
      console.error('Error creating notification:', notifError);
    }

    const response: AdminAdjustCreditsResponse = {
      success: true,
      new_balance: newBalance,
      message: `Successfully ${adjustment > 0 ? 'added' : 'removed'} ${Math.abs(adjustment)} credit(s). New balance: ${newBalance}`,
    };

    return res.status(200).json(response);
  } catch (error: any) {
    console.error('Admin adjust credits error:', error);
    return res.status(500).json({
      error: 'Failed to adjust credits',
    });
  }
}

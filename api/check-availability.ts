import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkSlotAvailability, getDayAvailability, getAvailableSlots, checkMultiHourAvailability } from './_lib/unifiedCapacityManager';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action, day, time, programType, selectedDays, duration } = req.method === 'GET' ? req.query : req.body;

    // Check specific slot availability
    if (action === 'checkSlot' && day && time) {
      const availability = await checkSlotAvailability(day as string, time as string);
      return res.status(200).json({ success: true, availability });
    }

    // Check day availability (all slots for a day)
    if (action === 'checkDay' && day) {
      const slots = await getDayAvailability(day as string);
      return res.status(200).json({ success: true, slots });
    }

    // Get all available slots for a program type
    if (action === 'getSlots' && programType) {
      const days = selectedDays ? (typeof selectedDays === 'string' ? [selectedDays] : selectedDays) : undefined;
      const slots = await getAvailableSlots(programType as any, days as string[]);
      return res.status(200).json({ success: true, slots });
    }

    // Check multi-hour availability
    if (action === 'checkMultiHour' && day && time && duration) {
      const available = await checkMultiHourAvailability(
        day as string,
        time as string,
        parseInt(duration as string)
      );
      return res.status(200).json({ success: true, available });
    }

    return res.status(400).json({
      error: 'Invalid request. Provide action, day, time, programType, or duration as needed.'
    });
  } catch (error: any) {
    console.error('Availability check error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to check availability'
    });
  }
}

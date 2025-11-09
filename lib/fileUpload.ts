/**
 * File Upload Service
 * Handles uploading medical reports and action plans to Supabase Storage
 */

import { supabase } from './supabase';

/**
 * Uploads a medical report PDF to Supabase Storage
 * @param file - The PDF file to upload
 * @param registrationId - The registration ID to associate with the file
 * @returns The storage path of the uploaded file, or null on error
 */
export async function uploadMedicalReport(
  file: File,
  registrationId: string
): Promise<string | null> {
  try {
    const fileName = `${registrationId}_medical_${Date.now()}_${file.name}`;

    const { data, error } = await supabase.storage
      .from('medical-reports')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Medical report upload error:', error);
      return null;
    }

    return data.path;
  } catch (error) {
    console.error('Unexpected upload error:', error);
    return null;
  }
}

/**
 * Uploads a medication action plan PDF to Supabase Storage
 * @param file - The PDF file to upload
 * @param registrationId - The registration ID to associate with the file
 * @returns The storage path of the uploaded file, or null on error
 */
export async function uploadMedicationActionPlan(
  file: File,
  registrationId: string
): Promise<string | null> {
  try {
    const fileName = `${registrationId}_action_plan_${Date.now()}_${file.name}`;

    const { data, error } = await supabase.storage
      .from('medical-reports')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Action plan upload error:', error);
      return null;
    }

    return data.path;
  } catch (error) {
    console.error('Unexpected upload error:', error);
    return null;
  }
}

/**
 * Gets a public URL for a file stored in Supabase Storage
 * @param path - The storage path returned from upload
 * @returns The public URL to access the file
 */
export function getPublicUrl(path: string): string {
  const { data } = supabase.storage
    .from('medical-reports')
    .getPublicUrl(path);

  return data.publicUrl;
}

/**
 * Deletes a file from Supabase Storage
 * @param path - The storage path to delete
 * @returns true if successful, false otherwise
 */
export async function deleteFile(path: string): Promise<boolean> {
  try {
    const { error } = await supabase.storage
      .from('medical-reports')
      .remove([path]);

    if (error) {
      console.error('File deletion error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Unexpected deletion error:', error);
    return false;
  }
}

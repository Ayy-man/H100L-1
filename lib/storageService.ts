import { supabase } from './supabase';
import { MedicalFile } from '../types';

const BUCKET_NAME = 'medical-documents';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_FILE_TYPE = 'application/pdf';
const SIGNED_URL_EXPIRY = 3600; // 1 hour in seconds

/**
 * Validates a file before upload
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  if (file.type !== ALLOWED_FILE_TYPE) {
    return { valid: false, error: 'Only PDF files are allowed' };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'File size cannot exceed 5MB' };
  }

  return { valid: true };
}

/**
 * Uploads a file to Supabase Storage
 * @param file - The file to upload
 * @param registrationId - The registration ID for organizing files
 * @param fileType - Type of file ('actionPlan' or 'medicalReport')
 * @returns MedicalFile object with URL and metadata
 */
export async function uploadMedicalFile(
  file: File,
  registrationId: string,
  fileType: 'actionPlan' | 'medicalReport'
): Promise<MedicalFile> {
  // Validate file
  const validation = validateFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Generate unique filename
  const timestamp = Date.now();
  const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `${registrationId}/${fileType}_${timestamp}_${sanitizedFilename}`;

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    console.error('Upload error:', error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(data.path);

  return {
    url: publicUrl,
    filename: file.name,
    size: file.size,
    uploadedAt: new Date().toISOString(),
  };
}

/**
 * Uploads multiple medical files
 */
export async function uploadMedicalFiles(
  files: {
    actionPlan?: File | null;
    medicalReport?: File | null;
  },
  registrationId: string
): Promise<{ actionPlan?: MedicalFile; medicalReport?: MedicalFile }> {
  const uploadedFiles: { actionPlan?: MedicalFile; medicalReport?: MedicalFile } = {};

  // Upload action plan if provided
  if (files.actionPlan) {
    try {
      uploadedFiles.actionPlan = await uploadMedicalFile(
        files.actionPlan,
        registrationId,
        'actionPlan'
      );
    } catch (error) {
      throw new Error(`Action plan upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Upload medical report if provided
  if (files.medicalReport) {
    try {
      uploadedFiles.medicalReport = await uploadMedicalFile(
        files.medicalReport,
        registrationId,
        'medicalReport'
      );
    } catch (error) {
      // If medical report fails and action plan was uploaded, we should clean up
      if (uploadedFiles.actionPlan) {
        await deleteFile(uploadedFiles.actionPlan.url);
      }
      throw new Error(`Medical report upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return uploadedFiles;
}

/**
 * Gets a signed URL for secure file access
 * @param fileUrl - The public URL of the file
 * @returns Signed URL that expires after 1 hour
 */
export async function getSignedUrl(fileUrl: string): Promise<string> {
  try {
    // Extract the file path from the public URL
    const url = new URL(fileUrl);
    const pathParts = url.pathname.split(`${BUCKET_NAME}/`);

    if (pathParts.length < 2) {
      throw new Error('Invalid file URL format');
    }

    const filePath = pathParts[1];

    // Create signed URL
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, SIGNED_URL_EXPIRY);

    if (error) {
      console.error('Signed URL error:', error);
      throw new Error(`Failed to create signed URL: ${error.message}`);
    }

    return data.signedUrl;
  } catch (error) {
    console.error('Error creating signed URL:', error);
    throw error;
  }
}

/**
 * Deletes a file from storage
 * @param fileUrl - The public URL of the file to delete
 */
export async function deleteFile(fileUrl: string): Promise<void> {
  try {
    // Extract the file path from the public URL
    const url = new URL(fileUrl);
    const pathParts = url.pathname.split(`${BUCKET_NAME}/`);

    if (pathParts.length < 2) {
      throw new Error('Invalid file URL format');
    }

    const filePath = pathParts[1];

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (error) {
      console.error('Delete error:', error);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  } catch (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
}

/**
 * Lists all files for a specific registration
 * @param registrationId - The registration ID
 */
export async function listRegistrationFiles(registrationId: string): Promise<any[]> {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .list(registrationId);

  if (error) {
    console.error('List files error:', error);
    throw new Error(`Failed to list files: ${error.message}`);
  }

  return data || [];
}

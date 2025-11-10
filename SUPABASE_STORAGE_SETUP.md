# Supabase Storage Setup Guide

This guide provides detailed step-by-step instructions for setting up the Supabase Storage bucket for medical documents.

## Prerequisites

- Access to your Supabase project dashboard
- Admin/Owner permissions on the Supabase project

## Step-by-Step Setup Instructions

### Step 1: Create the Storage Bucket

1. **Navigate to Storage:**
   - Log in to your Supabase dashboard at https://app.supabase.com
   - Select your project (ozdmultceksjktgufyrs)
   - Click on **Storage** in the left sidebar

2. **Create New Bucket:**
   - Click the **"New bucket"** button
   - Enter the following details:
     - **Name:** `medical-documents`
     - **Public bucket:** Toggle this **OFF** (bucket should be private for security)
     - **File size limit:** Set to `5242880` bytes (5MB) - optional but recommended
   - Click **"Create bucket"**

### Step 2: Configure RLS (Row Level Security) Policies

After creating the bucket, you need to set up security policies to control access.

1. **Navigate to Policies:**
   - In the Storage section, find your `medical-documents` bucket
   - Click on the bucket name
   - Click on the **"Policies"** tab

2. **Create Upload Policy (INSERT):**
   - Click **"New Policy"**
   - Select **"Create a new policy from scratch"**
   - Enter the following details:
     - **Policy name:** `Allow public uploads`
     - **Policy definition:** Select **INSERT** operation
     - **Target roles:** `anon`, `authenticated`
     - **Policy command:**
       ```sql
       (bucket_id = 'medical-documents'::text)
       ```
   - Click **"Review"** and then **"Save policy"**

3. **Create Read Policy (SELECT):**
   - Click **"New Policy"** again
   - Select **"Create a new policy from scratch"**
   - Enter the following details:
     - **Policy name:** `Allow public reads`
     - **Policy definition:** Select **SELECT** operation
     - **Target roles:** `anon`, `authenticated`
     - **Policy command:**
       ```sql
       (bucket_id = 'medical-documents'::text)
       ```
   - Click **"Review"** and then **"Save policy"**

4. **Create Delete Policy (DELETE) - Optional but Recommended:**
   - Click **"New Policy"**
   - Select **"Create a new policy from scratch"**
   - Enter the following details:
     - **Policy name:** `Allow authenticated users to delete`
     - **Policy definition:** Select **DELETE** operation
     - **Target roles:** `authenticated`
     - **Policy command:**
       ```sql
       (bucket_id = 'medical-documents'::text)
       ```
   - Click **"Review"** and then **"Save policy"**

### Step 3: Verify Bucket Configuration

1. **Check Bucket Settings:**
   - Go back to the Storage main page
   - Click on your `medical-documents` bucket
   - Verify:
     - ✓ Bucket is **Private** (not public)
     - ✓ File size limit is set to **5MB** (if configured)
     - ✓ Policies are active (should see green checkmarks)

2. **Test Upload (Optional):**
   - You can test uploading a file manually through the Supabase dashboard
   - Click **"Upload file"** in your bucket
   - Select a small PDF file to test
   - Verify it uploads successfully
   - Delete the test file after verification

### Step 4: Configure CORS (If Needed)

If you encounter CORS errors when uploading from your application:

1. **Navigate to Storage Settings:**
   - Go to **Storage** → **Settings** (or **Configuration**)
   - Look for **CORS Configuration**

2. **Add Your Domain:**
   - Add your application domains to the allowed origins:
     - For development: `http://localhost:3000`
     - For production: Your production domain (e.g., `https://yourdomain.com`)

### Step 5: Update Environment Variables (Optional Security Improvement)

For production, consider moving your Supabase credentials to environment variables:

1. **Create a `.env` file** in your project root:
   ```env
   VITE_SUPABASE_URL=https://ozdmultceksjktgufyrs.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key_here
   ```

2. **Update `lib/supabase.ts`:**
   ```typescript
   const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
   const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
   ```

3. **Add `.env` to `.gitignore`:**
   ```
   .env
   .env.local
   ```

## Bucket Structure

Files will be organized with the following structure:
```
medical-documents/
├── temp_[timestamp]_[random]/
│   ├── actionPlan_[timestamp]_[filename].pdf
│   └── medicalReport_[timestamp]_[filename].pdf
```

Each registration gets its own folder based on a temporary ID.

## Security Features Implemented

1. **Private Bucket:** Files are not publicly accessible by default
2. **Signed URLs:** All file access uses signed URLs that expire after 1 hour
3. **File Validation:**
   - Only PDF files are allowed
   - Maximum file size: 5MB
   - Files are validated before upload
4. **RLS Policies:** Control who can upload, read, and delete files

## Troubleshooting

### Common Issues:

1. **"Storage bucket not found" error:**
   - Verify the bucket name is exactly `medical-documents`
   - Check that the bucket was created successfully

2. **"Permission denied" errors:**
   - Verify RLS policies are set up correctly
   - Check that policies target the correct roles (`anon`, `authenticated`)
   - Ensure bucket_id in policies matches exactly

3. **CORS errors:**
   - Add your application domain to CORS settings
   - For development, allow `http://localhost:3000`

4. **Upload fails silently:**
   - Check browser console for detailed error messages
   - Verify file size is under 5MB
   - Verify file is a PDF

### Testing Checklist:

- [ ] Bucket created with name `medical-documents`
- [ ] Bucket is set to **Private** (not public)
- [ ] INSERT policy created for uploads
- [ ] SELECT policy created for reading
- [ ] File size limit set to 5MB (optional)
- [ ] Test upload from the application works
- [ ] Test viewing documents in admin dashboard works
- [ ] Test download functionality works
- [ ] Signed URLs are generated successfully

## Support

If you encounter issues:
1. Check the Supabase logs in the dashboard
2. Check browser console for JavaScript errors
3. Verify all policies are active and correct
4. Contact Supabase support if needed

## Next Steps

After setting up the storage bucket:
1. Test uploading files through the registration form
2. Verify files appear in the admin dashboard
3. Test viewing and downloading files
4. Monitor storage usage in Supabase dashboard

---

**Last Updated:** 2025-11-10
**Tested with:** Supabase Storage v1

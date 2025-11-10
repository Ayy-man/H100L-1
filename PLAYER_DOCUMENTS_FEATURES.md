# Player Documents Features - User Guide

This document describes the enhanced player documents features added to the SniperZone Hockey Training Admin Dashboard.

## Overview

The system now provides comprehensive document management with visual indicators, quick actions, and multiple views for managing player medical documents (Action Plans and Medical Reports).

---

## Features

### 1. Document Status Badges

Visual indicators that show at a glance whether a player has uploaded their medical documents.

#### Badge Types:

**✅ Documents Uploaded (Green)**
- Displayed when player has uploaded documents
- Shows count: "2 Docs" (both files) or "1 Doc" (one file)
- Green checkmark icon

**⚠️ Missing Documents (Yellow)**
- Displayed when player has medical conditions but no documents
- Warning icon with "Missing Docs" text
- Alerts staff to follow up

**📄 No Documents (Gray)**
- Displayed when no documents are uploaded
- Neutral indicator for players without medical needs
- Document icon with "No Docs" text

#### Where You'll See Badges:

1. **Admin Dashboard Table** - Quick scan of all registrations
2. **Registration Details Modal** - Compact view in header
3. **Player Documents Section** - Full status with detailed badges

---

### 2. Player Documents Section (Collapsible)

A dedicated, collapsible section in the registration details view that provides complete document management.

#### Features:

**Document Display:**
- Shows both Action Plan and Medical Report
- File metadata: filename, file size, upload date
- PDF icon for visual recognition
- Status for each document (uploaded/not uploaded)

**Quick View Options:**
- **View Button** - Opens document in new browser tab
- **Download Button** - Downloads document to computer
- Loading states while fetching secure URLs
- Error handling with clear messages

**Expandable/Collapsible:**
- Click the "Player Documents" header to expand/collapse
- Compact badge in header shows status at a glance
- Saves screen space while keeping info accessible

---

### 3. Quick Action Buttons

Convenient buttons for common document-related tasks.

#### Available Actions:

**📧 Request Documents**
- Opens email client with pre-filled message
- Automatically addresses parent email
- Lists missing documents
- Professional template ready to send

**🖨️ Print Documents**
- Prints all uploaded documents
- Opens system print dialog
- Only visible when documents exist

**✅ Mark as Reviewed**
- Indicates coach/staff has reviewed documents
- Visual confirmation with checkmark
- Green highlight for reviewed status

---

### 4. Visual Design

#### Color Coding:
- **Green** - Documents uploaded, everything good
- **Yellow** - Warning, attention needed
- **Gray** - Neutral, no documents
- **Ice Blue (#9BD4FF)** - Action buttons and highlights

#### Icons:
- **PDF Icon** - For document files
- **Checkmark** - For completed/uploaded items
- **Warning Triangle** - For missing required documents
- **Email/Print/Check** - For action buttons

#### Layout:
- Clean card-based design
- Consistent with existing SniperZone branding
- Responsive for mobile and desktop
- Hover effects for interactivity

---

## User Workflows

### Admin Dashboard Table View

1. **View All Registrations:**
   - Open Admin Dashboard (`/admin`)
   - Enter password: `sniperzone2025`
   - See table with new "Documents" column
   - Badge shows document status for each player

2. **Identify Players Needing Follow-up:**
   - Look for yellow "Missing Docs" badges
   - These players have medical conditions but no documents
   - Priority for follow-up

3. **Click Row to View Details:**
   - Click any row to open detailed modal
   - Modal shows full registration information
   - Automatically opens to "Details" tab

### Registration Details Modal

1. **Player Documents Section (Top of Details Tab):**
   - **Expanded by default** - Shows full document info
   - **Collapsible** - Click header to collapse/expand
   - **Status Badges** - Visual indicators for each document
   - **Quick Actions** - Buttons for common tasks

2. **View Documents:**
   - Click "View" button on any document
   - Document opens in new browser tab
   - Uses secure signed URLs (expires after 1 hour)
   - Works for PDFs in all modern browsers

3. **Download Documents:**
   - Click "Download" button on any document
   - File downloads to computer
   - Preserves original filename
   - Uses secure signed URLs

4. **Request Missing Documents:**
   - Click "Request Documents" button
   - Opens email client (Gmail, Outlook, etc.)
   - Pre-filled with:
     - Parent's email address
     - Professional message template
     - List of missing documents
   - Customize message and send

5. **Print Documents:**
   - Click "Print Documents" button
   - Opens system print dialog
   - Prints all uploaded documents
   - Only visible when documents exist

6. **Mark as Reviewed:**
   - Click "Mark as Reviewed" after reviewing
   - Visual confirmation with green checkmark
   - Helps track review status

### Documents Tab

- **Alternative view** - Separate tab for documents only
- **Same functionality** - View and download capabilities
- **Larger cards** - More space for document details
- **Empty state** - Friendly message when no documents

---

## Security Features

### Signed URLs
- All document access uses signed URLs
- URLs expire after 1 hour for security
- New URL generated for each view/download
- Prevents unauthorized long-term access

### Private Storage
- Files stored in private Supabase bucket
- Not publicly accessible
- RLS policies control access
- Secure file organization by registration ID

### Access Control
- Admin password required for dashboard
- Only authenticated admins can view documents
- Secure email workflow for requesting documents

---

## Technical Details

### File Organization
```
medical-documents/
└── temp_[timestamp]_[random]/
    ├── actionPlan_[timestamp]_filename.pdf
    └── medicalReport_[timestamp]_filename.pdf
```

### Components

**New Components:**
1. `DocumentStatusBadge.tsx` - Visual status indicators
2. `PlayerDocumentsSection.tsx` - Collapsible documents section
3. `DocumentsViewer.tsx` - Full-page document viewer (existing)

**Updated Components:**
1. `AdminDashboard.tsx` - Added documents column and section
2. Integration of new document features

### Data Structure
```typescript
interface MedicalFiles {
  actionPlan?: {
    url: string;
    filename: string;
    size: number;
    uploadedAt: string;
  };
  medicalReport?: {
    url: string;
    filename: string;
    size: number;
    uploadedAt: string;
  };
}
```

---

## Best Practices

### For Administrators

1. **Regular Review:**
   - Check dashboard regularly for new registrations
   - Look for yellow warning badges
   - Follow up promptly on missing documents

2. **Document Requests:**
   - Use "Request Documents" button for consistency
   - Customize message as needed for specific situations
   - Track follow-ups in your system

3. **Before Training Sessions:**
   - Review all participants' documents
   - Print documents for on-site reference
   - Mark as reviewed after checking

4. **Privacy:**
   - Close modal when done viewing sensitive info
   - Log out of admin dashboard when finished
   - Don't share signed URLs (they expire anyway)

### For Parents

1. **Upload Requirements:**
   - PDF files only
   - Maximum 5MB per file
   - Clear, readable scans
   - Up-to-date information

2. **Document Types:**
   - **Action Plan** - Medical action plan from doctor
   - **Medical Report** - Current medical assessment

3. **Updates:**
   - Upload new documents if information changes
   - Contact admin if having upload issues
   - Keep copies for your records

---

## Troubleshooting

### Documents Won't Open
- **Check**: Browser pop-up blocker settings
- **Try**: Disable pop-up blocker for this site
- **Alternative**: Use Download button instead

### Email Client Doesn't Open
- **Check**: Default email client is set
- **Try**: Copy email address manually
- **Alternative**: Use webmail (Gmail, Outlook.com)

### Badge Shows Wrong Status
- **Check**: Recent uploads may take a moment
- **Try**: Refresh the page
- **Contact**: Admin if issue persists

### Can't Download File
- **Check**: Internet connection
- **Try**: View in browser, then save from there
- **Check**: Browser download permissions

---

## Future Enhancements

Potential features for consideration:

1. **Capacity Overview Integration:**
   - Mini profile cards when clicking players in time slots
   - Quick document access from capacity view
   - Medical alerts prominently displayed

2. **Document Review Tracking:**
   - Track who reviewed and when
   - Automatic notifications for new uploads
   - Expiration reminders for outdated documents

3. **Bulk Operations:**
   - Print all documents for a session
   - Email multiple parents at once
   - Export document status report

4. **Document Types:**
   - Additional document categories
   - Custom document requirements
   - Waiver forms and agreements

---

## Support

### For Technical Issues:
- Check browser console for error messages
- Verify Supabase bucket is configured correctly
- Review signed URL generation logs

### For Feature Requests:
- Document desired functionality
- Consider user workflows
- Discuss with development team

---

**Last Updated:** 2025-11-10
**Version:** 2.0
**Status:** Production Ready

---

## Quick Reference

### Keyboard Shortcuts
- **Click Row** - Open registration details
- **Esc** (when implemented) - Close modal
- **Ctrl/Cmd + P** - Print (after clicking Print button)

### Color Legend
- 🟢 Green = Good (documents uploaded)
- 🟡 Yellow = Warning (documents missing)
- ⚪ Gray = Neutral (no documents)
- 🔵 Ice Blue = Actions/Interactive elements

### File Size Limits
- Maximum: 5MB per file
- Format: PDF only
- Both files: 10MB total maximum

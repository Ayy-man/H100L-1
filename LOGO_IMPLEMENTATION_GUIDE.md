# Logo Implementation Guide

## Overview
You provided 3 versions of the new SniperZone logo:
1. **White logo** (for dark backgrounds) - transparent background
2. **Black logo** (for white backgrounds) - white background
3. **Black logo** (for light backgrounds) - transparent background

## Step 1: Save Logo Files

Create a `public` folder in the project root (if it doesn't exist) and save the logo files:

```bash
mkdir -p public/images/logos
```

Save the logos with these filenames:
- `public/images/logos/sniperzone-logo-white.png` (white logo, transparent background)
- `public/images/logos/sniperzone-logo-black.png` (black logo, transparent background)
- `public/images/logos/sniperzone-logo.svg` (optional: SVG version for scalability)

## Step 2: Update Components

### A. Landing Page Header (components/Header.tsx)

**Current code** (lines 28-29):
```tsx
<div className="text-2xl font-black tracking-tighter text-white">
  <span className="text-blue-400">SNIPER</span>ZONE
</div>
```

**Replace with**:
```tsx
<a href="/" className="flex items-center">
  <img
    src="/images/logos/sniperzone-logo-white.png"
    alt="SniperZone Logo"
    className="h-12 w-auto"
  />
</a>
```

---

### B. Dashboard Header (components/dashboard/DashboardLayout.tsx)

**Current code** (lines 66-78):
```tsx
<a href="/dashboard" className="flex items-center space-x-3">
  <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
    <span className="text-primary-foreground font-bold text-xl">SZ</span>
  </div>
  <div className="flex flex-col">
    <span className="text-foreground font-bold text-lg leading-tight">
      SniperZone
    </span>
    <span className="text-muted-foreground text-xs leading-tight">
      Hockey Training
    </span>
  </div>
</a>
```

**Replace with**:
```tsx
<a href="/dashboard" className="flex items-center">
  <img
    src="/images/logos/sniperzone-logo-black.png"
    alt="SniperZone Logo"
    className="h-10 w-auto dark:hidden"
  />
  <img
    src="/images/logos/sniperzone-logo-white.png"
    alt="SniperZone Logo"
    className="h-10 w-auto hidden dark:block"
  />
</a>
```

---

### C. Login Page (components/Login.tsx)

Search for any logo/branding elements and replace with:
```tsx
<img
  src="/images/logos/sniperzone-logo-black.png"
  alt="SniperZone Logo"
  className="h-16 w-auto mx-auto mb-6"
/>
```

---

### D. Admin Dashboard (components/AdminDashboard.tsx)

If there's a logo in the admin header, replace with:
```tsx
<img
  src="/images/logos/sniperzone-logo-white.png"
  alt="SniperZone Logo"
  className="h-10 w-auto"
/>
```

---

## Step 3: Update Vite Configuration (if needed)

Ensure Vite serves the `public` folder. In `vite.config.ts`, verify:

```typescript
export default defineConfig({
  publicDir: 'public', // This line should exist
  // ... rest of config
});
```

---

## Step 4: Test

1. **Run dev server**: `npm run dev`
2. **Check pages**:
   - Landing page header (white logo on dark background)
   - Login page (black logo)
   - Dashboard header (black logo, switches to white in dark mode)
   - Admin dashboard (white logo)

3. **Build for production**: `npm run build`
4. **Preview build**: `npm run preview`

---

## Optional: Convert to SVG

For best scalability, convert the PNG logos to SVG format:
1. Use a tool like Inkscape or Adobe Illustrator
2. Save as `sniperzone-logo-white.svg` and `sniperzone-logo-black.svg`
3. Update image `src` paths to use `.svg` instead of `.png`

---

## Dark Mode Support

The code above uses Tailwind's dark mode classes:
- `dark:hidden` - hides element in dark mode
- `dark:block` - shows element in dark mode
- `hidden` - hides by default (light mode)

This ensures the white logo shows on dark backgrounds and black logo on light backgrounds.

---

## Troubleshooting

**Logo not appearing?**
1. Verify file path: `/public/images/logos/filename.png`
2. Check file permissions: `chmod 644 public/images/logos/*.png`
3. Clear browser cache: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
4. Check browser console for 404 errors

**Logo too large/small?**
- Adjust the `h-10` (height) class: `h-8`, `h-12`, `h-16`, etc.
- Use `w-auto` to maintain aspect ratio

**Logo not aligned?**
- Wrap in flex container: `<div className="flex items-center">`
- Add margin/padding: `mr-4`, `ml-2`, etc.

# Language System Design

## Overview
Implement French (Québécois) as default language across all pages with EN/FR toggle.

## Architecture

### Centralized Language Context
- `contexts/LanguageContext.tsx` - single source of truth
- Provides: `language`, `setLanguage()`, `t()` helper
- Default: `Language.FR`
- Persists to localStorage

### Translation File
- `lib/translations.ts` - nested object by component/page
- Quebec French (not European French)
- ~150-200 translatable strings

## Components to Update

| Priority | Component | Changes |
|----------|-----------|---------|
| 1 | contexts/LanguageContext.tsx | Create new |
| 2 | lib/translations.ts | Create new |
| 3 | App.tsx | Wrap in provider, remove local state |
| 4 | DashboardLayout.tsx | Add toggle to header |
| 5 | AdminDashboard.tsx | Use context instead of local state |
| 6 | BillingPage.tsx | Add translations |
| 7 | SignupPage.tsx | Add translations |
| 8 | ProfilePage.tsx | Add translations |
| 9 | Dashboard modals (7 files) | Add translations |
| 10 | Dashboard cards (5 files) | Add translations |

## Toggle Placement
- Homepage: Header (existing)
- Parent Dashboard: DashboardLayout header
- Admin Dashboard: Existing toggle, wire to context

## Quebec French Notes
- "Courriel" not "email"
- "Fin de semaine" not "week-end"
- Direct/informal tone

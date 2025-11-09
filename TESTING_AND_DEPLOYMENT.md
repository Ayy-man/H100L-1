# SniperZone: Testing Strategy & Deployment Pipeline

This document provides a comprehensive guide to ensuring the quality, reliability, and smooth deployment of the SniperZone Hockey Training application. It outlines the testing strategy across multiple layers and provides a detailed checklist for production deployment.

---

## 1. Testing Strategy

We will adopt a testing pyramid approach to maximize efficiency and test coverage. This strategy includes Unit, Component, Integration, and End-to-End (E2E) tests.

**Recommended Tools:**
*   **Unit/Component Testing:** [Vitest](https://vitest.dev/) or [Jest](https://jestjs.io/) with [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/).
*   **E2E Testing:** [Cypress](https://www.cypress.io/) or [Playwright](https://playwright.dev/).

---

### 1.1. Unit Tests
**Goal:** Verify that individual functions and pure business logic work correctly in isolation.

**Target Files:**
*   `lib/capacityManager.ts`
*   `lib/bookingService.ts`
*   `lib/timeSlots.ts`
*   Any utility functions (e.g., `utils/priceCalculator.js` if it existed).

**Example: `bookingService.ts` Unit Test (using Jest/Vitest syntax)**
```javascript
// a-test-file-for-bookingService.test.ts
import { makeBooking, checkAvailability } from './lib/bookingService';
import { _updateBookingState } from './lib/capacityManager'; // Mock this

// Mock the state update to isolate the booking logic
vi.mock('./lib/capacityManager', () => ({
  getAvailability: vi.fn(),
  _updateBookingState: vi.fn(() => true),
}));

describe('Booking Logic', () => {
  it('should prevent booking a 2x session if slots are full', () => {
    // Arrange: Mock that 2x sessions are unavailable
    getAvailability.mockReturnValue({
      timeSlot: '4:30-5:30 PM',
      canBook2x: false,
      available2xSlots: 0,
      // ... other properties
    });
    
    const bookingRequest = { category: 'M9', frequency: '2x' };

    // Act
    const result = makeBooking(bookingRequest);

    // Assert
    expect(result.success).toBe(false);
    expect(result.message).toContain('sessions are full');
    expect(_updateBookingState).not.toHaveBeenCalled();
  });
});
```

---

### 1.2. Component Tests
**Goal:** Test individual React components to ensure they render and behave correctly based on their props.

**Target Files:**
*   `components/form/FormInput.tsx`
*   `components/form/FormStep1.tsx`
*   `components/Pricing.tsx`

**Example: `FormInput.tsx` Component Test (using React Testing Library)**
```jsx
// FormInput.test.tsx
import { render, screen } from '@testing-library/react';
import FormInput from './components/form/FormInput';

describe('FormInput', () => {
  it('displays an error message when an error prop is provided', () => {
    // Arrange
    const errorMessage = "This field is required";
    render(
      <FormInput 
        label="Player Name"
        name="playerName"
        error={errorMessage}
        // ... other props
      />
    );

    // Act & Assert
    const errorElement = screen.getByText(errorMessage);
    expect(errorElement).toBeInTheDocument();
    expect(errorElement).toHaveClass('text-red-500'); // Check styling
  });
});
```
---

### 1.3. Integration Tests
**Goal:** Verify that multiple components work together as expected, or that the UI integrates correctly with (mocked) APIs.

**Target Flow:**
*   The entire multi-step form flow (`RegistrationForm.tsx`).
*   Interaction between the pricing plan selection and the form's state.

**Example: Multi-Step Form Integration Test**
```jsx
// RegistrationForm.integration.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App'; // Render the whole app to test the modal flow

it('should persist data between form steps and show a summary on the final step', async () => {
  render(<App />);
  const user = userEvent.setup();

  // Open the form
  await user.click(screen.getByText(/Register Now/i));

  // Step 1: Fill player name
  await user.type(screen.getByLabelText(/Player Full Name/i), 'Test Player');
  // ... fill other required fields ...
  
  // Go to next step
  await user.click(screen.getByRole('button', { name: 'Next' }));
  
  // Step 2: Select program
  await user.selectOptions(screen.getByLabelText(/Select Program Type/i), 'group');
  // ... fill other required fields ...
  
  // Navigate through all steps
  await user.click(screen.getByRole('button', { name: 'Next' })); // to Step 3
  // ... fill step 3 ...
  await user.click(screen.getByRole('button', { name: 'Next' })); // to Step 4

  // Assert: Check if the data from Step 1 is displayed on the final review step
  expect(screen.getByText('Player Name')).toBeInTheDocument();
  expect(screen.getByText('Test Player')).toBeInTheDocument();
});
```

---

### 1.4. End-to-End (E2E) Tests
**Goal:** Simulate a complete user journey in a real browser to validate the entire application flow from start to finish.

**Primary E2E Test Case: Full Registration Flow**
1.  **Visit** the homepage.
2.  **Assert** the main heading "SNIPERZONE" is visible.
3.  **Click** the language toggle to switch to 'EN'.
4.  **Assert** the heading changes to the English version.
5.  **Click** on a "Register" CTA from the `ProgramCards` section (e.g., for Group Training).
6.  **Assert** the registration form modal opens.
7.  **Assert** the "Program Type" dropdown in Step 2 is pre-filled with "Group Training".
8.  **Complete** Step 1 with valid test data. Click "Next".
9.  **Complete** Step 2 and 3. Click "Next".
10. **Assert** the final review step (Step 4) displays the correct summary and price.
11. **Enter** Stripe's test credit card details into the payment element.
12. **Click** the "Pay & Register" button.
13. **Assert** that a success confirmation appears and the form modal closes.

---

## 2. Deployment Pipeline & Checklist

**CI/CD Platform:** Vercel or Netlify are recommended for their seamless Git integration, automatic builds, and preview deployments.

### Continuous Integration (CI)
On every push to a branch, the CI pipeline should automatically:
1.  Install dependencies (`npm install`).
2.  Run the linter (`npm run lint`).
3.  Run all unit and component tests (`npm test`).
4.  Run all E2E tests (`npm run e2e`).
5.  Build the application (`npm run build`).

### Deployment Checklist

#### ✅ 1. Environment Variables
Set up environment variables in the Vercel/Netlify project settings. **Never commit these to Git.**
-   `REACT_APP_STRIPE_PUBLISHABLE_KEY`: Your publishable key from Stripe.
-   `STRIPE_SECRET_KEY`: Your secret key (used on the serverless function backend).
-   `STRIPE_WEBHOOK_SECRET`: Secret for verifying Stripe webhooks.
-   `GHL_API_KEY`: API Key for your CRM.

#### ✅ 2. SSL Certificate
Vercel and Netlify provide free SSL certificates automatically for all deployments. Ensure this is active.

#### ✅ 3. Domain Configuration
-   Purchase a custom domain (e.g., `sniperzone.ca`).
-   Follow the Vercel/Netlify documentation to point your domain's DNS records to their servers.

#### ✅ 4. Stripe Webhook Endpoints
-   In the Stripe Dashboard, configure a webhook endpoint pointing to your production URL (e.g., `https://sniperzone.ca/api/webhooks/stripe`).
-   Listen for events like `invoice.payment_succeeded`, `customer.subscription.deleted` to keep your database in sync.

#### ✅ 5. CRM (GoHighLevel) Webhook Endpoints
-   If required, set up webhooks in your CRM to receive notifications or trigger workflows when new contacts are created via your API.

#### ✅ 6. Error Monitoring
-   Integrate a service like [Sentry](https://sentry.io/).
-   Add the Sentry DSN as an environment variable (`SENTRY_DSN`).
-   Initialize Sentry in your `index.tsx` to automatically capture runtime errors from users.

#### ✅ 7. Analytics
-   Integrate a service like [Google Analytics 4](https://analytics.google.com/) or [Mixpanel](https://mixpanel.com/).
-   Add your Measurement ID (`GA_MEASUREMENT_ID`) as an environment variable and initialize it in your application to track page views and user events (e.g., registration funnel progress).

#### ✅ 8. Performance Optimization
-   **Image Optimization:** Ensure all images are compressed and served in modern formats (e.g., WebP). Vercel/Netlify often have built-in image optimization.
-   **Code Bundling:** The `npm run build` command (from Create React App / Vite) already handles code minification and tree-shaking.
-   **CDN:** Vercel/Netlify automatically deploy assets to a global CDN for fast delivery.

#### ✅ 9. SEO Meta Tags
-   Use a library like `react-helmet-async` to set dynamic `<title>` and `<meta name="description">` tags for better search engine visibility.
-   Ensure `index.html` has appropriate tags for language and social sharing (Open Graph).

#### ✅ 10. Security Headers
-   Add essential security headers to prevent common web vulnerabilities like Cross-Site Scripting (XSS) and clickjacking.

---

### Deployment Scripts & Configuration

#### For Vercel (`vercel.json`)
Create this file in the root of your project. Vercel will apply these headers to all responses.
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Content-Security-Policy", "value": "frame-ancestors 'none';" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" },
        { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains; preload" }
      ]
    }
  ]
}
```

#### For Netlify (`netlify.toml`)
Create this file in the root of your project.
```toml
[build]
  command = "npm run build"
  publish = "dist" # Or "build" depending on your setup

[[headers]]
  for = "/*"
  [headers.values]
    Content-Security-Policy = "frame-ancestors 'none';"
    X-Content-Type-Options = "nosniff"
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    Strict-Transport-Security = "max-age=31536000; includeSubDomains; preload"
```

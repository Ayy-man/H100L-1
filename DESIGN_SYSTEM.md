# SniperZone Hockey Training Design System

This document outlines the design system for the SniperZone Hockey Training brand. The aesthetic is modern, elite, and performance-focused, using a stark color palette with a vibrant accent to create a high-impact visual identity.

---

## 1. Color Palette

The color palette is minimalist and high-contrast, designed to evoke the feeling of being on the ice under bright lights. The "Ice Blue" accent is used exclusively for interactive elements to guide the user's attention.

| Role          | Hex/RGBA                    | Tailwind Class (Suggestion)       | Usage                               |
|---------------|-----------------------------|-----------------------------------|-------------------------------------|
| Background    | `#000000`                   | `bg-black`                        | Main page and section backgrounds   |
| Primary Text  | `#FFFFFF`                   | `text-white`                      | All headings and body copy          |
| Accent / CTA  | `#9BD4FF`                   | `bg-[#9BD4FF]` / `text-[#9BD4FF]` | Buttons, links, active states, glows|
| Form Fields   | `rgba(255, 255, 255, 0.12)`  | `bg-white/10`                     | Input backgrounds                   |
| Error         | `#FF3B3B`                   | `text-red-500` / `border-red-500` | Error messages, invalid field borders|
| Success       | `#4ADE80`                   | `text-green-400` / `border-green-500` | Success messages, confirmation indicators|

---

## 2. Typography

The chosen font is **Inter**, a clean and bold sans-serif that ensures readability and a modern feel. Headings are always uppercase to convey strength and importance.

- **Font Family:** Inter (`font-sans`)
- **Headings:** `uppercase font-black tracking-wider`
- **Body:** `font-normal`

| Element   | Desktop Size | Mobile Size | Tailwind Classes                           |
|-----------|--------------|-------------|--------------------------------------------|
| Heading 1 | 72px         | 48px        | `text-5xl md:text-7xl uppercase font-black tracking-wider` |
| Heading 2 | 48px         | 32px        | `text-3xl md:text-5xl uppercase font-black tracking-wider` |
| Body      | 16px         | 16px        | `text-base font-normal text-white`             |
| Small     | 14px         | 14px        | `text-sm text-gray-400`                    |


### Example:
```html
<h1 class="text-5xl md:text-7xl uppercase font-black tracking-wider">DOMINATE THE ICE</h1>
<p class="text-base mt-4">This is the body copy. It's clean, readable, and uses the default font weight.</p>
```

---

## 3. UI Components

Component examples are provided using React/JSX and Tailwind CSS classes.

### 1. Hero Section with Countdown Timer
A full-screen, high-impact introduction.

```jsx
const HeroWithCountdown = () => (
  <section className="h-screen bg-black flex flex-col items-center justify-center text-center p-4">
    <div className="absolute inset-0 bg-[url('/path/to/ice-texture.jpg')] bg-cover bg-center opacity-10"></div>
    <div className="absolute inset-0 bg-gradient-to-b from-black/50 to-black"></div>
    <div className="relative z-10">
      <h1 className="text-5xl md:text-7xl uppercase font-black tracking-wider">REGISTRATION OPENS SOON</h1>
      <p className="text-base md:text-lg text-gray-300 mt-4 max-w-2xl mx-auto">
        The next elite training camp is just around the corner. Secure your spot before it's too late.
      </p>
      {/* Countdown Timer Component */}
      <div className="flex justify-center gap-4 md:gap-8 mt-12 text-white">
        <div>
          <span className="text-4xl md:text-6xl font-black">12</span>
          <span className="block text-sm uppercase tracking-widest text-gray-400">Days</span>
        </div>
        <div>
          <span className="text-4xl md:text-6xl font-black">08</span>
          <span className="block text-sm uppercase tracking-widest text-gray-400">Hours</span>
        </div>
        <div>
          <span className="text-4xl md:text-6xl font-black">45</span>
          <span className="block text-sm uppercase tracking-widest text-gray-400">Minutes</span>
        </div>
      </div>
    </div>
  </section>
);
```

### 2. Program Cards
Used to display different training options.

```jsx
const ProgramCard = ({ title, description }) => (
  <div className="bg-gray-900 border border-white/10 rounded-xl p-8 transform transition-transform hover:-translate-y-2">
    <h3 className="text-2xl font-bold uppercase tracking-wider mb-4">{title}</h3>
    <p className="text-gray-400">{description}</p>
  </div>
);

const Programs = () => (
  <div className="grid md:grid-cols-3 gap-8">
    <ProgramCard title="Group Sessions" description="High-intensity drills in a competitive team environment." />
    <ProgramCard title="Private Coaching" description="One-on-one tailored training to target your specific weaknesses." />
    <ProgramCard title="Semi-Private" description="Small group (2-4 players) focus on positional skills and game sense." />
  </div>
);
```

### 3. Multi-Step Form (Conceptual)
A high-level structure for a single form step.

```jsx
const FormStep = ({ step, title, children }) => (
  <div>
    <div className="mb-8 text-center">
      <p className="text-sm font-bold text-[#9BD4FF] uppercase">Step {step} of 4</p>
      <h2 className="text-3xl md:text-5xl uppercase font-black tracking-wider mt-2">{title}</h2>
    </div>
    <div className="space-y-6">
      {children}
    </div>
  </div>
);
```

### 4. Pricing Tables
Clearly outlines the value of the subscription. The featured plan has an accent border.

```jsx
const PricingTable = () => (
    <div className="bg-black border-2 border-[#9BD4FF] rounded-2xl p-8 max-w-md mx-auto shadow-2xl shadow-[#9BD4FF]/20">
        <h3 className="text-2xl uppercase font-bold tracking-wider">ELITE MONTHLY</h3>
        <p className="text-5xl font-black my-4">$299 <span className="text-lg text-gray-400 font-normal">/month</span></p>
        <ul className="space-y-3 text-gray-300 my-8">
            <li className="flex items-center">✓ Unlimited Synthetic Ice</li>
            <li className="flex items-center">✓ Weekly Real Ice Sessions</li>
            <li className="flex items-center">✓ Pro Coaching Feedback</li>
        </ul>
        <a href="#" className="w-full text-center block bg-[#9BD4FF] text-black font-bold py-4 px-8 rounded-lg uppercase tracking-wider transition-shadow hover:shadow-[0_0_15px_#9BD4FF]">
            Join Now
        </a>
    </div>
);
```

### 5. CTAs (Call to Action)
Primary button with the signature ice blue glow on hover.

```jsx
<button className="bg-[#9BD4FF] text-black font-bold py-3 px-8 rounded-lg uppercase tracking-wider transition-all duration-300 hover:shadow-[0_0_15px_rgba(155,212,255,0.8),0_0_25px_rgba(155,212,255,0.5)] hover:scale-105">
  Register Now
</button>
```

### 6. Form Inputs
Inputs with transparent backgrounds for a modern, integrated look.

```jsx
<div>
  <label htmlFor="playerName" className="block text-sm font-medium text-gray-300 mb-2">Player Name</label>
  <input
    type="text"
    id="playerName"
    className="w-full bg-white/10 border-2 border-white/20 rounded-lg py-3 px-4 text-white placeholder-gray-500
               focus:outline-none focus:ring-2 focus:ring-[#9BD4FF] focus:border-transparent transition"
    placeholder="e.g., John Smith"
  />
</div>
```

### 7. Error/Success States

**Error State:**
```jsx
<div>
  <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
  <input
    type="email"
    id="email"
    className="w-full bg-white/10 border-2 border-red-500 rounded-lg py-3 px-4 text-white
               focus:outline-none focus:ring-2 focus:ring-red-500 transition"
  />
  <p className="mt-2 text-sm text-red-500">Please enter a valid email address.</p>
</div>
```

**Success Alert:**
```jsx
<div className="border border-green-500 bg-green-500/10 text-green-400 p-4 rounded-lg flex items-center">
  <span>✓ Your registration was successful!</span>
</div>
```

### 8. Loading States
A simple, on-brand spinner.

```jsx
<div className="flex justify-center items-center">
  <svg className="animate-spin h-8 w-8 text-[#9BD4FF]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
</div>
```

### 9. Modal Confirmation
Uses a frosted glass effect for the overlay.

```jsx
<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
  {/* Overlay */}
  <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
  
  {/* Modal */}
  <div className="relative bg-black border border-white/10 rounded-xl shadow-lg w-full max-w-md p-8">
    <h2 className="text-2xl uppercase font-bold tracking-wider text-center">Confirm Registration</h2>
    <p className="text-gray-400 text-center my-4">You are about to subscribe to the Elite Monthly plan. Are you ready to elevate your game?</p>
    <div className="flex justify-center gap-4 mt-8">
      <button className="bg-gray-700 text-white font-bold py-2 px-6 rounded-lg hover:bg-gray-600 transition">Cancel</button>
      <button className="bg-[#9BD4FF] text-black font-bold py-2 px-6 rounded-lg hover:shadow-[0_0_15px_#9BD4FF] transition">Confirm</button>
    </div>
  </div>
</div>
```

---

## 4. Animations & Effects

Animations should be subtle, smooth, and purposeful, enhancing the user experience without being distracting.

-   **Ice Blue Glow:** Applied on hover to primary CTAs and key interactive elements. Use a combination of `box-shadow` and `transition` for a smooth effect.
    -   `transition-shadow duration-300 hover:shadow-[0_0_15px_#9BD4FF]`
-   **Smooth Transitions:** All state changes (hover, focus) should be animated.
    -   `transition-all duration-300 ease-in-out`
-   **Frosted Glass Overlays:** Used for modals and sticky headers to create a sense of depth.
    -   `bg-black/50 backdrop-blur-lg`
-   **Page Scroll Animations:** Elements should fade or slide into view as the user scrolls. This is best achieved with a library like `framer-motion`.
    -   Example: `<motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>...</motion.div>`

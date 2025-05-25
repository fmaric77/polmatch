# GitHub Copilot Style Instructions

Always follow these rules when generating or editing code for this project:

- Use the same styling conventions as the rest of the app.
- Use Tailwind CSS utility classes for all layout, color, and spacing.
- Use dark backgrounds (bg-black, bg-black/80) and white text (text-white) for main containers.
- Use rounded corners (rounded, rounded-lg), borders (border, border-white), and drop shadows (shadow, shadow-lg) for containers.
- Use consistent padding (p-2, p-4, p-6, p-8) and margin (m-2, m-4, m-8, mt-8, mb-6, etc.).
- Use the same font and color scheme as the rest of the app.
- Use flex and grid utilities for layout, centering, and alignment.
- Use the same button and input styles as seen in other pages (e.g., bg-white text-black rounded hover:bg-gray-200).
- Always match the look and feel of existing pages, especially login, profile, and frontpage.
- Never introduce new styling conventions or CSS unless explicitly instructed.
- If unsure, copy the style from existing pages/components.

These rules must be followed for all new features, pages, and components.

---

# TypeScript/JavaScript Rules
- **Never use `any`**. Always specify a more precise type. If unsure, use `unknown` and narrow the type as soon as possible.
- **Remove all unused variables**. Do not leave variables or imports that are not used.
- **Prefer `const` over `let`**. Only use `let` if the variable will be reassigned.
- **Handle all errors and unused catch variables**. If a catch variable is unused, omit it or use `_`.
- **Follow ESLint and TypeScript warnings strictly**. Fix all reported issues before committing code.
- **Use explicit return types for all functions**.
- **Use interfaces and types for objects and function arguments.**

# React/Next.js Rules
- **Always type props and state.**
- **Do not use `any` in component props or state.**
- **Remove unused hooks, variables, and imports.**
- **Follow all React and Next.js best practices.**

# General
- **Write clean, readable, and maintainable code.**
- **Add comments for complex logic.**
- **Do not commit code with lint or type errors.**

> **Copilot: If you are about to generate code that uses `any`, leaves unused variables, or violates these rules, STOP and fix it before suggesting code.**

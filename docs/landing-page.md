# Landing page integration

Guests see the landing page first. `#login` opens sign in and `#signup` opens registration. Landing section links, browser back/forward navigation, and the auth screen's back button use ordinary hash navigation. Existing authenticated sessions still open the dashboard. After login, the public auth hash is removed.

The page lives in `src/pages/Landing.jsx`, with styles in `src/styles/base/landing.css`. The stylesheet is imported last by `src/styles/index.css`, and all marketing styles are scoped to `.landing-*` selectors. It reuses the app's logo, icons, color variables, and English interface language. Product previews use explicitly labeled sample data and never write to the API.

## Neural Noise

The supplied shader is in `src/components/ui/neural-noise.jsx`. The `ui` directory gives reusable visual primitives a predictable home, separate from complete pages. Its default RGB color matches the app's lime accent (`#c8ff58`); `color`, `opacity`, and `speed` remain configurable.

The canvas fits the hero container instead of the whole viewport. It respects reduced motion, pauses when offscreen or in a hidden tab, caps pixel density and animation rate, and releases animation frames, event listeners, observers, buffers, shaders, and the WebGL program on unmount. A CSS background keeps the hero usable if WebGL is unavailable.

## Stack compatibility

This existing project uses React, Vite, JavaScript/JSX, and plain CSS. The component follows that structure and needs no new runtime dependency, assets from external servers, provider, or state library. Tailwind, TypeScript, and shadcn are optional; they are not required by the shader or this page.

If the project later adopts the template's suggested stack:

1. Install TypeScript and React types with `npm install -D typescript @types/react @types/react-dom`; add a Vite-compatible `tsconfig.json` with `jsx: "react-jsx"`, `moduleResolution: "bundler"`, and `allowJs: true` for gradual adoption. Rename the visual component to `.tsx` and type its props and canvas reference.
2. Install Tailwind's Vite integration with `npm install -D tailwindcss @tailwindcss/vite`, register its plugin beside React in `vite.config.js`, and import Tailwind into a CSS entry. Review global CSS changes against the existing interface.
3. Set an `@` alias to `src` in Vite and TypeScript, run `npx shadcn@latest init`, and choose `src/components/ui` as the UI component directory. Keep `src/pages` for complete screens and `src/styles` for existing styles.

## Verification

Run `npm run check`. `src/landing.test.js` covers guest arrival, preview interactions and keyboard tabs, registration/sign-in navigation, returning to the landing, successful authentication, logout, and the existing-session dashboard bypass. API tests continue using disposable databases.

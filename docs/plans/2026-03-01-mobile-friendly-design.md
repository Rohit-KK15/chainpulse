# Mobile-Friendly ChainPulse Design

## Approach

CSS-first with a collapsible drawer for header controls. Minimal new components — one `MobileDrawer` and one `useIsMobile` hook. The 3D scene stays fullscreen with mobile-optimized defaults.

## 1. Mobile Detection

`useIsMobile()` hook using `matchMedia('(max-width: 768px)')`. Returns boolean. Used by Overlay to toggle between inline header (desktop) and drawer (mobile).

## 2. Mobile Drawer

New inline component in `src/ui/Overlay.tsx`:

- **Trigger:** Hamburger button, top-right, visible only on mobile
- **Panel:** Full-height slide-in from right, glassmorphism background
- **Contents:** Chain selector (vertical full-width buttons), Stats strip, Token filter — same existing components, vertically stacked
- **Dismissal:** Backdrop tap, X button, Escape key
- **Animation:** CSS `transform: translateX()` transition

Mobile header simplifies to: Logo (left) + Hamburger (right).

## 3. CSS Changes (App.css)

- Override CSS custom properties at `@media (max-width: 768px)` — bump font sizes +1-2px
- All buttons/clickable elements: `min-height: 44px` on mobile (Apple HIG)
- Safe area insets: `padding` uses `env(safe-area-inset-*)` on overlay
- Whale slider thumb: 10px → 20px on mobile
- Info/screenshot buttons: 22px → 36px on mobile
- Chain buttons in drawer: full-width rows instead of wrapping pills
- Drawer styles: slide-in panel, backdrop, vertical layout

## 4. 3D Scene Mobile Optimizations

- Camera distance: 26 on mobile (vs 22 desktop) for wider view
- OrbitControls: enable autoRotate on touch at 0.1 speed
- Bloom intensity: 1.5 → 1.0 on mobile
- DPR cap: `[1, 1.5]` on mobile (vs `[1, 2]`)

## 5. Panel/Modal Adjustments

- Tx Detail: position at bottom of viewport on mobile (bottom-sheet style)
- Hover tooltip: skip rendering on touch devices
- Screenshot modal: `max-height: 80vh`, scrollable
- Info panel: full width, bottom-anchored on mobile

## 6. Viewport Meta

Update `index.html`:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

## Files Changed

1. `index.html` — viewport-fit=cover
2. `src/ui/Overlay.tsx` — useIsMobile hook, MobileDrawer component, conditional rendering
3. `src/App.css` — mobile drawer styles, enlarged touch targets, safe areas, font overrides
4. `src/visualization/Scene.tsx` — mobile-aware camera/bloom/DPR defaults

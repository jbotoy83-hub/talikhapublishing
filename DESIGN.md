# DESIGN SYSTEM — Talikha Publishing

## 1. Visual Theme & Atmosphere
A calm, scholarly interface with generous whitespace, typographic authority, and restrained warmth. Think: a well-designed academic journal meets thoughtful literary magazine. Density 4/10, Variance 6/10, Motion 4/10.

## 2. Color Palette & Roles
| Token | Hex | Role |
|---|---|---|
| Canvas | `#f7f3ea` | Warm off-white background |
| Surface | `#ffffff` | Cards, panels, elevated surfaces |
| Forest | `#183d2c` | Primary brand, headings, CTAs |
| Forest Dark | `#0e271e` | Footer, announcement bar, dark sections |
| Clay | `#a65335` | Accent — links, hover states, active indicators |
| Amber | `#e8b45e` | Secondary accent — badges, eyebrow labels |
| Ink | `#1c2821` | Body text (never pure black) |
| Muted | `#6b756d` | Secondary text, metadata, placeholders |
| Line | `#d8ddd4` | Structural borders, dividers |

Rules: One accent family per section. No neon glows. No oversaturated colors. Tint shadows to background hue.

## 3. Typography Rules
| Level | Font | Size | Notes |
|---|---|---|---|
| Display H1 | Literata (serif) | clamp(2.9rem, 5vw, 4.6rem) | Track-tight (-0.02em), leading-none |
| Display H2 | Literata (serif) | text-3xl to text-4xl | Bold, tight tracking |
| Section H3 | Inter (sans) | text-lg to text-xl | SemiBold (600) |
| Body | Inter (sans) | text-base | Regular (400), line-height 1.6 |
| Small | Inter (sans) | text-sm | Muted color, line-height 1.5 |
| Eyebrow | Inter (sans) | text-[11px] | Uppercase, tracking-[0.18em], muted |
| Meta | Inter (sans) | text-xs | Labels, dates, counts |

Serif only for display/headings on editorial pages. Sans-serif for body, UI, navigation. Never Inter as the sole font.

## 4. Component Stylings
### Buttons
- Primary: `bg-forest-800 text-white rounded-full px-5 py-3 text-sm font-bold hover:bg-forest-900 active:scale-[0.98] transition-all duration-200`
- Secondary: `bg-white text-forest-900 rounded-full px-5 py-3 text-sm font-bold border border-forest-900/10 hover:border-clay-500 active:scale-[0.98] transition-all duration-200`
- Ghost: `text-forest-800 font-semibold underline-offset-4 hover:underline`
- Icon buttons: `h-10 w-10 grid place-items-center rounded-full hover:bg-gray-100 transition-colors duration-200`

### Cards
- Border: `border border-line bg-surface`
- Radius: `rounded-2xl`
- Shadow: none by default; use inner highlight (`ring-1 ring-black/[0.03]`) when needed
- Padding: `p-6` for content cards, `p-7` for cover cards
- Hover: `hover:border-clay-500/30 transition-colors duration-200`

### Inputs & Forms
- Label above input, error below
- Focus ring: `focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800`
- Placeholder: `placeholder:text-muted`

### Badges & Tags
- Pill: `rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider`
- Pastel backgrounds: pale green for success, pale amber for warning, pale red for danger

## 5. Layout Principles
- Max-width container: `max-w-[1400px]` or `section-shell`
- Section padding: `py-20` standard, `py-24` for hero-adjacent sections
- Grid rhythm: `gap-6` for card grids, `gap-8` for major layouts
- Asymmetric where intentional (hero split, service layout)
- Never three equal card columns without variation
- Mobile collapse: explicit `< 768px` fallback per multi-column section
- Full-height sections: `min-h-[100dvh]` never `h-screen`

## 6. Motion & Interaction
- Transitions: `duration-200 ease-out` for hover, `duration-300` for page-level
- Easing: `ease-[cubic-bezier(0.16,1,0.3,1)]` for premium feel
- Transform-only animations: `transform`, `opacity` — never `top`, `left`, `width`, `height`
- Hover physics: `active:scale-[0.98]` on buttons, `group-hover:translate-x-0.5` on arrow icons
- Scroll entry: fade-up `translate-y-12 opacity-0` → `translate-y-0 opacity-100` over 600ms
- Stagger cascade: `animation-delay: calc(var(--index) * 80ms)` for lists/grids
- Reduced motion: honor `prefers-reduced-motion` — degrade to static

## 7. Anti-Patterns (Banned)
- No `Inter` as the only font (pair serif display + sans body)
- No pure black (`#000000`) — use ink (`#1c2821`)
- No neon/outer glow shadows
- No generic "three equal card" feature rows
- No AI copywriting clichés ("Elevate", "Seamless", "Unleash", "Next-Gen")
- No centered hero when variance > 4 (use asymmetric)
- No overlapping elements
- No placeholder names ("John Doe", "Acme Corp")
- No fake precise numbers without context
- No emojis in code or visible text
- No custom mouse cursors
- No excessive gradient text on large headers
- No 3-column equal grids without variation
- No generic circular spinners (use skeletal loaders)
- No pill-shaped containers for large cards (use `rounded-2xl` max)
- No pure white `#ffffff` backgrounds everywhere — vary surface tones
- No inconsistent corner radius across a page
- No duplicate CTA intent on one page
- No wrapped button text at desktop

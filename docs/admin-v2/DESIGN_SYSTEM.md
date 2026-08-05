# ADMIN V2 design system

## Visual direction

Preview concepts: generated shell/overview and room-operations references in the current Codex thread. They are design references only; production screens remain code-native and use PostgreSQL responses.

- Dark navy shell; restrained muted gold identity/active accent.
- Neutral content background with open operational tables and a small number of purposeful surfaces.
- Visual density target 7/10, variance 3/10, motion 0/10.
- Vietnamese-first copy; immutable provider/code identifiers may remain secondary.
- No gradients, glassmorphism, decorative serif, animation, card-inside-card, or equal-weight card soup.

## Tokens

Use existing `apps/web/src/app/globals.css` tokens as the source of truth and consolidate ADMIN values around:

- background: neutral operational canvas;
- surface/elevated surface: white and muted neutral panels;
- border: low-contrast slate;
- text/muted text: dark navy/slate;
- primary: dark navy;
- identity accent: muted gold;
- destructive/warning/success/focus: semantic red/amber/green/focus ring;
- sidebar/sidebar-active: dark navy and gold-highlighted active state.

Limit practical text sizes to five, font weights to four, radii to three, and elevation levels to three.

## Shared component families

`AdminPageHeader`, `AdminFilterToolbar`, `AdminMetricSummary`, `AdminStatusLabel`, `AdminDataTable`, `AdminDetailSheet`, `AdminFormSection`, `AdminConfirmDialog`, `AdminErrorState`, `AdminEmptyState`, `AdminLoadingState`, `AdminResponsiveActionBar`, and `AdminPermissionBoundary`.

Use installed Base UI components first: `Sidebar`, `Breadcrumb`, `Button`, `Badge`, `DropdownMenu`, `Sheet`, `Dialog`, `AlertDialog`, `ScrollArea`, `Separator`, `Skeleton`, `Alert`, `Empty`, `Sonner`, `Table`, `Tabs`, `Tooltip`, `Field`, `Input`, and `Select`. No second UI system is introduced.

## Responsive rules

- Desktop: compact sidebar, breadcrumb/title/actions, dense data area.
- Tablet/mobile: sidebar through `Sheet`, filters through `Sheet` or compact toolbar, detail sheets full-screen, primary action remains reachable, forms single-column.
- Keep table semantics where comparison matters; use internal horizontal `ScrollArea` only for essential wide tables.
- No page-level horizontal overflow, clipped Vietnamese, or unreadable operational text.

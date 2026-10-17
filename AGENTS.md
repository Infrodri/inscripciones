# Project Guidelines for AI Agents

## UI & Modal Anti-Regression Rules

1. **Never use modal components as trigger wrappers**:
   - `<ConfirmDialog>` is an overlay modal, NOT a trigger wrapper or dropdown component.
   - Do NOT wrap action buttons inside `<ConfirmDialog>` (e.g. `<ConfirmDialog><Button>Eliminar</Button></ConfirmDialog>`).
   - Action buttons (e.g., "Abrir", "Duplicar", "Eliminar") must remain independent sibling elements.

2. **Single modal instance at parent level**:
   - Never render modals or dialogs inside an array iteration (`.map()`).
   - Maintain a single modal instance at the page or container level controlled by state (e.g., `deleteTarget: Item | null`).
   - Render conditionally at root: `{deleteTarget && <ConfirmDialog open={true} ... onCerrar={() => setDeleteTarget(null)} />}`.

3. **Modal Focus Trap & Recursion Protection**:
   - Modals MUST accept an `open?: boolean` prop and return `null` immediately before any hook or effect if `open === false`.
   - Focus traps must verify that the focused element is not already within the dialog and not within another active modal/dialog before invoking `focus()`.

4. **Design Tokens & UI Component Standards**:
   - Always use designated `<Button>` variants: `primario`, `secundario`, `peligro`, `fantasma`.
   - Use Tailwind `@theme` semantic tokens (`bg-surface`, `text-ink`, `border-line`, `text-muted`, `bg-warn-bg`, `text-danger`, etc.).
   - NEVER use raw hardcoded hex colors (e.g., `#ffffff`, `#1a202c`).
   - Do not wrap `<Link>` components in superfluous `<span>` tags.

5. **Local Services & Health Verification**:
   - The application relies on Express API (:3001) and PostgreSQL (:5434).
   - Before executing browser-based workflows or end-to-end verifications, ensure API connectivity by checking `http://localhost:3001/health` returns `{"ok":true}`.

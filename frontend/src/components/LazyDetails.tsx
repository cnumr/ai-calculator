import { useState, type ReactNode } from "react";

interface LazyDetailsProps {
  summary: ReactNode;
  /**
   * Content of the panel, as a function: it is only called, and its
   * elements only added to the DOM, while the panel is open.
   */
  children: () => ReactNode;
  className?: string;
}

/**
 * A native <details> disclosure whose content is rendered only while it is
 * open, and removed from the DOM when it is closed again (eco-design,
 * RWEB_0046: do not load what is not needed). Collapsed panels cost no DOM
 * nodes, which keeps the page light for the many users who never open them.
 */
export function LazyDetails({ summary, children, className }: LazyDetailsProps) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className={className}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>{summary}</summary>
      {open && children()}
    </details>
  );
}

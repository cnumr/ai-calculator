export type ImpactCriterion = "gwp" | "energy" | "water" | "adpe" | "pe";

export function isImpactCriterion(value: string): value is ImpactCriterion {
  return ["gwp", "energy", "water", "adpe", "pe"].includes(value);
}

interface ImpactIconProps {
  criterion: ImpactCriterion;
  className: string;
  decorative?: boolean;
  title?: string;
}

export function ImpactIcon({
  criterion,
  className,
  decorative = false,
  title,
}: ImpactIconProps) {
  return (
    <span
      className={className}
      {...(decorative ? { "aria-hidden": true } : { "aria-label": title, title })}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        {criterion === "gwp" && (
          <>
            <path d="M7 17a4 4 0 1 1 .8-7.9A5 5 0 0 1 17 11a3 3 0 1 1 0 6Z" />
            <path d="M10 14h4M12 12v4" />
          </>
        )}
        {criterion === "water" && (
          <path d="M12 3s6 6.6 6 11a6 6 0 0 1-12 0c0-4.4 6-11 6-11Z" />
        )}
        {criterion === "energy" && <path d="m13 2-8 12h6l-1 8 9-13h-6l1-7Z" />}
        {criterion === "adpe" && (
          <path d="m12 3 7 6-7 12L5 9l7-6ZM5 9h14M12 3v18" />
        )}
        {criterion === "pe" && (
          <path d="M13 3c1 4-2 5-2 8 0 1 1 2 2 2 2-2 4-5 3-8 3 3 4 6 4 9a8 8 0 0 1-16 0c0-4 2-7 5-10-1 4 1 5 2 6 0-3 1-5 2-7Z" />
        )}
      </svg>
    </span>
  );
}

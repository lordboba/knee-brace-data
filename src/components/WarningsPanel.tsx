import { AlertTriangle } from "lucide-react";
import type { ParserWarning } from "../domain/types";

type WarningsPanelProps = {
  warnings: ParserWarning[];
};

export function WarningsPanel({ warnings }: WarningsPanelProps) {
  if (warnings.length === 0) {
    return null;
  }

  const visibleWarnings = warnings.slice(0, 4);
  const hiddenCount = warnings.length - visibleWarnings.length;

  return (
    <aside className="warnings-panel" aria-label="Parser warnings">
      <div className="warnings-title">
        <AlertTriangle aria-hidden="true" size={16} />
        <strong>Parser warnings</strong>
        <span>{warnings.length} rows skipped</span>
      </div>
      <ul>
        {visibleWarnings.map((warning) => (
          <li key={`${warning.lineNumber}-${warning.reason}`}>
            Line {warning.lineNumber}: {warning.reason}
          </li>
        ))}
      </ul>
      {hiddenCount > 0 ? <p>{hiddenCount} more warnings hidden</p> : null}
    </aside>
  );
}

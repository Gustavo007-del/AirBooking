import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

export function Notice({
  message,
  title,
  tone = "error",
  retry,
  onDismiss,
}: {
  message: string;
  title?: string;
  tone?: "error" | "success" | "warning" | "info";
  retry?: () => void;
  onDismiss?: () => void;
}) {
  const Icon =
    tone === "success" ? CheckCircle2 : tone === "info" ? Info : AlertCircle;
  const heading =
    title ||
    {
      error: "Please check and try again",
      success: "All set",
      warning: "Please note",
      info: "Good to know",
    }[tone];
  return (
    <div
      className={`feedback-banner feedback-${tone}`}
      role={tone === "error" || tone === "warning" ? "alert" : "status"}
      aria-atomic="true"
    >
      <Icon className="feedback-icon" size={21} aria-hidden="true" />
      <div className="feedback-content">
        <strong>{heading}</strong>
        <p>{message}</p>
        {retry && (
          <button type="button" onClick={retry} className="feedback-action">
            Try again
          </button>
        )}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="feedback-dismiss"
          aria-label="Dismiss notification"
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
}

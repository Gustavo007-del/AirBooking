import axios from "axios";

function readable(message: string): string {
  return message
    .replace(/^(?:non_field_errors|__all__|detail|[a-z]+(?:_[a-z]+)+):\s*/i, "")
    .replace(/^password:\s*/i, "")
    .replace(
      "The password is too similar to the email.",
      "Choose a password that is different from your email address.",
    );
}
function messages(value: unknown): string[] {
  if (typeof value === "string") return [readable(value)];
  if (Array.isArray(value)) return value.flatMap(messages);
  if (value && typeof value === "object")
    return Object.values(value).flatMap(messages);
  return [];
}
export function fieldErrors(error: unknown): Record<string, string> {
  if (!axios.isAxiosError(error)) return {};
  const errors = error.response?.data?.errors;
  if (!errors || typeof errors !== "object" || Array.isArray(errors)) return {};
  return Object.fromEntries(
    Object.entries(errors).map(([field, value]) => [
      field,
      messages(value).join(" "),
    ]),
  );
}
export function errorMessage(error: unknown): string {
  if (!axios.isAxiosError(error))
    return error instanceof Error
      ? readable(error.message)
      : "Something went wrong. Please try again.";
  if (!error.response)
    return error.code === "ECONNABORTED"
      ? "This is taking longer than expected. Please try again."
      : "We couldn’t connect. Check your connection and try again.";
  if (error.response.data?.code === "airlabs_unavailable")
    return (
      messages(error.response.data.detail)[0] ||
      "AirLabs is unavailable right now."
    );
  if (error.response.status >= 500)
    return "We’re having trouble completing this request. Please try again shortly.";
  if (error.response.status === 429)
    return "Too many attempts. Please wait a little before trying again.";
  if (error.response.status === 404)
    return "We couldn’t find that record. It may no longer be available.";
  const data = error.response.data;
  const details = messages(data?.errors);
  if (error.response.status === 400 && details.length)
    return [...new Set(details)].join(" ");
  return (
    messages(data?.detail)[0] ||
    details[0] ||
    "We couldn’t complete this request. Please try again."
  );
}

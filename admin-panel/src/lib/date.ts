export const workspaceDate = (value?: string | null) => value ? new Date(value).toISOString().slice(0, 10) : "";
export const workspaceDisplayDate = (value?: string | null) => value ? new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value)) : "—";
export const formatTime = (time: string) => { const [h, m] = time.split(":").map(Number); const suffix = h >= 12 ? "PM" : "AM"; const hour = h % 12 || 12; return `${hour}:${String(m).padStart(2, "0")} ${suffix}`; };

const ECUADOR_TIME_ZONE = "America/Guayaquil";

const ecuadorDateTimeFormatter = new Intl.DateTimeFormat("es-EC", {
  timeZone: ECUADOR_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatDateTimeForEcuador(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return ecuadorDateTimeFormatter.format(date);
}

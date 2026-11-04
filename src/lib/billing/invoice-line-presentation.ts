type InvoiceLineTiming = {
  description: string;
  serviceDate: string | null;
  startsAt?: string | null;
  durationMinutes?: number | null;
};

export function invoiceLinePrimary(line: InvoiceLineTiming) {
  if (line.startsAt) {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(line.startsAt));
  }
  if (line.serviceDate) {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${line.serviceDate}T12:00:00Z`));
  }
  return "Invoice adjustment";
}

export function invoiceLineSecondary(line: InvoiceLineTiming) {
  const description = line.description.replace(/\s·\s[A-Z][a-z]{2}\s\d{1,2}$/, "");
  return line.durationMinutes ? `${description} · ${line.durationMinutes} min` : description;
}

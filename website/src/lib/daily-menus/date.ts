const serviceDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

function getServiceDateParts(value: string) {
  const match = serviceDatePattern.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day, 12));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { date, day, month, year };
}

const italianDateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  timeZone: "Europe/Rome",
  weekday: "long",
  year: "numeric",
});

export function isValidServiceDate(value: string) {
  return getServiceDateParts(value) !== null;
}

export function formatServiceDate(value: string) {
  const parts = getServiceDateParts(value);
  return parts ? italianDateFormatter.format(parts.date) : value;
}

// Dates are expanded in Colombia time (UTC-5), independent of the browser zone.
export function availabilityOccurrences(blocks, from, until) {
  const items = [];
  let day = new Date(new Date(from).getTime() - 86400000).toISOString().slice(0, 10);
  const last = new Date(new Date(until).getTime() + 86400000).toISOString().slice(0, 10);
  while (day <= last) {
    for (const b of blocks) {
      if (b.status === "cancelled" || day < b.dateFrom || (b.dateUntil && day > b.dateUntil)) continue;
      if (b.kind === "date" ? day !== b.dateFrom : new Date(`${day}T12:00:00Z`).getUTCDay() !== b.weekday) continue;
      const next = new Date(Date.parse(`${day}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
      const start = `${day}T${b.allDay ? "00:00" : b.start}:00-05:00`;
      const end = `${b.allDay ? next : day}T${b.allDay ? "00:00" : b.end}:00-05:00`;
      if (new Date(start) < until && new Date(end) > from) items.push({ block: b, day, start, end });
    }
    day = new Date(Date.parse(`${day}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
  }
  return items;
}

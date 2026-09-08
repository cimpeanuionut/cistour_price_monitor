const CISTOUR_HOST = "www.cistour.ro";
const DETAILS_PREFIX = "/packages/get_package_details/";

export function parseCistourUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Linkul nu este un URL valid.");
  }

  if (url.protocol !== "https:" || url.hostname !== CISTOUR_HOST) {
    throw new Error("Este permis doar un link HTTPS de pe www.cistour.ro.");
  }
  if (!url.pathname.startsWith(DETAILS_PREFIX)) {
    throw new Error("Linkul nu este un endpoint Cistour get_package_details.");
  }

  const segments = url.pathname.split("/").filter(Boolean);
  const roomId = segments.at(-1);
  if (!roomId?.startsWith("es-")) {
    throw new Error("Nu am găsit identificatorul camerei în link.");
  }

  return { url, roomId };
}

export function extractRoomPrice(payload, roomId) {
  const rawRooms = payload?.payment_policies_rooms;
  if (typeof rawRooms !== "string") {
    throw new Error("Răspunsul Cistour nu conține payment_policies_rooms.");
  }

  let rooms;
  try {
    rooms = JSON.parse(rawRooms);
  } catch {
    throw new Error("payment_policies_rooms nu este JSON valid.");
  }

  const resolvedRoomId = rooms[roomId]
    ? roomId
    : Object.keys(rooms).find((candidateId) => Number(rooms[candidateId]?.availability) > 0)
      || Object.keys(rooms)[0];
  const room = rooms[resolvedRoomId];
  if (!room) {
    throw new Error(`Răspunsul Cistour nu conține camere.`);
  }

  const price = Number(room.price);
  if (!Number.isFinite(price)) {
    throw new Error("Câmpul price al camerei nu este numeric.");
  }

  return {
    roomId: resolvedRoomId,
    roomName: room.mapped_room_name || room.name || "necunoscută",
    price,
    currency: room.currency || "EUR",
    available: Number(room.availability) > 0
  };
}

export function buildComparison(currentPrice, purchasePrice = 2084, currency = "EUR") {
  const difference = currentPrice - purchasePrice;
  const direction = difference > 0 ? "higher" : difference < 0 ? "lower" : "same";
  const color = direction === "higher" ? "#c62828" : direction === "lower" ? "#15803d" : "#475569";
  const signedDifference = difference > 0 ? `+${difference}` : difference < 0 ? `${difference}` : "0";

  return { purchasePrice, currentPrice, difference, signedDifference, direction, color, currency };
}

function formatNumber(value) {
  return new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 2 }).format(value);
}

export function buildEmailHtml(comparison, sourceUrl) {
  const purchase = formatNumber(comparison.purchasePrice);
  const current = formatNumber(comparison.currentPrice);
  const difference = comparison.difference > 0
    ? `+${formatNumber(comparison.difference)}`
    : comparison.difference < 0
      ? `-${formatNumber(Math.abs(comparison.difference))}`
      : "0";

  const warning = comparison.warning
    ? `<p style="color:#b45309"><strong>Atenție:</strong> ${escapeHtml(comparison.warning)}</p>`
    : "";

  return `<!doctype html>
<html lang="ro">
  <body style="font-family:Arial,sans-serif;color:#172033;line-height:1.55">
    ${warning}
    <p>Prețul la care am cumpărat excursia este <strong>${purchase} ${comparison.currency}</strong>.</p>
    <p>Noul preț este <strong>${current} ${comparison.currency}</strong>.</p>
    <p>Diferența este <strong style="color:${comparison.color}">${difference} ${comparison.currency}</strong>.</p>
    <p><a href="${escapeHtml(sourceUrl)}">Vezi oferta Cistour</a></p>
  </body>
</html>`;
}

export function buildPlainText(comparison) {
  const difference = comparison.difference > 0
    ? `+${formatNumber(comparison.difference)}`
    : comparison.difference < 0
      ? `-${formatNumber(Math.abs(comparison.difference))}`
      : "0";
  return [
    ...(comparison.warning ? [`Atenție: ${comparison.warning}`] : []),
    `Prețul la care am cumpărat excursia este ${formatNumber(comparison.purchasePrice)} ${comparison.currency}.`,
    `Noul preț este ${formatNumber(comparison.currentPrice)} ${comparison.currency}.`,
    `Diferența este ${difference} ${comparison.currency}.`
  ].join("\n");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}


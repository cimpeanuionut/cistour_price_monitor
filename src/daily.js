import { fetchCistourPriceWithRefresh } from "./cistour.js";
import { buildComparison, buildEmailHtml, buildPlainText } from "./core.js";
import { sendPriceEmail } from "./email.js";
import {
  ALERT_EMAIL,
  CISTOUR_URL,
  CISTOUR_ROOM_ID,
  CISTOUR_SEARCH_ID,
  CISTOUR_SEARCH_URL,
  MAIL_FROM,
  PURCHASE_PRICE,
  RESEND_API_KEY
} from "./config.js";

const currentHour = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Bucharest",
  hour: "2-digit",
  hour12: false
}).format(new Date());

if (currentHour !== "09") {
  console.log(`[Daily] Ora locală este ${currentHour}:00; nu trimit email.`);
  process.exit(0);
}

console.log("[Daily] Pornesc verificarea Cistour la 09:00 Europe/Bucharest.");
const room = await fetchCistourPriceWithRefresh({
  detailsUrl: CISTOUR_URL,
  searchId: CISTOUR_SEARCH_ID,
  searchUrl: CISTOUR_SEARCH_URL,
  roomId: CISTOUR_ROOM_ID
});
const result = {
  ...buildComparison(room.price, PURCHASE_PRICE, room.currency),
  available: room.available,
  roomId: room.roomId,
  roomName: room.roomName,
  sourceUrl: room.sourceUrl,
  requestedRoomId: room.requestedRoomId,
  warning: room.warning
};

const email = await sendPriceEmail({
  to: ALERT_EMAIL,
  from: MAIL_FROM,
  apiKey: RESEND_API_KEY,
  subject: `Preț excursie Cistour: ${result.signedDifference} ${result.currency}`,
  html: buildEmailHtml(result, result.sourceUrl),
  text: buildPlainText(result)
});

console.log(`[Daily] Email trimis. ID Resend: ${email.id || "necunoscut"}. Preț: ${result.currentPrice} ${result.currency}.`);

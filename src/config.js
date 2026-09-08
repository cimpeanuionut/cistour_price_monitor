import { existsSync } from "node:fs";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
if (existsSync(".env")) process.loadEnvFile(".env");

export const PURCHASE_PRICE = Number(process.env.PURCHASE_PRICE || 2084);
export const CISTOUR_URL = process.env.CISTOUR_URL || "https://www.cistour.ro/packages/get_package_details/{searchId}/{hash}/daf-dominicana-exotic-light-republica-toate-locatiile-republica-dominicana/es-344ce6859025a8e05467d44f7150be67?get_details_for_room";
export const CISTOUR_SEARCH_ID = process.env.CISTOUR_SEARCH_ID || "45727211";
export const CISTOUR_SEARCH_URL = process.env.CISTOUR_SEARCH_URL || "https://www.cistour.ro/vacante/republica-dominicana/toate-locatiile/din-bucuresti/circuite/cu-avion/?search_id=45727211";
export const CISTOUR_ROOM_ID = process.env.CISTOUR_ROOM_ID || "es-344ce6859025a8e05467d44f7150be67";
export const ALERT_EMAIL = process.env.ALERT_EMAIL;
export const MAIL_FROM = process.env.MAIL_FROM;
export const RESEND_API_KEY = process.env.RESEND_API_KEY;
export const API_TOKEN = process.env.API_TOKEN;
export const PORT = Number(process.env.PORT || 3000);

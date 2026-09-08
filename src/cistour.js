import { extractRoomPrice, parseCistourUrl } from "./core.js";

const DEFAULT_HEADERS = {
  accept: "application/json, text/javascript, */*; q=0.01",
  "accept-language": "ro-RO,ro;q=0.9,en;q=0.8",
  "user-agent": "Mozilla/5.0 (compatible; CistourPriceMonitor/1.0)",
  "x-requested-with": "XMLHttpRequest"
};

const SEARCH_HEADERS = {
  ...DEFAULT_HEADERS,
  accept: "application/json, text/javascript, */*; q=0.01",
  "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
  origin: "https://www.cistour.ro"
};

export async function fetchCistourPrice(rawUrl, fetchImpl = fetch) {
  const { url, roomId } = parseCistourUrl(rawUrl);
  console.log(`[Cistour] Pornesc verificarea pentru camera ${roomId}.`);
  console.log(`[Cistour] URL: ${url}`);

  let response;
  try {
    response = await fetchImpl(url, {
      headers: {
        ...DEFAULT_HEADERS,
        referer: "https://www.cistour.ro/"
      },
      redirect: "follow",
      signal: AbortSignal.timeout(30_000)
    });
  } catch (error) {
    console.error(`[Cistour] Conexiunea a eșuat: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }

  const contentType = response.headers.get("content-type") || "necunoscut";
  console.log(`[Cistour] Răspuns primit: HTTP ${response.status}, tip ${contentType}.`);

  if (!response.ok) {
    console.error(`[Cistour] Serverul a răspuns cu HTTP ${response.status}.`);
    throw new Error(`Cistour a răspuns cu HTTP ${response.status}.`);
  }

  const body = await response.text();
  console.log(`[Cistour] Corp răspuns primit: ${body.length} caractere.`);
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    console.warn(`[Cistour] Corpul nu este JSON. Preview: ${body.slice(0, 300)}`);
    throw new Error(`Cistour a returnat un răspuns neașteptat: ${contentType || "necunoscut"}.`);
  }

  console.log(`[Cistour] Corpul răspunsului este JSON valid.`);
  console.log(`[Cistour] JSON primit:\n${JSON.stringify(payload, null, 2)}`);
  if (typeof payload.payment_policies_rooms === "string") {
    try {
      const rooms = JSON.parse(payload.payment_policies_rooms);
      console.log(`[Cistour] ID-uri camere: ${Object.keys(rooms).join(", ")}`);
      console.log(`[Cistour] Rezumat camere: ${JSON.stringify(Object.entries(rooms).map(([id, room]) => ({
        id,
        name: room.mapped_room_name || room.name || "necunoscut",
        price: room.price,
        available: room.availability
      })), null, 2)}`);
      console.log(`[Cistour] payment_policies_rooms JSON:\n${JSON.stringify(rooms, null, 2)}`);
    } catch {
      console.warn("[Cistour] payment_policies_rooms nu poate fi afișat ca JSON.");
    }
  }

  if (payload?.error) {
    const details = payload.details?.error?.message;
    console.error(`[Cistour] API a raportat o eroare: ${details || payload.error}`);
    throw new Error(`Cistour: ${details || payload.error}`);
  }

  const room = extractRoomPrice(payload, roomId);
  if (room.roomId !== roomId) {
    console.warn(`[Cistour] Camera ${roomId} nu există; folosesc camera disponibilă ${room.roomId}.`);
  }
  console.log(`[Cistour] Preț extras: ${room.price} ${room.currency}; disponibil: ${room.available}.`);
  console.log(`[Cistour] Link ofertă pentru prețul extras: ${url}`);
  return { ...room, sourceUrl: url.toString() };
}

export async function fetchCistourPriceWithRefresh({ detailsUrl, searchId, searchUrl, roomId }, fetchImpl = fetch) {
  let currentUrl = detailsUrl;
  let lastError;
  let lastResult;
  let refreshed = false;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const result = await fetchCistourPrice(currentUrl, fetchImpl);
      if (result.roomId === roomId) return result;
      lastResult = result;
      lastError = new Error(`Camera cerută ${roomId} nu a apărut; Cistour a returnat ${result.roomId}.`);
      console.warn(`[Cistour] Încercarea ${attempt}: camera cerută nu este în rezultat.`);
    } catch (error) {
      lastError = error;
      console.warn(`[Cistour] Încercarea ${attempt} a eșuat (${error.message}).`);
    }

    if (attempt < 3) {
      if (!refreshed) {
        console.log(`[Cistour] Refac search-ul pentru camera ${roomId}.`);
        currentUrl = await refreshCistourDetailsUrl({ searchId, searchUrl, roomId }, fetchImpl);
        refreshed = true;
      } else {
        console.log(`[Cistour] Aștept 3 secunde și verific din nou același search (${attempt}/2).`);
        await delay(3_000);
      }
    }
  }

  if (lastResult) {
    return {
      ...lastResult,
      requestedRoomId: roomId,
      warning: `Camera cerută ${roomId} nu a fost găsită după 3 încercări. Prețul afișat este pentru camera ${lastResult.roomId}. Verifică oferta pe site.`
    };
  }

  throw lastError || new Error(`Camera ${roomId} nu a fost găsită după 3 încercări.`);
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function refreshCistourDetailsUrl({ searchId, searchUrl, roomId }, fetchImpl = fetch) {
  if (!searchId || !searchUrl || !roomId) {
    throw new Error("Lipsesc CISTOUR_SEARCH_ID, CISTOUR_SEARCH_URL sau CISTOUR_ROOM_ID.");
  }

  console.log(`[Cistour] Init session URL: ${searchUrl}`);
  const initResponse = await fetchImpl(searchUrl, {
    headers: { ...DEFAULT_HEADERS, accept: "text/html,application/xhtml+xml" },
    redirect: "follow",
    signal: AbortSignal.timeout(30_000)
  });
  const cookie = readSetCookie(initResponse.headers);
  if (!initResponse.ok) throw new Error(`Inițializarea Cistour a eșuat (HTTP ${initResponse.status}).`);

  const requestUri = new URL(searchUrl);
  requestUri.search = `?search_id=${encodeURIComponent(searchId)}`;
  console.log(`[Cistour] Search URL: https://www.cistour.ro/packages/search`);
  console.log(`[Cistour] Search request_uri: ${requestUri}`);
  const response = await fetchImpl("https://www.cistour.ro/packages/search", {
    method: "POST",
    headers: {
      ...SEARCH_HEADERS,
      referer: searchUrl,
      ...(cookie ? { cookie } : {})
    },
    body: new URLSearchParams({
      departure: "1",
      departure_name: "Bucuresti",
      destination_country: "18",
      destination_country_name: "Republica Dominicana",
      destination_region: "-1",
      destination_region_name: "Toate locatiile",
      date: "31.12.2026",
      check_in: "31.12.2026",
      supplier_codes: "",
      details_link: "",
      nights: "7",
      no_nights: "7",
      sejour_tour: "Tour",
      transport_type: "Flight",
      number_of_rooms: "1",
      directory_hotel_name: "",
      room_1_no_of_adults: "1",
      room_1_no_of_children: "0",
      room_1_first_child_age: "0",
      room_1_second_child_age: "0",
      room_1_third_child_age: "0",
      room_1_fourth_child_age: "0",
      room_1_fifth_child_age: "0",
      request_uri: requestUri.toString()
    }),
    redirect: "follow",
    signal: AbortSignal.timeout(30_000)
  });

  const body = await response.text();
  console.log(`[Cistour] Search răspuns: HTTP ${response.status}, ${body.length} caractere.`);
  if (!response.ok) throw new Error(`Search Cistour a eșuat (HTTP ${response.status}).`);

  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new Error("Search Cistour nu a returnat JSON.");
  }
  if (!payload.search_id || !payload.hash) {
    throw new Error("Search Cistour nu a returnat search_id și hash.");
  }

  const template = detailsUrlFromSearch(searchUrl, roomId);
  const refreshedUrl = template
    .replace("{searchId}", encodeURIComponent(payload.search_id))
    .replace("{hash}", encodeURIComponent(payload.hash));
  console.log(`[Cistour] URL nou generat pentru search_id=${payload.search_id}.`);
  return refreshedUrl;
}

function detailsUrlFromSearch(searchUrl, roomId) {
  return `https://www.cistour.ro/packages/get_package_details/{searchId}/{hash}/daf-dominicana-exotic-light-republica-toate-locatiile-republica-dominicana/${roomId}?get_details_for_room`;
}

function readSetCookie(headers) {
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie().map((value) => value.split(";", 1)[0]).join("; ");
  }
  return headers.get("set-cookie")?.split(";", 1)[0] || "";
}

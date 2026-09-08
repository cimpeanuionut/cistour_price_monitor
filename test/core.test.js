import test from "node:test";
import assert from "node:assert/strict";
import { buildComparison, buildEmailHtml, extractRoomPrice, parseCistourUrl } from "../src/core.js";

const roomId = "es-344ce6859025a8e05467d44f7150be67";
const url = `https://www.cistour.ro/packages/get_package_details/45724268/token/slug/${roomId}?get_details_for_room`;
const payload = {
  payment_policies_rooms: JSON.stringify({
    [roomId]: { mapped_room_name: "dubla", price: 2084, currency: "EUR", availability: 1 }
  })
};

test("extrage camera din link", () => {
  assert.equal(parseCistourUrl(url).roomId, roomId);
});

test("acceptă URL Cistour copiat ca link Markdown", () => {
  assert.equal(parseCistourUrl(`[ofertă](${url})`).roomId, roomId);
});

test("extrage price din payment_policies_rooms", () => {
  assert.deepEqual(extractRoomPrice(payload, roomId), {
    roomId,
    roomName: "dubla",
    price: 2084,
    currency: "EUR",
    available: true
  });
});

test("creșterea este pozitivă și roșie", () => {
  const result = buildComparison(2200, 2084, "EUR");
  assert.equal(result.signedDifference, "+116");
  assert.equal(result.color, "#c62828");
  assert.match(buildEmailHtml(result, url), /color:#c62828/);
  assert.match(buildEmailHtml(result, url), /\+116 EUR/);
});

test("scăderea este negativă și verde", () => {
  const result = buildComparison(2000, 2084, "EUR");
  assert.equal(result.signedDifference, "-84");
  assert.equal(result.color, "#15803d");
  assert.match(buildEmailHtml(result, url), /color:#15803d/);
  assert.match(buildEmailHtml(result, url), /-84 EUR/);
});

test("respinge orice alt domeniu", () => {
  assert.throws(() => parseCistourUrl("https://example.com/packages/get_package_details/x/es-room"));
});

test("folosește prima cameră disponibilă dacă ID-ul s-a schimbat", () => {
  const result = extractRoomPrice({
    payment_policies_rooms: JSON.stringify({
      "es-new-room": { mapped_room_name: "dubla", price: 2084, currency: "EUR", availability: 1 }
    })
  }, "es-old-room");
  assert.equal(result.roomId, "es-new-room");
});


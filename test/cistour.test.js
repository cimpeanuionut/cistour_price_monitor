import test from "node:test";
import assert from "node:assert/strict";
import { refreshCistourDetailsUrl } from "../src/cistour.js";

test("reîmprospătează search_id și hash Cistour", async () => {
  const responses = [
    { ok: true, status: 200, headers: new Headers({ "set-cookie": "PHPSESSID=session-1; Path=/" }), text: async () => "<html>" },
    { ok: true, status: 200, headers: new Headers(), text: async () => JSON.stringify({ status: 1, search_id: 45729204, hash: "e83b27618b9c4c33890fde2642ba1bdd" }) }
  ];
  const calls = [];
  const fetchMock = async (url, options) => {
    calls.push({ url, options });
    return responses.shift();
  };

  const result = await refreshCistourDetailsUrl({
    searchId: "45727211",
    searchUrl: "https://www.cistour.ro/vacante/republica-dominicana/?search_id=45727211",
    roomId: "es-344ce6859025a8e05467d44f7150be67"
  }, fetchMock);

  assert.match(result, /packages\/get_package_details\/45729204\/e83b27618b9c4c33890fde2642ba1bdd/);
  assert.equal(calls[1].options.method, "POST");
  assert.match(String(calls[1].options.body), /search_id/);
});
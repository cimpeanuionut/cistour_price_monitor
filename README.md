# Cistour Price Monitor

Plugin MCP și serviciu HTTP care primește **doar linkul** unui endpoint Cistour, extrage camera din URL, citește câmpul `price`, îl compară cu prețul de cumpărare de **2.084 EUR** și trimite un email HTML.

## Mesajul email

- „Prețul la care am cumpărat excursia este 2.084 EUR.”
- „Noul preț este … EUR.”
- „Diferența este +… EUR” cu roșu când prețul a crescut.
- „Diferența este -… EUR” cu verde când prețul a scăzut.

## Configurare

Necesită Node.js 20+ și un cont [Resend](https://resend.com/) pentru trimiterea emailului.

```bash
npm install
```

Valorile aplicației sunt configurate în `src/config.js`. Pornește serviciul:

```bash
npm start
```

`CISTOUR_URL` poate folosi template-ul `{searchId}/{hash}`. La verificare, aplicația încearcă mai întâi URL-ul configurat. Dacă hashul este expirat, rulează automat init session și `POST /packages/search`, preia noul `search_id` și `hash`, reconstruiește URL-ul camerei și reîncearcă o singură dată.

Nu salva cookie-uri Cistour. Serviciul creează o sesiune anonimă nouă la fiecare verificare.

## Endpoint REST

```http
POST /check-and-notify
Authorization: Bearer <API_TOKEN>
Content-Type: application/json

{"url":"https://www.cistour.ro/packages/get_package_details/.../es-...?get_details_for_room"}
```

## Instrumente MCP

- `check_cistour_price(url)` — verificare fără email.
- `check_cistour_price_and_email(url)` — verificare și email HTML.

Pentru rulare locală, `.mcp.json` folosește transportul stdio. Pentru ChatGPT Scheduled, publică serviciul la un URL HTTPS stabil și conectează endpointul `/mcp` în Developer Mode. Documentația oficială recomandă Streamable HTTP pentru pluginurile găzduite.

## Task zilnic recomandat

Ora: **09:00 Europe/Bucharest**.

```text
Apelează check_cistour_price_and_email cu linkul excursiei Cistour. Confirmă dacă emailul a fost trimis. Dacă verificarea eșuează, raportează clar eroarea.
```

Pentru rulare automată pe Render, blueprint-ul include un Cron Job care rulează la 06:00 și 07:00 UTC și trimite un singur email la 09:00 în fusul `Europe/Bucharest`, inclusiv la schimbarea orei de vară. URL-ul verificat este `CISTOUR_URL` din mediul de rulare.

După publicarea repository-ului pe Render, creează serviciile din `render.yaml`. Serviciul web pornește API-ul, iar serviciul `cistour-price-monitor-daily` execută verificarea zilnică. Cron Job-urile Render necesită un plan plătit.

## Testare

```bash
npm test
npm run check
```

Testele verifică extragerea camerei, câmpul `price`, semnul diferenței și culorile roșu/verde.

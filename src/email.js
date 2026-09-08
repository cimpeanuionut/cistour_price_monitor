export async function sendPriceEmail({ to, from, apiKey, subject, html, text }, fetchImpl = fetch) {
  console.log(`[Email] Pregătesc trimiterea: from=${from || "lipsă"}, to=${to || "lipsă"}.`);
  if (!to || !from || !apiKey) {
    console.error("[Email] Configurație incompletă: lipsesc una sau mai multe valori.");
    throw new Error("Lipsesc ALERT_EMAIL, MAIL_FROM sau RESEND_API_KEY.");
  }

  let response;
  try {
    response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ from, to: [to], subject, html, text }),
      signal: AbortSignal.timeout(15_000)
    });
  } catch (error) {
    console.error(`[Email] Conexiunea către Resend a eșuat: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }

  const responseText = await response.text();
  console.log(`[Email] Resend a răspuns: HTTP ${response.status}.`);
  console.log(`[Email] Răspuns Resend: ${responseText.slice(0, 500)}`);
  let body;
  try {
    body = JSON.parse(responseText);
  } catch {
    body = {};
  }
  if (!response.ok) {
    console.error(`[Email] Trimiterea a fost respinsă de Resend (HTTP ${response.status}).`);
    throw new Error(`Trimiterea emailului a eșuat (HTTP ${response.status}).`);
  }
  console.log(`[Email] Email acceptat de Resend. ID: ${body.id || "necunoscut"}.`);
  return { id: body.id || null };
}

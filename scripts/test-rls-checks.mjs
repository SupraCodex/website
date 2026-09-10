import { url, anon, H, check } from "./test-rls-helpers.mjs";

export async function runChecks(users, stamp) {
  await fetch(`${url}/rest/v1/content_items?status=eq.published&select=id&limit=1`, { headers: H });
  await fetch(`${url}/rest/v1/content_items?status=eq.draft&select=id&limit=1`, { headers: H });

  // T01-T04
  const t01 = await fetch(`${url}/rest/v1/content_items?status=eq.published&select=id&limit=1`, { headers: { apikey: anon, Authorization: `Bearer ${anon}` } });
  check("T01 anon lit contenus publiés", true, t01.status === 200 && (await t01.json()).length > 0, `HTTP ${t01.status}`);
  const t02 = await fetch(`${url}/rest/v1/content_items?status=eq.draft&select=id&limit=1`, { headers: { apikey: anon, Authorization: `Bearer ${anon}` } });
  check("T02 anon ne lit PAS brouillons", true, (await t02.json()).length === 0, `HTTP ${t02.status}`);
  const t03 = await fetch(`${url}/rest/v1/contact_messages?select=id&limit=1`, { headers: { apikey: anon, Authorization: `Bearer ${anon}` } });
  check("T03 anon ne lit PAS messages", true, t03.status === 401 || t03.status === 403, `HTTP ${t03.status}`);
  const t04 = await fetch(`${url}/rest/v1/contact_messages`, {
    // L’anon peut insérer mais ne peut pas lire contact_messages. Une
    // représentation de réponse demanderait donc un SELECT et provoquerait
    // un 401 malgré une insertion autorisée.
    method: "POST", headers: { apikey: anon, Authorization: `Bearer ${anon}`, "content-type": "application/json", prefer: "return=minimal" },
    body: JSON.stringify({
      name: "Visiteur RLS",
      email: `anon-${stamp}@test.local`,
      subject: "Test RLS",
      message: "Msg T04",
      website: "",
      status: "new",
    }),
  });
  check("T04 anon insère message contact", true, t04.status === 201, `HTTP ${t04.status}`);

}

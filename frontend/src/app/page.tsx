import { istAngemeldet } from "@/lib/auth/sitzung";
import { holeSitzung } from "@/lib/auth/sitzung.server";

export const dynamic = "force-dynamic";

export default async function Startseite() {
  const sitzung = await holeSitzung();

  if (!istAngemeldet(sitzung)) {
    return (
      <main>
        <h1>InfraDemand</h1>
        <p>Nicht angemeldet.</p>
        <a href="/api/auth/login">Anmelden</a>
      </main>
    );
  }

  return (
    <main>
      <h1>InfraDemand</h1>
      <p>
        Angemeldet als {sitzung.anzeigename ?? sitzung.benutzername} (Quelle: {sitzung.quelle})
      </p>
      <p>Rollen: {(sitzung.rollen ?? []).join(", ") || "keine"}</p>
      <form action="/api/auth/logout" method="post">
        <button type="submit">Abmelden</button>
      </form>
    </main>
  );
}

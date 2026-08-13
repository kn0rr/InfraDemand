import { redirect } from "next/navigation";
import { istAngemeldet } from "@/lib/auth/sitzung";
import { holeSitzung } from "@/lib/auth/sitzung.server";
import { Anforderungsbereich } from "./anforderungsbereich";

export const dynamic = "force-dynamic";

export default async function AnforderungenSeite() {
  const sitzung = await holeSitzung();

  if (!istAngemeldet(sitzung)) {
    // `ziel` bringt den Anwender nach der Anmeldung hierher zurueck statt auf die
    // Startseite. Der Wert wird im Anmelderoute-Handler auf einen anwendungsinternen
    // Pfad geprueft, bevor er in die Sitzung geht.
    redirect("/api/auth/login?ziel=/anforderungen");
  }

  return (
    <Anforderungsbereich
      benutzer={sitzung.benutzername ?? ""}
      istAdmin={(sitzung.rollen ?? []).includes("platform-admin")}
      mandanten={sitzung.mandanten ?? []}
    />
  );
}

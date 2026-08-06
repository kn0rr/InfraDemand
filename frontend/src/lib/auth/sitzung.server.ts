import { getIronSession, type IronSession } from "iron-session";
import { cookies } from "next/headers";
import { type Sitzungsinhalt, sitzungsOptionen } from "./sitzung";

/**
 * Liegt getrennt von `sitzung.ts`, weil `next/headers` ausserhalb einer Anfrage nicht
 * ladbar ist. Die Aufteilung haelt die Sitzungsoptionen pruefbar, ohne dass ein Test
 * eine Next-Laufzeit nachstellen muesste.
 *
 * Lesen ist ueberall moeglich, `save()` und `destroy()` nur in Route-Handlern und
 * Server Actions. Eine Server Component kann keine Cookies setzen.
 */
export async function holeSitzung(): Promise<IronSession<Sitzungsinhalt>> {
  return getIronSession<Sitzungsinhalt>(await cookies(), sitzungsOptionen());
}

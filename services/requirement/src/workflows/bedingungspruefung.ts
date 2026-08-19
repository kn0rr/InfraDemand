import type { Bedingung, Bedingungsart, Vergleich } from "./typen";

/**
 * Alles, was zur Auswertung einer Bedingung gebraucht wird (ADR-0024).
 *
 * Ein Datensatz, kein Zugriff: Das Modul liest nichts nach. Wer es aufruft, hat die Daten
 * bereits - und was hier nicht steht, kann eine Bedingung nicht heranziehen. Genau das
 * schliesst synchrone Aufrufe in Uebergaengen aus (ADR-0021 Punkt 1).
 */
export interface Vorgangskontext {
  /** Kernfelder und dynamische Attribute in einem flachen Feldraum. */
  feldwerte: Readonly<Record<string, unknown>>;
  /**
   * Der Ausloesende in **zwei** Begriffen, und das ist Absicht (ADR-0031 Punkt 2):
   * `userId` ist die Subjektkennung und Grundlage von `changed_by` - `vier_augen`
   * vergleicht dagegen. `kennung` ist der Benutzername, und den tragen Personenfelder.
   * Beides in einem Wert zu fuehren war der Fehler, den ADR-0031 behebt.
   */
  ausloeser: { userId: string; kennung: string; roles: readonly string[] };
  /**
   * Wer den Eintritt in einen Zustand ausgeloest hat, aus der Versionshistorie.
   * Fehlt ein Zustand, wurde er nie durchlaufen.
   */
  eintritte: ReadonlyMap<string, string>;
  /** Mit dem Vorgang mitgegebene Begruendung. */
  begruendung?: string;
}

export interface Bedingungsverstoss {
  art: Bedingungsart;
  message: string;
}

/**
 * Wertevergleich.
 *
 * **Bewusste Doppelung zu `istGleich` in `requirements/feldherkunft.ts`.** Ein Import
 * dorthin liesse die Workflow-Logik in den Requirements-Bereich zeigen; nach
 * ADR-0020 Punkt 9 muss dieses Verzeichnis fuer sich stehen. Wer das zusammenfuehren will,
 * muss zuerst den gemeinsamen Ort schaffen - nicht die Abhaengigkeit umdrehen.
 */
function gleich(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function istGefuellt(wert: unknown): boolean {
  if (wert === undefined || wert === null || wert === "") {
    return false;
  }

  return !(Array.isArray(wert) && wert.length === 0);
}

/**
 * Wertet einen Vergleich aus. `undefined` heisst **nicht auswertbar** - nicht "falsch".
 *
 * Der Unterschied traegt ADR-0024 Punkt 7: Ein nicht auswertbarer Vergleich fuehrt zur
 * Abweisung mit eigener Meldung, nie zu einem stillen Durchlassen.
 */
function werteVergleich(
  vergleich: Vergleich,
  feldwerte: Readonly<Record<string, unknown>>,
): boolean | undefined {
  const wert = feldwerte[vergleich.feld];

  switch (vergleich.operator) {
    case "istGleich":
      return gleich(wert, vergleich.wert);

    case "istUngleich":
      return !gleich(wert, vergleich.wert);

    case "istGefuellt":
      return istGefuellt(wert) === (vergleich.wert === true);

    case "istEinesVon":
      return Array.isArray(vergleich.wert)
        ? vergleich.wert.some((zulaessig) => gleich(wert, zulaessig))
        : undefined;

    case "mindestens":
    case "hoechstens": {
      // Zahlen numerisch, Zeichenketten lexikografisch - ISO-Datumsangaben sortieren
      // dabei richtig. Gemischte Typen sind nicht vergleichbar, und zu raten waere
      // schlimmer als abzuweisen.
      const vergleichbar =
        (typeof wert === "number" && typeof vergleich.wert === "number") ||
        (typeof wert === "string" && typeof vergleich.wert === "string");

      if (!vergleichbar) {
        return undefined;
      }

      return vergleich.operator === "mindestens"
        ? (wert as number | string) >= (vergleich.wert as number | string)
        : (wert as number | string) <= (vergleich.wert as number | string);
    }

    default:
      return undefined;
  }
}

/** Beschreibt einen Vergleich fuer eine Meldung. */
function benenne(vergleich: Vergleich): string {
  return `"${vergleich.feld}" ${vergleich.operator} ${JSON.stringify(vergleich.wert)}`;
}

/**
 * Prueft die Bedingungen eines Uebergangs (§7, ADR-0024).
 *
 * Sammelt alle Verstoesse statt beim ersten abzubrechen: Wer ein Formular abschickt, will
 * nicht dreimal nacheinander je einen Grund erfahren.
 */
export function pruefeUebergangsbedingungen(
  bedingungen: readonly Bedingung[],
  kontext: Vorgangskontext,
): Bedingungsverstoss[] {
  const verstoesse: Bedingungsverstoss[] = [];

  for (const bedingung of bedingungen) {
    let greift = true;

    for (const vergleich of bedingung.nurWenn ?? []) {
      const ergebnis = werteVergleich(vergleich, kontext.feldwerte);

      if (ergebnis === undefined) {
        verstoesse.push({
          art: bedingung.art,
          message: `Der Vorbehalt dieser Bedingung laesst sich nicht auswerten: ${benenne(vergleich)}`,
        });
        greift = false;
        break;
      }

      if (!ergebnis) {
        greift = false;
        break;
      }
    }

    if (!greift) {
      continue;
    }

    verstoesse.push(...pruefeAnforderung(bedingung, kontext));
  }

  return verstoesse;
}

function pruefeAnforderung(bedingung: Bedingung, kontext: Vorgangskontext): Bedingungsverstoss[] {
  switch (bedingung.art) {
    case "rolle":
      return bedingung.eineVon.some((rolle) => kontext.ausloeser.roles.includes(rolle))
        ? []
        : [
            {
              art: bedingung.art,
              message: `Dieser Uebergang verlangt eine dieser Rollen: ${bedingung.eineVon.join(", ")}`,
            },
          ];

    case "vier_augen": {
      const zustand = bedingung.andersAlsBeiEintritt;
      const vorherige = kontext.eintritte.get(zustand);

      if (vorherige === undefined) {
        // Nicht durchlassen: Ein Vier-Augen-Prinzip, das auf einem Pfad still ausfaellt,
        // ist schlimmer als eines, das haengenbleibt und jemanden hinsehen laesst.
        return [
          {
            art: bedingung.art,
            message: `Der Zustand "${zustand}" wurde nie durchlaufen - das Vier-Augen-Prinzip ist hier nicht pruefbar`,
          },
        ];
      }

      return vorherige === kontext.ausloeser.userId
        ? [
            {
              art: bedingung.art,
              message: `Dieser Uebergang verlangt eine andere Person als die, die "${zustand}" ausgeloest hat`,
            },
          ]
        : [];
    }

    case "identitaet":
      return gleich(kontext.feldwerte[bedingung.feld], kontext.ausloeser.kennung)
        ? []
        : [
            {
              art: bedingung.art,
              message: `Diesen Uebergang darf nur die in "${bedingung.feld}" genannte Person ausloesen`,
            },
          ];

    case "pflichtfelder": {
      const fehlend = bedingung.felder.filter((feld) => !istGefuellt(kontext.feldwerte[feld]));

      return fehlend.length === 0
        ? []
        : [
            {
              art: bedingung.art,
              message: `Diese Felder muessen gefuellt sein: ${fehlend.join(", ")}`,
            },
          ];
    }

    case "feldwert": {
      const vergleich: Vergleich = {
        feld: bedingung.feld,
        operator: bedingung.operator,
        wert: bedingung.wert,
      };
      const ergebnis = werteVergleich(vergleich, kontext.feldwerte);

      if (ergebnis === undefined) {
        return [
          {
            art: bedingung.art,
            message: `Diese Bedingung laesst sich nicht auswerten: ${benenne(vergleich)}`,
          },
        ];
      }

      return ergebnis
        ? []
        : [{ art: bedingung.art, message: `Nicht erfuellt: ${benenne(vergleich)}` }];
    }

    case "begruendung": {
      const mindestlaenge = bedingung.mindestlaenge ?? 1;
      const laenge = (kontext.begruendung ?? "").trim().length;

      return laenge >= mindestlaenge
        ? []
        : [
            {
              art: bedingung.art,
              message:
                mindestlaenge === 1
                  ? "Dieser Uebergang verlangt eine Begruendung"
                  : `Die Begruendung muss mindestens ${mindestlaenge} Zeichen haben`,
            },
          ];
    }

    default:
      // Unbekannte Art: nicht erfuellt. Sie kommt nicht durch die Graphpruefung, aber
      // eine Anforderung mit einer aelteren Fassung koennte eine tragen, die es hier
      // nicht mehr gibt - dann ist Abweisen die richtige Antwort.
      return [
        {
          art: (bedingung as { art: Bedingungsart }).art,
          message: "Diese Bedingung ist dieser Fassung des Dienstes unbekannt",
        },
      ];
  }
}
/**
 * Wer den Eintritt in welchen Zustand ausgeloest hat.
 *
 * Ein Eintritt ist eine Version, deren Status sich vom vorherigen unterscheidet - die
 * erste Version zaehlt als Eintritt in den Anfangszustand. **Spaetere Eintritte
 * ueberschreiben fruehere:** Wurde ein Zustand zweimal betreten, zaehlt der letzte. Wer
 * eine Anforderung erneut einreicht, ist damit derjenige, gegen den das Vier-Augen-Prinzip
 * prueft - nicht, wer sie beim ersten Mal eingereicht hat.
 *
 * Erwartet den Verlauf **aufsteigend nach Version**, so wie `findVersions` ihn liefert.
 */
export function eintritte(
  verlauf: readonly { status: string; changedBy: string }[],
): Map<string, string> {
  const karte = new Map<string, string>();
  let vorheriger: string | undefined;

  for (const stand of verlauf) {
    if (stand.status !== vorheriger) {
      karte.set(stand.status, stand.changedBy);
    }

    vorheriger = stand.status;
  }

  return karte;
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { pruefeDynamischeAttribute } from "../attribute-definitions/attribut-pruefung";
import { DynamicAttributeValidationError } from "../attribute-definitions/attribute-definitions.errors";
import { AttributeDefinitionsService } from "../attribute-definitions/attribute-definitions.service";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import type { Festhaltung, RequirementHistoryRow, RequirementRow } from "../database/schema";
import { MastershipService } from "../mastership/mastership.service";
import { UnknownSourceSystemError } from "../source-systems/source-systems.errors";
import { SourceSystemsService } from "../source-systems/source-systems.service";
import type { CreateRequirementDto } from "./create-requirement.dto";
import {
  alsDynamisch,
  alsKern,
  feldwerte,
  istGleich,
  KERNFELDER,
  letzteQuelleFuerFeld,
} from "./feldherkunft";
import {
  type Abweisung,
  type Feldvorhaben,
  pruefeHoheit,
  type Quellenklasse,
} from "./hoheitspruefung";
import type { PatchRequirementDto } from "./patch-requirement.dto";
import type { RequirementResponse } from "./requirement.dto";
import type { RequirementVersionResponse } from "./requirement-version.dto";
import { DuplicateExternalIdError, RequirementNotFoundError } from "./requirements.errors";
import { RequirementsRepository } from "./requirements.repository";

@Injectable()
export class RequirementsService {
  constructor(
    private readonly repository: RequirementsRepository,
    private readonly sourceSystems: SourceSystemsService,
    private readonly attributeDefinitions: AttributeDefinitionsService,
    private readonly mastership: MastershipService,
  ) {}
  /**
   * Teilweise Aenderung ueber den fremden Bezeichner (ADR-0010, ADR-0018 Punkt 6).
   *
   * Legt nicht an: Ein `PATCH` auf einen nicht vorhandenen Datensatz ist `404`. Der
   * Importeur legt mit `POST` an und aendert danach.
   */

  /**
   * Die Klasse der schreibenden Quelle (ADR-0017 A4).
   *
   * Aus dem Token, nicht aus dem Rumpf: Der Aufrufer soll nicht behaupten koennen, als
   * was er zaehlt. Der OAuth-Client ist der Schluessel in der Registratur.
   */
  private async schreibendeKlasse(benutzer: AuthenticatedUser): Promise<Quellenklasse> {
    return this.sourceSystems.pruefeSchreibquelle(benutzer.clientId);
  }

  private async abweisungenVerzeichnen(
    requirementId: string,
    abweisungen: readonly Abweisung[],
    benutzer: AuthenticatedUser,
  ): Promise<void> {
    await this.repository.recordRejections(
      abweisungen.map((abweisung) => ({
        requirementId,
        field: abweisung.field,
        rejectedValue: abweisung.rejectedValue,
        sourceSystem: benutzer.clientId,
        changedBy: benutzer.userId,
        reason: abweisung.reason,
      })),
    );
  }

  private static hoheitsfehler(abweisungen: readonly Abweisung[]): ConflictException {
    return new ConflictException({
      statusCode: 409,
      error: "Conflict",
      message: "Fuer diese Felder ist eine andere Quelle massgeblich",
      fields: abweisungen.map(({ field, reason, message }) => ({ field, reason, message })),
    });
  }

  async patchBySource(
    sourceSystem: string,
    externalId: string,
    eingabe: PatchRequirementDto,
    benutzer: AuthenticatedUser,
  ): Promise<RequirementResponse> {
    const bestand = await this.repository.findBySource(sourceSystem, externalId);
    if (bestand === undefined) {
      throw new NotFoundException(new RequirementNotFoundError(sourceSystem, externalId).message);
    }

    const klasse = await this.schreibendeKlasse(benutzer);
    const bisher = feldwerte(bestand);

    // Flacher Zielzustand: der Bestand, ueberschrieben mit dem, was der Aufrufer benannt
    // hat. Nicht Genanntes bleibt unveraendert, `null` loescht.
    const gewuenscht: Record<string, unknown> = {
      ...bisher,
      ...(eingabe.projectId === undefined ? {} : { projectId: eingabe.projectId }),
      ...(eingabe.requirementType === undefined
        ? {}
        : { requirementType: eingabe.requirementType }),
      ...(eingabe.status === undefined ? {} : { status: eingabe.status }),
      ...(eingabe.owner === undefined ? {} : { owner: eingabe.owner }),
      ...(eingabe.dynamicAttributes ?? {}),
    };

    // Nur die benannten Felder. Ein Vorgabewert aus der Attributdefinition ist keine
    // Aeusserung des Aufrufers und faellt nicht unter die Regeln.
    const benannt = new Set<string>([
      ...KERNFELDER.filter((feld) => eingabe[feld] !== undefined),
      ...Object.keys(eingabe.dynamicAttributes ?? {}),
    ]);

    // --- Festhaltungen (ADR-0017 B6) ---
    // Sie halten die **Automatik** fern, nicht den Menschen: Die Festhaltung schuetzt
    // gerade den von Hand gesetzten Wert. Und der Vorgang scheitert nicht - ein
    // naechtlicher Lauf hat niemanden, dem er es sagen koennte (ADR-0019 Punkt 2).
    if (klasse === "automatic") {
      const festgehalten = [...benannt].filter((feld) => bestand.heldFields[feld] !== undefined);

      await this.repository.recordRejections(
        festgehalten
          .filter((feld) => !istGleich(gewuenscht[feld], bisher[feld]))
          .map((feld) => ({
            requirementId: bestand.id,
            field: feld,
            rejectedValue: gewuenscht[feld] ?? null,
            sourceSystem: benutzer.clientId,
            changedBy: benutzer.userId,
            reason: "field_held" as const,
          })),
      );

      for (const feld of festgehalten) {
        if (bisher[feld] === undefined) {
          delete gewuenscht[feld];
        } else {
          gewuenscht[feld] = bisher[feld];
        }
        benannt.delete(feld);
      }
    }

    const kern = alsKern(gewuenscht);

    // Geprueft wird der Zustand **nach** Zusammenfuehrung und Festhaltung, nicht der
    // Rumpf. Sonst faellt ein Pflichtfeld nicht auf, das im Bestand fehlt.
    const definitionen = await this.attributeDefinitions.geltendeDefinitionen(kern.requirementType);
    const pruefung = pruefeDynamischeAttribute(alsDynamisch(gewuenscht), definitionen);

    if (pruefung.fehler.length > 0) {
      throw new BadRequestException({
        statusCode: 400,
        error: "Bad Request",
        message: "Dynamische Attribute genuegen den geltenden Definitionen nicht",
        attributes: pruefung.fehler,
      });
    }

    const regeln = await this.mastership.regeln();
    const quellen = await this.sourceSystems.klassenkarte();
    const versionen = await this.repository.findVersions(bestand.id);
    const staende = versionen.map((version) => ({
      werte: feldwerte(version),
      changeSource: version.changeSource,
    }));

    const kuenftig = feldwerte({ ...kern, dynamicAttributes: pruefung.werte });

    const vorhaben: Feldvorhaben[] = [...benannt].map((field) => {
      const quelle = letzteQuelleFuerFeld(staende, field);

      return {
        field,
        neuerWert: kuenftig[field] ?? null,
        aktuellerWert: bisher[field] ?? null,
        aktuelleQuellenklasse: quelle === undefined ? undefined : quellen.get(quelle),
      };
    });

    const abweisungen = pruefeHoheit(vorhaben, klasse, regeln);
    if (abweisungen.length > 0) {
      await this.abweisungenVerzeichnen(bestand.id, abweisungen, benutzer);
      throw RequirementsService.hoheitsfehler(abweisungen);
    }

    const zeile = await this.repository.update(bestand.id, {
      ...kern,
      dynamicAttributes: pruefung.werte,
      // Unveraendert durchgereicht: Eine Aenderung von Werten hebt keine Festhaltung auf.
      // Dafuer gibt es einen eigenen Vorgang (ADR-0017 B12).
      heldFields: bestand.heldFields,
      changedBy: benutzer.userId,
      changeSource: benutzer.clientId,
    });

    return RequirementsService.toResponse(zeile);
  }

  /**
   * Ohne Stichtag der aktuelle Bestand aus der Fachtabelle, mit Stichtag der Zustand aus
   * der Historie. Beide Wege muessen fuer "jetzt" dasselbe Ergebnis liefern - das prueft
   * der Test "Stichtag jetzt entspricht dem aktuellen Bestand".
   */
  async findAll(stichtag?: string): Promise<RequirementResponse[]> {
    const zeilen =
      stichtag === undefined
        ? await this.repository.findAll()
        : await this.repository.findAsOf(new Date(stichtag));

    return zeilen.map(RequirementsService.toResponse);
  }

  async findVersions(id: string): Promise<RequirementVersionResponse[]> {
    const versionen = await this.repository.findVersions(id);
    return versionen.map(RequirementsService.toVersionResponse);
  }

  async create(
    eingabe: CreateRequirementDto,
    benutzer: AuthenticatedUser,
  ): Promise<RequirementResponse> {
    const herkunft = eingabe.sourceSystem ?? "infrademand";

    try {
      // ADR-0017 A4: Wessen Klasse unbekannt ist, darf nicht schreiben.
      await this.sourceSystems.pruefeSchreibquelle(herkunft);

      // §6: gegen die **aktuell** gueltigen Definitionen, nicht gegen die bei Anlage
      // des Datensatzes geltenden. §19.2: derselbe Pruefpfad fuer jeden Eingangsweg.
      const definitionen = await this.attributeDefinitions.geltendeDefinitionen(
        eingabe.requirementType,
      );
      const pruefung = pruefeDynamischeAttribute(eingabe.dynamicAttributes ?? {}, definitionen);

      if (pruefung.fehler.length > 0) {
        throw new DynamicAttributeValidationError(pruefung.fehler);
      }

      // Auf die Anlage wirkt nur `manual_locked`: Es gibt keinen vorherigen Wert, den
      // eine automatische Quelle halten koennte. Ein berechnetes Feld darf aber auch
      // beim Anlegen nicht von Hand gesetzt werden.
      const klasse = await this.schreibendeKlasse(benutzer);
      const regeln = await this.mastership.regeln();

      const vorhaben: Feldvorhaben[] = Object.entries(
        feldwerte({
          projectId: eingabe.projectId,
          requirementType: eingabe.requirementType,
          status: eingabe.status,
          owner: eingabe.owner,
          dynamicAttributes: pruefung.werte,
        }),
      ).map(([field, neuerWert]) => ({
        field,
        neuerWert,
        aktuellerWert: null,
        aktuelleQuellenklasse: undefined,
      }));

      const abweisungen = pruefeHoheit(vorhaben, klasse, regeln);
      if (abweisungen.length > 0) {
        // Kein Eintrag in die Aufzeichnung: Es gibt keinen Datensatz, auf den er sich
        // beziehen koennte, und keinen Wert, bei dem wir geblieben waeren
        // (ADR-0019 Punkt 4).
        throw RequirementsService.hoheitsfehler(abweisungen);
      }

      const zeile = await this.repository.create({
        projectId: eingabe.projectId,
        requirementType: eingabe.requirementType,
        status: eingabe.status,
        owner: eingabe.owner,
        sourceSystem: herkunft,
        externalId: eingabe.externalId ?? null,
        // Die geprueften Werte, nicht die eingereichten: Vorgabewerte sind ergaenzt,
        // leere optionale Attribute entfernt.
        dynamicAttributes: pruefung.werte,
        changedBy: benutzer.userId,
        changeSource: benutzer.clientId,
      });

      return RequirementsService.toResponse(zeile);
    } catch (fehler) {
      if (fehler instanceof DynamicAttributeValidationError) {
        throw new BadRequestException({
          statusCode: 400,
          error: "Bad Request",
          message: "Dynamische Attribute genuegen den geltenden Definitionen nicht",
          // Feldbezogen, damit ein Formular alle beanstandeten Felder auf einmal
          // anzeigen kann statt eines nach dem anderen.
          attributes: fehler.fehler,
        });
      }
      if (fehler instanceof UnknownSourceSystemError) {
        throw new BadRequestException(fehler.message);
      }
      if (fehler instanceof DuplicateExternalIdError) {
        throw new ConflictException(fehler.message);
      }
      throw fehler;
    }
  }

  /**
   * Haelt ein Feld gegen automatische Uebernahme fest (ADR-0017 B6 bis B9).
   *
   * Ausdruecklich und mit Begruendung: Sie entsteht nie als Nebenwirkung einer Aenderung
   * (B7). Der Vorgang erzeugt eine neue Version wie jede andere Aenderung - die
   * Festhaltung ist Bestandteil des versionierten Zustands.
   */
  async setzeFesthaltung(
    sourceSystem: string,
    externalId: string,
    field: string,
    reason: string,
    benutzer: AuthenticatedUser,
  ): Promise<RequirementResponse> {
    const bestand = await this.repository.findBySource(sourceSystem, externalId);
    if (bestand === undefined) {
      throw new NotFoundException(new RequirementNotFoundError(sourceSystem, externalId).message);
    }

    // Ein festgehaltenes Feld, das es nicht gibt, wirkt nie - sieht aber aus, als taete
    // es das. Derselbe Gedanke wie bei den Hoheitsregeln.
    const definitionen = await this.attributeDefinitions.geltendeDefinitionen(
      bestand.requirementType,
    );
    const bekannt =
      (KERNFELDER as readonly string[]).includes(field) ||
      definitionen.some((definition) => definition.key === field);

    if (!bekannt) {
      throw new BadRequestException(
        `"${field}" ist weder ein Kernfeld noch ein fuer "${bestand.requirementType}" definiertes Attribut`,
      );
    }

    return this.schreibeFesthaltungen(
      bestand,
      {
        ...bestand.heldFields,
        [field]: { by: benutzer.userId, at: new Date().toISOString(), reason },
      },
      benutzer,
    );
  }

  /** Aufheben ist ein eigener, ebenso ausdruecklicher Vorgang (ADR-0017 B12). */
  async hebeFesthaltungAuf(
    sourceSystem: string,
    externalId: string,
    field: string,
    benutzer: AuthenticatedUser,
  ): Promise<RequirementResponse> {
    const bestand = await this.repository.findBySource(sourceSystem, externalId);
    if (bestand === undefined) {
      throw new NotFoundException(new RequirementNotFoundError(sourceSystem, externalId).message);
    }

    if (bestand.heldFields[field] === undefined) {
      throw new NotFoundException(`"${field}" ist an diesem Datensatz nicht festgehalten`);
    }

    const verbleibend = { ...bestand.heldFields };
    delete verbleibend[field];

    return this.schreibeFesthaltungen(bestand, verbleibend, benutzer);
  }

  /**
   * Schreibt geaenderte Festhaltungen und laesst die Fachwerte unberuehrt.
   *
   * Bewusst ueber denselben versionierten Schreibpfad wie eine Wertaenderung: Die
   * Festhaltung ist Bestandteil des Zustands (B9), und eine Stichtagsabfrage soll zeigen,
   * was damals festgehalten war.
   */
  private async schreibeFesthaltungen(
    bestand: RequirementRow,
    heldFields: Record<string, Festhaltung>,
    benutzer: AuthenticatedUser,
  ): Promise<RequirementResponse> {
    const zeile = await this.repository.update(bestand.id, {
      projectId: bestand.projectId,
      requirementType: bestand.requirementType,
      status: bestand.status,
      owner: bestand.owner,
      dynamicAttributes: bestand.dynamicAttributes,
      heldFields,
      changedBy: benutzer.userId,
      changeSource: benutzer.clientId,
    });

    return RequirementsService.toResponse(zeile);
  }

  private static toResponse(row: RequirementRow): RequirementResponse {
    return {
      id: row.id,
      projectId: row.projectId,
      requirementType: row.requirementType,
      status: row.status,
      owner: row.owner,
      sourceSystem: row.sourceSystem,
      externalId: row.externalId,
      heldFields: row.heldFields,
      dynamicAttributes: row.dynamicAttributes,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      version: row.version,
    };
  }

  private static toVersionResponse(row: RequirementHistoryRow): RequirementVersionResponse {
    return {
      ...RequirementsService.toResponse(row),
      validFrom: row.validFrom.toISOString(),
      validTo: row.validTo?.toISOString() ?? null,
      operation: row.operation,
      changedBy: row.changedBy,
      changeSource: row.changeSource,
    };
  }
}

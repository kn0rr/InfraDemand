import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { pruefeDynamischeAttribute } from "../attribute-definitions/attribut-pruefung";
import { DynamicAttributeValidationError } from "../attribute-definitions/attribute-definitions.errors";
import { AttributeDefinitionsService } from "../attribute-definitions/attribute-definitions.service";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { OpaClient } from "../berechtigung/opa.client";
import type { Festhaltung, RequirementHistoryRow, RequirementRow } from "../database/schema";
import { MastershipService } from "../mastership/mastership.service";
import { UnknownSourceSystemError } from "../source-systems/source-systems.errors";
import { SourceSystemsService } from "../source-systems/source-systems.service";
import { eintritte, pruefeUebergangsbedingungen } from "../workflows/bedingungspruefung";
import type { GeltenderWorkflow, WorkflowTransition } from "../workflows/typen";
import { WorkflowsService } from "../workflows/workflows.service";
import type { CreateRequirementDto } from "./create-requirement.dto";
import {
  alsDynamisch,
  alsKern,
  feldwerte,
  istGleich,
  KERNFELDER,
  letzteQuelleFuerFeld,
  PATCHBARE_KERNFELDER,
} from "./feldherkunft";
import {
  type Abweisung,
  type Feldvorhaben,
  pruefeHoheit,
  type Quellenklasse,
} from "./hoheitspruefung";
import { FesthaltungUebersicht } from "./hold-uebersicht.dto";
import type { PatchRequirementDto } from "./patch-requirement.dto";
import type { RequirementResponse } from "./requirement.dto";
import type { RequirementVersionResponse } from "./requirement-version.dto";
import { DuplicateExternalIdError, RequirementNotFoundError } from "./requirements.errors";
import { RequirementsRepository } from "./requirements.repository";
import { UebergangsauskunftResponse } from "./uebergaenge.dto";

@Injectable()
export class RequirementsService {
  constructor(
    private readonly repository: RequirementsRepository,
    private readonly sourceSystems: SourceSystemsService,
    private readonly attributeDefinitions: AttributeDefinitionsService,
    private readonly mastership: MastershipService,
    private readonly workflows: WorkflowsService,
    private readonly opa: OpaClient,
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
    const bestand = await this.ausHerkunft(sourceSystem, externalId, benutzer);

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
      ...(eingabe.owner === undefined ? {} : { owner: eingabe.owner }),
      ...(eingabe.responsibleGroup === undefined
        ? {}
        : { responsibleGroup: eingabe.responsibleGroup }),
      ...(eingabe.dynamicAttributes ?? {}),
    };

    // Nur die benannten Felder. Ein Vorgabewert aus der Attributdefinition ist keine
    // Aeusserung des Aufrufers und faellt nicht unter die Regeln.
    const benannt = new Set<string>([
      // `status` ist nicht dabei: Der Zustandswechsel laeuft ueber `wechsleZustand`
      // gegen den Graphen (ADR-0022 Punkt 1). `kern.status` traegt damit den Bestandswert.
      ...PATCHBARE_KERNFELDER.filter((feld) => eingabe[feld] !== undefined),
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
    const definitionen = await this.attributeDefinitions.geltendeDefinitionen(
      bestand.tenant,
      kern.requirementType,
    );
    const pruefung = pruefeDynamischeAttribute(alsDynamisch(gewuenscht), definitionen);

    if (pruefung.fehler.length > 0) {
      throw new BadRequestException({
        statusCode: 400,
        error: "Bad Request",
        message: "Dynamische Attribute genuegen den geltenden Definitionen nicht",
        attributes: pruefung.fehler,
      });
    }

    const regeln = await this.mastership.regeln(bestand.tenant);
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
    // ADR-0023: Der Workflow gehoert zur Art der Anforderung. Bliebe die alte Bindung
    // bestehen, liefe sie dauerhaft unter dem Graphen einer Art, die sie nicht mehr hat -
    // und das faellt niemandem auf, weil die Uebergaenge weiter funktionieren. Es sind nur
    // die falschen.
    //
    // Erst hier und nicht frueher: Ein Wechsel, den die Hoheitspruefung ohnehin abweist,
    // braucht keinen Lesezugriff auf die Workflow-Definitionen.
    const workflowBindung =
      kern.requirementType === bestand.requirementType
        ? undefined
        : await this.bindungFuer(bestand.tenant, kern.requirementType);

    const zeile = await this.repository.update(bestand.id, {
      ...kern,
      dynamicAttributes: pruefung.werte,
      // Unveraendert durchgereicht: Eine Aenderung von Werten hebt keine Festhaltung auf.
      // Dafuer gibt es einen eigenen Vorgang (ADR-0017 B12).
      heldFields: bestand.heldFields,
      changedBy: benutzer.userId,
      changeSource: benutzer.clientId,
      workflowBindung,
    });

    return RequirementsService.toResponse(zeile, await this.feldsicht(zeile, benutzer));
  }

  /**
   * Ohne Stichtag der aktuelle Bestand aus der Fachtabelle, mit Stichtag der Zustand aus
   * der Historie. Beide Wege muessen fuer "jetzt" dasselbe Ergebnis liefern - das prueft
   * der Test "Stichtag jetzt entspricht dem aktuellen Bestand".
   */
  async findAll(
    stichtag: string | undefined,
    benutzer: AuthenticatedUser,
  ): Promise<RequirementResponse[]> {
    // Eine Auskunft fuer beide Wege: Die Richtlinie kennt keinen Stichtag, sie beschreibt,
    // wer was sehen darf. Welche Tabelle das trifft, entscheidet das Repository.
    const sichtbarkeit = await this.opa.sichtbarkeit(benutzer);

    const zeilen =
      stichtag === undefined
        ? await this.repository.findAll(sichtbarkeit)
        : await this.repository.findAsOf(new Date(stichtag), sichtbarkeit);

    const sichten = await this.feldsichten(zeilen, benutzer);

    return zeilen.map((zeile) =>
      RequirementsService.toResponse(
        zeile,
        sichten.get(RequirementsService.feldsichtSchluessel(zeile)) ?? new Set(),
      ),
    );
  }

  async findVersions(
    id: string,
    benutzer: AuthenticatedUser,
  ): Promise<RequirementVersionResponse[]> {
    // Ueber den Aufloeser, nicht unmittelbar: Sonst waere die Historie der Weg, an der
    // Mandantenpruefung vorbei den Inhalt eines fremden Datensatzes zu lesen.
    const bestand = await this.ausKennung(id, benutzer);
    const versionen = await this.repository.findVersions(bestand.id);

    const sichten = await this.feldsichten(versionen, benutzer);

    return versionen.map((version) =>
      RequirementsService.toVersionResponse(
        version,
        sichten.get(RequirementsService.feldsichtSchluessel(version)) ?? new Set(),
      ),
    );
  }

  async create(
    eingabe: CreateRequirementDto,
    benutzer: AuthenticatedUser,
  ): Promise<RequirementResponse> {
    const herkunft = eingabe.sourceSystem ?? "infrademand";

    try {
      // ADR-0026 Punkt 3: Der Mandant kommt vom Aufrufer, aber er kann nur einen der
      // eigenen waehlen. Die Auswahl schraenkt ein, sie gibt nichts frei.
      if (!benutzer.tenants.includes(eingabe.tenant)) {
        // 403 und nicht 400: Der Rumpf ist wohlgeformt, es fehlt die Zugehoerigkeit.
        throw new ForbiddenException(`Sie gehoeren dem Mandanten "${eingabe.tenant}" nicht an`);
      }

      // ADR-0017 A4: Wessen Klasse unbekannt ist, darf nicht schreiben.
      await this.sourceSystems.pruefeSchreibquelle(herkunft);

      // ADR-0022 Punkt 2: Ohne gueltigen Workflow entsteht keine Anforderung. Sonst
      // hiesse "nicht konfiguriert" zugleich "nicht gesteuert" - und ein ungesteuerter
      // Typ saehe in der Oberflaeche aus wie ein gesteuerter.
      const workflow = await this.workflows.geltenderWorkflow(
        eingabe.tenant,
        eingabe.requirementType,
      );

      if (workflow === undefined) {
        throw new BadRequestException(
          `Fuer "${eingabe.requirementType}" ist kein gueltiger Workflow hinterlegt - ` +
            "ohne ihn kann keine Anforderung entstehen",
        );
      }

      // §6: gegen die **aktuell** gueltigen Definitionen, nicht gegen die bei Anlage
      // des Datensatzes geltenden. §19.2: derselbe Pruefpfad fuer jeden Eingangsweg.
      const definitionen = await this.attributeDefinitions.geltendeDefinitionen(
        eingabe.tenant,
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
      const regeln = await this.mastership.regeln(eingabe.tenant);
      // Ohne Angabe ist der Aufrufer verantwortlich. Seit ADR-0029 haengt die
      // Sichtbarkeit an diesem Feld - ein Vertipper kostete den Anwender sonst den
      // Zugriff auf die eigene Anforderung, ohne dass irgendwo ein Fehler entstuende.
      const verantwortlich = eingabe.owner ?? benutzer.username;
      const zustaendigeGruppe = eingabe.responsibleGroup ?? null;
      const vorhaben: Feldvorhaben[] = Object.entries(
        feldwerte({
          projectId: eingabe.projectId,
          requirementType: eingabe.requirementType,
          status: workflow.initialState,
          owner: verantwortlich,
          responsibleGroup: zustaendigeGruppe,
          dynamicAttributes: pruefung.werte,
        }),
      )
        // `status` ausgenommen: Der Anfangszustand kommt aus der Workflow-Definition und
        // ist keine Aeusserung des Aufrufers - dieselbe Ueberlegung wie beim Vorgabewert
        // einer Attributdefinition. Eine Regel `manual_locked` auf `status` wuerde sonst
        // das Anlegen von Hand verhindern, obwohl niemand einen Zustand gesetzt hat.
        .filter(([field]) => field !== "status")
        .map(([field, neuerWert]) => ({
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
        tenant: eingabe.tenant,
        status: workflow.initialState,
        owner: verantwortlich,
        responsibleGroup: eingabe.responsibleGroup ?? null,
        sourceSystem: herkunft,
        externalId: eingabe.externalId ?? null,
        // Die geprueften Werte, nicht die eingereichten: Vorgabewerte sind ergaenzt,
        // leere optionale Attribute entfernt.
        dynamicAttributes: pruefung.werte,
        workflowDefinitionId: workflow.id,
        workflowVersion: workflow.version,
        changedBy: benutzer.userId,
        changeSource: benutzer.clientId,
      });

      return RequirementsService.toResponse(zeile, await this.feldsicht(zeile, benutzer));
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
   * Wechselt den Zustand einer Anforderung (§7, ADR-0022 Punkt 1).
   *
   * Der Aufrufer nennt den **Zielzustand**, nicht den Uebergang. Ein Fremdsystem kennt
   * unseren Graphen nicht, und ein Formular soll nicht zwei Dinge schicken muessen, von
   * denen eines aus dem anderen folgt. Der passende Uebergang ist eindeutig: Zwei
   * Uebergaenge zwischen demselben Zustandspaar weist die Graphpruefung seit M4.1 ab.
   */
  async wechsleZustand(
    bestand: RequirementRow,
    zielzustand: string,
    begruendung: string | undefined,
    benutzer: AuthenticatedUser,
  ): Promise<RequirementResponse> {
    const workflow = await this.gebundeneFassung(bestand);

    if (!workflow.states.some((zustand) => zustand.key === zielzustand)) {
      throw new BadRequestException(`"${zielzustand}" ist kein Zustand des geltenden Workflows`);
    }

    if (bestand.status === zielzustand) {
      // §19.1: Wiederholte Uebermittlung desselben Datensatzes erzeugt keine Dubletten.
      // Ein Import liefert den Zustand bei jedem Lauf mit; jedes Mal eine Version zu
      // schreiben hiesse, Aenderungen zu verzeichnen, die keine waren.
      return RequirementsService.toResponse(bestand, await this.feldsicht(bestand, benutzer));
    }

    // Einmal gelesen, zweimal gebraucht: fuer die Eintritte des Vier-Augen-Prinzips und
    // fuer die feldgenaue Herkunft der Hoheitspruefung.
    const versionen = await this.repository.findVersions(bestand.id);

    // Bei fremdgefuehrten Workflows entscheidet das Fremdsystem (ADR-0021 Punkt 4). Ein
    // Zielzustand von dort ist eine Mitteilung, keine Bitte - und Bedingungen kann ein
    // solcher Workflow nicht tragen, das weist bereits die Graphpruefung ab.
    if (workflow.mode === "internal") {
      const uebergang = RequirementsService.findeUebergang(workflow, bestand.status, zielzustand);

      const verstoesse = pruefeUebergangsbedingungen(uebergang.bedingungen ?? [], {
        feldwerte: feldwerte(bestand),
        ausloeser: { userId: benutzer.userId, roles: benutzer.roles },
        eintritte: eintritte(versionen),
        begruendung,
      });

      if (verstoesse.length > 0) {
        // Feldbezogen wie die Hoheitsabweisung, damit ein Formular alle Gruende auf
        // einmal anzeigen kann statt eines nach dem anderen.
        throw new ConflictException({
          statusCode: 409,
          error: "Conflict",
          message: "Die Bedingungen dieses Uebergangs sind nicht erfuellt",
          conditions: verstoesse.map((verstoss) => ({
            kind: verstoss.art,
            message: verstoss.message,
          })),
        });
      }
    }

    await this.pruefeStatushoheit(bestand, zielzustand, versionen, benutzer);

    const zeile = await this.repository.update(bestand.id, {
      projectId: bestand.projectId,
      requirementType: bestand.requirementType,
      status: zielzustand,
      owner: bestand.owner,
      responsibleGroup: bestand.responsibleGroup,
      dynamicAttributes: bestand.dynamicAttributes,
      heldFields: bestand.heldFields,
      changeKind: "transition",
      changeReason: begruendung,
      changedBy: benutzer.userId,
      changeSource: benutzer.clientId,
    });

    return RequirementsService.toResponse(zeile, await this.feldsicht(zeile, benutzer));
  }

  /**
   * Ordnet einer Anforderung einen Zustand des Graphen zu (ADR-0022 Punkt 5).
   *
   * Fuer den Fall, dass ihr aktueller Zustand im geltenden Workflow nicht vorkommt - weil
   * sie aelter ist als er, weil ein Import einen fremden Status geliefert hat oder weil
   * ein Zustand aus der Definition entfernt wurde.
   *
   * **Kein Uebergang**, und deshalb auch nicht als solcher verzeichnet. Die Begruendung
   * ist Pflicht: Die Zuordnung setzt einen Zustand, den kein Uebergang hergibt, und wer
   * sie spaeter vorfindet, muss erkennen koennen, worauf sie beruhte.
   */
  private async ordneZustandZu(
    bestand: RequirementRow,
    zustand: string,
    reason: string,
    benutzer: AuthenticatedUser,
  ): Promise<RequirementResponse> {
    const workflow = await this.gebundeneFassung(bestand);

    if (!workflow.states.some((eintrag) => eintrag.key === zustand)) {
      throw new BadRequestException(`"${zustand}" ist kein Zustand des geltenden Workflows`);
    }

    const zeile = await this.repository.update(bestand.id, {
      projectId: bestand.projectId,
      requirementType: bestand.requirementType,
      status: zustand,
      owner: bestand.owner,
      responsibleGroup: bestand.responsibleGroup,
      dynamicAttributes: bestand.dynamicAttributes,
      heldFields: bestand.heldFields,
      changeKind: "state_assignment",
      changeReason: reason,
      changedBy: benutzer.userId,
      changeSource: benutzer.clientId,
    });

    return RequirementsService.toResponse(zeile, await this.feldsicht(zeile, benutzer));
  }

  /**
   * Welche Uebergaenge diese Anforderung jetzt nehmen kann - und warum die anderen nicht
   * (M4.5).
   *
   * **Die Oberflaeche kann das nicht selbst ausrechnen.** Sie muesste die Bedingungen samt
   * Vorbehalten auswerten, die Rollen des Anmeldenden dagegenhalten und fuer das
   * Vier-Augen-Prinzip die Eintritte aus der Versionshistorie kennen - eine zweite Fassung
   * der Pruefung im Browser, die bei der ersten Abweichung falsche Schaltflaechen anbietet.
   *
   * **Die Antwort haengt vom Anmeldenden ab** und darf deshalb nicht zwischengespeichert
   * werden: Rollen, Identitaet und Vier-Augen-Bezug beziehen sich auf ihn.
   *
   * Gesperrte Uebergaenge werden **mitgeliefert, nicht weggelassen.** Wer keine
   * Schaltflaeche sieht, weiss nicht, ob der Vorgang zu Ende ist oder ihm eine Rolle fehlt.
   */
  async zulaessigeUebergaenge(
    bestand: RequirementRow,
    benutzer: AuthenticatedUser,
  ): Promise<UebergangsauskunftResponse> {
    const workflow = await this.gebundeneFassung(bestand);
    const bekannt = workflow.states.some((zustand) => zustand.key === bestand.status);
    const zustaende = workflow.states.map((zustand) => ({
      key: zustand.key,
      label: zustand.label,
    }));
    // Bei fremdgefuehrten Workflows entscheidet das Fremdsystem (ADR-0021 Punkt 4) - wir
    // haben keine Uebergaenge anzubieten, auch wenn der Graph welche auffuehrte.
    if (workflow.mode === "external" || !bekannt) {
      return {
        currentState: bestand.status,
        currentStateInWorkflow: bekannt,
        states: zustaende,
        transitions: [],
      };
    }

    const versionen = await this.repository.findVersions(bestand.id);
    const kontext = {
      feldwerte: feldwerte(bestand),
      ausloeser: { userId: benutzer.userId, roles: benutzer.roles },
      eintritte: eintritte(versionen),
      // Bewusst leer: Die Begruendung entsteht erst beim Ausloesen. Ihr Fehlen ist kein
      // Hinderungsgrund, sondern eine Eingabeanforderung - siehe unten.
      begruendung: undefined,
    };

    const transitions = workflow.transitions
      .filter((uebergang) => uebergang.from === bestand.status)
      .map((uebergang) => {
        const verstoesse = pruefeUebergangsbedingungen(uebergang.bedingungen ?? [], kontext);
        const hindernisse = verstoesse.filter((verstoss) => verstoss.art !== "begruendung");

        return {
          toState: uebergang.to,
          label: uebergang.label,
          allowed: hindernisse.length === 0,
          blockedBy: hindernisse.map((verstoss) => ({
            kind: verstoss.art,
            message: verstoss.message,
          })),
          requiresReason: verstoesse.length !== hindernisse.length,
        };
      });

    return {
      currentState: bestand.status,
      currentStateInWorkflow: true,
      states: zustaende,
      transitions,
    };
  }

  /**
   * Hebt eine laufende Anforderung auf die aktuelle Fassung ihres Workflows
   * (ADR-0025 Punkt 4).
   *
   * **Der Ausweg, wenn eine Workflow-Definition fachlich falsch ist.** Seit M4.3 kann sie
   * formal einwandfrei und trotzdem unbrauchbar sein - eine Rolle, die niemand hat, ein
   * Vier-Augen-Bezug, der in der Praxis nicht erfuellbar ist. Ohne diesen Vorgang erreichte
   * die berichtigte Fassung die laufenden Anforderungen nie.
   *
   * Ausdruecklich und begruendungspflichtig, nie als Nebenwirkung: Wer hebt, aendert die
   * Regeln unter einem laufenden Vorgang, und das soll man ihm ansehen.
   */
  private async hebeFassung(
    bestand: RequirementRow,
    reason: string,
    benutzer: AuthenticatedUser,
  ): Promise<RequirementResponse> {
    const ziel = await this.workflows.aktuelleFassung(bestand.workflowDefinitionId);

    if (ziel === undefined) {
      throw new Error(`Workflow ${bestand.workflowDefinitionId} fehlt`);
    }

    if (ziel.version === bestand.workflowVersion) {
      // Schon auf dem heutigen Stand. Eine Version dafuer zu schreiben hiesse, eine
      // Aenderung zu verzeichnen, die keine war (§19.1) - dieselbe Ueberlegung wie beim
      // Wechsel auf denselben Zustand.
      return RequirementsService.toResponse(bestand, await this.feldsicht(bestand, benutzer));
    }

    if (!ziel.states.some((zustand) => zustand.key === bestand.status)) {
      // Sonst behebt dieser Vorgang ein Problem und erzeugt dabei das aus ADR-0022
      // Punkt 5: eine Anforderung in einem Zustand, den ihr Graph nicht kennt.
      throw new ConflictException(
        `Der aktuelle Zustand "${bestand.status}" kommt in Fassung ${ziel.version} nicht vor. ` +
          "Erst zuordnen, dann heben",
      );
    }

    const zeile = await this.repository.update(bestand.id, {
      projectId: bestand.projectId,
      requirementType: bestand.requirementType,
      // Unveraendert: Gehoben wird die Fassung, nicht der Zustand (ADR-0025 Punkt 5).
      status: bestand.status,
      owner: bestand.owner,
      responsibleGroup: bestand.responsibleGroup,
      dynamicAttributes: bestand.dynamicAttributes,
      heldFields: bestand.heldFields,
      workflowBindung: { definitionId: ziel.id, version: ziel.version },
      changeKind: "version_upgrade",
      changeReason: reason,
      changedBy: benutzer.userId,
      changeSource: benutzer.clientId,
    });

    return RequirementsService.toResponse(zeile, await this.feldsicht(zeile, benutzer));
  }

  /**
   * Der Graph, gegen den diese Anforderung laeuft - ihre Ursprungsfassung, nicht die
   * aktuelle (§7).
   */
  private async gebundeneFassung(bestand: RequirementRow): Promise<GeltenderWorkflow> {
    const workflow = await this.workflows.gebundenerWorkflow(
      bestand.workflowDefinitionId,
      bestand.workflowVersion,
    );

    if (workflow === undefined) {
      // Historienzeilen werden nie geloescht. Trifft das hier zu, ist etwas an der
      // Versionierung kaputt, und weiterzumachen hiesse, gegen einen erfundenen Graphen
      // zu pruefen.
      throw new Error(
        `Workflow-Fassung ${bestand.workflowDefinitionId}/${bestand.workflowVersion} fehlt`,
      );
    }

    return workflow;
  }

  /**
   * Loest einen Datensatz ueber die Herkunft auf (ADR-0010) und prueft die Zugehoerigkeit.
   *
   * **Ein fremder Mandant liefert 404, nicht 403.** Dass ein Datensatz existiert, ist
   * bereits eine Auskunft ueber den anderen Mandanten - wer mit 403 antwortet, verraet
   * seine Existenz. Beide Faelle sehen deshalb gleich aus.
   */
  private async ausHerkunft(
    sourceSystem: string,
    externalId: string,
    benutzer: AuthenticatedUser,
  ): Promise<RequirementRow> {
    const bestand = await this.repository.findBySource(
      sourceSystem,
      externalId,
      await this.opa.sichtbarkeit(benutzer),
    );

    if (bestand === undefined) {
      throw new NotFoundException(new RequirementNotFoundError(sourceSystem, externalId).message);
    }

    return bestand;
  }

  /**
   * Die verborgenen Attributschluessel fuer eine Zeile.
   *
   * Je Zeile die Definitionen ihres Mandanten und ihrer Art - die Sichtbarkeit ist gestuft
   * wie jede andere Angabe der Definition (ADR-0026 Punkt 5).
   */
  private async feldsicht(
    zeile: { tenant: string; requirementType: string },
    benutzer: AuthenticatedUser,
  ): Promise<ReadonlySet<string>> {
    const definitionen = await this.attributeDefinitions.geltendeDefinitionen(
      zeile.tenant,
      zeile.requirementType,
    );

    return this.opa.verborgeneFelder(definitionen, benutzer);
  }

  /**
   * Dasselbe fuer mehrere Zeilen, mit **einem** Aufruf je Kombination aus Mandant und Art.
   *
   * Nicht je Zeile: Eine Liste aus fuenfzig Anforderungen derselben Art braucht eine
   * Auskunft, nicht fuenfzig.
   */
  private async feldsichten(
    zeilen: readonly { tenant: string; requirementType: string }[],
    benutzer: AuthenticatedUser,
  ): Promise<Map<string, ReadonlySet<string>>> {
    const sichten = new Map<string, ReadonlySet<string>>();

    for (const zeile of zeilen) {
      const schluessel = RequirementsService.feldsichtSchluessel(zeile);

      if (!sichten.has(schluessel)) {
        sichten.set(schluessel, await this.feldsicht(zeile, benutzer));
      }
    }

    return sichten;
  }

  private static feldsichtSchluessel(zeile: { tenant: string; requirementType: string }): string {
    return `${zeile.tenant}\u0000${zeile.requirementType}`;
  }
  /**
   * Loest einen Datensatz ueber die interne Kennung auf und prueft die Zugehoerigkeit.
   *
   * Notwendig, weil eigene Erfassung keinen externen Bezeichner hat (§19.1). Kein
   * Widerspruch zu ADR-0010: Dessen Regel gilt der Grenze zur Kapazitaetsberechnung, nicht
   * der eigenen Oberflaeche.
   */
  private async ausKennung(id: string, benutzer: AuthenticatedUser): Promise<RequirementRow> {
    const bestand = await this.repository.findById(id, await this.opa.sichtbarkeit(benutzer));

    if (bestand === undefined) {
      throw new NotFoundException(`Anforderung ${id} existiert nicht`);
    }

    return bestand;
  }
  /**
   * Die Bindung, die fuer diese Anforderungsart gilt (ADR-0022 Punkt 2, ADR-0023).
   *
   * Ohne gueltigen Workflow gibt es keine Bindung - und damit keine Anforderung dieser
   * Art. Das gilt beim Anlegen wie beim Wechsel der Art.
   */
  private async bindungFuer(
    tenant: string,
    requirementType: string,
  ): Promise<{ definitionId: string; version: number }> {
    const workflow = await this.workflows.geltenderWorkflow(tenant, requirementType);

    if (workflow === undefined) {
      throw new BadRequestException(
        `Fuer "${requirementType}" ist kein gueltiger Workflow hinterlegt`,
      );
    }

    return { definitionId: workflow.id, version: workflow.version };
  }

  /**
   * Gibt es einen Uebergang vom aktuellen in den gewuenschten Zustand?
   *
   * Der unbekannte Ausgangszustand bekommt eine eigene Meldung. „Uebergang unzulaessig"
   * schickte die Suche in die falsche Richtung - man prueft den Graphen auf einen
   * Uebergang, den es nie geben konnte, weil schon der Ausgangspunkt nicht darin vorkommt.
   */
  private static findeUebergang(
    workflow: GeltenderWorkflow,
    aktuell: string,
    ziel: string,
  ): WorkflowTransition {
    if (!workflow.states.some((zustand) => zustand.key === aktuell)) {
      throw new ConflictException(
        `Der aktuelle Zustand "${aktuell}" kommt im geltenden Workflow nicht vor. ` +
          "Ein Administrator muss ihn zuordnen, bevor Uebergaenge moeglich sind",
      );
    }

    const uebergang = workflow.transitions.find(
      (eintrag) => eintrag.from === aktuell && eintrag.to === ziel,
    );

    if (uebergang === undefined) {
      throw new ConflictException(`Von "${aktuell}" fuehrt kein Uebergang nach "${ziel}"`);
    }

    return uebergang;
  }

  /**
   * Hoheitspruefung fuer den Zustandswechsel (ADR-0022 Punkt 8).
   *
   * Der Graph regelt, **wohin** gewechselt werden darf; die Hoheitsregeln regeln, **wer**
   * wechseln darf. Die beiden Pruefungen ersetzen einander nicht.
   */
  private async pruefeStatushoheit(
    bestand: RequirementRow,
    zielzustand: string,
    versionen: readonly RequirementHistoryRow[],
    benutzer: AuthenticatedUser,
  ): Promise<void> {
    const klasse = await this.schreibendeKlasse(benutzer);
    const regeln = await this.mastership.regeln(bestand.tenant);
    const quellen = await this.sourceSystems.klassenkarte();

    const quelle = letzteQuelleFuerFeld(
      versionen.map((version) => ({
        werte: feldwerte(version),
        changeSource: version.changeSource,
      })),
      "status",
    );

    const abweisungen = pruefeHoheit(
      [
        {
          field: "status",
          neuerWert: zielzustand,
          aktuellerWert: bestand.status,
          aktuelleQuellenklasse: quelle === undefined ? undefined : quellen.get(quelle),
        },
      ],
      klasse,
      regeln,
    );

    if (abweisungen.length === 0) {
      return;
    }

    // Verzeichnet **und** abgewiesen. ADR-0019 laesst den Rest einer Lieferung stehen,
    // wenn ein Feld abgelehnt wird - hier gibt es keinen Rest, der Zustandswechsel ist
    // die ganze Operation. Der Eintrag bleibt trotzdem, weil ein naechtlicher Lauf die
    // Antwort womoeglich nicht liest.
    await this.abweisungenVerzeichnen(bestand.id, abweisungen, benutzer);
    throw RequirementsService.hoheitsfehler(abweisungen);
  }
  /**
   * Alle festgehaltenen Felder der Plattform (ADR-0017 B14).
   *
   * Festhaltungen wachsen und schrumpfen nie von selbst. Ohne einen Ort, an dem sie
   * vollstaendig sichtbar sind, entsteht genau der schleichende Auseinanderlauf, den die
   * Sichtbarkeit am einzelnen Datensatz verhindern soll - nur eben verteilt und dadurch
   * unbemerkt.
   */
  async findFesthaltungen(): Promise<FesthaltungUebersicht[]> {
    const [datensaetze, zusammenfassung] = await Promise.all([
      this.repository.findMitFesthaltungen(),
      this.repository.findAbweisungsZusammenfassung(),
    ]);

    const abweisungen = new Map(
      zusammenfassung.map((eintrag) => [`${eintrag.requirementId}\u0000${eintrag.field}`, eintrag]),
    );

    return datensaetze.flatMap((zeile) => {
      const werte = feldwerte(zeile);

      return Object.entries(zeile.heldFields).map(([field, festhaltung]) => {
        const abweisung = abweisungen.get(`${zeile.id}\u0000${field}`);

        return {
          requirementId: zeile.id,
          sourceSystem: zeile.sourceSystem,
          externalId: zeile.externalId,
          field,
          heldValue: werte[field] ?? null,
          heldSince: festhaltung.at,
          heldBy: festhaltung.by,
          reason: festhaltung.reason,
          lastRejection:
            abweisung === undefined
              ? null
              : {
                  value: abweisung.letzterWert,
                  sourceSystem: abweisung.letzteQuelle,
                  occurredAt: abweisung.zuletzt.toISOString(),
                  count: abweisung.anzahl,
                },
        };
      });
    });
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
    const bestand = await this.ausHerkunft(sourceSystem, externalId, benutzer);

    // Ein festgehaltenes Feld, das es nicht gibt, wirkt nie - sieht aber aus, als taete
    // es das. Derselbe Gedanke wie bei den Hoheitsregeln.
    const definitionen = await this.attributeDefinitions.geltendeDefinitionen(
      bestand.tenant,
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
    const bestand = await this.ausHerkunft(sourceSystem, externalId, benutzer);

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
      responsibleGroup: bestand.responsibleGroup,
      dynamicAttributes: bestand.dynamicAttributes,
      heldFields,
      changedBy: benutzer.userId,
      changeSource: benutzer.clientId,
    });

    return RequirementsService.toResponse(zeile, await this.feldsicht(zeile, benutzer));
  }
  /**
   * **Das Feld fehlt, es steht nicht auf `null`.** Bei den uebrigen Feldern heisst `null`
   * bereits „nicht gesetzt" - beides zu vermengen machte die Aussagen ununterscheidbar.
   *
   * Im Contract kostet das nichts: `dynamicAttributes` traegt `additionalProperties`, und
   * ein verborgenes Attribut sieht aus wie ein nie gesetztes (ADR-0030 Punkt 3).
   */
  private static ohneVerborgene(
    werte: Record<string, unknown>,
    verborgen: ReadonlySet<string>,
  ): Record<string, unknown> {
    if (verborgen.size === 0) {
      return werte;
    }

    return Object.fromEntries(
      Object.entries(werte).filter(([schluessel]) => !verborgen.has(schluessel)),
    );
  }

  private static toResponse(
    row: RequirementRow,
    verborgen: ReadonlySet<string>,
  ): RequirementResponse {
    return {
      id: row.id,
      projectId: row.projectId,
      requirementType: row.requirementType,
      tenant: row.tenant,
      status: row.status,
      owner: row.owner,
      responsibleGroup: row.responsibleGroup,
      workflow: { id: row.workflowDefinitionId, version: row.workflowVersion },
      sourceSystem: row.sourceSystem,
      externalId: row.externalId,
      heldFields: row.heldFields,
      dynamicAttributes: RequirementsService.ohneVerborgene(row.dynamicAttributes, verborgen),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      version: row.version,
    };
  }

  private static toVersionResponse(
    row: RequirementHistoryRow,
    verborgen: ReadonlySet<string>,
  ): RequirementVersionResponse {
    return {
      ...RequirementsService.toResponse(row, verborgen),
      validFrom: row.validFrom.toISOString(),
      validTo: row.validTo?.toISOString() ?? null,
      operation: row.operation,
      changedBy: row.changedBy,
      changeSource: row.changeSource,
    };
  }

  async wechsleZustandUeberHerkunft(
    sourceSystem: string,
    externalId: string,
    zielzustand: string,
    begruendung: string | undefined,
    benutzer: AuthenticatedUser,
  ): Promise<RequirementResponse> {
    return this.wechsleZustand(
      await this.ausHerkunft(sourceSystem, externalId, benutzer),
      zielzustand,
      begruendung,
      benutzer,
    );
  }

  async wechsleZustandUeberKennung(
    id: string,
    zielzustand: string,
    begruendung: string | undefined,
    benutzer: AuthenticatedUser,
  ): Promise<RequirementResponse> {
    return this.wechsleZustand(
      await this.ausKennung(id, benutzer),
      zielzustand,
      begruendung,
      benutzer,
    );
  }

  async uebergaengeUeberHerkunft(
    sourceSystem: string,
    externalId: string,
    benutzer: AuthenticatedUser,
  ): Promise<UebergangsauskunftResponse> {
    return this.zulaessigeUebergaenge(
      await this.ausHerkunft(sourceSystem, externalId, benutzer),
      benutzer,
    );
  }

  async uebergaengeUeberKennung(
    id: string,
    benutzer: AuthenticatedUser,
  ): Promise<UebergangsauskunftResponse> {
    return this.zulaessigeUebergaenge(await this.ausKennung(id, benutzer), benutzer);
  }

  async ordneZustandZuUeberHerkunft(
    sourceSystem: string,
    externalId: string,
    zustand: string,
    reason: string,
    benutzer: AuthenticatedUser,
  ): Promise<RequirementResponse> {
    return this.ordneZustandZu(
      await this.ausHerkunft(sourceSystem, externalId, benutzer),
      zustand,
      reason,
      benutzer,
    );
  }

  async ordneZustandZuUeberKennung(
    id: string,
    zustand: string,
    reason: string,
    benutzer: AuthenticatedUser,
  ): Promise<RequirementResponse> {
    return this.ordneZustandZu(await this.ausKennung(id, benutzer), zustand, reason, benutzer);
  }

  async hebeFassungUeberHerkunft(
    sourceSystem: string,
    externalId: string,
    reason: string,
    benutzer: AuthenticatedUser,
  ): Promise<RequirementResponse> {
    return this.hebeFassung(
      await this.ausHerkunft(sourceSystem, externalId, benutzer),
      reason,
      benutzer,
    );
  }

  async hebeFassungUeberKennung(
    id: string,
    reason: string,
    benutzer: AuthenticatedUser,
  ): Promise<RequirementResponse> {
    return this.hebeFassung(await this.ausKennung(id, benutzer), reason, benutzer);
  }
}

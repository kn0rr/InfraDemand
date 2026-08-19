import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AttributeDefinitionsService } from "../attribute-definitions/attribute-definitions.service";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import type { WorkflowDefinitionHistoryRow, WorkflowDefinitionRow } from "../database/schema";
import { spezifischste } from "../gemeinsam/spezifitaet";
import { KERNFELDER } from "../requirements/feldherkunft";
import type { CreateWorkflowDefinitionDto } from "./create-workflow-definition.dto";
import { genannteFelder, pruefeGraph, unerreichbareZustaende } from "./graph-pruefung";
import type { Betriebsart, GeltenderWorkflow, Graph } from "./typen";
import type { UpdateWorkflowDefinitionDto } from "./update-workflow-definition.dto";
import type {
  WorkflowDefinitionResponse,
  WorkflowDefinitionVersionResponse,
  WorkflowVersionUsageResponse,
} from "./workflow-definition.dto";
import {
  DuplicateWorkflowRequirementTypeError,
  WorkflowDefinitionNotFoundError,
} from "./workflows.errors";
import { WorkflowsRepository } from "./workflows.repository";

@Injectable()
export class WorkflowsService {
  constructor(
    private readonly repository: WorkflowsRepository,
    private readonly attributeDefinitions: AttributeDefinitionsService,
  ) {}

  async findAll(): Promise<WorkflowDefinitionResponse[]> {
    const zeilen = await this.repository.findAll();

    return zeilen.map(WorkflowsService.toResponse);
  }

  async findVersions(id: string): Promise<WorkflowDefinitionVersionResponse[]> {
    const versionen = await this.repository.findVersions(id);

    if (versionen.length === 0) {
      throw new NotFoundException(`Workflow-Definition ${id} existiert nicht`);
    }

    return versionen.map(WorkflowsService.toVersionResponse);
  }

  /**
   * Der Workflow, gegen den ein Statuswechsel zu pruefen ist - der spezifischste fuer
   * diesen Mandanten und diese Anforderungsart (ADR-0026 Punkt 5).
   * **Ein ausser Kraft gesetzter Workflow bedeutet "keiner", nicht "der allgemeine".**
   * Das Repository liefert bewusst auch inaktive Zeilen; hier faellt die Entscheidung.
   * Wuerde stattdessen auf den allgemeinen zurueckgefallen, liefen die Anforderungen
   * dieses Typs vom Moment des Ausserkraftsetzens an durch einen anderen Graphen - eine
   * Aenderung, die niemand angeordnet hat und die an keiner Stelle sichtbar wird.
   *
   * Was ein fehlender Workflow fuer den Statuswechsel heisst, entscheidet M4.2.
   */
  async geltenderWorkflow(
    tenant: string,
    requirementType: string,
  ): Promise<GeltenderWorkflow | undefined> {
    const zeile = spezifischste(await this.repository.findKandidaten(tenant, requirementType));

    if (zeile === undefined || !zeile.active) {
      return undefined;
    }

    return {
      id: zeile.id,
      version: zeile.version,
      mode: zeile.mode,
      initialState: zeile.initialState,
      states: zeile.states,
      transitions: zeile.transitions,
    };
  }

  /**
   * Nennen die Bedingungen nur Felder, die es gibt?
   *
   * Eine Pflicht auf ein nicht vorhandenes Feld ist nie erfuellbar - der Uebergang waere
   * dauerhaft gesperrt, und auffallen wuerde es erst, wenn jemand feststeckt. Deshalb
   * beim Speichern.
   */
  private async pruefeFeldnamen(
    graph: Graph,
    tenant: string | null,
    requirementType: string | null,
  ): Promise<void> {
    const genannt = genannteFelder(graph);

    if (genannt.length === 0) {
      return;
    }

    // Leerer Anforderungstyp trifft keinen typbezogenen Eintrag - uebrig bleiben genau
    // die allgemeinen Definitionen. Das ist fuer einen allgemeinen Workflow das
    // Richtige, und "" kann kein echter Typ sein (MinLength(1) im DTO).
    // Der Mandant des Workflows, nicht `null`: Ein mandantenspezifischer Workflow darf die
    // Attribute seines Mandanten nennen. Bleibt er leer, liefert `geltendeDefinitionen` nur
    // die plattformweiten - und genau das ist fuer einen plattformweiten Workflow richtig,
    // denn er darf kein Feld nennen, das nur ein Mandant hat (ADR-0024 Punkt 7).
    const definitionen = await this.attributeDefinitions.geltendeDefinitionen(
      tenant,
      requirementType ?? "",
    );

    const bekannt = new Set<string>([
      ...(KERNFELDER as readonly string[]),
      ...definitionen.map((definition) => definition.key),
    ]);

    const unbekannt = genannt.filter((eintrag) => !bekannt.has(eintrag.feld));

    if (unbekannt.length > 0) {
      throw new BadRequestException(
        unbekannt
          .map(
            (eintrag) =>
              `${eintrag.stelle}: "${eintrag.feld}" ist weder ein Kernfeld noch ein hier geltendes Attribut`,
          )
          .join("; "),
      );
    }

    // ADR-0031 Punkt 4: `identitaet` vergleicht den Ausloesenden mit dem Feldwert. Nennt
    // sie ein Feld, das keine Person enthaelt, ist die Bedingung nicht falsch, sondern
    // **nie erfuellbar** - der Uebergang waere dauerhaft gesperrt, und niemand saehe,
    // warum. Genau dieser Fehler hat zwei Meilensteine ueberlebt.
    const personenfelder = new Set<string>([
      "owner",
      ...definitionen
        .filter((definition) => definition.dataType === "person")
        .map((definition) => definition.key),
    ]);

    const keinePerson = genannt.filter(
      (eintrag) => eintrag.art === "identitaet" && !personenfelder.has(eintrag.feld),
    );

    if (keinePerson.length > 0) {
      throw new BadRequestException(
        keinePerson
          .map(
            (eintrag) =>
              `${eintrag.stelle}: "${eintrag.feld}" enthaelt keine Person - "identitaet" verlangt "owner" oder ein Attribut vom Typ "person"`,
          )
          .join("; "),
      );
    }
  }

  /**
   * Die Fassung, an die eine laufende Anforderung gebunden ist (§7, ADR-0022).
   *
   * Nicht der aktuelle Workflow: §7 verlangt, dass eine laufende Anforderung auf ihrer
   * Ursprungsfassung bleibt. Der Graph steht vollstaendig in der Historienzeile - deshalb
   * genuegt ein Lesezugriff und kein Zusammensetzen.
   *
   * Liefert `undefined` nur, wenn die Fassung nicht existiert. Das kann nicht auftreten,
   * solange Historienzeilen nie geloescht werden - der Aufrufer muss den Fall trotzdem
   * behandeln, weil ein stiller `null`-Zugriff hier einen falschen Graphen bedeutete.
   */
  async gebundenerWorkflow(id: string, version: number): Promise<GeltenderWorkflow | undefined> {
    const zeile = await this.repository.findVersion(id, version);

    if (zeile === undefined) {
      return undefined;
    }

    return {
      id: zeile.id,
      version: zeile.version,
      mode: zeile.mode,
      initialState: zeile.initialState,
      states: zeile.states,
      transitions: zeile.transitions,
    };
  }

  /**
   * Die **aktuelle** Fassung einer Workflow-Definition - das Ziel eines Hebens
   * (ADR-0025 Punkt 4).
   *
   * Ohne Ruecksicht auf `active`: Eine ausser Kraft gesetzte Definition nimmt keine neuen
   * Anforderungen mehr auf (ADR-0025 Punkt 1), aber ihre laufenden auf den heutigen Stand
   * zu bringen bleibt sinnvoll - womoeglich ist gerade das die Behebung.
   */
  async aktuelleFassung(id: string): Promise<GeltenderWorkflow | undefined> {
    const zeile = await this.repository.findById(id);

    if (zeile === undefined) {
      return undefined;
    }

    return {
      id: zeile.id,
      version: zeile.version,
      mode: zeile.mode,
      initialState: zeile.initialState,
      states: zeile.states,
      transitions: zeile.transitions,
    };
  }

  async create(
    eingabe: CreateWorkflowDefinitionDto,
    benutzer: AuthenticatedUser,
  ): Promise<WorkflowDefinitionResponse> {
    // Die Fachtabelle hat keinen Vorgabewert; der Wert entsteht hier, sichtbar, statt
    // in der Datenbank.
    const mode: Betriebsart = eingabe.mode ?? "internal";
    const states = eingabe.states.map((zustand) => ({
      key: zustand.key,
      label: zustand.label,
      final: zustand.final === true,
    }));
    if (eingabe.tenant !== undefined && !benutzer.tenants.includes(eingabe.tenant)) {
      throw new ForbiddenException(`Sie gehoeren dem Mandanten "${eingabe.tenant}" nicht an`);
    }

    WorkflowsService.pruefeGraphOderWirf(
      { initialState: eingabe.initialState, states, transitions: eingabe.transitions },
      mode,
    );

    await this.pruefeFeldnamen(
      { initialState: eingabe.initialState, states, transitions: eingabe.transitions },
      eingabe.tenant ?? null,
      eingabe.requirementType ?? null,
    );

    try {
      const zeile = await this.repository.create({
        label: eingabe.label,
        requirementType: eingabe.requirementType ?? null,
        tenant: eingabe.tenant ?? null,
        mode,
        initialState: eingabe.initialState,
        states,
        transitions: eingabe.transitions,
        changedBy: benutzer.userId,
        changeSource: benutzer.clientId,
      });

      return WorkflowsService.toResponse(zeile);
    } catch (fehler) {
      if (fehler instanceof DuplicateWorkflowRequirementTypeError) {
        throw new ConflictException(fehler.message);
      }
      throw fehler;
    }
  }

  async update(
    id: string,
    eingabe: UpdateWorkflowDefinitionDto,
    benutzer: AuthenticatedUser,
  ): Promise<WorkflowDefinitionResponse> {
    const states = eingabe.states.map((zustand) => ({
      key: zustand.key,
      label: zustand.label,
      final: zustand.final === true,
    }));

    WorkflowsService.pruefeGraphOderWirf(
      { initialState: eingabe.initialState, states, transitions: eingabe.transitions },
      eingabe.mode,
    );
    const bestand = await this.repository.findById(id);

    if (bestand === undefined) {
      throw new NotFoundException(new WorkflowDefinitionNotFoundError(id).message);
    }

    await this.pruefeFeldnamen(
      { initialState: eingabe.initialState, states, transitions: eingabe.transitions },
      bestand.tenant,
      bestand.requirementType,
    );
    try {
      const zeile = await this.repository.update(id, {
        label: eingabe.label,
        mode: eingabe.mode,
        initialState: eingabe.initialState,
        states,
        transitions: eingabe.transitions,
        active: eingabe.active,
        changedBy: benutzer.userId,
        changeSource: benutzer.clientId,
      });

      return WorkflowsService.toResponse(zeile);
    } catch (fehler) {
      if (fehler instanceof WorkflowDefinitionNotFoundError) {
        throw new NotFoundException(fehler.message);
      }
      throw fehler;
    }
  }

  /**
   * Ein widerspruechlicher Graph wird beim Speichern abgewiesen, nicht beim Benutzen.
   * Waere es umgekehrt, stellte der Fehler eine laufende Anforderung fest - in einem
   * Zustand, den der Graph nicht kennt.
   *
   * Alle Befunde in einer Meldung: Wer ein Formular abschickt, will nicht siebenmal
   * nacheinander je einen Fehler zu sehen bekommen.
   */
  private static pruefeGraphOderWirf(graph: Graph, mode: Betriebsart): void {
    const befunde = pruefeGraph(graph, mode);

    if (befunde.length > 0) {
      throw new BadRequestException(
        befunde.map((befund) => `${befund.stelle}: ${befund.message}`).join("; "),
      );
    }
  }

  private static toResponse(row: WorkflowDefinitionRow): WorkflowDefinitionResponse {
    return {
      id: row.id,
      label: row.label,
      requirementType: row.requirementType,
      tenant: row.tenant,
      mode: row.mode,
      initialState: row.initialState,
      // Ausgeschrieben und nicht durchgereicht: Kaeme spaeter ein internes Feld an den
      // Zustand, geriete es sonst unbemerkt in den Contract. Dass `bedingungen` hier
      // urspruenglich fehlte, war dennoch ein Versehen - es kam mit M4.3 hinzu und wurde
      // hier nicht nachgezogen. Aufgefallen ist es erst, als der Editor sie durchreichen
      // sollte.
      states: row.states.map((zustand) => ({
        key: zustand.key,
        label: zustand.label,
        final: zustand.final === true,
      })),
      transitions: row.transitions.map((uebergang) => ({
        from: uebergang.from,
        to: uebergang.to,
        label: uebergang.label,
        bedingungen: uebergang.bedingungen ?? [],
      })),
      // Bei fremdgefuehrten Workflows ist Unerreichbarkeit der Normalfall - ohne
      // Uebergaenge ist jeder Zustand ausser dem ersten "nicht erreichbar". Der Hinweis
      // waere dort immer da und damit wertlos; Hinweise, die immer erscheinen, werden
      // uebersehen.
      unreachableStates: row.mode === "external" ? [] : unerreichbareZustaende(row),
      active: row.active,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      version: row.version,
    };
  }

  private static toVersionResponse(
    row: WorkflowDefinitionHistoryRow,
  ): WorkflowDefinitionVersionResponse {
    return {
      ...WorkflowsService.toResponse(row),
      validFrom: row.validFrom.toISOString(),
      validTo: row.validTo?.toISOString() ?? null,
      operation: row.operation,
      changedBy: row.changedBy,
      changeSource: row.changeSource,
    };
  }

  /**
   * Welche Fassungen in Gebrauch sind (ADR-0025 Punkt 3).
   *
   * Die Voraussetzung dafuer, eine Aenderung zu beurteilen: Ohne diese Auskunft ist nicht
   * zu sehen, wie viele Anforderungen eine berichtigte Fassung nicht erreicht.
   */
  async fassungsnutzung(id: string): Promise<WorkflowVersionUsageResponse[]> {
    const definition = await this.repository.findById(id);

    if (definition === undefined) {
      throw new NotFoundException(new WorkflowDefinitionNotFoundError(id).message);
    }

    const nutzung = await this.repository.fassungsnutzung(id);

    return nutzung.map((eintrag) => ({
      version: eintrag.version,
      requirements: eintrag.anzahl,
      current: eintrag.version === definition.version,
    }));
  }
}

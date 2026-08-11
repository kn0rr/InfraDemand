import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import type { WorkflowDefinitionHistoryRow, WorkflowDefinitionRow } from "../database/schema";
import type { CreateWorkflowDefinitionDto } from "./create-workflow-definition.dto";
import { pruefeGraph, unerreichbareZustaende } from "./graph-pruefung";
import type { Betriebsart, GeltenderWorkflow, Graph } from "./typen";
import type { UpdateWorkflowDefinitionDto } from "./update-workflow-definition.dto";
import type {
  WorkflowDefinitionResponse,
  WorkflowDefinitionVersionResponse,
} from "./workflow-definition.dto";
import {
  DuplicateWorkflowRequirementTypeError,
  WorkflowDefinitionNotFoundError,
} from "./workflows.errors";
import { WorkflowsRepository } from "./workflows.repository";

@Injectable()
export class WorkflowsService {
  constructor(private readonly repository: WorkflowsRepository) {}

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
   * Der Workflow, gegen den ein Statuswechsel dieses Anforderungstyps zu pruefen ist.
   *
   * **Ein ausser Kraft gesetzter Workflow bedeutet "keiner", nicht "der allgemeine".**
   * Das Repository liefert bewusst auch inaktive Zeilen; hier faellt die Entscheidung.
   * Wuerde stattdessen auf den allgemeinen zurueckgefallen, liefen die Anforderungen
   * dieses Typs vom Moment des Ausserkraftsetzens an durch einen anderen Graphen - eine
   * Aenderung, die niemand angeordnet hat und die an keiner Stelle sichtbar wird.
   *
   * Was ein fehlender Workflow fuer den Statuswechsel heisst, entscheidet M4.2.
   */
  async geltenderWorkflow(requirementType: string): Promise<GeltenderWorkflow | undefined> {
    const zeile = await this.repository.findForRequirementType(requirementType);

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

    WorkflowsService.pruefeGraphOderWirf(
      { initialState: eingabe.initialState, states, transitions: eingabe.transitions },
      mode,
    );

    try {
      const zeile = await this.repository.create({
        label: eingabe.label,
        requirementType: eingabe.requirementType ?? null,
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
      mode: row.mode,
      initialState: row.initialState,
      // Ausgeschrieben und nicht durchgereicht: Kaeme spaeter ein internes Feld an den
      // Zustand, geriete es sonst unbemerkt in den Contract.
      states: row.states.map((zustand) => ({
        key: zustand.key,
        label: zustand.label,
        final: zustand.final === true,
      })),
      transitions: row.transitions.map((uebergang) => ({
        from: uebergang.from,
        to: uebergang.to,
        label: uebergang.label,
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
}

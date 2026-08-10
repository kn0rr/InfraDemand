"use client";

import { Checkbox, MultiSelect, NumberInput, Select, TextInput } from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";
import type { Attributdefinition } from "@/lib/api/attributdefinitionen";

export interface Formularwerte {
  projectId: string;
  requirementType: string;
  status: string;
  owner: string;
  dynamicAttributes: Record<string, unknown>;
}

interface Eigenschaften {
  definition: Attributdefinition;
  formular: UseFormReturnType<Formularwerte>;
}

/**
 * Ein Eingabefeld, erzeugt aus einer Attributdefinition (§6).
 *
 * Der Datentyp bestimmt das Bedienelement. Genau dieser Zusammenhang ist der Grund, aus
 * dem der Typsatz im Code steht und nicht in den Stammdaten
 * ([ADR-0016](../../../docs/adr/0016-ui-grundlage-und-datenzugriff-im-frontend.md)):
 * Jeder Typ braucht ein Bedienelement und einen Pruefer, und beides ist Code.
 */
export function Attributfeld({ definition, formular }: Eigenschaften) {
  const pfad = `dynamicAttributes.${definition.key}`;
  const schluessel = formular.key(pfad);
  const beschriftung = { label: definition.label, withAsterisk: definition.required };

  switch (definition.dataType) {
    case "text":
      return <TextInput key={schluessel} {...beschriftung} {...formular.getInputProps(pfad)} />;

    case "number":
      return <NumberInput key={schluessel} {...beschriftung} {...formular.getInputProps(pfad)} />;

    case "boolean":
      return (
        <Checkbox
          key={schluessel}
          {...beschriftung}
          {...formular.getInputProps(pfad, { type: "checkbox" })}
        />
      );

    case "date":
      // Natives Datumsfeld: Es liefert JJJJ-MM-TT als Zeichenkette - genau das Format,
      // das der Service prueft. Eine Datumsauswahl gaebe ein Date-Objekt und eine
      // Umrechnung, die nur eine Fehlerquelle waere.
      return (
        <TextInput
          key={schluessel}
          type="date"
          {...beschriftung}
          {...formular.getInputProps(pfad)}
        />
      );

    case "enum":
      return (
        <Select
          key={schluessel}
          data={definition.allowedValues ?? []}
          clearable
          {...beschriftung}
          {...formular.getInputProps(pfad)}
        />
      );

    case "multi_enum":
      return (
        <MultiSelect
          key={schluessel}
          data={definition.allowedValues ?? []}
          {...beschriftung}
          {...formular.getInputProps(pfad)}
        />
      );
  }
}

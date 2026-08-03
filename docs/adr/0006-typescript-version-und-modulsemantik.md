# ADR-0006: TypeScript-Version und Modulsemantik

- **Status:** Angenommen
- **Datum:** 2026-07-31
- **Betrifft:** CLAUDE.md §2, §3
- **Ersetzt:** –
- **Ersetzt durch:** –

## Kontext

§3 fordert strikten TypeScript-Modus ohne implizite `any`-Typen. Aus
[ADR-0001](0001-backend-sprache-und-framework.md) folgt NestJS, aus
[ADR-0002](0002-repository-struktur.md) ein pnpm-Monorepo mit Node-Services und einer
Next.js-Anwendung im selben Arbeitsbereich.

Beim Aufbau des Grundgerüsts wurde die TypeScript-Version durch die
Abhängigkeitsauflösung bestimmt (`pnpm add -D typescript`), wodurch **TypeScript 7.0.2**
installiert wurde – der neue native Compiler. Die daraufhin durchgeführte Prüfung
brachte drei Befunde zutage, die eine bewusste Entscheidung erfordern.

### Befund 1: `moduleResolution: "node"` ist in TypeScript 7 entfernt

```
error TS5108: Option 'moduleResolution=node10' has been removed.
             Please remove it from your configuration.
```

Die ursprüngliche Basiskonfiguration war unter dem installierten Compiler nicht veraltet,
sondern nicht übersetzbar.

### Befund 2: Fehlendes `module` erzeugt stillschweigend ESM

Ohne gesetztes `module` leitet TypeScript den Wert aus `target` ab. Bei `target: "ES2023"`
ist das Ergebnis ESM. Der Emit einer Probeklasse bestätigte das:

```js
export { Service };        // ESM, nicht CommonJS
```

Ein NestJS-Service ohne `"type": "module"` scheitert damit zur Laufzeit an
`Cannot use import statement outside a module` – ein Fehler, der erst nach dem Build
auftritt und dessen Ursache weit von der Fehlermeldung entfernt liegt.

### Befund 3: Zwei Compiler im selben Arbeitsbereich

```
@nestjs/cli@11.0.24  →  dependencies.typescript: 5.9.3   (exakt gepinnt)
```

`nest build` bringt seinen eigenen TypeScript 5.9.3 mit. Ein Typecheck im Wurzelverzeichnis
hätte mit 7.0.2 geprüft, der Build mit 5.9.3 übersetzt. Erschwerend akzeptiert TypeScript
5.9 `moduleResolution: node10` noch – der Build wäre also grün gewesen, während der
Typecheck rot ist. Die Fehlkonfiguration hätte sich hinter dem Versionsunterschied
verborgen.

## Entscheidung

**1. TypeScript wird auf Version 5.9.3 exakt festgelegt** (ohne Caret-Bereich), passend
zu der von `@nestjs/cli` mitgebrachten Version. Es gibt genau einen Compiler und genau
einen Satz Diagnosemeldungen im Arbeitsbereich.

**2. Modulsemantik für Node-Services:** `module` und `moduleResolution` sind beide auf
`nodenext` gesetzt. CommonJS entsteht über das Feld `"type": "commonjs"` in der
`package.json` des jeweiligen Service, das dort **verpflichtend explizit** anzugeben ist.

**3. Die TypeScript-Konfiguration ist dreistufig aufgebaut:**

| Datei | Inhalt |
|---|---|
| `tsconfig.base.json` | ausschließlich Strenge- und Hygieneoptionen, **keine** Modul- oder Zielsemantik |
| `tsconfig.node.json` | erbt von der Basis; `target`, `lib`, `module`, `moduleResolution`, Decorators, `types: ["node"]` |
| `services/<name>/tsconfig.json` | erbt von `tsconfig.node.json`; ausschließlich `outDir`, `rootDir`, `include`, `exclude` |

Die Next.js-Anwendung erbt ebenfalls von `tsconfig.base.json`, setzt ihre Modul- und
Zielsemantik aber selbst (Bundler-Auflösung, DOM-Bibliotheken, `noEmit`).

**4. `verbatimModuleSyntax` bleibt auf `false`.**

**5. Keine `paths`-Aliase.** Interne Pakete werden über `"workspace:*"` referenziert.

## Begründung

**Zu 1 – ein Compiler.** Divergierende Diagnosemeldungen zwischen Editor, Typecheck und
Build kosten unverhältnismäßig viel Zeit, weil sie sich als „bei mir geht es" äußern. Die
Compilerversion ist zudem eine Reproduzierbarkeitseigenschaft des Builds und damit eine
bewusste Festlegung, kein Ergebnis der Abhängigkeitsauflösung. Der exakte Pin statt
`^5.9.3` verhindert, dass unterschiedliche Nebenversionen auf Entwicklungsrechner und in
der CI landen.

**Zu 2 – warum `nodenext` und nicht `commonjs` mit `node10`.** `nodenext` wertet das
`"exports"`-Feld in `package.json` aus. In einem pnpm-Arbeitsbereich ist das nicht
optional: pnpm verknüpft Pakete symbolisch, und moderne Pakete deklarieren ihre
Typdefinitionen ausschließlich über `exports`. Mit `node10` treten reihenweise Meldungen
der Form „Cannot find module … or its corresponding type declarations" auf, obwohl das
Paket installiert ist. Der CommonJS-Emit entsteht dabei nicht aus `module: commonjs`,
sondern aus dem `"type"`-Feld des Pakets – dadurch sind `exports`-Bewusstsein und
CommonJS gleichzeitig erreichbar, und einzelne Pakete können später auf ESM umgestellt
werden, ohne die Basis anzufassen.

**Zu 3 – warum die Basis keine Modulsemantik enthalten darf.** Node-Services und die
Next.js-Anwendung brauchen unvereinbare Werte für `module`, `moduleResolution`, `lib` und
`target`. Eine geteilte Basis, die diese Optionen setzt, ist für mindestens eine der
beiden Seiten falsch. Die Basis trägt daher nur, was für alle gilt: Typstrenge.

Die Trennung der dritten Stufe hat einen zweiten, weniger offensichtlichen Grund:
**Relative Pfade in einer geerbten Konfiguration lösen sich gegen die Datei auf, in der
sie stehen, nicht gegen die erbende.** Stünde `outDir: "dist"` in `tsconfig.node.json`,
würden sämtliche Services nach `<repo-root>/dist` übersetzen und sich gegenseitig
überschreiben. `outDir` und `rootDir` gehören deshalb ausschließlich in die
Service-Konfiguration.

**Zu 4 – zwei unabhängige Gründe.** Erstens entfernt `verbatimModuleSyntax` reine
Typ-Importe, wodurch `emitDecoratorMetadata` die für die Dependency Injection benötigten
Konstruktortypen verliert; NestJS meldet dann `Cannot resolve dependency at index [0]`.
Zweitens verbietet die Option ESM-Syntax in CommonJS-Modulen vollständig – unter
`nodenext` mit `"type": "commonjs"` wäre kein einziges `import`-Statement mehr zulässig.

**Zu 5.** `paths`-Aliase werden vom Typecheck aufgelöst, zur Laufzeit jedoch nicht. Das
Workspace-Protokoll funktioniert dagegen identisch in Build, Test, Laufzeit und CI – und
ist `exports`-bewusst, was Punkt 2 voraussetzt.

## Betrachtete Alternativen

### Bei TypeScript 7.0.2 bleiben

Der native Compiler ist deutlich schneller, was bei wachsendem Arbeitsbereich zählt.

Nicht gewählt, weil das gesamte NestJS-Werkzeug gegen die Programmierschnittstelle des
in JavaScript geschriebenen Compilers gebaut ist und `@nestjs/cli` seine eigene Version
5.9.3 mitbringt. Der Versionsunterschied wäre nicht behoben, sondern nur unsichtbar
geworden. Ein neuer Hauptversionsstand des Compilers im allerersten Projektschritt fügt
ein unbegrenztes Risiko an einer Stelle hinzu, an der es keinen fachlichen Nutzen bringt.

Die Entscheidung ist **vertagt, nicht abgelehnt**. Überprüfung nach M1, mit einem
konkreten Kriterium: sobald `@nestjs/cli` eine mit TypeScript 7 kompatible Version
mitbringt oder der Build vollständig auf SWC umgestellt ist, wird der Umstieg als eigenes
ADR bewertet.

### `module: "commonjs"` mit `moduleResolution: "node10"` (die klassische NestJS-Vorlage)

Die in vielen NestJS-Beispielen verwendete Kombination.

Nicht gewählt wegen der fehlenden `exports`-Unterstützung (siehe Begründung zu 2). In
einem pnpm-Arbeitsbereich mit internen Paketen ist das ein täglich spürbares Problem.
Unter TypeScript 7 wäre die Option ohnehin nicht mehr verfügbar.

### Vollständiges ESM für die NestJS-Services

Zukunftssicher und langfristig die richtige Richtung.

Nicht gewählt, weil das Zusammenspiel von ESM, Decorators, `reflect-metadata` und der
Dependency Injection in NestJS weiterhin Fallstricke birgt, die im ersten Projektschritt
Zeit ohne Gegenwert kosten. Die gewählte Konfiguration lässt den Wechsel je Paket offen.

## Konsequenzen

### Positiv

- Editor, Typecheck und Build verwenden nachweislich denselben Compiler.
- Interne Pakete und moderne Abhängigkeiten werden korrekt aufgelöst.
- Die Konfiguration ist zwischen Node-Services und Frontend teilbar, ohne für eine der
  beiden Seiten falsch zu sein.
- Ein Wechsel einzelner Pakete auf ESM ist ohne Änderung der Basis möglich.

### Negativ und Risiken

- **Der native Compiler wird vorerst nicht genutzt**, obwohl er verfügbar ist. Bewusst in
  Kauf genommener Geschwindigkeitsverzicht.
- **Der exakte Versions-Pin muss gepflegt werden.** Ohne automatisierte
  Abhängigkeitsaktualisierung veraltet er unbemerkt. Nachzuziehen mit der CI in M0,
  Schritt 3.
- **Die Regel zu `"type": "commonjs"` ist eine Konvention.** Wird sie in einem neuen
  Service vergessen, greift der Standardwert – der Fehler tritt dann zur Laufzeit auf.
  Gegenmaßnahme: Prüfung in der CI oder eine Service-Vorlage.
- **`verbatimModuleSyntax: false` bedeutet weniger strikte Import-Semantik**, als in
  einem reinen ESM-Projekt möglich wäre. Unvermeidbare Folge der Decorator-Nutzung.

## Nachweise

Alle Angaben wurden gegen die installierte Werkzeugkette geprüft, nicht angenommen.

| Prüfung | Ergebnis |
|---|---|
| `tsc --version` (installiert vor der Entscheidung) | `Version 7.0.2` |
| Übersetzung mit `moduleResolution: "node"` | `error TS5108: Option 'moduleResolution=node10' has been removed.` |
| Emit bei fehlendem `module`, `target: ES2023` | `export { Service };` (ESM) |
| `pnpm view @nestjs/cli dependencies.typescript` | `5.9.3` bei `@nestjs/cli@11.0.24` |
| Übersetzung mit `module`/`moduleResolution: nodenext` und `"type": "commonjs"` | Exit-Code 0 |
| Decorator-Metadaten im selben Lauf | `__metadata("design:paramtypes", [Dep])` erhalten |

Der letzte Punkt ist der entscheidende: Er belegt, dass die gewählte Konfiguration
CommonJS erzeugt **und** die für die NestJS-Dependency-Injection erforderlichen
Typmetadaten bewahrt.

## Folgeentscheidungen

| Frage | Wann |
|---|---|
| Automatisierte Abhängigkeitsaktualisierung (Renovate o. Ä.) | M0, Schritt 3 |
| Wurzel-`tsconfig.json` im Lösungsstil mit Projektverweisen für `tsc -b` | M1, mit dem ersten Service |
| Umstieg auf TypeScript 7 | Überprüfung nach M1 |
| Umstieg auf den SWC-Builder für schnellere Übersetzung | Bei spürbarer Buildzeit |

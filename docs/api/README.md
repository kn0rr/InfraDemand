# API-Contracts

Hier liegen die versionierten OpenAPI-3.1-Spezifikationen je Service, ein Dokument pro
Service:

```
docs/api/<service>.openapi.yaml
```

Diese Dateien sind **eingecheckte Artefakte mit externen Konsumenten**, keine
Nebenprodukte des Builds. Der zugehörige Arbeitsablauf und die CI-Absicherung sind in
[ADR-0005](../adr/0005-api-first-workflow.md) festgelegt:

- Die Spezifikation wird aus dem Code exportiert und hier eingecheckt.
- Die CI vergleicht den erneuten Export mit der eingecheckten Datei; jede Abweichung
  bricht den Build. Eine Schnittstellenänderung ist damit ohne bewussten Commit
  unmöglich.
- `oasdiff` prüft gegen den zuletzt freigegebenen Stand auf inkompatible Änderungen.
- Frontend- und Service-zu-Service-Clients werden ausschließlich aus diesen Dateien
  erzeugt, niemals von Hand geschrieben.

Noch keine Contracts vorhanden – der erste entsteht in Meilenstein M1 mit dem Requirement
Service.

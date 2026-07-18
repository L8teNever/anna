# Backup vor Client-Side-Routing-Umbau

**Branch:** `backup/pre-spa-routing-2026-07-18`
**Commit:** `c2ede5eff094331ddd4f47f733cf7f62f7e4ce7d`
**Datum:** 2026-07-18
**GitHub:** https://github.com/L8teNever/anna/tree/backup/pre-spa-routing-2026-07-18

## Warum

Vor dem Umbau auf echtes clientseitiges Routing (Start-/Einstellungs-/
Rechtliches-/Spiel-Seiten wechseln ohne vollständigen Dokument-Reload,
siehe `public/js/router.js`) wurde der letzte funktionierende Stand
gesichert. Dieser Umbau ändert grundlegend, wie Navigation zwischen
Seiten funktioniert (Fetch + DOM-Swap statt echter Browser-Navigation)
und berührt praktisch jede JS-Datei unter `public/js/` und
`public/games/*/`.

## Wiederherstellen

```bash
git fetch origin
git checkout backup/pre-spa-routing-2026-07-18
# oder, um main auf diesen Stand zurückzusetzen:
git checkout main
git reset --hard backup/pre-spa-routing-2026-07-18
git push --force-with-lease origin main
```

## Enthaltener Stand

- Row-Listen-Design der Startseite (statt Karten-Grid)
- Rechtliches-Unterseite (Impressum & Datenschutzerklärung, DSGVO)
- Selbst gehostete Schriften (kein Google Fonts mehr)
- Einmaliger Datenschutz-Hinweis-Banner
- Cross-Document View Transitions (CSS) + `page-transition.js`-Fallback
  für JS-ausgelöste Navigation (Vorstufe zum jetzigen Router-Umbau)

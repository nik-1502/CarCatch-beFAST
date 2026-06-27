# Top-Down Drifter Web-Version

Diese Version läuft als statische Website mit HTML5 Canvas. Die ursprüngliche Python-Datei `cargame4.py` bleibt erhalten; die Browser-Version liegt in `index.html`, `styles.css` und `game.js`.

## Lokal testen

Variante 1, direkt öffnen:

1. Öffne `index.html` im Browser.
2. Klicke einmal ins Spielfeld, damit Tastatureingaben sicher ankommen.

Variante 2, kleiner lokaler Server:

```powershell
python -m http.server 8000
```

Danach im Browser öffnen:

```text
http://localhost:8000
```

## Steuerung

- `Leertaste`: Spiel im Hauptmenü starten
- `Pfeiltasten`: Fahren und Lenken
- `Enter`: Im Spiel zurück ins Hauptmenü
- Maus/Klick: Menüs, Einstellungen und Auswahlfelder

## GitHub Pages Upload

1. Lege ein GitHub-Repository an oder nutze ein bestehendes.
2. Lade mindestens diese Dateien hoch:
   - `index.html`
   - `styles.css`
   - `game.js`
   - optional `README.md`
3. Öffne auf GitHub `Settings` -> `Pages`.
4. Wähle unter `Build and deployment` die Quelle `Deploy from a branch`.
5. Wähle Branch `main` und Ordner `/root`.
6. Speichern. Nach kurzer Zeit zeigt GitHub Pages die Website-URL an.

Wenn du die Dateien per Git hochlädst:

```powershell
git add index.html styles.css game.js README.md
git commit -m "Add browser version"
git push
```

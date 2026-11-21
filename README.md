# igdashboard DM-Helfer

Chrome-Erweiterung für das igdashboard. Für ausgewählte Follower öffnet sie je einen Instagram-Tab, klickt „Nachricht senden“ und fügt die Nachricht ein. Abschicken machst du selbst mit Enter. Danach schließt sich der Tab und der nächste kommt dran.

`{Name}` im Text wird durch den Vornamen aus dem Instagram-Profil ersetzt. Steht dort kein brauchbarer Name (leer, nur Benutzername, Firma), fällt die Anrede weg: „Hey {Name}, danke“ wird zu „Hey, danke“.

## Installation

1. Repo herunterladen: `git clone https://github.com/mKamleiter/chrome-extension.git`
   (oder auf GitHub „Code → Download ZIP“ und entpacken)
2. In Chrome `chrome://extensions` öffnen.
3. Oben rechts den **Entwicklermodus** einschalten.
4. **Entpackte Erweiterung laden** klicken und den Ordner `chrome-extension` auswählen.
5. Im selben Chrome-Profil bei Instagram anmelden.
6. Dashboard neu laden. Dort steht dann „Erweiterung aktiv (v…)“.

## Aktualisieren

`git pull` im Ordner ausführen (oder die neue ZIP-Datei in denselben Ordner entpacken). Danach unter `chrome://extensions` bei der Erweiterung auf das Neu-laden-Symbol klicken.

## Wo sie läuft

- Dashboard: `https://ig.mkamleiter.de`, `https://igtest.mkamleiter.de`, `http://localhost`, `http://127.0.0.1`
- Instagram: `https://www.instagram.com`

Die Erweiterung handelt nur in Tabs, die sie selbst geöffnet hat. Nachrichten verschickt sie nie selbst.

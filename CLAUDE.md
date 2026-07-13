# CLAUDE.md — Orveil

Au début de chaque session, lis tous les fichiers dans `memory-bank/` avant toute chose.
Ne termine jamais une tâche sans mettre à jour `memory-bank/activeContext.md` et `memory-bank/progress.md`.

## Projet
Dashboard de monitoring self-hosted. Frontend React/Vite sur port 5173 (dev) ou 3050 (Docker). Backend Node/Express sur port 5050 (interne Docker, mappé sur 3050 en prod).

## Commandes utiles

**Démarrer l'app (Docker) :**
```bash
docker-compose up -d
# App disponible sur http://localhost:3050
```

**Dev frontend uniquement :**
```bash
cd frontend && npm run dev
# ATTENTION : proxy /api → localhost:5050 non exposé si backend tourne en Docker
```

**Commit & push :**
```bash
git add <fichiers> && git commit -m "message" && git push origin main
```

## Conventions importantes

- **Ne jamais ajouter Co-Authored-By dans les commits**
- **Toujours écrire les messages de commit en anglais**
- **Ne jamais proposer de commit/push** — attendre que l'utilisateur le demande

## Pièges connus (lire systemPatterns.md pour les détails)

1. `t()` dans LangContext ne supporte pas l'interpolation — les clés qui sont des fonctions dans `fr.js`/`en.js` doivent être appelées manuellement ou inlinées
2. SVG ne supporte pas les hex 8 chiffres — toujours `fill` + `fillOpacity` séparés
3. `valid.map((p, vi) => ...)` dans Sparkline — pas `({ p, vi })`
4. Flèches Unicode `↑` `↓` ne s'affichent pas dans le navigateur de l'utilisateur — utiliser `+X%` / `-X%`
5. Port 5050 non exposé en Docker — dev server Vite ne peut pas proxier vers le backend Docker

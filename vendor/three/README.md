# three.js r186 — copie locale

Bibliothèque de rendu 3D servie depuis le dépôt : aucun script tiers n'est chargé à l'exécution (pas de CDN), la version est figée et vérifiable.

| Élément | Valeur |
|---|---|
| Paquet | `three@0.186.1` (npm), licence MIT — voir `LICENSE` |
| Intégrité npm vérifiée | `sha512-blFeqb49wRCSGUGj7gtpfnSGHy2lwDk94RhUmS1c/hTby70kvChbWpkJ4Pm1390LqzzvTmzgXKHPEafJwCb8jA==` |
| `three.module.min.js` | `build/three.module.js` + `build/three.core.js` regroupés et minifiés (esbuild 0.25.10) |
| `addons/` | copies non modifiées de `examples/jsm/postprocessing/` et `examples/jsm/shaders/` |

## Reproduire / vérifier

```bash
npm pack three@0.186.1 && tar xzf three-0.186.1.tgz
npx esbuild@0.25.10 package/build/three.module.js --bundle --format=esm --minify \
  --legal-comments=inline --target=es2020 --outfile=three.module.min.js
sha256sum three.module.min.js
# ed11a90814a27be663f430328985511ad86e03fd56a610d2347eea6f3139e705
```

Les fichiers de `addons/` doivent être identiques octet pour octet à ceux du paquet (`diff -r`).

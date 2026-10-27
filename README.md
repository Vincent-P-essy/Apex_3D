# Apex 3D

Site vitrine en HTML, CSS et JavaScript présentant un catalogue de couteaux imprimés en 3D, le processus de fabrication et une offre sur mesure. La page principale crédite Hugo Pouilliat pour la marque et les créations présentées.

Les couteaux sont rendus en 3D temps réel (WebGL2) : géométrie générée par le code, matériaux physiques (PBR) et éclairage de studio photo. Aucun modèle 3D ni aucune image produit n'est téléchargé.

## Aperçu

![Page d’accueil : couteau rendu en temps réel](docs/screenshots/homepage.jpg)

![Catalogue : chaque carte affiche son modèle 3D](docs/screenshots/product-catalog.jpg)

![Séquence « Du fichier à la lame » : étape de finition](docs/screenshots/fabrication-sequence.jpg)

![Atelier sur mesure : gravure laser en aperçu temps réel](docs/screenshots/engraving-studio.jpg)

Pages du site exécuté localement. Le catalogue est une interface statique ; ces captures ne démontrent pas un paiement ou une commande traitée par un serveur.

## Fonctionnalités

- **Hero** : le couteau se matérialise par fusion laser couche par couche (front incandescent, gerbe d'étincelles), puis flotte au-dessus d'un sol laqué réfléchissant, dans un faisceau de lumière poussiéreux. Les reflets suivent la souris.
- **Catalogue** : six modèles 3D distincts (chef, tactique clip-point, dague dorée gravée art déco, santoku damas à alvéoles, survie à scie, hologramme « sur mesure »), animés au survol, filtres animés.
- **Fiche produit** : visionneuse 360° (glisser, molette, flèches du clavier) avec inertie.
- **Du fichier à la lame** : séquence pilotée par le défilement — plan holographique coté, impression couche par couche avec tête d'imprimante, polissage, dépose dans un écrin velours.
- **Atelier sur mesure** : le texte saisi est gravé en direct sur la lame (police et finition acier / or / noir au choix), puis pré-remplit la demande de devis.
- **Formulaire de contact** : envoi réel par e-mail via FormSubmit (sans serveur), champ piège anti-robots, repli `mailto:` si le service est injoignable.
- Assistant de conversation côté navigateur, navigation clavier et lecteurs d'écran.

## Formulaire de contact

Les demandes sont relayées par [FormSubmit](https://formsubmit.co) vers la boîte définie par `INBOX` en tête de `script.js`.

1. Premier envoi depuis le site en ligne : FormSubmit envoie un e-mail « Activate Form » à cette boîte (ce premier message n'est pas transmis).
2. Cliquer sur le bouton d'activation : les messages suivants sont livrés, avec l'adresse du visiteur en réponse (Reply-To).
3. Recommandé : remplacer l'adresse par l'alias aléatoire fourni par FormSubmit dans `FORM_ENDPOINT`, pour ne plus l'exposer dans le code source.

## Rendu 3D

- **Lames paramétriques** : profils dos/tranchant, émouture réelle (biseau, micro-fil, contre-tranchant, gouttière) avec arêtes nettes, crantage et scie ; manches balayés en superellipse ou octogone (`js/engine/geometry.js`, `js/engine/knives.js`).
- **Matériaux** : acier brossé anisotrope, revêtement noir, or, laque, bois, G10, caoutchouc ; textures procédurales (damas, stonewash, gravures, logo) générées en canvas à la demande, modèle par modèle.
- **Lumière** : boîtes à lumière HDR captées dans une carte d'environnement préfiltrée (PMREM), comme en photo produit.
- **Extension de shader** : plan d'impression et section en fusion, lignes de couches, front de polissage, éclat sur le fil, gravure laser.
- **Post-traitement** : bloom HDR, tone mapping neutre, grain argentique, vignettage, légère aberration chromatique (une seule passe finale).
- **Deux contextes WebGL seulement** : un contexte « cinéma » déplacé dans la section la plus visible (hero, fabrication, atelier, fiche) et un contexte hors écran (`OffscreenCanvas`) qui transfère chaque carte sans copie (`transferToImageBitmap`).
- **Qualité adaptative** : résolution réduite automatiquement si le GPU peine, puis bloom coupé ; rendu suspendu hors écran.

## Chargement

- **Chemin critique minimal** : seul le hero est préparé derrière le voile de chargement (textures du modèle affiché, environnement lumineux, shaders). Le voile est plafonné à 3,5 s ; au-delà, la page s'affiche et le couteau apparaît dès qu'il est prêt.
- **Constructions différées** : catalogue, séquence de fabrication, atelier de gravure et fiche 3D sont importés (`import()` dynamique) et construits à l'approche de leur section ou pendant les temps morts du navigateur, par petites tranches.
- **Shaders** : compilés avec l'éclairage réel et la cible du post-traitement (mêmes variantes que le rendu), en parallèle quand le pilote expose `KHR_parallel_shader_compile`, sinon un par un entre deux images.
- **Mode allégé** (écran tactile ou appareil modeste) : textures en demi-résolution, MSAA 2×, moins de particules, bloom ajouté en fondu après l'affichage.
- **Réseau** : les modules du chemin critique sont déclarés en `modulepreload` dans `index.html` (pas de cascade d'imports) — liste à tenir à jour si les imports changent.

## Accessibilité et repli

- Sans WebGL2 : illustrations vectorielles et séquence de fabrication statique.
- `prefers-reduced-motion` : poses fixes, sans animation automatique.
- Sans JavaScript : tout le contenu reste lisible.

## Sécurité

- Aucun script tiers à l'exécution : three.js r186 est servi depuis `vendor/three/` (provenance et empreintes dans [vendor/three/README.md](vendor/three/README.md)).
- Politique CSP stricte (`script-src 'self'` + empreintes SHA-256 des deux scripts en ligne, `connect-src` limité au site et à FormSubmit, `object-src 'none'`, `base-uri 'self'`).
- Aucun gestionnaire d'évènement en ligne ; le texte saisi dans l'assistant est inséré en `textContent`.

Après modification d'un script en ligne de `index.html` (détection initiale, import map), recalculer son empreinte et la reporter dans la balise CSP :

```bash
python3 -c "import re,hashlib,base64;s=open('index.html').read();[print(\"'sha256-%s'\"%base64.b64encode(hashlib.sha256(x.encode()).digest()).decode()) for x in re.findall(r'<script(?![^>]*src=)[^>]*>(.*?)</script>',s,re.S)]"
```

## Technologies

HTML5, CSS3 et JavaScript (modules ES) sans framework ni étape de compilation ; three.js pour WebGL2. Les polices sont chargées depuis Google Fonts et les messages du formulaire passent par FormSubmit. Aucun service de paiement ou backend de commande n’est fourni dans ce dépôt.

## Lancer localement

Les modules ES ne se chargent pas en `file://` : servir le dossier en HTTP.

```bash
git clone https://github.com/Vincent-P-essy/Apex_3D.git
cd Apex_3D
python3 -m http.server 8000
```

Ouvrir <http://localhost:8000>. Ajouter `?debug` à l'adresse active la vérification détaillée des shaders (journal d'erreurs WebGL), désactivée par défaut car elle impose des allers-retours synchrones avec le GPU.

## Structure

- `index.html` : site Apex 3D.
- `styles.css` : mise en page, effets et styles responsive.
- `script.js` : interface (chargement, filtres, fiche produit, formulaires et envoi des demandes, assistant).
- `chatbot.js` : base de réponses de l'assistant.
- `js/main.js` : démarrage du rendu 3D (chemin critique du hero, constructions différées) et boucle d'animation.
- `js/stage.js` : contexte WebGL partagé entre les sections, post-traitement, qualité adaptative.
- `js/gallery.js` : rendu hors écran des cartes du catalogue.
- `js/scenes/` : hero, séquence de fabrication, atelier de gravure, visionneuse 360°.
- `js/engine/` : géométrie, modèles, matériaux, textures procédurales, éclairage, effets.
- `vendor/three/` : three.js r186 (MIT).
- `portfolio.html` : page de portfolio également conservée dans le dépôt.

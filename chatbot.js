/* ================================================================
   APEX 3D — Base de connaissances chatbot
   Auteur : Vincent Plessy — vincent.plessy12@gmail.com
   ================================================================ */

function normalize(str) {
  return str.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a, b) {
  var m = a.length, n = b.length;
  var dp = Array.from({length: m + 1}, function(_, i) {
    var row = [i];
    for (var j = 1; j <= n; j++) row[j] = 0;
    return row;
  });
  for (var j = 0; j <= n; j++) dp[0][j] = j;
  for (var i = 1; i <= m; i++)
    for (var j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

function fuzzyMatch(word, pattern) {
  if (word === pattern) return true;
  if (pattern.length <= 4) return word === pattern;
  var maxDist = pattern.length <= 6 ? 1 : 2;
  return levenshtein(word, pattern) <= maxDist;
}

function matchesPattern(words, pattern) {
  var patternWords = normalize(pattern).split(' ');
  if (patternWords.length === 1) {
    return words.some(function(w) { return fuzzyMatch(w, patternWords[0]); });
  }
  return words.join(' ').includes(patternWords.join(' '));
}

var KB = [
  {
    patterns: ['bonjour', 'salut', 'hello', 'bonsoir', 'hey', 'coucou', 'yo', 'bonne journee', 'bonne soiree'],
    answer: "Bonjour ! Bienvenue sur Apex 3D 👋 Comment puis-je vous aider ?"
  },
  {
    patterns: ['quoi prendre', 'que prendre', 'que choisir', 'quoi choisir', 'lequel choisir', 'conseil', 'recommande', 'aide moi', 'perdu', 'hesit', 'indecis', 'meilleur', 'bon choix'],
    answer: "Je vous aide à choisir ! Quel est votre usage ?\n\n🍳 <b>Cuisine</b> → Le Classique (35€) ou Le Santoku (40€)\n🖼️ <b>Déco / collection</b> → Le Doré (60€)\n🏕️ <b>Tactique / outdoor</b> → L'Ombre (45€) ou Le Ranger (55€)\n🎁 <b>Cadeau unique</b> → Sur Mesure (dès 50€)"
  },
  {
    patterns: ['cuisine', 'cuisiner', 'chef', 'couper', 'legume', 'viande', 'polyvalent'],
    answer: "Pour la cuisine :\n\n• <b>Le Classique</b> (35€) — lame longue, polyvalent, référence absolue\n• <b>Le Santoku</b> (40€) — style japonais, alvéoles anti-adhésion, précision chirurgicale\n\nLes deux sont en PLA+, légers et bien équilibrés !"
  },
  {
    patterns: ['decoration', 'deco', 'collection', 'collectionneur', 'exposer', 'vitrine', 'display'],
    answer: "Pour la déco et la collection :\n\n• <b>Le Doré</b> (60€) — lame dorée, gravures géométriques, livré dans un écrin ✨\n• <b>L'Ombre</b> (45€) — design tactique épuré, support d'exposition inclus"
  },
  {
    patterns: ['tactique', 'survie', 'outdoor', 'camping', 'chasse', 'ranger', 'combat', 'scie'],
    answer: "Pour un style tactique :\n\n• <b>L'Ombre</b> (45€) — compact, clip-point, noir mat\n• <b>Le Ranger</b> (55€) — drop-point avec scie sur le dos, ABS résistant\n\n⚠️ Nos couteaux sont des pièces de <b>collection</b>, non des outils tranchants."
  },
  {
    patterns: ['couteau', 'couteaux', 'modele', 'catalogue', 'disponible', 'gamme', 'liste', 'tous'],
    answer: "Nos 6 modèles :\n• <b>Le Classique</b> — chef polyvalent (35€)\n• <b>L'Ombre</b> — tactique compact (45€)\n• <b>Le Doré</b> — collection dorée (60€)\n• <b>Le Santoku</b> — style japonais (40€)\n• <b>Le Ranger</b> — tactique survie (55€)\n• <b>Sur Mesure</b> — votre design (dès 50€)"
  },
  {
    patterns: ['prix', 'cout', 'tarif', 'combien', 'cher', 'budget', 'euros'],
    answer: "Nos tarifs :\n• Le Classique — <b>35€</b> ⭐ Meilleure vente\n• Le Santoku — <b>40€</b>\n• L'Ombre — <b>45€</b>\n• Le Ranger — <b>55€</b>\n• Le Doré — <b>60€</b>\n• Sur Mesure — <b>à partir de 50€</b>\n\nLivraison incluse en France !"
  },
  {
    patterns: ['commander', 'commande', 'acheter', 'achat', 'payer', 'paiement', 'comment faire', 'panier'],
    answer: "Pour commander :\n1. Ajoutez au <b>panier</b> (bouton + sur chaque produit)\n2. Ou cliquez <b>Voir le détail</b> → Payer maintenant (Stripe)\n3. Sinon, remplissez le <b>formulaire de contact</b> en bas de page\n\nVincent vous répond sous 24h !"
  },
  {
    patterns: ['stripe', 'paiement securise', 'carte bancaire', 'cb', 'virement'],
    answer: "Nous acceptons le paiement par <b>carte bancaire</b> via Stripe (100% sécurisé) et par <b>virement bancaire</b>.\n\nCliquez 'Voir le détail' sur un produit puis 'Payer maintenant' pour accéder au paiement Stripe !"
  },
  {
    patterns: ['sur mesure', 'personnalise', 'custom', 'mon design', 'unique', 'prenom', 'graver', 'gravure'],
    answer: "Vincent réalise des couteaux <b>100% sur mesure</b> :\n• Forme de lame au choix\n• Couleur et matière du manche\n• Gravures personnalisées\n• Prénom, date, initiales gravés\n\nDélai : 5-10 jours. Dès 50€. Contactez via le formulaire !"
  },
  {
    patterns: ['matiere', 'materiau', 'pla', 'abs', 'petg', 'impression', 'imprime', '3d', 'filament'],
    answer: "Matériaux utilisés :\n• <b>PLA+</b> — résistant, finition mate (Classique, Santoku)\n• <b>PETG</b> — flexible et solide (L'Ombre)\n• <b>ABS</b> — très résistant aux chocs (Le Ranger)\n• <b>PLA Métallique</b> — reflets dorés (Le Doré)\n\nPrécision d'impression : 0.1mm !"
  },
  {
    patterns: ['livraison', 'delai', 'expedition', 'envoi', 'recevoir', 'quand', 'rapide'],
    answer: "Livraison en <b>France métropolitaine</b> :\n• Modèles standards : <b>3-5 jours ouvrés</b>\n• Sur mesure : <b>5-10 jours ouvrés</b>\n\nEmballage premium, suivi de colis, livraison incluse dans le prix !"
  },
  {
    patterns: ['cadeau', 'offrir', 'anniversaire', 'noel', 'fete', 'surprise', 'idee cadeau'],
    answer: "Nos couteaux font d'excellents cadeaux ! 🎁\n\n• <b>Le Doré</b> — écrin inclus, effet garanti\n• <b>Sur Mesure</b> — prénom gravé, totalement unique\n\nContactez Vincent pour un emballage cadeau spécial !"
  },
  {
    patterns: ['contact', 'joindre', 'parler', 'vincent', 'email', 'mail', 'ecrire', 'whatsapp'],
    answer: "Contactez Vincent directement :\n📧 <b>vincent.plessy12@gmail.com</b>\n💬 <b>WhatsApp</b> — bouton vert en bas à gauche\n📝 <b>Formulaire</b> en bas de page\n\nRéponse garantie sous 24h !"
  },
  {
    patterns: ['retour', 'remboursement', 'garantie', 'probleme', 'casse', 'defaut', 'satisfait'],
    answer: "En cas de problème à la réception :\n📧 <b>vincent.plessy12@gmail.com</b>\n\nEnvoyez une photo — nous trouverons une solution. Votre satisfaction est notre priorité !"
  },
  {
    patterns: ['merci', 'super', 'parfait', 'nickel', 'excellent', 'top', 'genial', 'cool', 'bravo'],
    answer: "Merci ! Bonne visite et n'hésitez pas pour toute question 😊"
  },
  {
    patterns: ['au revoir', 'aurevoir', 'bye', 'a bientot', 'ciao', 'tchao'],
    answer: "À bientôt ! Merci de votre visite sur Apex 3D. 👋"
  }
];

function getBotAnswer(input) {
  var words = normalize(input).split(' ').filter(Boolean);
  var bestScore = 0;
  var bestAnswer = null;

  for (var i = 0; i < KB.length; i++) {
    var score = 0;
    for (var j = 0; j < KB[i].patterns.length; j++) {
      if (matchesPattern(words, KB[i].patterns[j])) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestAnswer = KB[i].answer;
    }
  }

  return bestAnswer || "Je ne suis pas sûr de comprendre 🤔 Essayez :\n• <b>Catalogue</b> et modèles\n• <b>Prix</b>\n• <b>Livraison</b>\n• Commandes <b>sur mesure</b>\n\nOu contactez Vincent : <b>vincent.plessy12@gmail.com</b>";
}

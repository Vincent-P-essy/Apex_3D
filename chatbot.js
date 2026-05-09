// Normalize: lowercase, strip accents, remove punctuation
function normalize(str) {
  return str.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Levenshtein distance for typo tolerance
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({length: m + 1}, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

// Check if a word is "close enough" to a pattern word (typo tolerance)
function fuzzyMatch(word, pattern) {
  if (word === pattern) return true;
  if (pattern.length <= 4) return word === pattern;
  const maxDist = pattern.length <= 6 ? 1 : 2;
  return levenshtein(word, pattern) <= maxDist;
}

// Check if normalized text contains a pattern (supports multi-word & fuzzy)
function matchesPattern(words, pattern) {
  const patternWords = normalize(pattern).split(' ');
  if (patternWords.length === 1) {
    return words.some(w => fuzzyMatch(w, patternWords[0]));
  }
  // Multi-word: check as substring of the sentence
  const sentence = words.join(' ');
  return sentence.includes(patternWords.join(' '));
}

const KB = [
  {
    patterns: ['bonjour', 'salut', 'hello', 'bonsoir', 'hey', 'coucou', 'yo', 'bonne journee', 'bonne soiree'],
    answer: "Bonjour ! 😊 Ravi de vous accueillir sur la boutique de Hugo Pouilliat. Comment puis-je vous aider ?"
  },
  {
    patterns: ['mdr', 'lol', 'xd', 'haha', 'hehe', 'ptdr', 'mort de rire', 'rigolo', 'drole', 'marrant'],
    answer: "Haha 😄 Je suis là pour vous aider ! Vous cherchez un couteau en particulier, ou vous avez une question sur nos créations 3D ?"
  },
  {
    patterns: ['quoi prendre', 'que prendre', 'que choisir', 'quoi choisir', 'lequel choisir', 'lequel prendre', 'je sais pas', 'sais pas quoi', 'conseil', 'conseille', 'recommande', 'recommandation', 'aide moi', 'perdu', 'hesit', 'indecis', 'meilleur', 'bon choix'],
    answer: "Je vous aide à choisir ! 😊 Quel est votre usage ?\n\n🍳 <b>Cuisine</b> → Le Classique (35€) ou Le Santoku (40€)\n🖼️ <b>Collection / déco</b> → Le Doré (60€)\n🏕️ <b>Tactique / collection</b> → L'Ombre (45€) ou Le Ranger (55€)\n🎁 <b>Cadeau unique</b> → Sur Mesure (dès 50€)\n\nQuel usage vous attire ?"
  },
  {
    patterns: ['cuisine', 'cuisiner', 'chef', 'couper', 'legume', 'viande', 'poisson', 'polyvalent', 'utilis'],
    answer: "Pour la cuisine, je recommande :\n\n• <b>Le Classique</b> (35€) — lame longue, manche ergonomique, polyvalent\n• <b>Le Santoku</b> (40€) — style japonais, parfait pour la précision\n\nLes deux sont fabriqués en PLA+/PETG, légers et bien équilibrés !"
  },
  {
    patterns: ['decoration', 'deco', 'collection', 'collectionneur', 'exposer', 'exposition', 'vitrine', 'mur', 'display'],
    answer: "Pour la déco et la collection :\n\n• <b>Le Doré</b> (60€) — lame dorée, gravures géométriques, livré dans un écrin ✨\n• <b>L'Ombre</b> (45€) — design tactique élégant avec support d'exposition\n\nDeux pièces qui feront leur effet dans n'importe quelle pièce !"
  },
  {
    patterns: ['tactique', 'survie', 'outdoor', 'camping', 'chasse', 'militaire', 'ranger', 'combat', 'scie'],
    answer: "Pour un style tactique :\n\n• <b>L'Ombre</b> (45€) — compact, lame clip-point, manche noir mat\n• <b>Le Ranger</b> (55€) — lame drop-point avec scie sur le dos, très résistant\n\n⚠️ Nos couteaux sont des pièces de <b>collection</b>, pas des outils tranchants réels."
  },
  {
    patterns: ['couteau', 'couteaux', 'modele', 'catalogue', 'disponible', 'gamme', 'liste', 'tous', 'voir'],
    answer: "Nous proposons 6 modèles :\n• <b>Le Classique</b> — chef polyvalent (35€)\n• <b>L'Ombre</b> — tactique compact (45€)\n• <b>Le Doré</b> — collection dorée (60€)\n• <b>Le Santoku</b> — style japonais (40€)\n• <b>Le Ranger</b> — tactique avec scie (55€)\n• <b>Sur Mesure</b> — votre design (dès 50€)\n\nFiltrez par catégorie dans le catalogue !"
  },
  {
    patterns: ['prix', 'cout', 'tarif', 'combien', 'cher', 'budget', 'euros', 'pas cher', 'moins cher', 'economique', 'gratuit', 'offre'],
    answer: "Nos prix :\n• Le Classique — <b>35€</b> ⭐\n• Le Santoku — <b>40€</b>\n• L'Ombre — <b>45€</b>\n• Le Ranger — <b>55€</b>\n• Le Doré — <b>60€</b>\n• Sur Mesure — <b>à partir de 50€</b>\n\nLivraison incluse en France métropolitaine !"
  },
  {
    patterns: ['commander', 'commande', 'acheter', 'achat', 'payer', 'paiement', 'proceder', 'procedure', 'comment faire'],
    answer: "Pour commander c'est simple :\n1. Choisissez votre modèle dans le catalogue\n2. Remplissez le <b>formulaire de contact</b> en bas de page\n3. Hugo vous répond sous 24h pour confirmer et organiser le paiement\n\nVente directe, sans intermédiaire !"
  },
  {
    patterns: ['sur mesure', 'personnalise', 'custom', 'mon design', 'unique', 'creer', 'prenom', 'graver', 'gravure'],
    answer: "Hugo réalise des couteaux <b>100% sur mesure</b> :\n• Forme de la lame au choix\n• Couleur et matière du manche\n• Gravures et décorations personnalisées\n• Prénom ou texte gravé\n\nDélai : 5-10 jours ouvrés. Dès 50€. Contactez via le formulaire !"
  },
  {
    patterns: ['matiere', 'materiau', 'pla', 'abs', 'petg', 'impression', 'imprime', '3d', 'plastique', 'filament', 'imprimante'],
    answer: "Les matériaux utilisés par Hugo :\n• <b>PLA+</b> — résistant, finition mate\n• <b>PETG</b> — flexible et solide\n• <b>ABS</b> — très résistant aux chocs\n• <b>PLA Métallique</b> — reflets dorés/argentés\n\nPrécision d'impression : 0.1mm. Chaque pièce vérifiée à la main."
  },
  {
    patterns: ['livraison', 'delai', 'expedition', 'envoi', 'recevoir', 'quand', 'combien de temps', 'rapide', 'vite'],
    answer: "Livraison en <b>France métropolitaine</b> :\n• Modèles standards : <b>3-5 jours ouvrés</b>\n• Sur mesure : <b>5-10 jours ouvrés</b>\n\nEmballage soigné, certificat d'authenticité pour les pièces de collection."
  },
  {
    patterns: ['cadeau', 'offrir', 'anniversaire', 'noel', 'fete', 'surprise', 'original', 'idee cadeau'],
    answer: "Nos couteaux font d'excellents cadeaux ! 🎁\n\n• <b>Le Doré</b> — livré dans un écrin, parfait pour marquer les esprits\n• <b>Sur Mesure</b> — prénom gravé, vraiment unique\n\nContactez Hugo pour un emballage cadeau spécial !"
  },
  {
    patterns: ['contact', 'joindre', 'parler', 'hugo', 'email', 'mail', 'telephone', 'appeler', 'ecrire'],
    answer: "Contactez Hugo directement :\n📧 <b>contact@hugopouilliat.fr</b>\n📝 Ou via le <b>formulaire</b> en bas de page\n\nRéponse garantie sous 24h !"
  },
  {
    patterns: ['retour', 'remboursement', 'rembourser', 'garantie', 'probleme', 'casse', 'defaut', 'abime', 'satisfait'],
    answer: "En cas de problème à la réception :\n📧 <b>contact@hugopouilliat.fr</b>\n\nEnvoyez une photo du problème — nous trouverons une solution ensemble. Votre satisfaction est notre priorité !"
  },
  {
    patterns: ['merci', 'super', 'parfait', 'nickel', 'excellent', 'top', 'genial', 'cool', 'sympa', 'super', 'bravo'],
    answer: "Merci à vous ! 😊 Bonne visite et n'hésitez pas si vous avez d'autres questions !"
  },
  {
    patterns: ['au revoir', 'aurevoir', 'bye', 'a bientot', 'ciao', 'bonne continuation', 'tchao'],
    answer: "À bientôt ! Merci de votre visite sur la boutique Hugo Pouilliat. 👋"
  },
  {
    patterns: ['oui', 'ok', 'daccord', 'pourquoi pas', 'allez', 'vas y', 'go', 'bien sur'],
    answer: "Super ! 😊 Dites-moi en quoi je peux vous aider — catalogue, prix, livraison ou commande sur mesure ?"
  },
  {
    patterns: ['non', 'nan', 'pas vraiment', 'bof', 'mouais', 'pas sur'],
    answer: "Pas de souci ! 😊 Si vous avez des questions sur nos couteaux 3D, je suis là. Vous pouvez aussi parcourir le catalogue directement !"
  }
];

function getBotAnswer(input) {
  const words = normalize(input).split(' ').filter(Boolean);
  let bestScore = 0;
  let bestAnswer = null;

  for (const entry of KB) {
    let score = 0;
    for (const p of entry.patterns) {
      if (matchesPattern(words, p)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestAnswer = entry.answer;
    }
  }

  if (bestAnswer) return bestAnswer;
  return "Je ne suis pas sûr de comprendre 🤔 Essayez de me poser une question sur :\n• Le <b>catalogue</b> et les modèles\n• Les <b>prix</b>\n• La <b>livraison</b>\n• Les commandes <b>sur mesure</b>\n\nOu contactez Hugo à <b>contact@hugopouilliat.fr</b> !";
}

function addMessage(text, sender) {
  const container = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = `chat-msg ${sender}`;
  const span = document.createElement('span');
  span.innerHTML = text.replace(/\n/g, '<br/>');
  div.appendChild(span);
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function showTyping() {
  const container = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'chat-msg bot chat-typing';
  div.id = 'typing-indicator';
  const span = document.createElement('span');
  span.textContent = 'Hugo réfléchit…';
  div.appendChild(span);
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function removeTyping() {
  const el = document.getElementById('typing-indicator');
  if (el) el.remove();
}

function sendMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  addMessage(text, 'user');
  showTyping();
  setTimeout(() => {
    removeTyping();
    addMessage(getBotAnswer(text), 'bot');
  }, 700 + Math.random() * 500);
}

function askQuestion(question) {
  document.getElementById('chat-input').value = question;
  sendMessage();
}

function toggleChat() {
  const win = document.getElementById('chat-window');
  const iconOpen = document.getElementById('chat-icon-open');
  const iconClose = document.getElementById('chat-icon-close');
  const notif = document.querySelector('.chat-notif');
  win.classList.toggle('open');
  const isOpen = win.classList.contains('open');
  iconOpen.style.display = isOpen ? 'none' : 'block';
  iconClose.style.display = isOpen ? 'block' : 'none';
  if (notif) notif.style.display = 'none';
}

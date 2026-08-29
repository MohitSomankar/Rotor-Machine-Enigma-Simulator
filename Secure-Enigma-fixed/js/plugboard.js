// plugboard.js — Steckerbrett (letter-pair swapping, up to 13 pairs / 10 typical)
class Plugboard {
  constructor(pairs = []) {
    // map[i] = swapped index; default identity (no swap)
    this.map = Array.from({ length: 26 }, (_, i) => i);
    this.pairs = [];
    pairs.forEach(([a, b]) => this.addPair(a, b));
  }

  addPair(a, b) {
    a = a.toUpperCase();
    b = b.toUpperCase();
    if (a === b) return false;
    const ai = ALPHABET.indexOf(a);
    const bi = ALPHABET.indexOf(b);
    if (ai === -1 || bi === -1) return false;

    // Reject if either letter is already plugged
    if (this.map[ai] !== ai || this.map[bi] !== bi) return false;
    if (this.pairs.length >= 10) return false; // historical max in play

    this.map[ai] = bi;
    this.map[bi] = ai;
    this.pairs.push([a, b]);
    return true;
  }

  removePair(a, b) {
    a = a.toUpperCase();
    b = b.toUpperCase();
    const ai = ALPHABET.indexOf(a);
    const bi = ALPHABET.indexOf(b);
    this.map[ai] = ai;
    this.map[bi] = bi;
    this.pairs = this.pairs.filter(
      ([x, y]) => !((x === a && y === b) || (x === b && y === a))
    );
  }

  swap(charIndex) {
    return this.map[charIndex];
  }

  reset() {
    this.map = Array.from({ length: 26 }, (_, i) => i);
    this.pairs = [];
  }
}

window.Plugboard = Plugboard;

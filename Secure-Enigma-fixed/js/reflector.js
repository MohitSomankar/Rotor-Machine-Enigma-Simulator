// reflector.js — Historical reflector wirings
const REFLECTOR_DATA = {
  B: "YRUHQSLDPXNGOKMIEBFZCWVJAT",
  C: "FVPJIAOYEDRZXWGCTKUQSBNMHL",
};

class Reflector {
  constructor(name = "B") {
    const wiring = REFLECTOR_DATA[name];
    if (!wiring) throw new Error(`Unknown reflector type: ${name}`);
    this.name = name;
    this.wiring = wiring;
  }

  reflect(charIndex) {
    const c = ALPHABET[charIndex];
    return ALPHABET.indexOf(this.wiring[ALPHABET.indexOf(c)]);
  }
}

window.REFLECTOR_DATA = REFLECTOR_DATA;
window.Reflector = Reflector;

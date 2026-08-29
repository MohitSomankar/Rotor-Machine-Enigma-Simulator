// rotor.js — Historically accurate Enigma rotor wirings (Enigma I / M3 rotor set)
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const ROTOR_DATA = {
  I:   { wiring: "EKMFLGDQVZNTOWYHXUSPAIBRCJ", notch: "Q" },
  II:  { wiring: "AJDKSIRUXBLHWTMCQGZNPYFVOE", notch: "E" },
  III: { wiring: "BDFHJLCPRTXVZNYEIWGAKMUSQO", notch: "V" },
  IV:  { wiring: "ESOVPZJAYQUIRHXLNFTGKDCMWB", notch: "J" },
  V:   { wiring: "VZBRGITYUPSDNHLXAWMJQOFECK", notch: "Z" },
};

class Rotor {
  /**
   * @param {string} name        - "I" | "II" | "III" | "IV" | "V"
   * @param {string} ringSetting - single letter A-Z (Ringstellung)
   * @param {string} position    - single letter A-Z (starting rotor position)
   */
  constructor(name, ringSetting = "A", position = "A") {
    const data = ROTOR_DATA[name];
    if (!data) throw new Error(`Unknown rotor type: ${name}`);

    this.name = name;
    this.wiring = data.wiring;
    this.notch = data.notch;
    this.ringSetting = ALPHABET.indexOf(ringSetting.toUpperCase());
    this.position = ALPHABET.indexOf(position.toUpperCase());
  }

  // Does this rotor sit "at the notch" right now? (controls whether the
  // rotor to its LEFT will step on the next key press)
  isAtNotch() {
    return ALPHABET[this.position] === this.notch;
  }

  step() {
    this.position = (this.position + 1) % 26;
  }

  // Signal enters from the right (keyboard side) going left through the wiring
  forward(charIndex) {
    const shift = this.position - this.ringSetting;
    const shifted = mod(charIndex + shift, 26);
    const wiredChar = this.wiring[shifted];
    const wiredIndex = ALPHABET.indexOf(wiredChar);
    return mod(wiredIndex - shift, 26);
  }

  // Signal returns from the reflector going right back through the wiring
  backward(charIndex) {
    const shift = this.position - this.ringSetting;
    const shifted = mod(charIndex + shift, 26);
    const plainChar = ALPHABET[shifted];
    const wiredIndex = this.wiring.indexOf(plainChar);
    return mod(wiredIndex - shift, 26);
  }

  reset(ringSetting = "A", position = "A") {
    this.ringSetting = ALPHABET.indexOf(ringSetting.toUpperCase());
    this.position = ALPHABET.indexOf(position.toUpperCase());
  }
}

function mod(n, m) {
  return ((n % m) + m) % m;
}

// Exposed globally (no bundler being used, per the project plan)
window.ALPHABET = ALPHABET;
window.ROTOR_DATA = ROTOR_DATA;
window.Rotor = Rotor;

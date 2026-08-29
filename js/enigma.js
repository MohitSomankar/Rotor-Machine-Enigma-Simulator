// enigma.js — Full Enigma M3 machine: plugboard -> rotors -> reflector -> rotors -> plugboard

class EnigmaMachine {
  /**
   * @param {string[]} rotorNames  e.g. ["I", "II", "III"] (left to right)
   * @param {string[]} ringSettings e.g. ["A", "A", "A"]
   * @param {string[]} positions    e.g. ["C", "M", "R"]
   * @param {string} reflectorName  "B" | "C"
   * @param {Array<[string,string]>} plugPairs
   */
  constructor(
    rotorNames = ["I", "II", "III"],
    ringSettings = ["A", "A", "A"],
    positions = ["A", "A", "A"],
    reflectorName = "B",
    plugPairs = []
  ) {
    this.configure(rotorNames, ringSettings, positions, reflectorName, plugPairs);
  }

  configure(rotorNames, ringSettings, positions, reflectorName, plugPairs) {
    // rotors[0] = left, rotors[1] = middle, rotors[2] = right (fastest)
    this.rotors = [
      new Rotor(rotorNames[0], ringSettings[0], positions[0]),
      new Rotor(rotorNames[1], ringSettings[1], positions[1]),
      new Rotor(rotorNames[2], ringSettings[2], positions[2]),
    ];
    this.reflector = new Reflector(reflectorName);
    this.plugboard = new Plugboard(plugPairs);
  }

  resetPositions(positions) {
    this.rotors.forEach((r, i) => (r.position = ALPHABET.indexOf(positions[i])));
  }

  // Implements the historical double-stepping anomaly:
  // the middle rotor, if sitting on its own notch, steps itself AND
  // kicks the left rotor forward on the same keypress.
  stepRotors() {
    const [left, middle, right] = this.rotors;
    const middleAtNotch = middle.isAtNotch();
    const rightAtNotch = right.isAtNotch();

    if (middleAtNotch) {
      left.step();
      middle.step();
    } else if (rightAtNotch) {
      middle.step();
    }
    right.step();
  }

  encryptChar(char) {
    char = char.toUpperCase();
    if (!ALPHABET.includes(char)) return char; // pass through spaces/punctuation

    this.stepRotors();

    let idx = ALPHABET.indexOf(char);
    idx = this.plugboard.swap(idx);

    // Right to left through rotors (fast -> slow)
    idx = this.rotors[2].forward(idx);
    idx = this.rotors[1].forward(idx);
    idx = this.rotors[0].forward(idx);

    idx = this.reflector.reflect(idx);

    // Left to right back through rotors
    idx = this.rotors[0].backward(idx);
    idx = this.rotors[1].backward(idx);
    idx = this.rotors[2].backward(idx);

    idx = this.plugboard.swap(idx);

    return ALPHABET[idx];
  }

  // Enigma is self-reciprocal: encrypt === decrypt, given identical settings
  encryptText(text) {
    return text
      .toUpperCase()
      .split("")
      .map((ch) => this.encryptChar(ch))
      .join("");
  }

  getRotorPositions() {
    return this.rotors.map((r) => ALPHABET[r.position]);
  }
}

window.EnigmaMachine = EnigmaMachine;

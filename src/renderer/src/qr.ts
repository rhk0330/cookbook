const VERSION = 3;
const SIZE = VERSION * 4 + 17;
const DATA_CODEWORDS = 55;
const ECC_CODEWORDS = 15;
const MASK_PATTERN = 0;
const QUIET_ZONE = 4;

type ModuleValue = boolean | null;

export function createQrMatrix(text: string): boolean[][] {
  const dataCodewords = createDataCodewords(text);
  const errorCodewords = createErrorCorrectionCodewords(dataCodewords, ECC_CODEWORDS);
  const codewords = [...dataCodewords, ...errorCodewords];
  const modules = createMatrix<ModuleValue>(SIZE, null);
  const functionModules = createMatrix<boolean>(SIZE, false);

  drawFunctionPatterns(modules, functionModules);
  drawCodewords(modules, functionModules, codewords);
  drawFormatBits(modules, functionModules, MASK_PATTERN);

  return addQuietZone(
    modules.map((row) => row.map((cell) => Boolean(cell)))
  );
}

function createDataCodewords(text: string): number[] {
  const bytes = Array.from(new TextEncoder().encode(text));
  const bits: number[] = [];
  const capacityBits = DATA_CODEWORDS * 8;

  if (bytes.length > 53) {
    throw new Error("QR value is too long.");
  }

  appendBits(bits, 0x4, 4);
  appendBits(bits, bytes.length, 8);
  for (const byte of bytes) {
    appendBits(bits, byte, 8);
  }

  const terminatorLength = Math.min(4, capacityBits - bits.length);
  appendBits(bits, 0, terminatorLength);
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  const codewords: number[] = [];
  for (let index = 0; index < bits.length; index += 8) {
    codewords.push(bitsToByte(bits.slice(index, index + 8)));
  }

  let padByte = 0xec;
  while (codewords.length < DATA_CODEWORDS) {
    codewords.push(padByte);
    padByte = padByte === 0xec ? 0x11 : 0xec;
  }

  return codewords;
}

function appendBits(bits: number[], value: number, length: number): void {
  for (let index = length - 1; index >= 0; index -= 1) {
    bits.push((value >>> index) & 1);
  }
}

function bitsToByte(bits: number[]): number {
  return bits.reduce((byte, bit) => (byte << 1) | bit, 0);
}

function drawFunctionPatterns(
  modules: ModuleValue[][],
  functionModules: boolean[][]
): void {
  drawFinderPattern(modules, functionModules, 0, 0);
  drawFinderPattern(modules, functionModules, SIZE - 7, 0);
  drawFinderPattern(modules, functionModules, 0, SIZE - 7);
  drawAlignmentPattern(modules, functionModules, SIZE - 7, SIZE - 7);

  for (let index = 8; index < SIZE - 8; index += 1) {
    setFunctionModule(modules, functionModules, index, 6, index % 2 === 0);
    setFunctionModule(modules, functionModules, 6, index, index % 2 === 0);
  }

  reserveFormatAreas(modules, functionModules);
  setFunctionModule(modules, functionModules, 8, SIZE - 8, true);
}

function drawFinderPattern(
  modules: ModuleValue[][],
  functionModules: boolean[][],
  left: number,
  top: number
): void {
  for (let y = -1; y <= 7; y += 1) {
    for (let x = -1; x <= 7; x += 1) {
      const xx = left + x;
      const yy = top + y;
      if (!isInBounds(xx, yy)) {
        continue;
      }

      const inFinder = x >= 0 && x <= 6 && y >= 0 && y <= 6;
      const isBorder = x === 0 || x === 6 || y === 0 || y === 6;
      const isCenter = x >= 2 && x <= 4 && y >= 2 && y <= 4;
      setFunctionModule(
        modules,
        functionModules,
        xx,
        yy,
        inFinder && (isBorder || isCenter)
      );
    }
  }
}

function drawAlignmentPattern(
  modules: ModuleValue[][],
  functionModules: boolean[][],
  centerX: number,
  centerY: number
): void {
  for (let y = -2; y <= 2; y += 1) {
    for (let x = -2; x <= 2; x += 1) {
      const distance = Math.max(Math.abs(x), Math.abs(y));
      setFunctionModule(
        modules,
        functionModules,
        centerX + x,
        centerY + y,
        distance !== 1
      );
    }
  }
}

function reserveFormatAreas(
  modules: ModuleValue[][],
  functionModules: boolean[][]
): void {
  for (let index = 0; index <= 8; index += 1) {
    if (index !== 6) {
      setFunctionModule(modules, functionModules, 8, index, false);
      setFunctionModule(modules, functionModules, index, 8, false);
    }
  }

  for (let index = 0; index < 8; index += 1) {
    setFunctionModule(modules, functionModules, SIZE - 1 - index, 8, false);
  }

  for (let index = 0; index < 7; index += 1) {
    setFunctionModule(modules, functionModules, 8, SIZE - 1 - index, false);
  }
}

function drawCodewords(
  modules: ModuleValue[][],
  functionModules: boolean[][],
  codewords: number[]
): void {
  let bitIndex = 0;
  let upward = true;

  for (let right = SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) {
      right -= 1;
    }

    for (let vertical = 0; vertical < SIZE; vertical += 1) {
      const y = upward ? SIZE - 1 - vertical : vertical;
      for (let offset = 0; offset < 2; offset += 1) {
        const x = right - offset;
        if (functionModules[y][x]) {
          continue;
        }

        const byte = codewords[Math.floor(bitIndex / 8)] ?? 0;
        let isBlack = ((byte >>> (7 - (bitIndex % 8))) & 1) === 1;
        if (shouldMask(x, y)) {
          isBlack = !isBlack;
        }
        modules[y][x] = isBlack;
        bitIndex += 1;
      }
    }

    upward = !upward;
  }
}

function drawFormatBits(
  modules: ModuleValue[][],
  functionModules: boolean[][],
  mask: number
): void {
  const bits = createFormatBits(mask);

  for (let index = 0; index <= 5; index += 1) {
    setFunctionModule(modules, functionModules, 8, index, getBit(bits, index));
  }
  setFunctionModule(modules, functionModules, 8, 7, getBit(bits, 6));
  setFunctionModule(modules, functionModules, 8, 8, getBit(bits, 7));
  setFunctionModule(modules, functionModules, 7, 8, getBit(bits, 8));
  for (let index = 9; index < 15; index += 1) {
    setFunctionModule(modules, functionModules, 14 - index, 8, getBit(bits, index));
  }

  for (let index = 0; index < 8; index += 1) {
    setFunctionModule(
      modules,
      functionModules,
      SIZE - 1 - index,
      8,
      getBit(bits, index)
    );
  }
  for (let index = 8; index < 15; index += 1) {
    setFunctionModule(
      modules,
      functionModules,
      8,
      SIZE - 15 + index,
      getBit(bits, index)
    );
  }
  setFunctionModule(modules, functionModules, 8, SIZE - 8, true);
}

function createFormatBits(mask: number): number {
  const data = (1 << 3) | mask;
  let remainder = data;
  for (let index = 0; index < 10; index += 1) {
    remainder = (remainder << 1) ^ (((remainder >>> 9) & 1) * 0x537);
  }

  return ((data << 10) | remainder) ^ 0x5412;
}

function createErrorCorrectionCodewords(data: number[], degree: number): number[] {
  const generator = createGeneratorPolynomial(degree);
  const result = Array<number>(degree).fill(0);

  for (const byte of data) {
    const factor = byte ^ result.shift()!;
    result.push(0);
    for (let index = 0; index < degree; index += 1) {
      result[index] ^= multiply(generator[index + 1], factor);
    }
  }

  return result;
}

function createGeneratorPolynomial(degree: number): number[] {
  let result = [1];
  for (let index = 0; index < degree; index += 1) {
    result = multiplyPolynomials(result, [1, EXP[index]]);
  }
  return result;
}

function multiplyPolynomials(left: number[], right: number[]): number[] {
  const result = Array<number>(left.length + right.length - 1).fill(0);
  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      result[leftIndex + rightIndex] ^= multiply(
        left[leftIndex],
        right[rightIndex]
      );
    }
  }
  return result;
}

function multiply(left: number, right: number): number {
  if (left === 0 || right === 0) {
    return 0;
  }

  return EXP[LOG[left] + LOG[right]];
}

function shouldMask(x: number, y: number): boolean {
  return (x + y) % 2 === MASK_PATTERN;
}

function setFunctionModule(
  modules: ModuleValue[][],
  functionModules: boolean[][],
  x: number,
  y: number,
  isBlack: boolean
): void {
  modules[y][x] = isBlack;
  functionModules[y][x] = true;
}

function addQuietZone(matrix: boolean[][]): boolean[][] {
  const size = matrix.length + QUIET_ZONE * 2;
  const result = createMatrix<boolean>(size, false);

  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix.length; x += 1) {
      result[y + QUIET_ZONE][x + QUIET_ZONE] = matrix[y][x];
    }
  }

  return result;
}

function createMatrix<T>(size: number, value: T): T[][] {
  return Array.from({ length: size }, () => Array<T>(size).fill(value));
}

function isInBounds(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < SIZE && y < SIZE;
}

function getBit(value: number, index: number): boolean {
  return ((value >>> index) & 1) !== 0;
}

const { EXP, LOG } = createTables();

function createTables(): { EXP: number[]; LOG: number[] } {
  const exp = Array<number>(512).fill(0);
  const log = Array<number>(256).fill(0);
  let value = 1;

  for (let index = 0; index < 255; index += 1) {
    exp[index] = value;
    log[value] = index;
    value <<= 1;
    if (value & 0x100) {
      value ^= 0x11d;
    }
  }

  for (let index = 255; index < exp.length; index += 1) {
    exp[index] = exp[index - 255];
  }

  return { EXP: exp, LOG: log };
}

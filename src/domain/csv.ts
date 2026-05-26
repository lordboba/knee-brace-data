export type CsvLineResult =
  | { ok: true; columns: string[] }
  | { ok: false; reason: string };

export function parseCsvLine(line: string): CsvLineResult {
  const columns: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        current += '"';
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (character === "," && !inQuotes) {
      columns.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  if (inQuotes) {
    return { ok: false, reason: "Unclosed quoted field" };
  }

  columns.push(current);
  return { ok: true, columns };
}

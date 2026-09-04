/**
 * シンプルなCSVパーサー
 * 引用符（"）で囲まれた値や、カンマを含む値にも最小限対応
 */
export function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length === 0) return [];

  // ヘッダーと行をパースする補助関数
  const parseLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const header = parseLine(lines[0]);

  return lines.slice(1).map((line) => {
    const values = parseLine(line);
    const row = {};
    header.forEach((key, i) => {
      row[key] = values[i] ?? '';
    });
    return row;
  });
}

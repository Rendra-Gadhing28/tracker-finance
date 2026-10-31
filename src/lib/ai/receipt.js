/**
 * Neko Dompet - Smart Receipt & Transaction Text Parser
 */

const CATEGORY_KEYWORDS = [
  {
    id: 'bensin',
    keywords: ['spbu', 'pertamina', 'shell', 'bensin', 'pertalite', 'pertamax', 'solar', 'parkir', 'tol']
  },
  {
    id: 'pulsa',
    keywords: ['pulsa', 'kuota', 'paket data', 'telkomsel', 'indosat', 'xl', 'smartfren', 'tri', 'axis', 'listrik', 'pln', 'token listrik', 'token pln']
  },
  {
    id: 'jajanin',
    keywords: ['kado', 'hadiah', 'traktir', 'donasi', 'sedekah', 'amal', 'zakat', 'infaq']
  },
  {
    id: 'nabung',
    keywords: ['nabung', 'tabungan', 'investasi', 'deposito', 'celengan', 'reksadana', 'bibit', 'bareksa', 'saham']
  },
  {
    id: 'masuk',
    keywords: ['gaji', 'honor', 'uang jajan', 'kiriman', 'cashback', 'bonus', 'payroll', 'insentif', 'dividen']
  },
  {
    id: 'jajan',
    keywords: [
      'makan', 'minum', 'kopi', 'resto', 'warung', 'indomaret', 'alfamart', 'alfamidi',
      'roti', 'bakso', 'gofood', 'grabfood', 'shopeefood', 'snack', 'cafe', 'kafe',
      'food', 'kuliner', 'mie', 'nasi', 'ayam', 'beverage', 'mart', 'supermarket',
      'hypermart', 'yoshinoya', 'mcdonald', 'kfc', 'starbucks', 'kenangan'
    ]
  }
];

function matchesWord(text, word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rx = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');
  return rx.test(text);
}

function parseIndonesianAmount(str) {
  let s = str.trim();
  if (s.includes('.') && s.includes(',')) {
    if (s.indexOf('.') < s.indexOf(',')) {
      // 75.500,00 -> Indonesian format
      s = s.split(',')[0].replace(/\./g, '');
    } else {
      // 75,500.00 -> US format
      s = s.split('.')[0].replace(/,/g, '');
    }
  } else if (s.includes('.')) {
    if (/\.\d{3}/.test(s)) {
      s = s.replace(/\./g, '');
    } else if (/\.\d{2}$/.test(s)) {
      s = s.replace(/\.\d{2}$/, '');
    }
  } else if (s.includes(',')) {
    if (/,\d{3}/.test(s)) {
      s = s.replace(/,/g, '');
    } else if (/,\d{2}$/.test(s)) {
      s = s.replace(/,\d{2}$/, '');
    }
  }
  s = s.replace(/\D/g, '');
  return parseInt(s, 10) || 0;
}

function parseNumberFromLine(line) {
  const kMatch = line.match(/\b(\d+(?:[.,]\d+)?)\s*(?:k|rb)\b/i);
  if (kMatch) {
    return Math.round(parseFloat(kMatch[1].replace(',', '.')) * 1000);
  }

  const rpMatch = line.match(/(?:rp\.?|idr)\s*([0-9.,]+)/i);
  if (rpMatch) {
    const parsed = parseIndonesianAmount(rpMatch[1]);
    if (parsed > 0) return parsed;
  }

  const formattedMatch = line.match(/\b(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?)\b/);
  if (formattedMatch) {
    const parsed = parseIndonesianAmount(formattedMatch[1]);
    if (parsed > 0) return parsed;
  }

  const rawMatches = [...line.matchAll(/\b(\d{3,9})\b/g)];
  if (rawMatches.length > 0) {
    return parseInt(rawMatches[rawMatches.length - 1][1], 10);
  }

  return 0;
}

function extractNominal(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const totalLineRegex = /(?:grand\s+total|total\s+bayar|total\s+belanja|total|tagihan|debit|\bdb\b|kredit|\bcr\b|jumlah\s+bayar|nominal|sebesar|amount)/i;
  const cashChangeRegex = /^(?:tunai|cash|kembalian|kembali|change)\b/i;

  // 1. Search lines with explicit total keywords
  for (const line of lines) {
    if (totalLineRegex.test(line) && !cashChangeRegex.test(line)) {
      // Remove any date or account number before extracting amount
      const sanitized = line.replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, '')
                            .replace(/\b\d{10,20}\b/g, '');
      const num = parseNumberFromLine(sanitized);
      if (num > 0) return num;
    }
  }

  // 2. Search lines with Rp or IDR prefix (bottom-up)
  const rpLines = lines.filter((l) => /(?:rp\.?|idr)/i.test(l) && !cashChangeRegex.test(l));
  if (rpLines.length > 0) {
    for (let i = rpLines.length - 1; i >= 0; i--) {
      const sanitized = rpLines[i].replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, '')
                                 .replace(/\b\d{10,20}\b/g, '');
      const num = parseNumberFromLine(sanitized);
      if (num > 0) return num;
    }
  }

  // 3. Search for 'k' or 'rb' amounts
  const kMatch = text.match(/\b(\d+(?:[.,]\d+)?)\s*(?:k|rb)\b/i);
  if (kMatch) {
    return Math.round(parseFloat(kMatch[1].replace(',', '.')) * 1000);
  }

  // 4. Candidate numbers from non-cash lines
  const validLines = lines.filter((l) => !cashChangeRegex.test(l));
  const candidateNumbers = [];
  for (const line of validLines) {
    const sanitized = line.replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, '')
                          .replace(/\b\d{10,20}\b/g, '');
    const num = parseNumberFromLine(sanitized);
    if (num > 0) candidateNumbers.push(num);
  }

  if (candidateNumbers.length > 0) {
    return candidateNumbers[candidateNumbers.length - 1];
  }

  return 0;
}

function extractTanggal(text) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const formatYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const lower = text.toLowerCase();
  if (lower.includes('hari ini')) {
    return formatYMD(now);
  }
  if (lower.includes('kemarin')) {
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return formatYMD(yesterday);
  }

  // 1. YYYY-MM-DD
  const ymdMatch = text.match(/\b(20\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b/);
  if (ymdMatch) {
    return `${ymdMatch[1]}-${pad(ymdMatch[2])}-${pad(ymdMatch[3])}`;
  }

  // 2. DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmyMatch = text.match(/\b(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](20\d{2})\b/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${pad(dmyMatch[2])}-${pad(dmyMatch[1])}`;
  }

  // 3. DD Month YYYY (e.g. 15 Okt 2026 or 15 Oktober 2026)
  const monthNames = {
    jan: 1, januari: 1, feb: 2, februari: 2, mar: 3, maret: 3, apr: 4, april: 4,
    mei: 5, may: 5, jun: 6, juni: 6, jul: 7, juli: 7, agu: 8, agustus: 8, aug: 8,
    sep: 9, september: 9, okt: 10, oktober: 10, oct: 10, nov: 11, november: 11, des: 12, desember: 12, dec: 12
  };
  const namedMonthMatch = text.match(/\b(0?[1-9]|[12]\d|3[01])\s+([a-zA-Z]{3,9})\s+(20\d{2})\b/);
  if (namedMonthMatch) {
    const mStr = namedMonthMatch[2].toLowerCase();
    const mNum = monthNames[mStr];
    if (mNum) {
      return `${namedMonthMatch[3]}-${pad(mNum)}-${pad(namedMonthMatch[1])}`;
    }
  }

  // 4. DD/MM/YY (e.g. 15/10/26)
  const dmyShortMatch = text.match(/\b(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](2[4-9]|3\d)\b/);
  if (dmyShortMatch) {
    const fullYear = `20${dmyShortMatch[3]}`;
    return `${fullYear}-${pad(dmyShortMatch[2])}-${pad(dmyShortMatch[1])}`;
  }

  // 5. DD/MM with time (e.g. SMS BCA: "01/10 14:20")
  const dmTimeMatch = text.match(/\b(0?[1-9]|[12]\d|3[01])\/(0?[1-9]|1[0-2])\s+\d{1,2}:\d{2}\b/);
  if (dmTimeMatch) {
    const currentYear = now.getFullYear();
    return `${currentYear}-${pad(dmTimeMatch[2])}-${pad(dmTimeMatch[1])}`;
  }

  return formatYMD(now);
}

function cleanMerchantName(str) {
  if (!str) return '';
  return str
    .replace(/(?:rp\.?|idr|\d{1,3}(?:[.,]\d{3})+).*/i, '')
    .replace(/[^\w\s.&'-]/g, '')
    .trim();
}

function extractCatatan(text) {
  const anMatch = text.match(/\b(?:A\/N|AN)\s+([A-Za-z0-9\s.&'-]{3,40})/i);
  if (anMatch) {
    const name = cleanMerchantName(anMatch[1]);
    if (name && name.length >= 3) return name.slice(0, 50);
  }

  const merchantPrefixMatch = text.match(/\b(?:merchant|toko|outlet):\s*([A-Za-z0-9\s.&'-]{3,40})/i);
  if (merchantPrefixMatch) {
    const name = cleanMerchantName(merchantPrefixMatch[1]);
    if (name && name.length >= 3) return name.slice(0, 50);
  }

  const keMatch = text.match(/\b(?:ke|kepada)\s+(?:\d{5,25}\s+)?(?:an\s+|a\/n\s+)?([^,.;\n\r]+?)(?:\s+(?:menggunakan|sebesar|pada|tanggal|rp|idr|\.|\n|$)|$)/i);
  if (keMatch) {
    const name = cleanMerchantName(keMatch[1]);
    if (name && name.length >= 3) return name.slice(0, 50);
  }

  const diMatch = text.match(/\b(?:di)\s+([^,.;\n\r]+?)(?:\s+(?:menggunakan|sebesar|pada|tanggal|rp|idr|\.|\n|$)|$)/i);
  if (diMatch) {
    const name = cleanMerchantName(diMatch[1]);
    if (name && name.length >= 3) return name.slice(0, 50);
  }

  const dariMatch = text.match(/\b(?:dari)\s+([^,.;\n\r]+?)(?:\s+(?:berhasil|menggunakan|sebesar|pada|tanggal|rp|idr|\.|\n|$)|$)/i);
  if (dariMatch) {
    const name = cleanMerchantName(dariMatch[1]);
    if (name && name.length >= 3) return name.slice(0, 50);
  }

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const skipRegex = /^(?:trsf|transfer|struk|bukti|transaksi|pembayaran|receipt|invoice|bca|mandiri|bni|bri|gopay|ovo|dana|shopeepay|qris|selamat|terima\s+kasih|kamu\s+berhasil|total|grand\s+total|tunai|kembalian|subtotal|rp|tgl|tanggal|no\.|trx|ref)/i;

  for (const line of lines) {
    if (skipRegex.test(line)) continue;
    if (/^\d+$/.test(line.replace(/[\s./-]/g, ''))) continue;
    const clean = cleanMerchantName(line);
    if (clean && clean.length >= 3) {
      return clean.slice(0, 50);
    }
  }

  const brands = [
    'indomaret', 'alfamart', 'alfamidi', 'spbu pertamina', 'pertamina', 'shell',
    'kopi kenangan', 'starbucks', 'mcdonald', 'kfc', 'bakso pak kumis', 'bakso', 'roti'
  ];
  for (const b of brands) {
    if (new RegExp(`\\b${b}\\b`, 'i').test(text)) {
      const m = text.match(new RegExp(`\\b${b}\\b`, 'i'));
      if (m) return m[0].toUpperCase();
    }
  }

  if (lines.length > 0) {
    const firstLine = lines[0].replace(/[^\w\s.-]/g, '').trim();
    if (firstLine) return firstLine.slice(0, 50);
  }

  return 'Transaksi';
}

/**
 * Parse raw receipt / SMS / QRIS / transaction text into structured data.
 *
 * @param {string} text
 * @param {Array<Object>} [categories=[]]
 * @returns {{
 *   success: boolean,
 *   nominal: number,
 *   tanggal: string,
 *   tipe: 'keluar' | 'masuk' | 'tabung',
 *   kategori_id: string,
 *   catatan: string,
 *   confidence: number
 * }}
 */
export function parseReceiptText(text, categories = []) {
  if (!text || typeof text !== 'string') {
    const pad = (n) => String(n).padStart(2, '0');
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    return {
      success: false,
      nominal: 0,
      tanggal: todayStr,
      tipe: 'keluar',
      kategori_id: 'jajan',
      catatan: '',
      confidence: 0
    };
  }

  const lower = text.toLowerCase();

  // 1. Detect Tipe
  let tipe = 'keluar';
  const tabungKeywords = ['setor tabungan', 'celengan', 'deposito', 'tabungan berjangka'];
  const masukKeywords = ['terima transfer', 'transfer masuk', 'top up masuk', 'gaji', 'uang jajan', 'dana masuk', 'pemasukan', 'trsf cr', 'uang masuk'];

  if (tabungKeywords.some((kw) => lower.includes(kw))) {
    tipe = 'tabung';
  } else if (masukKeywords.some((kw) => lower.includes(kw))) {
    tipe = 'masuk';
  }

  // 2. Detect Nominal
  const nominal = extractNominal(text);

  // 3. Detect Tanggal
  const tanggal = extractTanggal(text);

  // 4. Detect Kategori ID
  let bestCatId = null;
  let maxScore = 0;
  for (const entry of CATEGORY_KEYWORDS) {
    let score = 0;
    for (const kw of entry.keywords) {
      if (matchesWord(lower, kw)) {
        score += kw.includes(' ') ? 3 : 1;
      }
    }
    if (score > maxScore) {
      maxScore = score;
      bestCatId = entry.id;
    }
  }
  let matchedCatId = bestCatId;

  let finalCatId = matchedCatId;
  if (Array.isArray(categories) && categories.length > 0) {
    const directMatch = categories.find((c) => c.id === matchedCatId);
    if (directMatch) {
      finalCatId = directMatch.id;
    } else if (matchedCatId === 'jajan') {
      const labelMatch = categories.find((c) => /jajan|makan|food/i.test(c.nama || c.name || ''));
      if (labelMatch) finalCatId = labelMatch.id;
    } else if (matchedCatId) {
      const nameMatch = categories.find((c) => (c.nama || c.name || '').toLowerCase().includes(matchedCatId));
      if (nameMatch) finalCatId = nameMatch.id;
    }

    if (!finalCatId || !categories.some((c) => c.id === finalCatId)) {
      const typeMatch = categories.find((c) => c.tipe === tipe);
      finalCatId = typeMatch ? typeMatch.id : (matchedCatId || categories[0].id);
    }
  } else {
    if (!finalCatId) {
      finalCatId = tipe === 'masuk' ? 'masuk' : tipe === 'tabung' ? 'nabung' : 'jajan';
    }
  }

  // 5. Detect Catatan
  const catatan = extractCatatan(text);

  // 6. Calculate Confidence
  let confidence = 0.5;
  if (nominal > 0) {
    confidence = 0.7;
    if (catatan && catatan !== 'Transaksi') {
      confidence += 0.15;
    }
    if (matchedCatId) {
      confidence += 0.1;
    }
  } else {
    confidence = 0.0;
  }
  confidence = Math.min(1.0, Math.round(confidence * 100) / 100);

  return {
    success: nominal > 0,
    nominal,
    tanggal,
    tipe,
    kategori_id: finalCatId,
    catatan,
    confidence
  };
}

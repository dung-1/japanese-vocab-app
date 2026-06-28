/**
 * Normalize chuỗi tiếng Việt: bỏ dấu TV, lowercase, bỏ khoảng trắng thừa.
 * Ví dụ: normalizeVi('Đàn Ông') === 'dan ong'
 */
export function normalizeVi(input: string): string {
  if (!input) return '';
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // bỏ dấu tổ hợp
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize chuỗi tiếng Nhật: giữ nguyên kanji/kana, chỉ bỏ khoảng trắng thừa + lowercase romaji.
 */
export function normalizeJa(input: string): string {
  if (!input) return '';
  return input
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?()「」『』【】《》、。·]/g, ' ')
    .trim();
}

/**
 * Normalize chung: dùng khi so sánh cross-language (VI <-> JA kana).
 */
export function normalizeQuery(input: string): string {
  return normalizeVi(normalizeJa(input));
}

/**
 * Tách chuỗi thành tokens theo khoảng trắng (đã normalize).
 */
export function tokenize(input: string): string[] {
  const n = normalizeQuery(input);
  if (!n) return [];
  return n.split(' ').filter((t) => t.length > 0);
}
import { KnowledgeDomain } from './knowledge.model';

export interface SlashCommand {
  /** Key duy nhất, không có dấu "/" */
  id: string;

  /** Trigger text — user gõ "/kanji" */
  trigger: string;

  /** Tên hiển thị trong menu */
  label: string;

  /** Mô tả ngắn hiển thị dưới label */
  description: string;

  /** Icon hiển thị trước label */
  icon: string;

  /** Domain AI sẽ search */
  domain: KnowledgeDomain | null;

  /** Text prefill vào input sau khi chọn */
  prefill: string;

  /** Hướng dẫn thêm vào system prompt khi dùng lệnh này */
  promptHint?: string;

  /** Màu accent của command (để style tag) */
  color?: string;

  /** Shortcut description (hiển thị ở góc phải menu item) */
  shortcut?: string;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'kanji',
    trigger: 'kanji',
    label: 'Kanji 漢字',
    icon: '漢',
    description: 'Giải thích Kanji: onyomi, kunyomi, nghĩa, mnemonic, ví dụ',
    domain: 'kanji-word',
    prefill: '/kanji ',
    color: '#6b46c1',
    shortcut: '/k',
    promptHint: 'Tập trung giải thích chi tiết Kanji được hỏi: âm đọc, nghĩa, ghi nhớ, ví dụ ứng dụng.',
  },
  {
    id: 'tango',
    trigger: 'tango',
    label: 'Từ vựng 単語',
    icon: '語',
    description: 'Hỏi về từ vựng: hiragana, hán việt, nghĩa, cách dùng',
    domain: 'vocab',
    prefill: '/tango ',
    color: '#2b6cb0',
    shortcut: '/t',
    promptHint: 'Tập trung giải thích từ vựng: cách đọc, nghĩa tiếng Việt, hán Việt, ví dụ câu.',
  },
  {
    id: 'bunpo',
    trigger: 'bunpo',
    label: 'Ngữ pháp 文法',
    icon: '文',
    description: 'Giải thích mẫu ngữ pháp: cấu trúc, sắc thái, ví dụ',
    domain: 'grammar',
    prefill: '/bunpo ',
    color: '#276749',
    shortcut: '/b',
    promptHint: 'Tập trung giải thích mẫu ngữ pháp: cấu trúc công thức, sắc thái ý nghĩa, so sánh với mẫu tương tự, 2-3 ví dụ.',
  },
  {
    id: 'bushu',
    trigger: 'bushu',
    label: 'Bộ thủ 部首',
    icon: '部',
    description: 'Giải thích bộ thủ: nghĩa, Kanji chứa bộ thủ đó, cách ghi nhớ',
    domain: 'radical',
    prefill: '/bushu ',
    color: '#c05621',
    shortcut: '/r',
    promptHint: 'Tập trung giải thích bộ thủ: nghĩa gốc, số nét, Kanji tiêu biểu chứa bộ thủ, mẹo ghi nhớ.',
  },
  {
    id: 'giongo',
    trigger: 'giongo',
    label: 'Từ láy 擬音語',
    icon: '♪',
    description: 'Từ tượng thanh / tượng hình: ý nghĩa, cảm giác, ví dụ',
    domain: 'reduplicative',
    prefill: '/giongo ',
    color: '#b7791f',
    shortcut: '/g',
    promptHint: 'Giải thích từ láy/tượng thanh/tượng hình: ý nghĩa, cảm giác, ngữ cảnh dùng, ví dụ câu.',
  },
  {
    id: 'quiz',
    trigger: 'quiz',
    label: 'Tạo câu hỏi Quiz',
    icon: '🎯',
    description: 'AI tạo 3-5 câu hỏi trắc nghiệm về chủ đề bạn nhập',
    domain: null,
    prefill: '/quiz ',
    color: '#e53e3e',
    shortcut: '/q',
    promptHint: 'Tạo 3-5 câu hỏi trắc nghiệm (A/B/C/D) kèm đáp án và giải thích. Format rõ ràng, dễ đọc.',
  },
  {
    id: 'compare',
    trigger: 'compare',
    label: 'So sánh',
    icon: '⚖️',
    description: 'So sánh 2 Kanji / từ / mẫu ngữ pháp tương tự nhau',
    domain: null,
    prefill: '/compare ',
    color: '#2c7a7b',
    shortcut: '/c',
    promptHint: 'So sánh chi tiết sự giống nhau và khác nhau. Dùng bảng so sánh nếu có thể. Cho ví dụ minh hoạ từng trường hợp.',
  },
  {
    id: 'example',
    trigger: 'example',
    label: 'Đặt câu ví dụ',
    icon: '✍️',
    description: 'Tạo 3-5 câu ví dụ dùng Kanji / từ / mẫu ngữ pháp',
    domain: null,
    prefill: '/example ',
    color: '#553c9a',
    shortcut: '/e',
    promptHint: 'Tạo 3-5 câu ví dụ tự nhiên, kèm furigana, dịch tiếng Việt. Ưu tiên câu thực tế trong cuộc sống hàng ngày.',
  },
  {
    id: 'mnemonic',
    trigger: 'mnemonic',
    label: 'Mẹo ghi nhớ',
    icon: '🧠',
    description: 'Gợi ý cách ghi nhớ Kanji / từ vựng sáng tạo',
    domain: 'kanji-word',
    prefill: '/mnemonic ',
    color: '#38a169',
    shortcut: '/m',
    promptHint: 'Tạo mẹo ghi nhớ sáng tạo, hài hước, dễ nhớ. Liên kết với hình ảnh quen thuộc, câu chuyện ngắn, hoặc âm Hán Việt.',
  },
];

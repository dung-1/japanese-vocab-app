import { Injectable } from '@angular/core';

export interface NumberQuestion {
  number: number;
  japanese: string;
  reading: string;
  digits: number;
}

@Injectable({ providedIn: 'root' })
export class NumberJapaneseService {

  // Đọc số tiếng Nhật đầy đủ
  toJapanese(n: number): string {
    if (n === 0) return 'ゼロ';

    const ones = ['', 'いち', 'に', 'さん', 'し', 'ご', 'ろく', 'なな', 'はち', 'きゅう'];
    const kanji = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

    let result = '';
    let num = n;

    // 兆 (chō) = 1,000,000,000,000
    if (num >= 1_000_000_000_000) {
      const cho = Math.floor(num / 1_000_000_000_000);
      result += this.readUnder10000(cho) + 'ちょう';
      num %= 1_000_000_000_000;
    }

    // 億 (oku) = 100,000,000
    if (num >= 100_000_000) {
      const oku = Math.floor(num / 100_000_000);
      result += this.readUnder10000(oku) + 'おく';
      num %= 100_000_000;
    }

    // 万 (man) = 10,000
    if (num >= 10_000) {
      const man = Math.floor(num / 10_000);
      result += this.readUnder10000(man) + 'まん';
      num %= 10_000;
    }

    if (num > 0) {
      result += this.readUnder10000(num);
    }

    return result;
  }

  private readUnder10000(n: number): string {
    let result = '';
    let num = n;

    const sen = Math.floor(num / 1000);
    if (sen > 0) {
      result += (sen === 1 ? '' : this.digit(sen)) + 'せん';
      num %= 1000;
    }

    const hyaku = Math.floor(num / 100);
    if (hyaku > 0) {
      result += (hyaku === 1 ? '' : this.digit(hyaku)) + 'ひゃく';
      num %= 100;
    }

    const ju = Math.floor(num / 10);
    if (ju > 0) {
      result += (ju === 1 ? '' : this.digit(ju)) + 'じゅう';
      num %= 10;
    }

    if (num > 0) {
      result += this.digit(num);
    }

    return result;
  }

  private digit(n: number): string {
    const ones = ['', 'いち', 'に', 'さん', 'し', 'ご', 'ろく', 'なな', 'はち', 'きゅう'];
    return ones[n];
  }

  // Tạo số ngẫu nhiên theo số chữ số
  generateNumber(digits: number): number {
    const min = Math.pow(10, digits - 1);
    const max = Math.pow(10, digits) - 1;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // Tạo câu hỏi
  generateQuestion(digits: number): NumberQuestion {
    const number = this.generateNumber(digits);
    const reading = this.toJapanese(number);
    return {
      number,
      japanese: number.toLocaleString('ja-JP'),
      reading,
      digits,
    };
  }

  // Đọc to số bằng SpeechSynthesis
  speak(text: string, rate: number = 0.85): void {
    if (typeof window === 'undefined') return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'ja-JP';
    utter.rate = rate;
    utter.pitch = 1;
    window.speechSynthesis.speak(utter);
  }

  // Format số có dấu phẩy ngàn
  formatNumber(n: number): string {
    return n.toLocaleString();
  }
}

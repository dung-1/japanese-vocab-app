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
    if (n === 0) return 'ぜろ';

    let result = '';
    let num = n;

    // 兆 = 1,000,000,000,000
    if (num >= 1_000_000_000_000) {
      const cho = Math.floor(num / 1_000_000_000_000);
      result += this.readUnder10000(cho) + 'ちょう';
      num %= 1_000_000_000_000;
    }

    // 億 = 100,000,000
    if (num >= 100_000_000) {
      const oku = Math.floor(num / 100_000_000);
      result += this.readUnder10000(oku) + 'おく';
      num %= 100_000_000;
    }

    // 万 = 10,000
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

    // 千
    const sen = Math.floor(num / 1000);
    if (sen > 0) {
      // 1000 = せん (không đọc いちせん)
      // 3000 = さんぜん, 8000 = はっせん
      if (sen === 1)       result += 'せん';
      else if (sen === 3)  result += 'さんぜん';
      else if (sen === 8)  result += 'はっせん';
      else                 result += this.digitReading(sen) + 'せん';
      num %= 1000;
    }

    // 百
    const hyaku = Math.floor(num / 100);
    if (hyaku > 0) {
      // 100 = ひゃく, 300 = さんびゃく, 600 = ろっぴゃく, 800 = はっぴゃく
      if (hyaku === 1)      result += 'ひゃく';
      else if (hyaku === 3) result += 'さんびゃく';
      else if (hyaku === 6) result += 'ろっぴゃく';
      else if (hyaku === 8) result += 'はっぴゃく';
      else                  result += this.digitReading(hyaku) + 'ひゃく';
      num %= 100;
    }

    // 十
    const ju = Math.floor(num / 10);
    if (ju > 0) {
      // 10 = じゅう (không đọc いちじゅう)
      if (ju === 1) result += 'じゅう';
      else          result += this.digitReading(ju) + 'じゅう';
      num %= 10;
    }

    // 一〜九
    if (num > 0) {
      result += this.digitReading(num);
    }

    return result;
  }

  // Chỉ đọc chữ số đơn: dùng よん, なな, きゅう
  private digitReading(n: number): string {
    const map: Record<number, string> = {
      1: 'いち',
      2: 'に',
      3: 'さん',
      4: 'よん',
      5: 'ご',
      6: 'ろく',
      7: 'なな',
      8: 'はち',
      9: 'きゅう',
    };
    return map[n] ?? '';
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

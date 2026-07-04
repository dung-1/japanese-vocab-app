import { Component } from '@angular/core';
import { Router } from '@angular/router';

interface MenuItem {
  path: string;
  title: string;
  description: string;
  icon: string;
  gradient: string;
}

@Component({
  selector: 'app-home',
  standalone: false,
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent {
  menuItems: MenuItem[] = [
    {
      path: '/kanji-words',
      title: 'Học theo Kanji',
      description: 'Tìm hiểu và luyện tập các chữ Kanji cơ bản đến nâng cao.',
      icon: '字',
      gradient: 'linear-gradient(135deg, #e63946 0%, #ff6b6b 100%)'
    },
    {
      path: '/vocabulary',
      title: 'Học từ vựng',
      description: 'Mở rộng vốn từ vựng tiếng Nhật hàng ngày.',
      icon: '語',
      gradient: 'linear-gradient(135deg, #4361ee 0%, #7209b7 100%)'
    },
    {
      path: '/kanji-radicals',
      title: 'Học theo bộ thủ',
      description: 'Hiểu cấu trúc Kanji qua các bộ thủ cơ bản.',
      icon: '部',
      gradient: 'linear-gradient(135deg, #f77f00 0%, #fcbf49 100%)'
    },
    {
      path: '/adverb-radicals',
      title: 'Học phó từ',
      description: 'Hiểu rõ phó từ giúp quá trình sử dụng đơn giản hơn.',
      icon: '副',
      gradient: 'linear-gradient(135deg, #06d6a0 0%, #1b9aaa 100%)'
    },
    {
      path: '/reduplicative-words',
      title: 'Học từ láy',
      description: 'Học các từ láy trong tiếng Nhật với flashcard và kiểm tra trắc nghiệm.',
      icon: '々',
      gradient: 'linear-gradient(135deg, #7209b7 0%, #f72585 100%)'
    },
    {
      path: '/grammar',
      title: 'Học Ngữ Pháp',
      description: 'Luyện tập các mẫu ngữ pháp N5–N3 với flashcard và kiểm tra trắc nghiệm.',
      icon: '文',
      gradient: 'linear-gradient(135deg, #6b46c1 0%, #9f7aea 100%)'
    },
    {
      path: '/ai',
      title: 'Trợ lý AI',
      description: 'Hỏi đáp Kanji, từ vựng, bộ thủ, ngữ pháp bằng AI (RAG + Ollama).',
      icon: '🤖',
      gradient: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)'
    }
  ];

  constructor(private router: Router) {}

  navigateTo(path: string) {
    this.router.navigate([path]);
  }

  isActive(path: string): boolean {
    return this.router.isActive(path, true);
  }
}
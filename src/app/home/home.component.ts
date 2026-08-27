import { Component } from '@angular/core';
import { Router } from '@angular/router';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

interface MenuItem {
  path: string | null;
  title: string;
  description: string;
  icon: string;
  disabled?: boolean;
}

interface QuickAction {
  label: string;
  scrollTarget?: string;
}

interface ProgressStat {
  label: string;
  value: number;
}

interface BottomNavItem {
  path: string;
  icon: string;
}

@Component({
  selector: 'app-home',
  standalone: false,
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent {
  // Left sidebar navigation — matches the routes/icons shown in the
  // Figma reference screenshot (Desktop 1440.png).
  navItems: NavItem[] = [
    { path: '/home', label: 'Dashboard', icon: '' },
    { path: '/kanji-words', label: 'Kanji', icon: '字' },
    { path: '/grammar', label: 'Ngữ pháp', icon: '文' },
    { path: '/vocabulary', label: 'Học Từ vựng', icon: '語' },
    { path: '/catholic', label: 'Công Giáo', icon: '✝' },
    { path: '/ai', label: 'ChatBot', icon: 'AI' },
    { path: '/kanji-radicals', label: 'Bộ Thủ', icon: '部' }
  ];

  // Main dashboard cards. Copy/order/icons match the Figma screenshot.
  // Note: "/adverb-radicals" and the "Cộng Đồng" (community) card have no
  // backing route in app-routing.module.ts — this is a pre-existing gap
  // (adverb-radicals) or a feature that doesn't exist yet (community).
  // "Cộng Đồng" is rendered disabled (non-clickable) rather than pointing
  // it at a route that doesn't exist. See report.md.
  menuItems: MenuItem[] = [
    {
      path: '/kanji-words',
      title: 'Học Kanji',
      description: 'Ôn tập & kiểm tra N5-N3',
      icon: '字'
    },
    {
      path: '/grammar',
      title: 'Ngữ pháp',
      description: 'Bài 20-22 · N3',
      icon: '文'
    },
    {
      path: '/vocabulary',
      title: 'Học Từ vựng',
      description: 'Bản tin hôm nay · JLPT',
      icon: '語'
    },
    {
      path: '/kanji-radicals',
      title: 'Bộ Thủ',
      description: 'Nghiên cứu: Study',
      icon: '部'
    },
    {
      path: '/catholic',
      title: 'Kiến thức Công Giáo',
      description: '429 câu hỏi Kinh Thánh & giáo lý',
      icon: '✝'
    },
    {
      path: '/adverb-radicals',
      title: 'Phó Từ',
      description: 'Luyện tập phó từ N5-N3',
      icon: '副'
    },
    {
      path: '/reduplicative-words',
      title: 'Từ Láy',
      description: 'Luyện tập từ láy từ N5-N3',
      icon: '々'
    },
    {
      path: null,
      title: 'Cộng Đồng',
      description: 'Chia sẻ & thảo luận',
      icon: '人',
      disabled: true
    },
    {
      path: '/ai',
      title: 'Hội thoại AI',
      description: 'Luyện hội thoại với trợ lý AI',
      icon: 'AI'
    }
  ];

  // Right rail. "Bài tập này" / "Bài tập nay" have no backing feature yet,
  // so they're static (non-navigating) — kept as shown in the design.
  // "Thành tích" smooth-scrolls down to the progress stats already in
  // this same panel, since that's the only sensible target for it.
  sideRailTitle = 'Bài tập đặc biệt';
  quickActions: QuickAction[] = [
    { label: 'Bài tập này' },
    { label: 'Bài tập nay' },
    { label: 'Thành tích', scrollTarget: 'progress-stats' }
  ];

  progressSectionLabel = 'THÀNH TÍCH';
  progressStats: ProgressStat[] = [
    { label: 'Tác giả cấp cao', value: 82 },
    { label: 'Đạt bậc Kanji', value: 48 }
  ];

  // ===================== Mobile (390px) layout =====================
  // Matches the mobile reference screenshot you sent: top header with
  // hamburger + logo + avatar, a slide-out drawer (reusing navItems), a
  // compact 3-column icon grid (a curated subset of menuItems — the
  // mobile mockup only shows 6 cards, not all 8), a progress card with
  // its own distinct stats (different labels/values than the desktop
  // right rail — that's what the mobile mockup shows), and a bottom tab
  // bar. "Cộng đồng" is disabled for the same reason as on desktop: no
  // backing route exists yet.
  isDrawerOpen = false;

  mobileMenuItems: MenuItem[] = [
    { path: '/kanji-words', title: 'Kanji', description: '', icon: '字' },
    { path: '/vocabulary', title: 'Từ vựng', description: '', icon: '語' },
    { path: '/grammar', title: 'Ngữ pháp', description: '', icon: '文' },
    { path: '/kanji-radicals', title: 'Bộ Thủ', description: '', icon: '部' },
    { path: '/catholic', title: 'Công Giáo', description: '', icon: '✝' },
    { path: '/ai', title: 'Hội thoại AI', description: '', icon: 'AI' },
    { path: null, title: 'Cộng đồng', description: '', icon: '人', disabled: true }
  ];

  mobileProgressStats: ProgressStat[] = [
    { label: 'Tiến độ Kanji N4', value: 80 },
    { label: 'Bài học Ngữ pháp 20', value: 60 },
    { label: 'Bộ Từ vựng Giao thông', value: 45 }
  ];

  bottomNavItems: BottomNavItem[] = [
    { path: '/home', icon: '⌂' },
    { path: '/kanji-words', icon: '字' },
    { path: '/vocabulary', icon: '語' },
    { path: '/grammar', icon: '文' },
    { path: '/ai', icon: 'AI' }
  ];

  constructor(private router: Router) {}

  toggleDrawer() {
    this.isDrawerOpen = !this.isDrawerOpen;
  }

  closeDrawerAndNavigate(path: string | null) {
    this.isDrawerOpen = false;
    this.navigateTo(path);
  }

  navigateTo(path: string | null) {
    if (!path) {
      return;
    }
    this.router.navigate([path]);
  }

  isActive(path: string | null): boolean {
    return !!path && this.router.isActive(path, true);
  }

  scrollToTarget(id?: string) {
    if (!id) {
      return;
    }
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

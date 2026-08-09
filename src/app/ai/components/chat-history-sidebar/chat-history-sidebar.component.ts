import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { DbSession } from '../../services/supabase-chat.service';
import { HostListener } from '@angular/core';
export interface SessionListItem {
  id: string;
  title: string;
  updatedAt: Date;
  messageCount?: number;
}

@Component({
  selector: 'app-chat-history-sidebar',
  standalone: false,
  templateUrl: './chat-history-sidebar.component.html',
  styleUrl: './chat-history-sidebar.component.css',
})
export class ChatHistorySidebarComponent implements OnInit, OnChanges {
  @Input() currentSessionId: string | null = null;
  @Input() sessions: DbSession[] = [];
  @Input() loading = false;

  @Output() sessionSelected = new EventEmitter<string>();
  @Output() newChat = new EventEmitter<void>();
  @Output() deleteSession = new EventEmitter<string>();
  @Output() renameSession = new EventEmitter<{ id: string; title: string }>();

  groupedSessions: { group: string; items: SessionListItem[] }[] = [];

  // Date groups
  private readonly groups = [
    { label: 'Hôm nay', check: (d: Date) => this.isToday(d) },
    { label: 'Hôm qua', check: (d: Date) => this.isYesterday(d) },
    { label: '7 ngày trước', check: (d: Date) => this.isWithinLastWeek(d) },
    { label: 'Tháng trước', check: (d: Date) => this.isWithinLastMonth(d) },
    { label: 'Cũ hơn', check: () => true },
  ];

  // LƯU Ý: logic filter group chạy từ trên xuống, cái nào thỏa mãn trước thì lấy
  // nên thứ tự trong mảng 'groups' cực kỳ quan trọng.

  // -------------------------------------------------------------------------

  //--Lưu ý: Tôi sẽ implement logic group ở đây thay vì dùng util ngoài để đảm bảo chạy được ngay
  // -------------------------------------------------------------------------

  ngOnInit(): void {
    this.updateGroupedSessions();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['sessions']) {
      this.updateGroupedSessions();
    }
  }

  updateGroupedSessions(): void {
    if (!this.sessions || this.sessions.length === 0) {
      this.groupedSessions = [];
      return;
    }

    const groups: { [key: string]: SessionListItem[] } = {};

    this.sessions.forEach((s) => {
      const date = new Date(s.updated_at);
      let groupLabel = 'Cũ hơn';

      for (const g of this.groups) {
        if (g.check(date)) {
          groupLabel = g.label;
          break;
        }
      }

      if (!groups[groupLabel]) groups[groupLabel] = [];
      groups[groupLabel].push({
        id: s.id,
        title: s.title,
        updatedAt: date,
      });
    });

    // Chuyển map sang array theo đúng thứ tự ưu tiên của this.groups
    this.groupedSessions = this.groups
      .filter((g) => groups[g.label])
      .map((g) => ({
        group: g.label,
        items: groups[g.label],
      }));
  }

  onRename(s: SessionListItem): void {
    const newTitle = prompt('Nhập tên mới cho phiên chat:', s.title);
    if (newTitle && newTitle.trim()) {
      this.renameSession.emit({ id: s.id, title: newTitle.trim() });
    }
  }
  pinSession(s: SessionListItem): void {}
  archiveSession(s: SessionListItem): void {}
  private isToday(d: Date): boolean {
    const today = new Date();
    return d.toDateString() === today.toDateString();
  }

  private isYesterday(d: Date): boolean {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return d.toDateString() === yesterday.toDateString();
  }

  private isWithinLastWeek(d: Date): boolean {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return d > weekAgo;
  }

  private isWithinLastMonth(d: Date): boolean {
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    return d > monthAgo;
  }
  openMenuId: string | null = null;

  toggleMenu(id: string, event: Event): void {
    event.stopPropagation();

    if (this.openMenuId === id) {
      this.openMenuId = null;
    } else {
      this.openMenuId = id;
    }
  }
  @HostListener('document:click')
  closeMenu(): void {
    this.openMenuId = null;
  }
}

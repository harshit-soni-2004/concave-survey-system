import { Injectable, signal, computed } from '@angular/core';
import { Subject } from 'rxjs';

export type Theme = 'dark' | 'light';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly THEME_KEY = 'concave_theme';
  private currentThemeSignal = signal<Theme>(this.getInitialTheme());
  
  readonly theme = computed(() => this.currentThemeSignal());
  readonly isDark = computed(() => this.currentThemeSignal() === 'dark');

  // Stream for charts and external components to re-render
  readonly themeChanged$ = new Subject<Theme>();

  constructor() {
    this.applyTheme(this.currentThemeSignal());
  }

  toggleTheme(): void {
    const nextTheme: Theme = this.currentThemeSignal() === 'dark' ? 'light' : 'dark';
    this.setTheme(nextTheme);
  }

  setTheme(theme: Theme): void {
    this.currentThemeSignal.set(theme);
    localStorage.setItem(this.THEME_KEY, theme);
    this.applyTheme(theme);
    this.themeChanged$.next(theme);
  }

  private applyTheme(theme: Theme): void {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark-theme');
      document.documentElement.classList.remove('light-theme');
    } else {
      document.documentElement.classList.add('light-theme');
      document.documentElement.classList.remove('dark-theme');
    }
  }

  private getInitialTheme(): Theme {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(this.THEME_KEY);
      if (saved === 'light' || saved === 'dark') {
        return saved;
      }
    }
    return 'dark';
  }
}

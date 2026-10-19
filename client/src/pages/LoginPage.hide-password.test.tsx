import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '../../tests/helpers/render';
import { http, HttpResponse } from 'msw';
import { server } from '../../tests/helpers/msw/server';
import { resetAllStores } from '../../tests/helpers/store';
import LoginPage from './LoginPage';

vi.mock('./login/LoginWorld', () => ({ default: () => null }));

// ENSCON：OIDC_HIDE_PASSWORD_FORM（只藏帳密畫面、?pw=1 後門）與 enscon_invite 邀請碼記憶。
function mockConfig(extra: Record<string, unknown> = {}) {
  server.use(
    http.get('/api/auth/app-config', () => HttpResponse.json({
      has_users: true,
      allow_registration: true,
      demo_mode: false,
      oidc_configured: true,
      oidc_display_name: 'LINE',
      oidc_only_mode: false,
      oidc_login: true,
      password_login: true,
      password_registration: true,
      setup_complete: true,
      oidc_hide_password_form: true,
      ...extra,
    })),
    http.get('/api/auth/invite/:token', () => HttpResponse.json({ valid: true })),
  );
}

describe('LoginPage — OIDC_HIDE_PASSWORD_FORM (ENSCON)', () => {
  beforeEach(() => {
    resetAllStores();
    window.history.replaceState({}, '', '/login');
  });
  afterEach(() => window.history.replaceState({}, '', '/'));

  it('FE-PAGE-LOGIN-ENSCON-001: hides the password form and shows one big LINE-green OIDC button', async () => {
    mockConfig();
    render(<LoginPage />);
    const btn = await screen.findByText(/sign in with line/i);
    const a = btn.closest('a')!;
    expect(a.style.background).toMatch(/#06C755|rgb\(6, 199, 85\)/i);
    expect(screen.queryByPlaceholderText('your@email.com')).toBeNull();
    expect(screen.getAllByText(/sign in with line/i)).toHaveLength(1);
  });

  it('FE-PAGE-LOGIN-ENSCON-002: uses OIDC_BUTTON_COLOR when the server sends one', async () => {
    mockConfig({ oidc_button_color: '#123456' });
    render(<LoginPage />);
    const a = (await screen.findByText(/sign in with line/i)).closest('a')!;
    expect(a.style.background).toMatch(/#123456|rgb\(18, 52, 86\)/i);
  });

  it('FE-PAGE-LOGIN-ENSCON-003: ?pw=1 shows the original form (admin back door)', async () => {
    window.history.replaceState({}, '', '/login?pw=1');
    mockConfig();
    render(<LoginPage />);
    await waitFor(() => expect(screen.getByPlaceholderText('your@email.com')).toBeInTheDocument());
  });

  it('FE-PAGE-LOGIN-ENSCON-004: still shows the form while no user exists yet (first admin setup)', async () => {
    mockConfig({ has_users: false });
    render(<LoginPage />);
    await waitFor(() => expect(screen.getByPlaceholderText('your@email.com')).toBeInTheDocument());
  });

  it('FE-PAGE-LOGIN-ENSCON-005: ?invite= is remembered in localStorage and carried on the OIDC link', async () => {
    window.history.replaceState({}, '', '/login?invite=abcdEFGH1234');
    mockConfig();
    render(<LoginPage />);
    const a = (await screen.findByText(/sign in with line/i)).closest('a')!;
    expect(localStorage.getItem('enscon_invite')).toBe('abcdEFGH1234');
    expect(a.getAttribute('href')).toContain('invite=abcdEFGH1234');
  });

  it('FE-PAGE-LOGIN-ENSCON-006: without ?invite= the stored invite is added to the OIDC link', async () => {
    localStorage.setItem('enscon_invite', 'storedINVITE99');
    mockConfig();
    render(<LoginPage />);
    const a = (await screen.findByText(/sign in with line/i)).closest('a')!;
    expect(a.getAttribute('href')).toContain('invite=storedINVITE99');
  });
});

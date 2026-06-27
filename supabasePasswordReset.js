// CompanyManager — Password Reset Flow

(function () {
  function qs(selector) { return document.querySelector(selector); }

  function setMessage(element, message, ok = true) {
    if (!element) return;
    element.textContent = message || '';
    element.style.display = message ? 'block' : 'none';
    element.style.color = ok ? '#86efac' : '#fca5a5';
  }

  function getResetRedirectUrl() {
    const origin = window.location.origin || 'https://companymanager.com.pl';
    return `${origin}/reset-password.html`;
  }

  function hasRecoveryParams() {
    const hash = String(window.location.hash || '');
    const search = String(window.location.search || '');
    return /type=recovery|access_token=|refresh_token=/.test(hash) || /[?&]code=/.test(search) || /[?&]type=recovery/.test(search);
  }

  function showMode(mode) {
    const requestCard = qs('#passwordResetRequestCard');
    const updateCard = qs('#passwordResetUpdateCard');
    if (requestCard) requestCard.style.display = mode === 'update' ? 'none' : '';
    if (updateCard) updateCard.style.display = mode === 'update' ? '' : 'none';
  }

  async function prepareRecoverySession() {
    if (!window.cmSupabase) throw new Error('Brak połączenia z Supabase. Sprawdź supabaseClient.js.');

    const params = new URLSearchParams(window.location.search || '');
    const code = params.get('code');

    if (code && window.cmSupabase.auth.exchangeCodeForSession) {
      const { error } = await window.cmSupabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
    }

    const { data, error } = await window.cmSupabase.auth.getSession();
    if (error) throw error;
    if (!data?.session) {
      throw new Error('Link resetujący jest nieważny albo wygasł. Wyślij nowy link resetowania hasła.');
    }
    return data.session;
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const requestForm = qs('#passwordResetRequestForm');
    const updateForm = qs('#passwordResetUpdateForm');
    const requestMessage = qs('#passwordResetRequestMessage');
    const updateMessage = qs('#passwordResetUpdateMessage');

    if (hasRecoveryParams()) {
      showMode('update');
      setMessage(updateMessage, 'Sprawdzanie linku resetującego...', true);
      try {
        await prepareRecoverySession();
        setMessage(updateMessage, 'Link poprawny. Wpisz nowe hasło.', true);
      } catch (error) {
        setMessage(updateMessage, error.message || 'Nie udało się otworzyć formularza resetowania hasła.', false);
      }
    } else {
      showMode('request');
    }

    requestForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = String(qs('#resetEmail')?.value || '').trim().toLowerCase();
      if (!email) return setMessage(requestMessage, 'Podaj adres email.', false);
      if (!window.cmSupabase) return setMessage(requestMessage, 'Brak połączenia z Supabase. Sprawdź supabaseClient.js.', false);

      setMessage(requestMessage, 'Wysyłanie linku resetującego...', true);
      const { error } = await window.cmSupabase.auth.resetPasswordForEmail(email, {
        redirectTo: getResetRedirectUrl()
      });

      if (error) {
        setMessage(requestMessage, 'Nie udało się wysłać linku: ' + error.message, false);
        return;
      }

      // Komunikat celowo neutralny — nie zdradzamy, czy konto istnieje.
      setMessage(requestMessage, 'Jeżeli konto z tym adresem email istnieje, wysłaliśmy link do resetowania hasła.', true);
    });

    updateForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const password = String(qs('#newPassword')?.value || '');
      const confirm = String(qs('#newPasswordConfirm')?.value || '');

      if (password.length < 8) return setMessage(updateMessage, 'Hasło musi mieć minimum 8 znaków.', false);
      if (password !== confirm) return setMessage(updateMessage, 'Hasła nie są takie same.', false);
      if (!window.cmSupabase) return setMessage(updateMessage, 'Brak połączenia z Supabase. Sprawdź supabaseClient.js.', false);

      setMessage(updateMessage, 'Zapisywanie nowego hasła...', true);
      try {
        await prepareRecoverySession();
        const { error } = await window.cmSupabase.auth.updateUser({ password });
        if (error) throw error;
        await window.cmSupabase.auth.signOut().catch(() => {});
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, document.title, 'reset-password.html');
        }
        setMessage(updateMessage, 'Hasło zostało zmienione. Za chwilę przeniesiemy Cię do logowania.', true);
        setTimeout(() => { window.location.href = 'login.html'; }, 1800);
      } catch (error) {
        setMessage(updateMessage, error.message || 'Nie udało się zmienić hasła.', false);
      }
    });
  });
})();

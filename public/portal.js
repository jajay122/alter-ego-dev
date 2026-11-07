const status = document.getElementById('portal-status');
const logout = document.getElementById('portal-logout');
async function refresh() {
  try {
    const response = await fetch('/api/session');
    if (!response.ok) throw new Error('session');
    const session = await response.json();
    logout.hidden = !session.authenticated;
    status.textContent = !session.passwordConfigured ? 'Configurez votre mot de passe privé côté serveur pour utiliser les applications.'
      : session.authenticated ? 'Votre session privée est ouverte. Vous pouvez passer d’une application à l’autre.'
        : 'Chaque application vous demandera de déverrouiller votre espace privé.';
  } catch { status.textContent = 'L’état de votre session est indisponible. Réessayez après rechargement.'; }
}
logout.addEventListener('click', async () => {
  logout.disabled = true;
  try {
    const response = await fetch('/api/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    if (!response.ok) throw new Error('logout');
    logout.hidden = true;
    status.textContent = 'Votre espace est verrouillé. Les données restent privées.';
  } catch { status.textContent = 'Impossible de confirmer le verrouillage. Réessayez.'; }
  finally { logout.disabled = false; }
});
refresh();

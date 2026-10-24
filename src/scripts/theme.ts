// The saved choice is applied before first paint by the inline script in Page.astro's <head>.
// This wires the nav button: two states, saved in localStorage (never a cookie).
export const THEME_KEY = 'a11ign-theme';

const systemLight = window.matchMedia('(prefers-color-scheme: light)');

function current(): 'light' | 'dark' {
	const set = document.documentElement.getAttribute('data-theme');
	if (set === 'light' || set === 'dark') return set;
	return systemLight.matches ? 'light' : 'dark';
}

function label() {
	const button = document.querySelector<HTMLButtonElement>('[data-theme-toggle]');
	button?.setAttribute('aria-label', current() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
}

export function setupThemeToggle() {
	const button = document.querySelector<HTMLButtonElement>('[data-theme-toggle]');
	if (!button) return;
	label();
	systemLight.addEventListener('change', label);
	button.addEventListener('click', () => {
		const next = current() === 'dark' ? 'light' : 'dark';
		document.documentElement.setAttribute('data-theme', next);
		try {
			localStorage.setItem(THEME_KEY, next);
		} catch {
			// A blocked store only means the choice is not remembered.
		}
		label();
	});
}

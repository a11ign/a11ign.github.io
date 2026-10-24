export function setupMenu() {
	const button = document.querySelector<HTMLButtonElement>('[data-menu-button]');
	const panel = document.getElementById('a11ign-menu');
	if (!button || !panel) return;

	const set = (open: boolean) => {
		button.setAttribute('aria-expanded', String(open));
		button.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
		panel.classList.toggle('on', open);
	};
	const isOpen = () => button.getAttribute('aria-expanded') === 'true';

	button.addEventListener('click', () => set(!isOpen()));
	document.addEventListener('keydown', (event) => {
		if (event.key === 'Escape' && isOpen()) {
			set(false);
			button.focus();
		}
	});
	// The panel only exists below 860px, so close it when the window grows past that.
	window.matchMedia('(min-width: 861px)').addEventListener('change', (event) => {
		if (event.matches) set(false);
	});
}

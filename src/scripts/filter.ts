// Resources filter chips: a chip shows only the matching posts, retitles the list and updates the count.
export function setupFilter() {
	const root = document.querySelector<HTMLElement>('[data-filter-root]');
	if (!root) return;
	const chips = [...root.querySelectorAll<HTMLButtonElement>('[data-chip]')];
	const posts = [...root.querySelectorAll<HTMLElement>('li[data-kind]')];
	const title = root.querySelector<HTMLElement>('[data-list-title]');
	const count = root.querySelector<HTMLElement>('[data-count]');
	if (!title || !count) return;

	for (const chip of chips) {
		chip.addEventListener('click', () => {
			const name = chip.dataset.chip ?? 'All';
			const kind = chip.dataset.kind;
			for (const c of chips) c.setAttribute('aria-pressed', String(c === chip));
			let shown = 0;
			for (const post of posts) {
				const match = !kind || post.dataset.kind === kind;
				post.hidden = !match;
				if (match) shown += 1;
			}
			title.textContent = name === 'All' ? 'All resources' : name;
			count.textContent = `Showing ${shown} of ${posts.length} resources`;
		});
	}
}

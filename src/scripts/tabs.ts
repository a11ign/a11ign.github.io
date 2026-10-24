// Install tabs (Claude Code | Codex): roving tabindex, arrows move and select, Home and End jump.
export function setupTabs() {
	document.querySelectorAll<HTMLElement>('[data-agent-tabs]').forEach((list) => {
		const tabs = [...list.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
		const root = list.closest('[data-agent-setup]');
		const panel = root?.querySelector<HTMLElement>('[data-agent-panel]');
		if (!root || !panel) return;
		// Without JavaScript there are no tabs and both commands show, so the panel is only a tab panel from here on.
		panel.setAttribute('role', 'tabpanel');
		panel.setAttribute('aria-labelledby', (tabs.find((tab) => tab.getAttribute('aria-selected') === 'true') ?? tabs[0]).id);

		const select = (tab: HTMLButtonElement, focus: boolean) => {
			for (const t of tabs) {
				const on = t === tab;
				t.setAttribute('aria-selected', String(on));
				t.tabIndex = on ? 0 : -1;
			}
			panel.setAttribute('aria-labelledby', tab.id);
			root.querySelectorAll<HTMLElement>('[data-agent-code]').forEach((code) => {
				code.toggleAttribute('data-active', code.dataset.agentCode === tab.dataset.agent);
			});
			if (focus) tab.focus();
		};

		tabs.forEach((tab, i) => {
			tab.addEventListener('click', () => select(tab, false));
			tab.addEventListener('keydown', (event) => {
				// Alt+Arrow is the browser's Back and Forward, not ours.
				if (event.altKey || event.ctrlKey || event.metaKey) return;
				const last = tabs.length - 1;
				const target =
					event.key === 'ArrowRight' ? tabs[i === last ? 0 : i + 1]
					: event.key === 'ArrowLeft' ? tabs[i === 0 ? last : i - 1]
					: event.key === 'Home' ? tabs[0]
					: event.key === 'End' ? tabs[last]
					: null;
				if (!target) return;
				event.preventDefault();
				select(target, true);
			});
		});
	});
}

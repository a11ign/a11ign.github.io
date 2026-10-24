const COPIED_FOR_MS = 2000;
const COPIED = 'Copied to clipboard';
const FAILED = "Couldn't copy. The text is selected, so you can copy it yourself.";
// A live region only announces a change, so it is emptied first and filled a moment later: the same message twice still speaks twice.
const ANNOUNCE_AFTER_MS = 50;

function selectText(node: Element) {
	const selection = window.getSelection();
	if (!selection) return;
	const range = document.createRange();
	range.selectNodeContents(node);
	selection.removeAllRanges();
	selection.addRange(range);
}

function announce(status: HTMLElement, message: string) {
	status.textContent = '';
	if (message) window.setTimeout(() => (status.textContent = message), ANNOUNCE_AFTER_MS);
}

async function copy(block: HTMLElement, button: HTMLButtonElement, status: HTMLElement) {
	const code = block.querySelector('pre code');
	if (!code) return;
	clearTimeout(Number(button.dataset.timer));
	status.textContent = '';
	try {
		await navigator.clipboard.writeText(code.textContent ?? '');
	} catch {
		selectText(code);
		button.textContent = 'Copy';
		announce(status, FAILED);
		return;
	}
	button.textContent = 'Copied';
	announce(status, COPIED);
	button.dataset.timer = String(
		window.setTimeout(() => {
			button.textContent = 'Copy';
			status.textContent = '';
		}, COPIED_FOR_MS),
	);
}

export function setupCopyButtons() {
	document.querySelectorAll<HTMLElement>('.a1-code').forEach((block) => {
		const button = block.querySelector<HTMLButtonElement>('[data-copy]');
		const status = block.querySelector<HTMLElement>('[data-copy-status]');
		if (!button || !status || button.dataset.ready) return;
		button.dataset.ready = 'true';
		button.addEventListener('click', () => void copy(block, button, status));
	});
}

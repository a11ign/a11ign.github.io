const COPIED_FOR_MS = 2000;
const COPIED = 'Copied to clipboard';
const FAILED = "Couldn't copy. The text is selected, so you can copy it yourself.";

function selectText(node: Element) {
	const selection = window.getSelection();
	if (!selection) return;
	const range = document.createRange();
	range.selectNodeContents(node);
	selection.removeAllRanges();
	selection.addRange(range);
}

async function copy(block: HTMLElement, button: HTMLButtonElement, status: HTMLElement) {
	const code = block.querySelector('pre code');
	if (!code) return;
	clearTimeout(Number(button.dataset.timer));
	try {
		await navigator.clipboard.writeText(code.textContent ?? '');
	} catch {
		selectText(code);
		button.textContent = 'Copy';
		status.textContent = FAILED;
		return;
	}
	button.textContent = 'Copied';
	status.textContent = COPIED;
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

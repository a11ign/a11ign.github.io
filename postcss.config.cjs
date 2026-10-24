// The design system keys its light theme on [data-theme="light"]. A visitor whose system is set to
// light, and who has not pressed the theme toggle, has no data-theme attribute (and with JavaScript
// off never will), so every light rule is repeated under prefers-color-scheme for that case.
// :root:where(:not([data-theme])) has the specificity of [data-theme="light"], and the copy sits
// straight after the original, so the cascade is the same either way.
const LIGHT = '[data-theme="light"]';
const SYSTEM_LIGHT = ':root:where(:not([data-theme]))';

const systemLightTheme = () => ({
	postcssPlugin: 'a11ign-system-light-theme',
	Once(root, { AtRule }) {
		root.walkRules((rule) => {
			if (!rule.selector.includes(LIGHT)) return;
			for (let at = rule.parent; at && at.type !== 'root'; at = at.parent) {
				if (at.type === 'atrule' && (/keyframes$/.test(at.name) || at.params.includes('prefers-color-scheme'))) return;
			}
			const selector = rule.selectors
				.filter((s) => s.includes(LIGHT))
				.map((s) => s.split(LIGHT).join(SYSTEM_LIGHT))
				.join(',');
			const media = new AtRule({ name: 'media', params: '(prefers-color-scheme: light)' });
			media.append(rule.clone({ selector }));
			rule.after(media);
		});
	},
});
systemLightTheme.postcss = true;

module.exports = { plugins: [systemLightTheme()] };

import { AUTHOR, DOCS_DATE, GITHUB_URL, SITE_URL, canonical } from './site';

export function softwareApplication() {
	return {
		'@context': 'https://schema.org',
		'@type': 'SoftwareApplication',
		name: 'a11ign',
		applicationCategory: 'DeveloperApplication',
		operatingSystem: 'Windows',
		offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
		license: 'https://spdx.org/licenses/AGPL-3.0-or-later.html',
		url: `${SITE_URL}/`,
		codeRepository: GITHUB_URL,
		author: AUTHOR,
	};
}

export function docsArticle(headline: string, description: string, path: string) {
	return {
		'@context': 'https://schema.org',
		'@type': 'Article',
		headline,
		description,
		url: canonical(path),
		author: AUTHOR,
		datePublished: DOCS_DATE,
		dateModified: DOCS_DATE,
	};
}

/** Home, Documentation, then the page. /docs itself is just Home, Documentation. */
export function docsBreadcrumbs(pageName: string | null, path: string) {
	const items = [
		{ name: 'Home', url: `${SITE_URL}/` },
		{ name: 'Documentation', url: canonical('/docs') },
	];
	if (pageName) items.push({ name: pageName, url: canonical(path) });
	return {
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: items.map((item, i) => ({ '@type': 'ListItem', position: i + 1, ...item })),
	};
}

export function faqPage(questions: { question: string; answer: string }[]) {
	return {
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		mainEntity: questions.map(({ question, answer }) => ({
			'@type': 'Question',
			name: question,
			acceptedAnswer: { '@type': 'Answer', text: answer },
		})),
	};
}

export function savedIds(): string[] {
	try {
		const value = JSON.parse(localStorage.getItem('aps:saved') || '[]');
		return Array.isArray(value) ? value.filter((id) => typeof id === 'string').slice(0, 100) : [];
	} catch {
		return [];
	}
}
export function toggleSaved(id: string) {
	const ids = savedIds();
	const next = ids.includes(id) ? ids.filter((item) => item !== id) : [id, ...ids].slice(0, 100);
	localStorage.setItem('aps:saved', JSON.stringify(next));
	return next.includes(id);
}

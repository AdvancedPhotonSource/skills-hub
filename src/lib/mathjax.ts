interface MathJax {
	startup: { promise: Promise<void> };
	typesetPromise: (elements: HTMLElement[]) => Promise<void>;
	typesetClear: (elements: HTMLElement[]) => void;
}

let loading: Promise<MathJax> | undefined;

export function loadMathJax() {
	if (loading) return loading;
	const script = document.createElement('script');
	script.src = 'https://cdn.jsdelivr.net/npm/mathjax@4.1.3/tex-svg.js';
	script.async = true;
	Object.assign(window, {
		MathJax: {
			loader: { load: ['ui/safe'] },
			startup: { typeset: false },
			tex: {
				inlineMath: [['\\(', '\\)']],
				displayMath: [['\\[', '\\]']],
				packages: ['base', 'ams', 'newcommand', 'noundefined'],
				maxBuffer: 100000
			},
			svg: { fontCache: 'local' },
			options: {
				safeOptions: {
					allow: { URLs: 'none', classes: 'none', cssIDs: 'none', styles: 'none' }
				}
			}
		}
	});
	loading = new Promise<MathJax>((resolve, reject) => {
		script.onerror = () => reject(new Error('MathJax could not be loaded.'));
		script.onload = async () => {
			try {
				const math = (window as Window & { MathJax?: MathJax }).MathJax;
				if (!math) throw new Error('MathJax did not initialize.');
				await math.startup.promise;
				resolve(math);
			} catch (error) {
				reject(error);
			}
		};
		document.head.append(script);
	}).catch((error) => {
		loading = undefined;
		script.remove();
		throw error;
	});
	return loading;
}

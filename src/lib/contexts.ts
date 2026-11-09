// APS Beamline Directory, reviewed 2026-11-09. Comma-separated endstations
// in the directory are expanded into individual choices; beamline-wide tags
// are also available. Update this list when the directory changes.
export const beamlineDirectoryUrl = 'https://www.aps.anl.gov/Beamlines/Beamline-Directory';
const endstations: Record<string, string> = {
	'1-BM': 'B,C',
	'1-ID': 'B,C,E',
	'2-BM': 'A,B',
	'2-ID': 'D,E',
	'3-ID': 'B,C,D',
	'4-ID': 'B,G,H',
	'5-BM': 'B',
	'5-ID': 'B,C,D',
	'6-BM': 'A,B',
	'6-ID': 'B,C,D',
	'7-BM': 'B',
	'7-ID': 'B,C,D',
	'8-BM': 'B',
	'8-ID': 'E,I',
	'9-BM': 'B,C',
	'9-ID': 'D',
	'10-BM': 'B',
	'10-ID': 'B',
	'11-BM': 'B',
	'11-ID': 'B,C,D',
	'12-BM': 'B',
	'12-ID': 'B,E',
	'13-BM': 'C,D',
	'13-ID': 'C,D,E',
	'14-ID': 'B',
	'15-ID': 'B,C,D,E',
	'16-BM': 'B,D',
	'16-ID': 'B,D,E',
	'17-BM': 'B',
	'17-ID': 'B',
	'18-ID': 'D',
	'19-BM': 'D',
	'19-ID': 'E',
	'20-BM': 'B',
	'20-ID': 'D,E',
	'21-ID': 'D,F,G',
	'22-ID': 'D,E',
	'23-ID': 'B,D',
	'24-ID': 'C,E',
	'25-ID': 'C,D,E',
	'26-ID': 'C',
	'27-ID': 'B',
	'28-ID': 'B,C,D,E,F,G',
	'29-ID': 'C,D',
	'30-ID': 'B,C',
	'31-ID': 'D,E',
	'32-ID': 'B,C',
	'33-BM': 'C',
	'33-ID': 'C',
	'34-ID': 'E,F',
	'35-ID': 'B,C,D,E'
};

export const facilities = [
	['aps', 'APS'],
	['alcf', 'ALCF'],
	['cnm', 'CNM'],
	['atlas', 'ATLAS']
] as const;
export const beamlines = Object.entries(endstations).flatMap(([beamline, stations]) =>
	[beamline, ...stations.split(',').map((station) => `${beamline}-${station}`)].map(
		(label) => [label.toLowerCase(), label] as const
	)
);
export const contextOptions = [...facilities, ...beamlines];
const contextKey = (value: string) =>
	value
		.trim()
		.toLowerCase()
		.replace(/[\s_-]/g, '')
		.replace(/^0+(?=\d)/, '');
const canonicalContexts = new Map(contextOptions.map(([id]) => [contextKey(id), id]));

// Accept old spellings at the boundary, but store only canonical IDs.
export const canonicalContext = (value: string) => canonicalContexts.get(contextKey(value));

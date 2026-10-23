import type { Category } from './types';

const domains = [
	[
		'beamline',
		'Beamline & experiments',
		[
			['planning', 'Experiment planning'],
			['acquisition', 'Data acquisition'],
			['detectors', 'Detectors & calibration']
		]
	],
	[
		'controls',
		'Controls & instrumentation',
		[
			['epics', 'EPICS'],
			['bluesky', 'Bluesky & Ophyd'],
			['devices', 'Device integration']
		]
	],
	[
		'science',
		'Scientific data & analysis',
		[
			['reduction', 'Data reduction'],
			['imaging', 'Imaging & tomography'],
			['scattering', 'Scattering & diffraction'],
			['spectroscopy', 'Spectroscopy']
		]
	],
	[
		'agents',
		'AI & agents',
		[
			['skill-authoring', 'Skill authoring'],
			['agent-workflows', 'Agent workflows'],
			['mcp', 'MCP integrations']
		]
	],
	[
		'software',
		'Software engineering',
		[
			['python', 'Python'],
			['web', 'Web development'],
			['testing', 'Testing & debugging']
		]
	],
	[
		'computing',
		'Computing & infrastructure',
		[
			['hpc', 'HPC'],
			['deployment', 'Containers & deployment'],
			['storage', 'Storage & networking']
		]
	],
	[
		'research',
		'Research & documentation',
		[
			['literature', 'Literature'],
			['writing', 'Scientific & technical writing'],
			['training', 'Training']
		]
	],
	[
		'productivity',
		'Productivity & collaboration',
		[
			['documents', 'Documents & spreadsheets'],
			['reporting', 'Reporting'],
			['projects', 'Project workflows']
		]
	]
] as const;

export const categories: Category[] = domains.flatMap(([id, name, children]) => [
	{ id, name, parent: null },
	...children.map(([child, label]) => ({ id: child, name: label, parent: id }))
]);

export const roles = [
	'Beamline scientist',
	'Researcher',
	'Software engineer',
	'Controls engineer',
	'System administrator'
];
export const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? id;

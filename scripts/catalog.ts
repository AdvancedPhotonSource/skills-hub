import type { Classification } from '../src/lib/server/catalog';

export type CatalogSkill = Classification & { name: string; directory?: string };

// Reviewed source selection; commits make the starter library reproducible.
export const starterCatalog: {
	repository: string;
	commit: string;
	ref: string;
	license: string;
	skills: CatalogSkill[];
}[] = [
	{
		repository: 'K-Dense-AI/scientific-agent-skills',
		commit: '593377bb048752abb0152deab9fbb1083a6087df',
		ref: 'main',
		license: 'MIT (repository LICENSE.md; individual declarations retained)',
		skills: [
			{
				name: 'exploratory-data-analysis',
				categories: ['exploration'],
				tags: ['python', 'hdf5', 'numpy'],
				role: 'Researcher',
				example:
					'Inspect the groups, dataset shapes, dtypes, and attributes in my HDF5 file before loading arrays. Identify missing metadata and propose a bounded first analysis.'
			},
			{
				name: 'matplotlib',
				categories: ['visualization', 'python'],
				tags: ['python', 'matplotlib'],
				role: 'Researcher',
				example:
					'Plot these three intensity-versus-q scans with labeled units, uncertainty bars, and a colorblind-friendly legend. Export a reproducible script plus SVG and PNG figures.'
			},
			{
				name: 'scientific-visualization',
				categories: ['visualization', 'writing'],
				tags: ['python', 'matplotlib', 'seaborn'],
				role: 'Researcher',
				example:
					'Turn these scan results into a publication-ready multipanel figure. Keep scales and units consistent, show uncertainty, and explain the choices in a short caption.'
			},
			{
				name: 'statistical-analysis',
				categories: ['statistics'],
				tags: ['python', 'scipy', 'statsmodels'],
				role: 'Researcher',
				example:
					'Compare measurements from two sample conditions with repeated scans. Identify the experimental unit, check assumptions, and report effect sizes and confidence intervals.'
			},
			{
				name: 'uncertainty-and-units',
				categories: ['statistics', 'reduction'],
				tags: ['python', 'pint', 'uncertainties'],
				role: 'Beamline scientist',
				example:
					'Propagate uncertainty through an intensity normalization using signal, background, monitor counts, and exposure time. Track units and shared calibration uncertainties explicitly.'
			},
			{
				name: 'pymatgen',
				categories: ['materials', 'scattering'],
				tags: ['python', 'pymatgen', 'crystallography'],
				role: 'Researcher',
				example:
					'Read this CIF, summarize its lattice and symmetry, and calculate a powder X-ray diffraction pattern at the specified wavelength. Explain the assumptions before comparing with measured peaks.'
			},
			{
				name: 'dask',
				categories: ['hpc', 'exploration'],
				tags: ['python', 'dask', 'numpy'],
				role: 'Software engineer',
				example:
					'Design a chunked Dask workflow to compute per-frame means from an image stack larger than RAM. Estimate worker memory and validate the result on a small local subset.'
			},
			{
				name: 'zarr-python',
				categories: ['storage', 'imaging'],
				tags: ['python', 'zarr', 'numpy'],
				role: 'Software engineer',
				example:
					'Choose chunk shapes and codecs for a local Zarr image stack accessed one frame at a time. Demonstrate a small write/read round trip and preserve axes and units as attributes.'
			},
			{
				name: 'sympy',
				categories: ['statistics', 'python'],
				tags: ['python', 'sympy'],
				role: 'Researcher',
				example:
					'Derive the Jacobian of this calibration model symbolically, simplify it with stated assumptions, and compare its numerical evaluation with finite differences.'
			},
			{
				name: 'scikit-learn',
				categories: ['exploration', 'statistics'],
				tags: ['python', 'scikit-learn'],
				role: 'Researcher',
				example:
					'Build a baseline classifier for these labeled spectra. Split by sample before preprocessing to prevent leakage, and report cross-validation uncertainty and a held-out confusion matrix.'
			},
			{
				name: 'polars',
				categories: ['exploration', 'python'],
				tags: ['python', 'polars', 'parquet'],
				role: 'Software engineer',
				example:
					'Use a lazy Polars query to filter scan metadata in Parquet, join calibration records, and summarize exposure time by sample without loading unrelated columns.'
			},
			{
				name: 'vaex',
				categories: ['exploration', 'hpc'],
				tags: ['python', 'vaex', 'hdf5'],
				role: 'Researcher',
				example:
					'Profile this large tabular HDF5 dataset with Vaex: inspect column types, apply a quality filter, and compute grouped statistics without materializing the whole table.'
			}
		]
	},
	{
		repository: 'anthropics/skills',
		commit: 'dbd4588f9e1033efb41dad4bef2f7947c8993d44',
		ref: 'main',
		license: 'Apache-2.0 (each selected skill includes LICENSE.txt)',
		skills: [
			{
				name: 'frontend-design',
				categories: ['web'],
				tags: ['html', 'css', 'ui'],
				role: 'Software engineer',
				example:
					'Design an accessible beamline run-summary page with scan status, data-quality indicators, and a compact results table. Make it usable on both a desktop monitor and a phone.'
			},
			{
				name: 'webapp-testing',
				categories: ['testing', 'web'],
				tags: ['python', 'playwright'],
				role: 'Software engineer',
				example:
					'Use Playwright to test the local application: search for a skill, open it, and download its ZIP. Check keyboard access and capture desktop and mobile screenshots.'
			},
			{
				name: 'mcp-builder',
				categories: ['mcp'],
				tags: ['mcp', 'typescript', 'python'],
				role: 'Software engineer',
				example:
					'Design a read-only MCP server over an existing scan catalog with search_scans and get_scan tools. Reuse its API, validate inputs, and provide clear structured errors.'
			},
			{
				name: 'skill-creator',
				categories: ['skill-authoring'],
				tags: ['agent-skills', 'evaluation'],
				role: 'Software engineer',
				example:
					'Turn our documented beamline data-inspection workflow into an Agent Skill with supporting scripts. Create representative evaluation prompts and check that the skill activates on appropriate tasks.'
			}
		]
	},
	{
		repository: 'AdvancedPhotonSource/ptychodus',
		commit: '7c661a1cbecb5148315a1d5cfaa42fd592da3704',
		ref: 'main',
		license: 'Argonne BSD-style terms in repository LICENSE; retained in each package',
		skills: [
			{
				name: 'add-plugin',
				directory: '.claude/skills/add-plugin',
				categories: ['imaging', 'python'],
				tags: ['ptychodus', 'ptychography', 'hdf5'],
				role: 'Software engineer',
				example:
					'In my Ptychodus checkout, add a reader for our beamline HDF5 diffraction format. Follow the existing plugin interface, preserve scan indexes, and verify registration and a small file round trip.'
			},
			{
				name: 'add-reconstructor',
				directory: '.claude/skills/add-reconstructor',
				categories: ['imaging', 'python'],
				tags: ['ptychodus', 'ptychography', 'reconstruction'],
				role: 'Software engineer',
				example:
					'In my Ptychodus checkout, integrate a reconstruction library as an optional backend. Match the current Reconstructor interface, stream iteration results, and keep startup working without the optional dependency.'
			},
			{
				name: 'check-layers',
				directory: '.claude/skills/check-layers',
				categories: ['testing', 'python'],
				tags: ['ptychodus', 'python', 'architecture'],
				role: 'Software engineer',
				example:
					'Audit my Ptychodus changes for imports that violate the api/model/view/controller boundaries, including ptychodus_store. Report offending file locations and suggested ownership without changing the code.'
			}
		]
	},
	{
		repository: 'AdvancedPhotonSource/EAA',
		commit: '738960330cb66b3cf195d7e261def2e89ef5f9a8',
		ref: 'main',
		license: 'No license declaration or applicable license file supplied at this revision',
		skills: [
			{
				name: 'create-eaa-compatible-mcp-servers',
				directory: 'developer_tools/create_eaa_compatible_mcp_servers',
				categories: ['mcp', 'devices', 'bluesky'],
				tags: ['eaa', 'mcp', 'bluesky', 'epics'],
				role: 'Controls engineer',
				example:
					'Review an MCP gateway for our existing Bluesky Queue Server against EAA’s documented payload contracts. Check tool schemas, image paths, get_attribute_payload, and the separation between gateway and instrument execution.'
			}
		]
	}
];

// Original hub-authored packages, with reviewed upstream references inside each folder.
export const localSkills: CatalogSkill[] = [
	{
		name: 'aps-eaa-workflow-setup',
		categories: ['agent-workflows', 'mcp', 'skill-authoring'],
		tags: ['eaa', 'python', 'mcp', 'argo'],
		role: 'Software engineer',
		example:
			'Set up a terminal EAA agent using our configured model endpoint, a dedicated workspace, and downloaded hub skills. Show how to attach our existing MCP server and diagnose missing skills or tool images.'
	},
	{
		name: 'aps-lauelab-indexing',
		categories: ['scattering', 'materials'],
		tags: ['lauelab', 'laue', '34-id-e', 'hdf5'],
		role: 'Researcher',
		example:
			'Prepare a reproducible lauelab indexing workflow for these APS 34-ID-E frames and their matching detector geometry and crystal XML files. Summarize peaks, orientations, unique indexed peaks, and any input failures.'
	}
];

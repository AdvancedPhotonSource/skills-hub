import type { Classification } from '../src/lib/server/catalog';

export type CatalogSkill = Classification & {
	name: string;
	directory?: string;
};

// Reviewed source selection; commits make the starter library reproducible.
export const starterCatalog: {
	repository: string;
	commit: string;
	ref: string;
	license: string;
	skills: CatalogSkill[];
}[] = [
	{
		// OSTI's read-only mirror points to this upstream; pin the mirror's revision.
		repository: 'AI-ModCon/genesis-skills',
		commit: '70dce5aca946e2804f9b8579da01910cd2861858',
		ref: 'main',
		license: 'Repository LICENSE and NOTICE plus skill-specific licenses and attribution retained',
		skills: [
			...[
				[
					'aurora',
					'Prepare a PBS job for our reconstruction workflow on ALCF Aurora, including GPU affinity and a small validation run.'
				],
				[
					'frontier',
					'Adapt our scientific analysis job for Frontier with its documented Slurm resources, programming environment, and storage.'
				],
				[
					'pbs',
					'Write a PBS job array for these detector datasets using our allocation and resource limits.'
				],
				[
					'perlmutter',
					'Prepare a Perlmutter Slurm job for our analysis workflow with the correct allocation and scratch paths.'
				],
				[
					'slurm',
					'Create a bounded Slurm job array for beamline data reduction and collect job status and accounting.'
				]
			].map(([name, example]) => ({
				name,
				directory: `skills/hpc-skills/${name}`,
				categories: ['hpc'],
				tags: ['alcf', 'genesis', 'hpc', name],
				role: 'Researcher',
				example
			})),
			...[
				[
					'agentic-vulnerabilities-scan',
					'Assess our beamline assistant in an authorized sandbox using a bounded Promptfoo vulnerability scan.'
				],
				[
					'ai-fingerprint',
					'Profile our scientific AI assistant’s architecture and security boundaries before a safety review.'
				],
				[
					'battleprint',
					'Use our AI system fingerprint to analyze attack vectors and defenses for a scientific assistant.'
				],
				[
					'fingerprinting',
					'Classify this scientific ML repository and gather evidence for a follow-on safety assessment.'
				],
				[
					'uncertainty-quantification',
					'Assess calibration, out-of-distribution behavior, and uncertainty before using our model in experimental decisions.'
				],
				[
					'uq-metrics-evaluator',
					'Evaluate prediction accuracy and uncertainty calibration from our scientific model’s CSV outputs.'
				]
			].map(([name, example]) => ({
				name,
				directory: `skills/basesafe-skills/${name}`,
				categories: ['machine-learning', 'agent-workflows'],
				tags: ['alcf', 'genesis', 'safety', 'basesafe'],
				role: 'Researcher',
				example
			})),
			{
				name: 'academy',
				categories: ['agent-workflows', 'hpc'],
				tags: ['alcf', 'genesis', 'hpc', 'academy'],
				role: 'Software engineer',
				example:
					'Build an Academy workflow that coordinates scientific analysis agents and dispatches compute tasks to HPC resources.'
			}
		].map((entry) => ({
			...entry,
			provenance: 'argonne' as const,
			contexts: ['alcf'],
			sourceUrl: `https://gitlab.osti.gov/genesis/genesis-skills/-/tree/main/${'directory' in entry ? entry.directory.split('/').slice(0, 2).join('/') : 'skills/academy'}?ref_type=heads`,
			upstreamAuthor: 'Genesis Skills contributors'
		}))
	},
	{
		repository: 'K-Dense-AI/scientific-agent-skills',
		commit: '593377bb048752abb0152deab9fbb1083a6087df',
		ref: 'main',
		license: 'MIT (repository LICENSE.md; individual declarations retained)',
		skills: [
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
				name: 'scikit-learn',
				categories: ['machine-learning', 'exploration', 'statistics'],
				tags: ['python', 'scikit-learn'],
				role: 'Researcher',
				example:
					'Build a baseline classifier for these labeled spectra. Split by sample before preprocessing to prevent leakage, and report cross-validation uncertainty and a held-out confusion matrix.'
			}
		]
	},
	{
		repository: 'uw-ssec/rse-plugins',
		commit: 'bf9da803e9ec9ac11f4ecd2424114774da658c1d',
		ref: 'main',
		license: 'BSD-3-Clause (repository and containerization plugin LICENSE files retained)',
		skills: [
			{
				name: 'singularity-apptainer',
				directory: 'plugins/containerization/skills/singularity-apptainer',
				categories: ['hpc', 'deployment'],
				tags: ['apptainer', 'singularity', 'slurm', 'mpi'],
				role: 'Researcher',
				example:
					'Package our diffraction analysis environment as an Apptainer image and prepare a Slurm script using this cluster’s documented partition and account. Include data mounts and a small MPI or GPU validation step before scaling.'
			},
			{
				name: 'gpu-containers',
				directory: 'plugins/containerization/skills/gpu-containers',
				categories: ['deployment', 'hpc', 'machine-learning'],
				tags: ['gpu', 'cuda', 'rocm', 'docker', 'pytorch'],
				role: 'Software engineer',
				example:
					'Prepare a GPU container for our PyTorch image-reconstruction model. Check the installed driver and allocated devices, select a compatible image, and verify framework GPU visibility before training.'
			}
		]
	},
	{
		repository: 'scimate-ai/hpc-skills',
		commit: '4ea8069188d931875121cdd418d7a26e60f47152',
		ref: 'main',
		license: 'MIT (repository LICENSE; retained in the package)',
		skills: [
			{
				name: 'hpc-orchestration',
				categories: ['hpc'],
				tags: ['slurm', 'pbs', 'lsf', 'mpi', 'batch-jobs'],
				role: 'Researcher',
				example:
					'Prepare a bounded job array to process these detector datasets on our cluster. Use the actual scheduler, allocation, and scratch policy; estimate resources from a pilot, stage inputs, and collect exit status and output checksums.'
			}
		]
	},
	{
		repository: 'K-Dense-AI/scientific-agent-skills',
		commit: '5f2bc0341354fd5590aef76a533ada1e1e5b4e62',
		ref: 'main',
		license: 'MIT (repository LICENSE.md; individual declarations retained)',
		skills: [
			{
				name: 'pytorch-lightning',
				categories: ['machine-learning', 'hpc'],
				tags: ['python', 'pytorch', 'lightning', 'deep-learning', 'gpu'],
				role: 'Researcher',
				example:
					'Organize training of our detector-image classifier with Lightning. Split by specimen before preprocessing, start with a small single-device run, log metrics locally, and preserve checkpoints before considering distributed training.'
			},
			{
				name: 'umap-learn',
				categories: ['machine-learning', 'exploration', 'visualization'],
				tags: ['python', 'umap', 'dimensionality-reduction', 'clustering'],
				role: 'Researcher',
				example:
					'Explore these high-dimensional XRF spectra with UMAP and a PCA baseline. Choose a scientifically meaningful scaling and metric, compare seeds and neighborhoods, and check apparent clusters in the original spectra.'
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
	},
	{
		repository: 'AdvancedPhotonSource/APEXA-APS-Beamline-Assistant',
		commit: '6e7e7bc9d3460a06ff772f15473de6f4b09c4e6e',
		ref: 'main',
		license: 'Argonne open-source terms in repository LICENSE; retained in the package',
		skills: [
			{
				name: 'apexa-report',
				directory: '.agents/skills/apexa-report',
				categories: ['reporting', 'acquisition'],
				tags: ['apexa', 'midas', 'logbook', 'html'],
				role: 'Beamline scientist',
				example:
					'In APEXA, generate a self-contained HTML report from this completed calibration run and its ESAF. Include bound-limited parameters and quote the latest experiment logbook entries with their timestamps.'
			}
		]
	}
];

// Original hub-authored packages, with reviewed upstream references inside each folder.
export const localSkills: CatalogSkill[] = [
	{
		name: 'aps-hub-discovery',
		categories: ['agent-workflows'],
		tags: ['discovery', 'aps'],
		role: '',
		example: 'Find a skill or MCP for ptychography reconstruction and explain the requirements.'
	},
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
	},
	{
		name: 'aps-gsas-ii-powder-refinement',
		categories: ['scattering', 'materials', 'python'],
		tags: ['gsas-ii', 'rietveld', 'crystallography', 'powder-diffraction'],
		role: 'Researcher',
		example:
			'Prepare a GSAS-II project from my powder pattern, matching instrument parameters, and CIF. Propose staged refinement settings, retain the input project, and report residuals and model limitations before extending to a series.'
	}
];

export function catalogMetadata(entry: CatalogSkill, repository?: string): Classification {
	const techniqueTags: Record<string, string> = {
		xrf: 'xrf',
		ptychography: 'ptychography',
		laue: 'laue',
		'powder-diffraction': 'diffraction',
		crystallography: 'diffraction'
	};
	return {
		...entry,
		applicationType: entry.applicationType || 'skill',
		tags: entry.tags.filter((tag) => !['skill', 'mcp'].includes(tag)),
		contexts: entry.contexts || ['aps', ...entry.tags.filter((tag) => /^\d+-id-/.test(tag))],
		techniques: [
			...new Set(entry.tags.flatMap((tag) => (techniqueTags[tag] ? [techniqueTags[tag]] : [])))
		],
		provenance:
			entry.provenance ||
			(repository && !repository.startsWith('AdvancedPhotonSource/') ? 'external' : 'argonne'),
		sourceUrl: entry.sourceUrl || (repository ? `https://github.com/${repository}` : ''),
		upstreamAuthor: entry.upstreamAuthor || repository?.split('/')[0] || '',
		relevance: entry.example || '',
		mcp: entry.mcp || null
	};
}

import { db } from '../src/lib/server/db';
import { userById } from '../src/lib/server/auth';
import { publish } from '../src/lib/server/catalog';
import { validatePackage } from '../src/lib/server/packages';

const id = 'aps-example-library';
db.prepare('INSERT OR IGNORE INTO users (id, username, display_name) VALUES (?, ?, ?)').run(
	id,
	'examples',
	'Example library'
);
const user = userById(id);
if (!user) throw new Error('The examples username is already in use. No account was changed.');

const examples = [
	{
		name: 'hdf5-data-explorer',
		description:
			'Understand an HDF5 or NeXus file before analysis. Inspect groups, dataset shapes, units, and metadata without loading an entire experiment into memory.',
		categories: ['reduction'],
		tags: ['hdf5', 'nexus', 'python'],
		role: 'Researcher',
		body: `# Explore scientific data\n\nUse this workflow when receiving an unfamiliar HDF5 or NeXus file. Produce a concise map of its structure and identify the data needed for the next analysis step.\n\n## Start with structure\n\n1. Ask for the file path and the scientific question.\n2. Open the file read-only with h5py. List groups, datasets, shapes, and data types without reading full arrays.\n3. Look for NeXus NX_class attributes, units, axis names, timestamps, and detector metadata.\n4. Identify likely signal, coordinate, and normalization datasets.\n\n## Inspect a small sample\n\nRead a small slice of the relevant datasets. Report missing values, unexpected ranges, and whether dimensions agree with the axes. Preserve the original data.\n\n## Report\n\nReturn a table of dataset paths, shapes, units, and likely roles. State which interpretation follows from metadata and which needs confirmation. Suggest the smallest useful next analysis step.`,
		reference:
			'Record dataset paths, shape, dtype, units, axes, chunking, and compression. Never infer physical units solely from a dataset name.'
	},
	{
		name: 'python-test-workflow',
		description:
			'Write focused tests for scientific Python code. Cover numerical edge cases, array shapes, and real behavior with clear, maintainable pytest fixtures.',
		categories: ['python', 'testing'],
		tags: ['python', 'pytest', 'numpy'],
		role: 'Software engineer',
		body: `# Test a scientific Python change\n\n## Understand the contract\n\nRead the function, its callers, and nearby tests. Identify expected shapes, units, dtypes, and error behavior before changing code.\n\n## Select useful cases\n\n- A small representative input with a known result.\n- Empty and single-element inputs when supported.\n- Non-finite values and invalid dimensions.\n- A regression case demonstrating the reported bug.\n\nUse NumPy tolerance-aware assertions for floating-point results. Explain the tolerance rather than choosing one solely to make a test pass. Keep fixtures small and deterministic.\n\n## Verify\n\nRun the targeted tests first, then the relevant suite. Report the commands and results. Avoid duplicating the implementation in the expected-value calculation.`
	},
	{
		name: 'epics-record-reader',
		description:
			'Make sense of EPICS record definitions and existing diagnostic output. Explain links, fields, units, and alarm behavior in the context of a controls question.',
		categories: ['epics'],
		tags: ['epics', 'controls'],
		role: 'Controls engineer',
		body: `# Read EPICS records\n\nWork from supplied database files, templates, substitutions, and diagnostic output.\n\n## Gather context\n\nAsk for the record name, IOC context, and observed behavior. Determine the record type and resolve macros using the supplied substitutions.\n\n## Trace the record\n\n1. Explain INP or OUT links and relevant device support.\n2. Identify processing triggers, scan settings, and forward links.\n3. Summarize engineering units, conversion fields, limits, and alarms.\n4. Distinguish configuration from current runtime values.\n\n## Deliver a readable explanation\n\nInclude a small link diagram and cite the record fields supporting your interpretation. Describe missing context explicitly. This workflow explains supplied information; it does not perform control-system writes.`
	},
	{
		name: 'slurm-job-planner',
		description:
			'Prepare a clear Slurm batch script from a workload’s resource needs. Make memory, CPU/GPU allocation, logging, and environment setup explicit.',
		categories: ['hpc'],
		tags: ['slurm', 'hpc', 'python'],
		role: 'Researcher',
		body: `# Plan a batch job\n\nCollect the workload command, input location, expected runtime, memory estimate, and parallelism model. Ask for the cluster's partition, account, and module conventions.\n\n## Match resources to work\n\nDistinguish independent jobs, threaded programs, and MPI workloads. Use arrays for independent inputs when appropriate. Avoid inventing partition or account names.\n\n## Prepare the script\n\nInclude resource requests, a working directory, explicit environment setup, and uniquely named logs. Explain every resource request and keep the first run small.\n\n## Review the result\n\nReturn the script and the assumptions it depends on. Explain how to inspect job status and resource utilization using the site's supported tools. Leave submission to the user.`
	},
	{
		name: 'technical-handoff',
		description:
			'Turn project notes into a concise technical handoff. Capture the current state, reproducible setup, open decisions, and the next useful action.',
		categories: ['writing', 'projects'],
		tags: ['documentation', 'handoff'],
		role: 'Software engineer',
		body: `# Write a useful handoff\n\nAsk who will receive the handoff and what they need to do next. Read the supplied notes and repository context.\n\n## Use a small structure\n\n1. **Purpose:** what the system does and who uses it.\n2. **Current state:** what works, what was verified, and what remains incomplete.\n3. **Run it:** exact setup and verification commands.\n4. **Next steps:** a short ordered list with unresolved decisions.\n\nLink to authoritative existing documentation instead of copying it. Distinguish observed facts from assumptions. Remove details that do not help the next person operate or change the system.`
	},
	{
		name: 'skill-authoring-guide',
		description:
			'Turn a repeatable workflow into a portable Agent Skill. Define a precise trigger, write actionable instructions, and keep supporting material organized.',
		categories: ['skill-authoring'],
		tags: ['agents', 'markdown'],
		role: 'Software engineer',
		body: `# Create a focused skill\n\nStart with one repeatable task and a concrete example of a successful outcome.\n\n## Define the trigger\n\nChoose a short lowercase, hyphenated name. Write a description explaining what the skill does and when an agent should use it.\n\n## Write the workflow\n\nState the required inputs, the sequence of actions, and the expected output. Prefer concrete instructions over general advice. Document environment requirements only when they matter.\n\n## Package supporting material\n\nKeep SKILL.md at the root of a folder matching the skill name. Place detailed references, scripts, and assets in companion directories. Use relative links.\n\n## Try a real task\n\nExercise the instructions with a representative example. Remove repetition and unnecessary context. Publish the whole folder so its relative references remain intact.`
	}
];

let count = 0;
for (const example of examples) {
	if (db.prepare('SELECT 1 FROM skills WHERE owner_id=? AND name=?').get(id, example.name))
		continue;
	const source = `---\nname: ${example.name}\ndescription: ${example.description}\n---\n\n${example.body}\n`;
	const files = [{ path: 'SKILL.md', data: Buffer.from(source), mode: 0o644 }];
	if (example.reference)
		files.push({
			path: 'references/checklist.md',
			data: Buffer.from(example.reference),
			mode: 0o644
		});
	publish(user, validatePackage(files), example);
	count++;
}
console.log(`Added ${count} example skills. The example author has no sign-in credentials.`);
db.close();

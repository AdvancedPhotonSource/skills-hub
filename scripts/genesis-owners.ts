// Reviewed against the imported Genesis snapshot, not the repository organization.
export const genesisRepository = 'AI-ModCon/genesis-skills';
const snapshot = '70dce5aca946e2804f9b8579da01910cd2861858';
const evidenceRoot = `https://github.com/${genesisRepository}/blob/${snapshot}`;

export const genesisOwners = {
	mattebaughman: {
		name: 'Matt Baughman',
		basis: 'author',
		evidence: `${evidenceRoot}/skills/hpc-skills/ATTRIBUTION.md`
	},
	ianfoster: {
		name: 'Ian Foster',
		basis: 'author',
		evidence: `${evidenceRoot}/skills/academy/ATTRIBUTION.md`
	},
	'nhodas-pnnl': {
		name: 'Nathan Hodas',
		basis: 'uploader',
		evidence: `https://github.com/${genesisRepository}/commit/7c3ea83edaff1c6d685cf7239ac4ad32f3d0008b`
	}
} as const;
type GenesisOwner = keyof typeof genesisOwners;

export function genesisOwnership(directory: string) {
	let login: GenesisOwner;
	let attribution: string;
	if (/^skills\/hpc-skills\/(aurora|frontier|pbs|perlmutter|slurm)$/.test(directory)) {
		login = 'mattebaughman';
		attribution = 'Matt Baughman (PPPL); contributor: Kyle Felker (ANL)';
	} else if (directory === 'skills/academy') {
		login = 'ianfoster';
		attribution = 'Ian Foster (ANL)';
	} else if (
		/^skills\/basesafe-skills\/(agentic-vulnerabilities-scan|ai-fingerprint|battleprint|fingerprinting|uncertainty-quantification|uq-metrics-evaluator)$/.test(
			directory
		)
	) {
		login = 'nhodas-pnnl';
		attribution = 'ModCon BaseSafe Team; Genesis uploader: Nathan Hodas (PNNL)';
	} else return null;
	return { login, attribution, ...genesisOwners[login] };
}

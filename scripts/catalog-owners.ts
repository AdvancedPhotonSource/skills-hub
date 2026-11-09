import { genesisOwners, genesisOwnership, genesisRepository } from './genesis-owners';

export const catalogOwners = {
	...genesisOwners,
	stevehenke: {
		name: 'Steve Henke',
		basis: 'author',
		evidence: 'https://github.com/AdvancedPhotonSource/ptychodus'
	},
	pawantr: {
		name: 'Pawan Tripathi',
		basis: 'author',
		evidence: 'https://github.com/AdvancedPhotonSource/APEXA-APS-Beamline-Assistant'
	}
} as const;
export type CatalogOwner = keyof typeof catalogOwners;

// Explicit owner assignments requested for the APS catalog. Genesis retains
// its reviewed per-subtree author/uploader mapping.
export function catalogOwnership(repository: string, directory: string) {
	if (repository.toLowerCase() === genesisRepository.toLowerCase())
		return genesisOwnership(directory);
	let login: 'stevehenke' | 'pawantr';
	if (repository.toLowerCase() === 'advancedphotonsource/ptychodus') login = 'stevehenke';
	else if (
		repository.toLowerCase() === 'advancedphotonsource/apexa-aps-beamline-assistant' &&
		directory === '.agents/skills/apexa-report'
	)
		login = 'pawantr';
	else return null;
	return { login, attribution: catalogOwners[login].name, ...catalogOwners[login] };
}

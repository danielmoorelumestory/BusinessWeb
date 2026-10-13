import snapshot from './reviewSnapshot.json'

export const SOLID_REVIEW = snapshot
export const SOLID_REVIEW_MANIFEST = 'research/solid-state-mcp-2026-10-10/manifest.json'
export const solidReviewFor = (name: string) => snapshot.companies.find(c => c.name === name)
export const SOLID_RESEARCH_CANDIDATES = snapshot.companies.filter(c => c.candidate)

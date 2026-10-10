import type { Company } from './companies'
import { cnSectorResearch } from './details/cnSectorResearch'
import { cnFourSectorResearch } from './details/cnFourSectorResearch'
import { cnFinancePropertyIndustrialResearch } from './details/cnFinancePropertyIndustrialResearch'
import { cnChemGoldmanResearch } from './details/cnChemGoldmanResearch'

// Apply last: the older reassessment and generated constituent data must not
// restore withdrawn ratings, share assumptions, or fixed position instructions.
export function applyCnSectorResearch(company: Company): Company {
  if (company.market !== 'cn') return company
  const research = cnChemGoldmanResearch[company.code] ?? cnFinancePropertyIndustrialResearch[company.code] ?? cnFourSectorResearch[company.code] ?? cnSectorResearch[company.code]
  if (!research) return company
  const directory = cnChemGoldmanResearch[company.code]
    ? 'cn-chem-goldman-2026-10-07'
    : cnFinancePropertyIndustrialResearch[company.code]
    ? 'cn-finance-property-industrial-2026-10-07'
    : cnFourSectorResearch[company.code]
    ? 'cn-four-sectors-2026-10-07'
    : 'cn-sectors-2026-10-07'
  return { ...company, ...research, researchReport: `research/${directory}/${company.code}.md` }
}

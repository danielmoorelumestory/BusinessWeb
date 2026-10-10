import { Link, useLocation } from 'react-router-dom'
import { researchForCompany, researchPath } from '../data/futureTrendsResearch'

export default function FutureCompanyLink({ name, code }: { name: string; code: string }): JSX.Element {
  const location = useLocation()
  const r = researchForCompany(name, code)
  return r ? <Link to={researchPath(r.key)} state={{ from: location.pathname + location.search }}>{name}</Link> : <span>{name}（主体待核）</span>
}

import React from 'react'
import { Link } from 'react-router-dom'
import { isAbsoluteUrl, isNotesPath } from '../data/notesLinks'

type Props = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { to: string }

/**
 * 站内链接：以 /note/ 开头的路径是 notes 站点的静态页面，完整的 http(s) 地址属于别的站点，二者都必须用普通 <a> 整页加载；
 * 用前端路由的 Link 会被 SPA 路由接管，找不到匹配路由而显示"这一页不存在"。其余路径照常使用 Link。
 */
const SmartLink = React.forwardRef<HTMLAnchorElement, Props>(function SmartLink({ to, ...rest }, ref) {
  if (isNotesPath(to) || isAbsoluteUrl(to)) return <a ref={ref} href={to} {...rest} />
  return <Link ref={ref} to={to} {...rest} />
})

export default SmartLink

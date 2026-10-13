import React from 'react'
import { PageTitle } from '../components/ui/PageTabs'
import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, Download, FileText } from 'lucide-react'

// PDF 与书稿同源：book-慢即是快/正念投资.pdf（build_pdf.py 生成），发布时复制到 public/first-book/。
// 重新生成 PDF 后，同步更新页数和体积。
// 是否在「我的书」页展示 PDF 阅读/下载入口。暂不开放：改成 true 即恢复入口。
// 注意：隐藏入口不等于不可访问，public/first-book/ 下的 PDF 仍可被直接访问。
export const PDF_ENTRY_ENABLED = false

const BOOK_PDF = { file: '正念投资.pdf', pages: 235, sizeMB: '4.8' }

const BOOKS = [
  {
    id: 'slow-is-fast',
    title: '正念投资：普通人用规则代替盯盘的投资方法',
    description: '不盯盘、不预测：从资产配置到公司研究，找到适合自己的投资方法，让投资服务生活。',
    path: '/first-book/slow-is-fast',
    pdf: BOOK_PDF,
  },
]

const pdfUrl = (file: string): string => `${import.meta.env.BASE_URL}first-book/${encodeURIComponent(file)}`

export default function MyBooks({ showPdf = PDF_ENTRY_ENABLED }: { showPdf?: boolean }): JSX.Element {
  return (
    <main className="container animate-fade-in page-shell">
      <PageTitle desc="《正念投资：普通人用规则代替盯盘的投资方法》全文与目录">我的书</PageTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {BOOKS.map(book => (
          <article key={book.id} className="book-card">
            <Link to={book.path} className="book-card__main">
              <BookOpen size={32} color="var(--accent)" />
              <h2 style={{ margin: 0, fontSize: '1.3rem', lineHeight: 1.5 }}>{book.title}</h2>
              <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.8 }}>{book.description}</p>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)', marginTop: 'auto' }}>
                查看本书 <ArrowRight size={16} />
              </span>
            </Link>

            {showPdf && (
              <aside className="book-card__pdf" aria-label="PDF 版">
                <FileText size={28} color="var(--accent-warm)" />
                <div className="book-card__pdf-title">PDF 版</div>
                <div className="book-card__pdf-meta">{book.pdf.pages} 页 · {book.pdf.sizeMB} MB</div>
                <p className="book-card__pdf-hint">版面固定，适合整本连续阅读，也方便离线保存。</p>
                <a
                  className="btn-primary"
                  href={pdfUrl(book.pdf.file)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FileText size={16} style={{ marginRight: 6 }} aria-hidden="true" />阅读 PDF
                </a>
                <a
                  className="btn-ghost"
                  href={pdfUrl(book.pdf.file)}
                  download={book.pdf.file}
                >
                  <Download size={16} style={{ marginRight: 6 }} aria-hidden="true" />下载
                </a>
              </aside>
            )}
          </article>
        ))}
      </div>
    </main>
  )
}

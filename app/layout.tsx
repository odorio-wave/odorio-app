import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

// ★ ここでサイト全体の「顔」となる情報を設定します ★
export const metadata: Metadata = {
  title: 'ODORIO - 投票×議論',
  description: '正解のない哲学的な問題やみんなが気になっているトピックについて、みんなで投票・議論するプラットフォーム',
  
  // SNSでシェアされたときの設定 (Open Graph)
  openGraph: {
    title: 'ODORIO - 議論が踊る、価値観が集う',
    description: 'あなたの価値観は多数派？少数派？議論に参加しよう！',
    url: 'https://kotae-no-nai.com', // 取得予定のドメイン（仮でOK）
    siteName: 'ODORIO',
    locale: 'ja_JP',
    type: 'website',
    // 公開後に public フォルダに 'og-image.png' を置くと、それが表示されます
    images: [
      {
        url: '/og-image.png', 
        width: 1200,
        height: 630,
        alt: 'ODORIO サイトイメージ',
      },
    ],
  },

  // Twitter用設定
  twitter: {
    card: 'summary_large_image', // 大きな画像で表示
    title: 'ODORIO - 投××議論',
    description: '正解のない哲学的な問題やみんなが気になっているトピックについて、みんなで投票・議論するプラットフォーム',
    // images: ['/og-image.png'], // 公開後に有効化
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
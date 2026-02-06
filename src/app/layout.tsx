import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'CallFlow OS — Контроль обращений клиники',
  description: 'Сколько денег ваша клиника теряет на звонках? CallFlow OS считает потери и показывает как их вернуть.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  )
}

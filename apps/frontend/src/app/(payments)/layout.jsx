import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/Providers'
import { Toaster } from 'react-hot-toast'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'PAYSTREAM - Your Money, Simplified. Instantly.',
  description: 'Experience seamless digital payments with bank-level security and instant transfers. Send money, track spending, and manage your finances effortlessly.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          {/* Floating Bubbles Layer */}
          <div className="bubble-layer">
            <div className="bubble" style={{width: '60px', height: '60px', top: '10%', left: '15%', animationDelay: '0s'}}></div>
            <div className="bubble" style={{width: '40px', height: '40px', top: '20%', left: '80%', animationDelay: '2s'}}></div>
            <div className="bubble" style={{width: '80px', height: '80px', top: '60%', left: '10%', animationDelay: '4s'}}></div>
            <div className="bubble" style={{width: '50px', height: '50px', top: '70%', left: '85%', animationDelay: '1s'}}></div>
            <div className="bubble" style={{width: '70px', height: '70px', top: '40%', left: '50%', animationDelay: '3s'}}></div>
            <div className="bubble" style={{width: '45px', height: '45px', top: '85%', left: '40%', animationDelay: '5s'}}></div>
            <div className="bubble" style={{width: '55px', height: '55px', top: '15%', left: '60%', animationDelay: '2.5s'}}></div>
            <div className="bubble" style={{width: '35px', height: '35px', top: '50%', left: '25%', animationDelay: '4.5s'}}></div>
            <div className="bubble" style={{width: '65px', height: '65px', top: '30%', left: '90%', animationDelay: '1.5s'}}></div>
            <div className="bubble" style={{width: '48px', height: '48px', top: '75%', left: '70%', animationDelay: '3.5s'}}></div>
          </div>
          {children}
          <Toaster position="top-right" />
        </Providers>
      </body>
    </html>
  )
}

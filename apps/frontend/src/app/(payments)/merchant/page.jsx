import { redirect } from 'next/navigation'

export default function LegacyMerchantRedirect() {
  redirect('/legacy/merchant')
}

import { redirect } from 'next/navigation'

interface PageProps {
  params: { locale: string }
}

export default function LocaleRootPage({ params }: PageProps) {
  redirect(`/${params.locale}/login`)
}

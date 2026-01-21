import { NextResponse } from 'next/server'
import { getAvailableProviders } from '@/lib/ai-extraction'

export async function GET() {
  const providers = getAvailableProviders()
  return NextResponse.json(providers)
}


import { NextResponse } from 'next/server';
import { getPublicModelList } from '@/services/models';

export async function GET() {
  return NextResponse.json({ models: getPublicModelList() });
}
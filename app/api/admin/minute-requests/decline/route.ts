import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import MinuteRequest from '@/models/MinuteRequest';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { requestId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { requestId } = body ?? {};
  if (!requestId) return NextResponse.json({ error: 'requestId is required' }, { status: 400 });

  await connectDB();
  const updated = await MinuteRequest.findOneAndUpdate(
    { _id: requestId, adminId: session.user.adminId, status: 'pending' },
    { status: 'declined' },
    { returnDocument: 'after' },
  ).populate('userId', 'username');
  if (!updated) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

  return NextResponse.json({ success: true });
}

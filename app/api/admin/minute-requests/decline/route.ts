import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import MinuteRequest from '@/models/MinuteRequest';
import { requireWebMutationSession } from '@/lib/web-mutation-auth';

export async function POST(req: NextRequest) {
  const authResult = await requireWebMutationSession(['admin']);
  if (authResult.response) return authResult.response;
  const { session } = authResult;

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

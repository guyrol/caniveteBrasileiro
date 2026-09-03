import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import dbConnect from '@/lib/mongodb';
import History from '@/lib/models/History';
import { verifyToken } from '@/lib/auth';

// Helper to authenticate route requests
async function getUserIdFromSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');
  if (!sessionCookie || !sessionCookie.value) return null;
  const decoded = verifyToken(sessionCookie.value);
  return decoded ? decoded.userId : null;
}

export async function GET() {
  try {
    const userId = await getUserIdFromSession();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const records = await History.find({ userId }).sort({ timestamp: -1 });

    const mapped = records.map(rec => ({
      id: rec._id.toString(),
      type: rec.type,
      label: rec.label,
      data: rec.data,
      timestamp: rec.timestamp
    }));

    return NextResponse.json({ success: true, history: mapped });

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getUserIdFromSession();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type, label, data } = await req.json();
    if (!type || !label || !data) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    await dbConnect();

    // If type is notes, we update the existing notes document if it exists to avoid duplicates
    if (type === 'notes') {
      const existingNote = await History.findOne({ userId, type: 'notes' });
      if (existingNote) {
        existingNote.data = data;
        existingNote.timestamp = new Date();
        await existingNote.save();
        return NextResponse.json({
          success: true,
          item: {
            id: existingNote._id.toString(),
            type: existingNote.type,
            label: existingNote.label,
            data: existingNote.data,
            timestamp: existingNote.timestamp
          }
        });
      }
    }

    const newRecord = await History.create({
      userId,
      type,
      label,
      data
    });

    return NextResponse.json({
      success: true,
      item: {
        id: newRecord._id.toString(),
        type: newRecord.type,
        label: newRecord.label,
        data: newRecord.data,
        timestamp: newRecord.timestamp
      }
    });

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const userId = await getUserIdFromSession();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const clearAll = searchParams.get('clearAll') === 'true';

    await dbConnect();

    if (clearAll) {
      await History.deleteMany({ userId });
      return NextResponse.json({ success: true });
    }

    if (id) {
      const rec = await History.findOneAndDelete({ _id: id, userId });
      if (!rec) {
        return NextResponse.json({ error: 'Record not found or not owned' }, { status: 404 });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 });
  }
}

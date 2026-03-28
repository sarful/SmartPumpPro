import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import Admin from '@/models/Admin';
import Queue from '@/models/Queue';
import { getQueuePosition } from '@/lib/queue-engine';
import { MIN_RUNTIME_THRESHOLD, tickUnifiedMotorSessions } from '@/lib/timer-engine';
import { activateLoadShedding, clearLoadShedding } from '@/lib/loadshedding-engine';
import { isDeviceOnline, isDeviceReadyEffective } from '@/lib/device-readiness';
import { logEvent, logReadinessTransitions } from '@/lib/usage-logger';
import { finalizeCardModeSession, normalizeRfidUid } from '@/lib/card-mode';
import {
  getDeviceSecretHeaderName,
  isAuthorizedDeviceRequest,
  isDeviceSecretConfigured,
} from '@/lib/device-auth';
import { reportIncident } from '@/lib/observability';

const BAD_REQUEST = { error: 'adminId is required' };

type AdminSnapshot = {
  loadShedding?: boolean;
  username?: string;
  status?: 'pending' | 'active' | 'suspended';
  suspendReason?: string | null;
  deviceReady?: boolean;
  devicePinHigh?: boolean;
  deviceLastSeenAt?: Date | null;
  cardModeActive?: boolean;
  cardActiveUid?: string | null;
  cardActiveUserId?: string | { toString(): string } | null;
  cardActivatedAt?: Date | null;
  cardLastSeenAt?: Date | null;
  cardBilledMinutes?: number;
  cardModeMessage?: string | null;
  cardModeStopReason?: string | null;
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const adminId = searchParams.get('adminId');
  const userId = searchParams.get('userId');
  const uidRaw = searchParams.get('uid'); // null when not provided; empty string when uid=
  const uidProvided = uidRaw !== null;
  const uid = normalizeRfidUid(uidRaw ?? undefined);
  const lsParam = searchParams.get('ls'); // optional: ESP32 sensed load-shedding (true/1)
  const devParam = searchParams.get('dev') ?? searchParams.get('device'); // optional: ESP32 device-ready pin (true/1)
  const isReadOnlyRequest = lsParam === null && devParam === null && !uidProvided;

  try {
    const deviceAuthorized = isDeviceSecretConfigured() && isAuthorizedDeviceRequest(req);

    if (!deviceAuthorized && isReadOnlyRequest) {
      const session = await auth();
      if (!session?.user?.role) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      if (session.user.role === 'user') {
        if (session.user.id !== userId || session.user.adminId !== adminId) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      } else if (session.user.role === 'admin') {
        if (session.user.adminId !== adminId) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      }
    } else if (!isDeviceSecretConfigured()) {
      return NextResponse.json(
        {
          error: 'ESP32 device auth is not configured',
          details: 'Set ESP32_DEVICE_SECRET on the server before connecting devices.',
        },
        { status: 503 },
      );
    } else if (!deviceAuthorized) {
      return NextResponse.json(
        {
          error: 'Unauthorized device request',
          details: `Missing or invalid ${getDeviceSecretHeaderName()} header.`,
        },
        { status: 401 },
      );
    }

    await connectDB();
    // Run one tick to decrement timers and auto-stop if needed
    await tickUnifiedMotorSessions();

    if (!adminId) {
      return NextResponse.json(BAD_REQUEST, { status: 400 });
    }

    // If userId missing, derive by admin: pick RUNNING if any, else top of queue user if present.
    let user =
      userId &&
      (await User.findById(userId)
        .select({ motorStatus: 1, motorRunningTime: 1, availableMinutes: 1, adminId: 1, username: 1 })
        .lean());

    if (!user) {
      user =
        (await User.findOne({ adminId, motorStatus: 'RUNNING' })
          .select({ motorStatus: 1, motorRunningTime: 1, availableMinutes: 1, adminId: 1, username: 1 })
          .lean()) ||
        (await User.findOne({ adminId })
          .select({ motorStatus: 1, motorRunningTime: 1, availableMinutes: 1, adminId: 1, username: 1 })
          .lean());
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found for admin' }, { status: 404 });
    }

    const adminLookupId = (adminId ?? user.adminId?.toString()) || null;
    let admin: AdminSnapshot | null = adminLookupId
      ? await Admin.findById(adminLookupId)
          .select({
            loadShedding: 1,
            username: 1,
            status: 1,
            suspendReason: 1,
            deviceReady: 1,
            devicePinHigh: 1,
            deviceLastSeenAt: 1,
            cardModeActive: 1,
            cardActiveUid: 1,
            cardActiveUserId: 1,
            cardActivatedAt: 1,
            cardLastSeenAt: 1,
            cardBilledMinutes: 1,
            cardModeMessage: 1,
            cardModeStopReason: 1,
          })
          .lean()
      : null;

    // React to ESP32 sensed load shedding: pause/resume motors
    if (adminLookupId && lsParam !== null) {
      const sensed = ['1', 'true', 'on', 'yes'].includes(lsParam.toLowerCase());
      const current = admin?.loadShedding ?? false;
      if (sensed !== current) {
        if (sensed) {
          await activateLoadShedding(adminLookupId);
        } else {
          await clearLoadShedding(adminLookupId);
        }
        admin = { ...(admin || {}), loadShedding: sensed, username: admin?.username };
      }
    }

    if (adminLookupId && devParam !== null) {
      const devicePinHigh = ['1', 'true', 'on', 'yes', 'high'].includes(devParam.toLowerCase());
      admin = await Admin.findByIdAndUpdate(
        adminLookupId,
        {
          $set: {
            deviceReady: devicePinHigh,
            devicePinHigh,
            deviceLastSeenAt: new Date(),
          },
        },
        {
          returnDocument: 'after',
          projection: {
            loadShedding: 1,
            username: 1,
            status: 1,
            suspendReason: 1,
            deviceReady: 1,
            devicePinHigh: 1,
            deviceLastSeenAt: 1,
            cardModeActive: 1,
            cardActiveUid: 1,
            cardActiveUserId: 1,
            cardActivatedAt: 1,
            cardLastSeenAt: 1,
            cardBilledMinutes: 1,
            cardModeMessage: 1,
            cardModeStopReason: 1,
          },
        },
      ).lean();
    }

    // Gate motor by load shedding + device readiness + suspend status.
    const deviceOnline = isDeviceOnline(admin?.deviceLastSeenAt ?? null);
    const effectiveDeviceReady = isDeviceReadyEffective(admin);
    const effectiveLoadShedding = Boolean(admin?.loadShedding) && deviceOnline;
    const adminBlocked =
      effectiveLoadShedding ||
      !effectiveDeviceReady ||
      admin?.status === 'suspended';

    // RFID Card Mode: when uid is present, allow card-bound user to run and lock others out.
    if (adminLookupId && uid) {
      // Resolve the card user first so unknown cards get a clear error even if motor is running.
      const cardUser = await User.findOne({ adminId: adminLookupId, rfidUid: uid })
        .select({ _id: 1, username: 1, adminId: 1, availableMinutes: 1, status: 1, suspendReason: 1, motorStatus: 1 })
        .lean();

      // Unknown card: return message and stop any active card session for safety.
      if (!cardUser) {
        if (admin?.cardModeActive) {
          await finalizeCardModeSession({ adminId: adminLookupId, reason: 'unknown_uid' });
        }
        return NextResponse.json({
          error: 'Unknown card',
          cardModeActive: false,
          cardModeMessage: 'Unknown card',
          motorStatus: 'OFF',
          remainingMinutes: 0,
          availableMinutes: 0,
          loadShedding: effectiveLoadShedding,
          deviceReady: effectiveDeviceReady,
        });
      }

      // Hard block RFID until the ESP32 reports ready again.
      if (!effectiveDeviceReady || effectiveLoadShedding) {
        if (admin?.cardModeActive) {
          await finalizeCardModeSession({ adminId: adminLookupId, reason: 'admin_override' });
        }
        return NextResponse.json({
          error: !effectiveDeviceReady ? 'Device not ready' : 'Load shedding active now',
          cardModeActive: false,
          cardModeMessage: !effectiveDeviceReady ? 'Device not ready' : 'Load shedding active now',
          motorStatus: 'OFF',
          remainingMinutes: 0,
          availableMinutes: cardUser.availableMinutes ?? 0,
          loadShedding: effectiveLoadShedding,
          deviceReady: effectiveDeviceReady,
        });
      }

      // If motor is already running (any mode), block card mode unless it's the same active card session.
      const runningUser = await User.findOne({ adminId: adminLookupId, motorStatus: 'RUNNING' })
        .select({ _id: 1 })
        .lean();
      const sameActiveCard =
        admin?.cardModeActive &&
        admin.cardActiveUid === uid &&
        runningUser?._id &&
        String(admin.cardActiveUserId) === String(runningUser._id);
      if (runningUser && !sameActiveCard) {
        if (admin?.cardModeActive) {
          await finalizeCardModeSession({ adminId: adminLookupId, reason: 'admin_override' });
        }
        return NextResponse.json({
          error: 'Motor already running',
          cardModeActive: false,
          cardModeMessage: 'Motor already running',
          motorStatus: 'OFF',
          remainingMinutes: 0,
          availableMinutes: 0,
          loadShedding: effectiveLoadShedding,
          deviceReady: effectiveDeviceReady,
        });
      }

      // If another card session is already active for a different UID, do not switch.
      if (admin?.cardModeActive && admin.cardActiveUid && admin.cardActiveUid !== uid) {
        return NextResponse.json({
          error: 'Motor already running',
          cardModeActive: true,
          cardModeMessage: admin.cardModeMessage || 'Now using card',
          motorStatus: 'OFF',
          remainingMinutes: 0,
          availableMinutes: 0,
          loadShedding: effectiveLoadShedding,
          deviceReady: effectiveDeviceReady,
        });
      }

      // Apply existing suspend policies.
      if (admin?.status === 'suspended') {
        return NextResponse.json({
          error: admin.suspendReason || 'Admin suspended',
          cardModeActive: false,
          cardModeMessage: admin.suspendReason || 'Admin suspended',
          motorStatus: 'OFF',
          remainingMinutes: 0,
          availableMinutes: cardUser.availableMinutes ?? 0,
          loadShedding: effectiveLoadShedding,
          deviceReady: effectiveDeviceReady,
        });
      }
      if (cardUser.status === 'suspended') {
        return NextResponse.json({
          error: cardUser.suspendReason || 'User suspended',
          cardModeActive: false,
          cardModeMessage: cardUser.suspendReason || 'User suspended',
          motorStatus: 'OFF',
          remainingMinutes: 0,
          availableMinutes: cardUser.availableMinutes ?? 0,
          loadShedding: effectiveLoadShedding,
          deviceReady: effectiveDeviceReady,
        });
      }

      // Balance rule: must have > 5 minutes to run in card mode.
      if ((cardUser.availableMinutes ?? 0) <= MIN_RUNTIME_THRESHOLD) {
        if (admin?.cardModeActive && String(admin.cardActiveUserId ?? '') === String(cardUser._id)) {
          await finalizeCardModeSession({ adminId: adminLookupId, reason: 'insufficient' });
        }
        const updatedUser = await User.findById(cardUser._id)
          .select({ availableMinutes: 1 })
          .lean();
        return NextResponse.json({
          error: 'Insufficient balance',
          cardModeActive: false,
          cardModeMessage: 'Insufficient balance',
          motorStatus: 'OFF',
          remainingMinutes: 0,
          availableMinutes: updatedUser?.availableMinutes ?? cardUser.availableMinutes ?? 0,
          loadShedding: effectiveLoadShedding,
          deviceReady: effectiveDeviceReady,
        });
      }

      // Activate card mode session.
      const isNewSession =
        !admin?.cardModeActive ||
        admin.cardActiveUid !== uid ||
        String(admin.cardActiveUserId) !== String(cardUser._id);
      await Admin.findByIdAndUpdate(
        adminLookupId,
        {
          $set: {
            cardModeActive: true,
            cardActiveUid: uid,
            cardActiveUserId: cardUser._id,
            cardActivatedAt: isNewSession ? new Date() : admin?.cardActivatedAt ?? new Date(),
            cardLastSeenAt: new Date(),
            cardBilledMinutes: isNewSession ? 0 : admin?.cardBilledMinutes ?? 0,
            cardModeMessage: 'Now using card',
            cardModeStopReason: null,
          },
        },
        { projection: { cardModeActive: 1, cardActiveUid: 1, cardActiveUserId: 1, cardActivatedAt: 1, cardBilledMinutes: 1 } },
      ).lean();

      // Freeze queue while card mode is active.
      await Queue.deleteMany({ adminId: adminLookupId, status: 'WAITING' }).exec();

      // Ensure card user is marked as running for device command (timer engine skips card mode admins).
      await User.updateOne(
        { _id: cardUser._id },
        {
          $set: {
            motorStatus: 'RUNNING',
            motorStartTime: isNewSession ? new Date() : admin?.cardActivatedAt ?? new Date(),
            lastSetMinutes: cardUser.availableMinutes ?? 0,
            motorRunningTime: cardUser.availableMinutes ?? 0,
          },
        },
      ).exec();
      if (isNewSession) {
        await logEvent({
          adminId: adminLookupId,
          userId: cardUser._id,
          event: 'motor_start',
          meta: {
            source: 'card_mode',
            requestedMinutes: cardUser.availableMinutes ?? 0,
            cardMode: true,
            uid,
          },
        });
      }
      const freshCardUser = await User.findById(cardUser._id)
        .select({ motorStatus: 1, motorRunningTime: 1, availableMinutes: 1, adminId: 1, username: 1, status: 1 })
        .lean();

      if (freshCardUser && (freshCardUser.availableMinutes ?? 0) <= MIN_RUNTIME_THRESHOLD) {
        await finalizeCardModeSession({ adminId: adminLookupId, reason: 'insufficient' });
        return NextResponse.json({
          userId: freshCardUser._id,
          motorStatus: 'OFF',
          remainingMinutes: 0,
          availableMinutes: freshCardUser.availableMinutes ?? 0,
          loadShedding: effectiveLoadShedding,
          deviceReady: effectiveDeviceReady,
          cardModeActive: false,
          cardModeMessage: 'Insufficient balance',
          holdReason: 'insufficient_balance',
        });
      }

      // Reuse the existing hold gate logic for safety.
      const adminBlocked =
        effectiveLoadShedding ||
        !effectiveDeviceReady;
      const userBlocked = freshCardUser?.status === 'suspended';
      const shouldHold = adminBlocked || userBlocked;

      if (freshCardUser) {
        if (shouldHold && freshCardUser.motorStatus === 'RUNNING') {
          await User.updateOne({ _id: freshCardUser._id }, { $set: { motorStatus: 'HOLD', motorStartTime: null } }).exec();
        } else if (!shouldHold && freshCardUser.motorStatus === 'HOLD') {
          await User.updateOne(
            { _id: freshCardUser._id },
            {
              $set: {
                motorStatus: 'RUNNING',
                motorStartTime: new Date(),
                lastSetMinutes: freshCardUser.motorRunningTime ?? freshCardUser.availableMinutes ?? 0,
                motorRunningTime: freshCardUser.motorRunningTime ?? freshCardUser.availableMinutes ?? 0,
              },
            },
          ).exec();
        }
      }

      let finalUser = await User.findById(cardUser._id)
        .select({ motorStatus: 1, motorRunningTime: 1, availableMinutes: 1, adminId: 1, username: 1, status: 1 })
        .lean();

      if (finalUser && finalUser.motorStatus !== 'RUNNING') {
        await User.updateOne(
          { _id: cardUser._id },
          {
            $set: {
              motorStatus: 'RUNNING',
              motorStartTime: new Date(),
              lastSetMinutes: finalUser.motorRunningTime ?? finalUser.availableMinutes ?? 0,
              motorRunningTime: finalUser.motorRunningTime ?? finalUser.availableMinutes ?? 0,
            },
          },
        ).exec();

        finalUser = await User.findById(cardUser._id)
          .select({ motorStatus: 1, motorRunningTime: 1, availableMinutes: 1, adminId: 1, username: 1, status: 1 })
          .lean();
      }

      return NextResponse.json({
        userId: finalUser?._id ?? cardUser._id,
        motorStatus: 'RUNNING',
        remainingMinutes: finalUser?.motorRunningTime ?? 0,
        availableMinutes: finalUser?.availableMinutes ?? 0,
        loadShedding: effectiveLoadShedding,
        deviceReady: effectiveDeviceReady,
        cardModeActive: true,
        cardModeMessage: 'Now using card',
        cardActiveUser: cardUser.username,
        cardActiveUserId: finalUser?._id ?? cardUser._id,
        holdReason: null,
      });
    }

    // Card removed: end active session (ceil charge on removal).
    if (adminLookupId && uidProvided && !uid && admin?.cardModeActive) {
      await finalizeCardModeSession({ adminId: adminLookupId, reason: 'removed' });
      admin = {
        ...(admin || {}),
        cardModeActive: false,
        cardActiveUid: null,
        cardActiveUserId: null,
      };
    }

    if (adminLookupId && admin?.cardModeActive && admin.cardActiveUserId) {
      const activeCardUser = await User.findById(admin.cardActiveUserId)
        .select({ status: 1, motorStatus: 1, motorRunningTime: 1, availableMinutes: 1 })
        .lean();

      const activeCardUserBlocked = activeCardUser?.status === 'suspended';
      const shouldHoldCard = effectiveLoadShedding || !effectiveDeviceReady || activeCardUserBlocked;

      if (shouldHoldCard && activeCardUser?.motorStatus === 'RUNNING') {
        await User.updateOne(
          { _id: admin.cardActiveUserId },
          { $set: { motorStatus: 'HOLD', motorStartTime: null } },
        ).exec();
        admin = {
          ...(admin || {}),
          cardModeMessage: !effectiveDeviceReady
            ? 'Device not ready'
            : effectiveLoadShedding
              ? 'Load shedding active now'
              : 'Card user suspended',
        };
      } else if (!shouldHoldCard && activeCardUser?.motorStatus === 'HOLD') {
        await User.updateOne(
          { _id: admin.cardActiveUserId },
          {
            $set: {
              motorStatus: 'RUNNING',
              motorStartTime: new Date(),
              lastSetMinutes: activeCardUser.motorRunningTime ?? activeCardUser.availableMinutes ?? 0,
              motorRunningTime: activeCardUser.motorRunningTime ?? activeCardUser.availableMinutes ?? 0,
            },
          },
        ).exec();
        admin = {
          ...(admin || {}),
          cardModeMessage: 'Now using card',
        };
      }
    }

    const runningQueue = await Queue.findOne({ adminId: adminLookupId, status: 'RUNNING' })
      .select({ userId: 1 })
      .lean();

    if (runningQueue?.userId) {
      const runningUser = await User.findById(runningQueue.userId)
        .select({ status: 1, motorStatus: 1, motorRunningTime: 1 })
        .lean();

      const runningUserBlocked = runningUser?.status === 'suspended';
      const shouldHold = adminBlocked || runningUserBlocked;

      if (shouldHold && runningUser?.motorStatus === 'RUNNING') {
        await User.updateOne(
          { _id: runningQueue.userId },
          { $set: { motorStatus: 'HOLD', motorStartTime: null } },
        );
      } else if (!shouldHold && runningUser?.motorStatus === 'HOLD') {
        await User.updateOne(
          { _id: runningQueue.userId },
          {
            $set: {
              motorStatus: 'RUNNING',
              motorStartTime: new Date(),
              lastSetMinutes: runningUser.motorRunningTime ?? 0,
            },
          },
        );
      }
    }

    const freshUser = await User.findById(user._id)
      .select({ motorStatus: 1, motorRunningTime: 1, availableMinutes: 1, adminId: 1, username: 1, status: 1 })
      .lean();

    if (!freshUser) {
      return NextResponse.json({ error: 'User not found after state update' }, { status: 404 });
    }

    const runningUserDoc = await User.findOne({
      adminId: freshUser.adminId,
      motorStatus: 'RUNNING',
    })
      .select({ username: 1, status: 1 })
      .lean();

    const userBlocked = freshUser.status === 'suspended';
    const holdReason = effectiveLoadShedding
      ? 'loadshedding'
      : !effectiveDeviceReady
        ? 'device_not_ready'
        : admin?.status === 'suspended'
          ? 'admin_suspended'
          : userBlocked
            ? 'user_suspended'
            : null;

    let cardActiveUser: string | null = null;
    if (admin?.cardModeActive && admin.cardActiveUserId) {
      const cardUserDoc = await User.findById(admin.cardActiveUserId)
        .select({ username: 1 })
        .lean();
      cardActiveUser = cardUserDoc?.username ?? null;
    }

    await logReadinessTransitions({
      adminId: freshUser.adminId.toString(),
      userId: freshUser._id.toString(),
      current: {
        deviceReady: effectiveDeviceReady,
        loadShedding: effectiveLoadShedding,
        internetOnline: effectiveDeviceReady,
      },
      meta: {
        source: 'esp32_poll',
      },
    });

    return NextResponse.json({
      userId: freshUser._id,
      motorStatus: freshUser.motorStatus,
      remainingMinutes: freshUser.motorRunningTime ?? 0,
      availableMinutes: freshUser.availableMinutes ?? 0,
      loadShedding: effectiveLoadShedding,
      deviceReady: effectiveDeviceReady,
      devicePinHigh: admin?.devicePinHigh ?? false,
      cardModeActive: Boolean(admin?.cardModeActive),
      cardModeMessage: admin?.cardModeMessage ?? null,
      cardActiveUser,
      cardActiveUid: admin?.cardActiveUid ?? null,
      cardActiveUserId: admin?.cardActiveUserId ?? null,
      adminStatus: admin?.status ?? 'active',
      userStatus: freshUser.status ?? 'active',
      holdReason,
      adminName: admin?.username ?? null,
      queuePosition: await getQueuePosition(freshUser.adminId.toString(), freshUser._id.toString()),
      runningUser: runningUserDoc?.username ?? null,
      estimatedWait: await estimateWait(freshUser.adminId.toString(), freshUser._id.toString()),
    });
  } catch (error) {
    const requestId = await reportIncident({
      error,
      source: 'esp32_poll',
      route: '/api/esp32/poll',
      platform: 'device',
      adminId: adminId ?? null,
      ip: req.headers.get('x-forwarded-for'),
      userAgent: req.headers.get('user-agent'),
      meta: {
        userId: userId ?? null,
        uid: uid ?? null,
      },
    });
    return NextResponse.json({ error: 'Internal server error', requestId }, { status: 500 });
  }
}

async function estimateWait(adminId: string, userId: string) {
  const entry = await Queue.findOne({
    adminId,
    userId,
    status: { $in: ['WAITING', 'RUNNING'] },
  })
    .select({ position: 1, status: 1 })
    .lean();
  if (!entry) return 0;
  if (entry.status === 'RUNNING') return 0;

  const runningQueue = await Queue.findOne({ adminId, status: 'RUNNING' })
    .select({ userId: 1, requestedMinutes: 1 })
    .lean();

  let wait = 0;
  if (runningQueue?.userId) {
    const runningUser = await User.findById(runningQueue.userId)
      .select({ motorRunningTime: 1 })
      .lean();
    wait += runningUser?.motorRunningTime ?? runningQueue.requestedMinutes ?? 0;
  }

  const waitingAhead = await Queue.find({
    adminId,
    status: 'WAITING',
    position: { $lt: entry.position },
  })
    .select({ requestedMinutes: 1 })
    .lean();

  wait += waitingAhead.reduce((sum, item) => sum + (item.requestedMinutes ?? 0), 0);
  return wait;
}

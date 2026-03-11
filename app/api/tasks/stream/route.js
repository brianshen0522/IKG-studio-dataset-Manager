import { getUserFromRequest } from '@/lib/auth';
import { isAdminOrDM } from '@/lib/permissions';
import { getAllTasks } from '@/lib/db-tasks';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const POLL_MS = 2000;
const HEARTBEAT_MS = 15000;

function fmt(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(req) {
  const actor = await getUserFromRequest(req);
  if (!actor || !isAdminOrDM(actor)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403, headers: { 'Content-Type': 'application/json' }
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let last = '';

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(poll);
        clearInterval(hb);
        try { controller.close(); } catch {}
      };

      const push = async () => {
        if (closed) return;
        try {
          const tasks = await getAllTasks();
          const payload = JSON.stringify({ tasks });
          if (payload !== last) {
            last = payload;
            controller.enqueue(encoder.encode(fmt('tasks', { tasks })));
          }
        } catch (err) {
          controller.enqueue(encoder.encode(fmt('error', { message: err.message })));
        }
      };

      controller.enqueue(encoder.encode('retry: 3000\n\n'));
      await push();

      const poll = setInterval(push, POLL_MS);
      const hb = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode(': heartbeat\n\n'));
      }, HEARTBEAT_MS);

      req.signal.addEventListener('abort', close);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    }
  });
}

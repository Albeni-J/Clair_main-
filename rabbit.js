import amqp from "amqplib";

let conn;
let channel;

export async function initRabbit() {
  if (channel) return channel;

  const url = process.env.RABBIT_URL;
  conn = await amqp.connect(url);

  conn.on("error", (err) => console.error("Rabbit error:", err));
  conn.on("close", () => {
    console.error("Rabbit connection closed. Exit to restart.");
    process.exit(1);
  });

  channel = await conn.createChannel();

  const queue = process.env.RABBIT_QUEUE || "appeals_queue";
  await channel.assertQueue(queue, { durable: true });

  console.log("✅ RabbitMQ connected, queue:", queue);
  return channel;
}

export async function publishToQueue(messageObj) {
  const ch = await initRabbit();
  const queue = process.env.RABBIT_QUEUE || "appeals_queue";

  const payload = Buffer.from(JSON.stringify(messageObj));
  const ok = ch.sendToQueue(queue, payload, { persistent: true });

  if (!ok) console.warn("RabbitMQ backpressure: sendToQueue returned false");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function consumeQueue(onMessage) {
  const ch = await initRabbit();
  const queue = process.env.RABBIT_QUEUE || "appeals_queue";

  // чтобы worker не брал сразу много сообщений
  await ch.prefetch(1);

  // ---- RATE LIMIT: 5 в минуту ----
  const MAX_PER_MINUTE = 5;
  const INTERVAL_MS = Math.ceil(60_000 / MAX_PER_MINUTE); // 12000
  let lastStart = 0;
  // --------------------------------

  ch.consume(queue, async (msg) => {
    if (!msg) return;

    try {
      // ✅ тормозим ПЕРЕД обработкой (между стартами)
      const now = Date.now();
      const wait = lastStart ? Math.max(0, INTERVAL_MS - (now - lastStart)) : 0;
      if (wait > 0) await sleep(wait);
      lastStart = Date.now();

      const body = JSON.parse(msg.content.toString());
      await onMessage(body);

      ch.ack(msg);
    } catch (e) {
      console.error("❌ Worker error:", e.message);
      // чтобы не зациклить бесконечно:
      ch.nack(msg, false, false);
    }
  });

  console.log("👂 Worker listening queue:", queue, `| rate: ${MAX_PER_MINUTE}/min`);
}
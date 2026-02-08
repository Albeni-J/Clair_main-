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

export async function consumeQueue(onMessage) {
  const ch = await initRabbit();
  const queue = process.env.RABBIT_QUEUE || "appeals_queue";

  await ch.prefetch(1);

  ch.consume(queue, async (msg) => {
    if (!msg) return;

    try {
      const body = JSON.parse(msg.content.toString());
      await onMessage(body);
      ch.ack(msg);
    } catch (e) {
      console.error("❌ Worker error:", e.message);
      // чтобы не зациклить бесконечно:
      ch.nack(msg, false, false);
    }
  });

  console.log("👂 Worker listening queue:", queue);
}

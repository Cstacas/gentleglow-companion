import { InteractionType, InteractionResponseType, verifyKey } from 'discord-interactions';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  const signature = req.headers['x-signature-ed25519'];
  const timestamp = req.headers['x-signature-timestamp'];

  // Read raw body
  const rawBody = await new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
  });

  // Verify signature
  const isValid = verifyKey(rawBody, signature, timestamp, process.env.DISCORD_PUBLIC_KEY);

  if (!isValid) {
    return res.status(401).send('Invalid signature');
  }

  const interaction = JSON.parse(rawBody);

  // Respond to PING
  if (interaction.type === InteractionType.PING) {
    return res.status(200).json({
      type: InteractionResponseType.PONG,
    });
  }

  // Respond to commands
  return res.status(200).json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: 'Hello from Vercel!',
    },
  });
}

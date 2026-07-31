import { InteractionType, InteractionResponseType, verifyKey } from 'discord-interactions';

export const config = {
  api: {
    bodyParser: false, // REQUIRED for Discord
  },
};

export default async function handler(req, res) {
  const rawBody = await getRawBody(req);

  const signature = req.headers['x-signature-ed25519'];
  const timestamp = req.headers['x-signature-timestamp'];

  const isValid = verifyKey(rawBody, signature, timestamp, process.env.DISCORD_PUBLIC_KEY);

  if (!isValid) {
    return res.status(401).send('Invalid request signature');
  }

  const interaction = JSON.parse(rawBody);

  // Discord PING
  if (interaction.type === InteractionType.PING) {
    return res.status(200).json({ type: InteractionResponseType.PONG });
  }

  // Slash commands
  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    const name = interaction.data.name;

    if (name === 'pet') {
      return res.status(200).json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: 'GentleGlow is here 💖' },
      });
    }

    if (name === 'plant') {
      return res.status(200).json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: 'Your plant is happy 🌱' },
      });
    }
  }

  return res.status(200).json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content: 'Unhandled interaction.' },
  });
}

function getRawBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
  });
}

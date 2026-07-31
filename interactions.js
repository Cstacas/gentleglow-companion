import { InteractionType, InteractionResponseType, verifyKey } from 'discord-interactions';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  // Discord signature headers
  const signature = req.headers['x-signature-ed25519'];
  const timestamp = req.headers['x-signature-timestamp'];

  // Raw body is needed for signature verification
  const rawBody = JSON.stringify(req.body);

  // Verify the request came from Discord
  const isValid = verifyKey(
    rawBody,
    signature,
    timestamp,
    process.env.DISCORD_PUBLIC_KEY
  );

  if (!isValid) {
    return res.status(401).send('Invalid request signature');
  }

  const interaction = req.body;

  // 1️⃣ Respond to Discord's PING (verification)
  if (interaction.type === InteractionType.PING) {
    return res.status(200).json({
      type: InteractionResponseType.PONG
    });
  }

  // 2️⃣ Respond to slash commands
  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    const commandName = interaction.data.name;

    if (commandName === 'pet') {
      return res.status(200).json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: 'GentleGlow is here 💖'
        }
      });
    }

    if (commandName === 'plant') {
      return res.status(200).json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: 'Your plant is happy 🌱'
        }
      });
    }
  }

  // Default fallback
  return res.status(200).json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: 'Unhandled interaction.'
    }
  });
}

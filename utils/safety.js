import { EmbedBuilder } from 'discord.js';

// High-risk phrase scanning triggers (focusing on expressions of crisis and self-harm)
const HIGH_RISK_PATTERNS = [
  /\b(kill myself|suicide|suicidal|end my life|want to die|better off dead|ending it all|cut myself|self-harm|harming myself)\b/i,
  /\b(want to end it all|don't want to live anymore|wish I was dead|ending my life)\b/i
];

export function scanMessageForHighRisk(content) {
  for (const pattern of HIGH_RISK_PATTERNS) {
    if (pattern.test(content)) {
      // Find the matched string
      const match = content.match(pattern);
      return { isHighRisk: true, matchedWord: match ? match[0] : 'crisis keyword' };
    }
  }
  return { isHighRisk: false, matchedWord: null };
}

// Generate the Moderator alert details
export function buildModAlertEmbed(user, channel, content, matchedWord) {
  return new EmbedBuilder()
    .setTitle('⚠️ High-Risk Crisis Flag Triggered')
    .setDescription(`A message containing a potential self-harm or crisis indicator was detected.`)
    .setColor('#d9534f') // Red alert color
    .addFields(
      { name: 'User', value: `<@${user.id}> (${user.tag})`, inline: true },
      { name: 'User ID', value: `\`${user.id}\``, inline: true },
      { name: 'Channel', value: `<#${channel.id}>`, inline: true },
      { name: 'Matched Pattern', value: `\`${matchedWord}\``, inline: false },
      { name: 'Flagged Content', value: `*"${content.substring(0, 1000)}"*`, inline: false }
    )
    .addFields({
      name: '📋 Moderator Supportive Action Checklist',
      value: 
        `1. **Assess Immediately**: Review the user's recent messages in <#${channel.id}> for context.\n` +
        `2. **Reach Out Privately**: Send a gentle, supportive direct message (DM). Avoid accusatory language.\n` +
        `3. **Do NOT Publicly Warn/Mute**: Do not issue warning labels, public timeouts, or public bot call-outs to avoid alienating the user.\n` +
        `4. **Provide Verified Resources**: Offer the 988 lifeline and other private resources.\n` +
        `5. **Escalate to Leadership/Emergency Services**: If the threat is immediate and details (like location) are known, follow server protocols for emergency contacts.`
    })
    .setTimestamp();
}

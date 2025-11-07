import { Client, GatewayIntentBits, Partials, Events } from 'discord.js';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';

dotenv.config();

// ====================
// Express (Render用 Keep Alive)
// ====================
const app = express();
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(process.env.PORT || 3000, () => console.log('🌐 Webサーバー起動完了'));

// ====================
// Discord クライアント設定
// ====================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

// ====================
// 設定ファイルの読み込み
// ====================
const CONFIG_PATH = './config.json';
let config = { channelId: null, roleId: null, introNotifyChannelId: null };

if (fs.existsSync(CONFIG_PATH)) {
  try {
    const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
    if (data.trim()) {
      config = JSON.parse(data);
    } else {
      console.warn('⚠️ config.json が空だったため、デフォルト値を使用します。');
    }
  } catch (err) {
    console.error('⚠️ config.json の読み込みに失敗しました:', err);
  }
} else {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  console.log('🆕 config.json を新規作成しました。');
}

// ====================
// 起動時イベント
// ====================
client.once(Events.ClientReady, () => {
  console.log(`✅ ログイン完了: ${client.user.tag}`);
});

// ====================
// メッセージ監視処理
// ====================
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (config.channelId && message.channel.id !== config.channelId) return;

  const introRegex = /\[名前\].+\n\[VRCの名前\].+\n\[年齢\].+\n\[性別\].+\n\[趣味\].+\n\[一言\].+/s;

  // 自己紹介が不完全な場合
  if (!introRegex.test(message.content)) {
    await message.reply(
      '⚠️ 自己紹介の形式が正しくありません。\n以下のテンプレートに沿って記入してください：\n\n' +
      '[名前]\n[VRCの名前]\n[年齢]\n[性別]\n[趣味]\n[一言]'
    );
    console.log(`🚫 自己紹介テンプレート不一致: ${message.author.tag}`);
    return;
  }

  console.log(`📥 自己紹介検知: ${message.author.tag}`);

  // ロール付与（重複チェックあり）
  if (config.roleId) {
    try {
      const role = await message.guild.roles.fetch(config.roleId);
      const member = await message.guild.members.fetch(message.author.id);
      if (!member.roles.cache.has(role.id)) {
        await member.roles.add(role);
        console.log(`🎉 ロール付与完了: ${config.roleId}`);
      } else {
        console.log(`ℹ️ すでにロールを所持: ${message.author.tag}`);
      }
    } catch (error) {
      console.error('❌ ロール付与失敗:', error);
    }
  }

  // 通知チャンネルにのみEmbed送信（本人には返信しない）
  if (config.introNotifyChannelId) {
    try {
      const notifyChannel = await client.channels.fetch(config.introNotifyChannelId);
      if (notifyChannel && notifyChannel.isTextBased()) {
        await notifyChannel.send({
          embeds: [{
            title: '📝 新しい自己紹介が投稿されました！',
            description: message.content,
            color: 0x00bfff,
            footer: { text: `ユーザー: ${message.author.tag}` },
            timestamp: new Date().toISOString()
          }]
        });
        console.log(`📨 通知チャンネル送信完了: ${config.introNotifyChannelId}`);
      }
    } catch (err) {
      console.error('❌ 通知チャンネル送信失敗:', err);
    }
  }
});

// ====================
// Bot起動
// ====================
if (!process.env.DISCORD_TOKEN) {
  console.error('❌ DISCORD_TOKEN が .env に設定されていません！');
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN).catch(error => {
  console.error('❌ ログイン失敗:', error);
  process.exit(1);
});
// main.mjs
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
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel]
});

// ====================
// 設定ファイルの読み込み
// ====================
const CONFIG_PATH = './config.json';
let config = { channelId: null, roleId: null };

if (fs.existsSync(CONFIG_PATH)) {
  try {
    const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
    if (data.trim()) {
      config = JSON.parse(data);
    } else {
      console.warn('⚠️ config.json が空だったため、デフォルト値を使用します。');
    }
  } catch (err) {
    console.error('⚠️ config.json の読み込みに失敗しました。初期化します:', err);
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
// メッセージ監視＆ロール付与
// ====================

client.on(Events.MessageCreate, async (message) => {
  // Bot自身は無視
  if (message.author.bot) return;

  // チャンネル指定がある場合は限定
  if (config.channelId && message.channel.id !== config.channelId) return;

  // 自己紹介テンプレートの正規表現チェック
  const introRegex = /\[名前\].+\n\[VRCの名前\].+\n\[年齢\].+\n\[性別\].+\n\[趣味\].+\n\[一言\].+/s;

  if (introRegex.test(message.content)) {
    // roleId が設定されていればロール付与
    if (config.roleId) {
      try {
        const role = await message.guild.roles.fetch(config.roleId);
        const member = await message.guild.members.fetch(message.author.id);
        await member.roles.add(role);
        console.log(`🎉 ${message.author.tag} にロールを付与しました！`);
        await message.reply('✅ 自己紹介を確認しました！ロールを付与しました。');
      } catch (error) {
        console.error('ロール付与エラー:', error);
        message.reply('⚠️ ロール付与に失敗しました。Botの権限を確認してください。');
      }
    } else {
      message.reply('⚙️ roleId が設定されていません。管理者に連絡してください。');
    }
  }
});

// ====================
// Bot起動
// ====================
client.login(process.env.DISCORD_TOKEN);

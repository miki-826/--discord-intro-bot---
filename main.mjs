import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  REST,
  Routes,
  SlashCommandBuilder
} from 'discord.js';
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
let config = { roleId: null, introNotifyChannelId: null };

if (fs.existsSync(CONFIG_PATH)) {
  try {
    const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
    config = data.trim() ? JSON.parse(data) : config;
  } catch (err) {
    console.error('⚠️ config.json の読み込みに失敗しました:', err);
  }
} else {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  console.log('🆕 config.json を新規作成しました。');
}

// ====================
// スラッシュコマンド登録
// ====================
const commands = [
  new SlashCommandBuilder()
    .setName('introduce')
    .setDescription('自己紹介を送信します（改行なしでOK）')
    .addStringOption(opt =>
      opt.setName('内容')
         .setDescription('自己紹介テンプレートを1行で入力')
         .setRequired(true)
    )
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands })
  .then(() => console.log('✅ スラッシュコマンド登録完了'))
  .catch(err => console.error('❌ コマンド登録失敗:', err));

// ====================
// Bot起動時イベント
// ====================
client.once(Events.ClientReady, () => {
  console.log(`✅ ログイン完了: ${client.user.tag}`);
});

// ====================
// スラッシュコマンド処理
// ====================
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'introduce') return;

  await interaction.deferReply({ ephemeral: true });

  const raw = interaction.options.getString('内容').trim();

  // 正規化（不可視文字・多重スペース除去）
  const normalize = text =>
    text.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim();
  const cleaned = normalize(raw);

  // 正規表現で形式と中身を一括判定
  const introRegex = /\[名前\].+\[VRCの名前\].+\[年齢\].+\[性別\].+\[趣味\].+\[一言\].+/s;
  const isValidIntro = introRegex.test(cleaned);

  if (!isValidIntro) {
    await interaction.editReply({
      content:
        '⚠️ 自己紹介の形式が正しくありません。\n以下のラベルすべてに1文字以上の内容を記入してください：\n\n' +
        '[名前] ○○ [VRCの名前] ○○ [年齢] ○○ [性別] ○○ [趣味] ○○ [一言] ○○'
    });
    console.log(`🚫 自己紹介テンプレート不一致: ${interaction.user.tag}`);
    return;
  }

  // 整形（ラベルごとに改行を挿入）
  const labels = ['[名前]', '[VRCの名前]', '[年齢]', '[性別]', '[趣味]', '[一言]'];
  let formatted = cleaned;
  for (const label of labels) {
    const safeLabel = label.replace(/[\[\]]/g, '\\$&');
    const regex = new RegExp(`\\s*(${safeLabel})\\s*`, 'g');
    formatted = formatted.replace(regex, '\n$1 ');
  }
  formatted = formatted.trim();

  // 表示名の取得（ニックネーム優先）
  const username = interaction.member?.nickname || interaction.user.username;
  const introMessage = `📝 ${username} さんの自己紹介です：\n${formatted}`;

  // ✅ ロール付与（必要なら）
  if (config.roleId) {
    try {
      const role = await interaction.guild.roles.fetch(config.roleId);
      const member = await interaction.guild.members.fetch(interaction.user.id);
      if (!member.roles.cache.has(role.id)) {
        await member.roles.add(role);
        console.log(`🎉 ロール付与完了: ${interaction.user.tag}`);
      }
    } catch (err) {
      console.error('❌ ロール付与失敗:', err);
    }
  }

  // ✅ 通知チャンネルに送信（整形済み）
  if (config.introNotifyChannelId) {
    try {
      const notifyChannel = await client.channels.fetch(config.introNotifyChannelId);
      if (notifyChannel && notifyChannel.isTextBased()) {
        await notifyChannel.send({ content: introMessage });
        console.log(`📨 自己紹介を通知チャンネルに送信しました`);
      }
    } catch (err) {
      console.error('❌ 通知チャンネル送信失敗:', err);
    }
  }

  // ✅ 本人にだけ元の入力を表示（改行なし）
  await interaction.editReply({
    content: `✅ 自己紹介を受け付けました：\n${raw}`
  });
});

// ====================
// Botログイン
// ====================
if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
  console.error('❌ DISCORD_TOKEN または CLIENT_ID が .env に設定されていません！');
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN).catch(error => {
  console.error('❌ ログイン失敗:', error);
  process.exit(1);
});
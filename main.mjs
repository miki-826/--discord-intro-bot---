import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder
} from 'discord.js';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';

dotenv.config();

// ====================
// Express (Render用 Keep Alive)
// ====================
const app = express();
app.get('/', (_, res) => res.send('Bot is running!'));
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

try {
  if (fs.existsSync(CONFIG_PATH)) {
    const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
    config = data.trim() ? JSON.parse(data) : config;
  } else {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    console.log('🆕 config.json を新規作成しました。');
  }
} catch (err) {
  console.error('⚠️ config.json の読み込みに失敗しました:', err);
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
    ),
  new SlashCommandBuilder()
    .setName('setconfig')
    .setDescription('Botの設定を更新します（管理者専用）')
    .addStringOption(opt =>
      opt.setName('key')
         .setDescription('設定項目（roleId / introNotifyChannelId）')
         .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('value')
         .setDescription('新しい値（ID）')
         .setRequired(true)
    )
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
rest.put(
  Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
  { body: commands }
)
.then(() => console.log('✅ ギルドコマンド登録完了'))
.catch(err => console.error('❌ コマンド登録失敗:', err));

// ====================
// Bot起動時イベント
// ====================
client.once(Events.ClientReady, () => {
  console.log(`✅ ログイン完了: ${client.user.tag}`);
});

// ====================
// メッセージ削除機能
// ====================
client.on(Events.MessageCreate, async message => {
  if (message.author.bot) return;
  if (message.channel.id === config.introNotifyChannelId) {
    try {
      await message.delete();
      console.log(`🧹 メッセージ削除: ${message.author.tag}`);
    } catch (err) {
      console.error('❌ メッセージ削除失敗:', err);
    }
  }
});

// ====================
// スラッシュコマンド処理
// ====================
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  // /introduce
  if (commandName === 'introduce') {
    try {
      await interaction.deferReply({ ephemeral: true });
    } catch (err) {
      console.error('❌ deferReply 失敗:', err);
      return;
    }

    try {
      const raw = interaction.options.getString('内容')?.trim();
      const normalize = text =>
        text.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim();
      const cleaned = normalize(raw);

      const introRegex = /\[名前\].+\[VRCの名前\].+\[年齢\].+\[性別\].+\[趣味\].+\[一言\].+/s;
      if (!introRegex.test(cleaned)) {
        await interaction.editReply({
          content:
            '⚠️ 自己紹介の形式が正しくありません。\n以下のラベルすべてに1文字以上の内容を記入してください：\n\n' +
            '[名前] ○○ [VRCの名前] ○○ [年齢] ○○ [性別] ○○ [趣味] ○○ [一言] ○○'
        });
        return;
      }

      const labels = ['[名前]', '[VRCの名前]', '[年齢]', '[性別]', '[趣味]', '[一言]'];
      let formatted = cleaned;
      for (const label of labels) {
        const safeLabel = label.replace(/[\[\]]/g, '\\$&');
        const regex = new RegExp(`\\s*(${safeLabel})\\s*`, 'g');
        formatted = formatted.replace(regex, '\n$1 ');
      }

      const username = interaction.member?.nickname || interaction.user.username;
      const avatar = interaction.user.displayAvatarURL({ size: 256, dynamic: true });

      // 通知チャンネルに送信
      if (config.introNotifyChannelId) {
        try {
          const notifyChannel = await client.channels.fetch(config.introNotifyChannelId);
          if (notifyChannel?.isTextBased()) {
            const embed = new EmbedBuilder()
              .setAuthor({ name: `${username} さんの自己紹介`, iconURL: avatar })
              .setDescription(formatted.trim())
              .setColor(0x00bfff);

            await notifyChannel.send({ embeds: [embed] });
            console.log(`📨 自己紹介を通知チャンネルに送信しました`);
          }
        } catch (err) {
          console.error('❌ 通知チャンネル送信失敗:', err);
        }
      }

      // ロール付与
      if (config.roleId) {
        try {
          const role = await interaction.guild.roles.fetch(config.roleId);
          const member = await interaction.guild.members.fetch(interaction.user.id);
          if (role?.editable && !member.roles.cache.has(role.id)) {
            await member.roles.add(role);
            console.log(`🎉 ロール付与完了: ${interaction.user.tag}`);
          }
        } catch (err) {
          console.error('❌ ロール付与失敗:', err);
        }
      }

      await interaction.editReply({ content: `✅ 自己紹介を受け付けました：\n${raw}` });
    } catch (err) {
      console.error('❌ introduce 処理中エラー:', err);
      await interaction.editReply({ content: '⚠️ エラーが発生しました。もう一度お試しください。' });
    }
  }

  // /setconfig
  if (commandName === 'setconfig') {
    try {
      await interaction.deferReply({ ephemeral: true });
    } catch (err) {
      console.error('❌ deferReply 失敗:', err);
      return;
    }

    try {
      const key = interaction.options.getString('key');
      const value = interaction.options.getString('value');
      const allowedKeys = ['roleId', 'introNotifyChannelId'];

      if (!allowedKeys.includes(key)) {
        await interaction.editReply({
          content: `❌ 無効なキーです。使用可能: ${allowedKeys.join(', ')}`
        });
        return;
      }

      const member = await interaction.guild.members.fetch(interaction.user.id);
      if (!member.permissions.has('Administrator')) {
        await interaction.editReply({
          content: '❌ このコマンドは管理者のみ実行できます。'
        });
        return;
      }

      config[key] = value;
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
      await interaction.editReply({ content: `✅ ${key} を更新しました：${value}` });
      console.log(`🛠️ ${key} を ${interaction.user.tag} が更新しました`);
    } catch (err) {
      console.error('❌ setconfig 処理中エラー:', err);
      await interaction.editReply({ content: '⚠️ 設定の保存に失敗しました。' });
    }
  }
});

// ====================
// Botログイン
// ====================
if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID || !process.env.GUILD_ID) {
  console.error('❌ DISCORD_TOKEN / CLIENT_ID / GUILD_ID が .env に設定されていません！');
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN).catch(error => {
  console.error('❌ ログイン失敗:', error);
  process.exit(1);
});

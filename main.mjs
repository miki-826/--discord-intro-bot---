// main.mjs
import { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, PermissionsBitField } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs';
import express from 'express';

dotenv.config();

// 設定ファイル
const CONFIG_PATH = './config.json';
let config = { channelId: null, roleId: null };
if (fs.existsSync(CONFIG_PATH)) {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
}

// Discordクライアント作成
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// =====================
// Slashコマンド登録
// =====================
const commands = [
    new SlashCommandBuilder()
        .setName('setup')
        .setDescription('自己紹介の設定を行います（管理者専用）')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('自己紹介を投稿するチャンネル')
                .setRequired(true))
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('自己紹介完了時に付与するロール')
                .setRequired(true))
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

// コマンド登録
(async () => {
    try {
        console.log('⏳ Slashコマンド登録中...');
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
        console.log('✅ Slashコマンド登録完了！');
    } catch (error) {
        console.error('❌ Slashコマンド登録エラー:', error);
    }
})();

// =====================
// 起動時
// =====================
client.once('ready', () => {
    console.log(`🎉 ${client.user.tag} が起動しました！`);
});

// =====================
// コマンド処理
// =====================
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === 'setup') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({ content: '❌ このコマンドは管理者のみ使用できます。', ephemeral: true });
        }

        const channel = interaction.options.getChannel('channel');
        const role = interaction.options.getRole('role');

        config.channelId = channel.id;
        config.roleId = role.id;
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

        await interaction.reply({
            content: `✅ 設定完了しました！\n自己紹介チャンネル: ${channel}\n付与ロール: ${role}`,
            ephemeral: false
        });
    }
});

// =====================
// メッセージ監視
// =====================
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!config.channelId || !config.roleId) return; // 設定されていない場合は無視
    if (message.channel.id !== config.channelId) return;

    const pattern = /\[名前\].+?\[VRCの名前\].+?\[年齢\].+?\[性別\].+?\[趣味\].+?\[一言\].+/s;

    if (pattern.test(message.content)) {
        const role = message.guild.roles.cache.get(config.roleId);
        if (role) {
            await message.member.roles.add(role);
            await message.reply(`✅ フォーマット確認OK！ ${role.name} ロールを付与しました！`);
        } else {
            await message.reply('⚠️ ロールが見つかりません。管理者に確認してください。');
        }
    } else {
        await message.reply(
            '⚠️ 自己紹介の形式が正しくありません！\n以下の形式で書いてください：\n```\n' +
            '[名前] 〇〇\n[VRCの名前] 〇〇\n[年齢] 〇〇\n[性別] 〇〇\n[趣味] 〇〇\n[一言] 〇〇\n```'
        );
    }
});

// =====================
// エラーハンドリング
// =====================
client.on('error', console.error);

// =====================
// Express サーバー（Render対応）
// =====================
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => {
    res.json({ status: 'Bot is running 🤖', config });
});
app.listen(port, () => console.log(`🌐 Webサーバー起動（Port ${port}）`));

// =====================
// Discord ログイン
// =====================
client.login(process.env.DISCORD_TOKEN);

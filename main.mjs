client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'introduce') return;

  const content = interaction.options.getString('内容');
  const introRegex = /\[名前\].+\n\[VRCの名前\].+\n\[年齢\].+\n\[性別\].+\n\[趣味\].+\n\[一言\].+/s;

  // ❌ 自己紹介がテンプレートに沿っていない場合 → 本人のみに警告
  if (!introRegex.test(content)) {
    await interaction.reply({
      content:
        '⚠️ 自己紹介の形式が正しくありません。\n以下のテンプレートに沿って記入してください：\n\n' +
        '[名前]\n[VRCの名前]\n[年齢]\n[性別]\n[趣味]\n[一言]',
      ephemeral: true
    });
    console.log(`🚫 自己紹介テンプレート不一致: ${interaction.user.tag}`);
    return;
  }

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

  // ✅ 通知チャンネルに自己紹介本文だけ送信
  if (config.introNotifyChannelId) {
    try {
      const notifyChannel = await client.channels.fetch(config.introNotifyChannelId);
      if (notifyChannel && notifyChannel.isTextBased()) {
        await notifyChannel.send(content);
        console.log(`📨 自己紹介本文を通知チャンネルに送信しました`);
      }
    } catch (err) {
      console.error('❌ 通知チャンネル送信失敗:', err);
    }
  }

  // ✅ 本人にだけ成功メッセージ
  await interaction.reply({
    content: '✅ 自己紹介を受け付けました！',
    ephemeral: true
  });
});
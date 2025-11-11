import { supabase } from './supabaseClient.js';

export async function getConfig(guildId) {
  const { data, error } = await supabase
    .from('guild_config')
    .select('*')
    .eq('guild_id', guildId)
    .single();

  if (error) {
    console.error('❌ Supabaseから設定取得失敗:', error);
    return { roleId: null, introNotifyChannelId: null };
  }

  return {
    roleId: data?.role_id ?? null,
    introNotifyChannelId: data?.intro_notify_channel ?? null
  };
}

export async function setConfig(guildId, key, value) {
  const columnMap = {
    roleId: 'role_id',
    introNotifyChannelId: 'intro_notify_channel'
  };

  const column = columnMap[key];
  if (!column) return false;

  const { error } = await supabase
    .from('guild_config')
    .upsert({ guild_id: guildId, [column]: value });

  if (error) {
    console.error('❌ Supabase設定保存失敗:', error);
    return false;
  }

  return true;
}
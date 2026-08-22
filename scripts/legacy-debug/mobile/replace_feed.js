const fs = require('fs');
const file = 'src/screens/ToolsHubScreen.tsx';
let content = fs.readFileSync(file, 'utf8');

const startStr = "{communityMessages.map((msg) => (";
const endStr = "))}";

const startIdx = content.indexOf(startStr);
const endIdx = content.indexOf(endStr, startIdx);

if (startIdx !== -1 && endIdx !== -1) {
    const replacement = `{communityMessages.map((msg) => (
                    <TouchableOpacity 
                        activeOpacity={0.8}
                        key={msg.id} 
                        style={{ flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.glassBorder, backgroundColor: 'transparent' }}
                    >
                        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isDark ? '#1D9BF0' : '#0F1419', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                            {msg.avatar && msg.avatar.startsWith('http') ? (
                                <Image source={{ uri: msg.avatar }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                            ) : (
                                <Text style={{ color: '#FFF', fontWeight: 'bold' }}>{msg.avatar || msg.user?.substring(0, 2).toUpperCase().replace('@', '') || 'U'}</Text>
                            )}
                        </View>
                        
                        <View style={{ flex: 1, paddingRight: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{msg.user}</Text>
                                <View style={{ marginLeft: 4 }}>
                                    <Check color="#1D9BF0" size={14} />
                                </View>
                                <Text style={{ color: colors.textMuted, fontSize: 14, marginLeft: 6 }}>@{msg.user?.replace('@', '').replace(/\\s+/g, '').toLowerCase()}</Text>
                                <Text style={{ color: colors.textMuted, fontSize: 14, marginLeft: 4 }}>·</Text>
                                <Text style={{ color: colors.textMuted, fontSize: 14, marginLeft: 4 }}>{msg.time}</Text>
                                
                                <View style={{ flex: 1 }} />
                                <MoreVertical color={colors.textMuted} size={16} />
                            </View>
                            
                            {msg.replyTo && (
                                <View style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', borderLeftWidth: 3, borderLeftColor: '#1D9BF0', padding: 8, borderRadius: 8, marginBottom: 8, marginTop: 4 }}>
                                    <Text style={{ color: '#1D9BF0', fontSize: 12, fontWeight: 'bold', marginBottom: 2 }}>Replying to @{msg.replyTo.username?.replace(/\\s+/g, '').toLowerCase()}</Text>
                                    <Text style={{ color: colors.textMuted, fontSize: 13 }} numberOfLines={2}>{msg.replyTo.text || 'Photo'}</Text>
                                </View>
                            )}

                            {msg.text && msg.text.startsWith('🎙️') && msg.mediaUrl ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, paddingVertical: 8, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', borderRadius: 16, paddingHorizontal: 12 }}>
                                    <TouchableOpacity onPress={() => playVoice(msg.id, msg.mediaUrl)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#1D9BF0', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                                        {playingVoiceId === msg.id ? <Pause color="#FFF" size={16} /> : <Play color="#FFF" size={16} />}
                                    </TouchableOpacity>
                                    <View style={{ flex: 1 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', height: 24, gap: 2 }}>
                                            {Array.from({ length: 28 }).map((_, i) => {
                                                const h = Math.random() * 16 + 4;
                                                const filled = playingVoiceId === msg.id && (i / 28) <= voiceProgress;
                                                return <View key={i} style={{ width: 2.5, height: h, borderRadius: 1.5, backgroundColor: filled ? '#1D9BF0' : colors.glassBorder }} />;
                                            })}
                                        </View>
                                        <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 2 }}>{msg.text.replace('🎙️ ', '')}</Text>
                                    </View>
                                </View>
                            ) : (
                                <>
                                    {msg.text ? <Text style={{ color: colors.text, fontSize: 15, lineHeight: 20 }}>{msg.text}</Text> : null}
                                    {msg.mediaUrl && !msg.mediaUrl.startsWith('data:audio') && (
                                        <Image source={{ uri: msg.mediaUrl }} style={{ width: '100%', height: 250, borderRadius: 16, marginTop: 12, borderWidth: 1, borderColor: colors.glassBorder }} resizeMode="cover" />
                                    )}
                                </>
                            )}

                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 40, marginTop: 14 }}>
                                <TouchableOpacity onPress={() => setReplyingTo(msg)} style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <MessageCircle color={colors.textMuted} size={18} />
                                    <Text style={{ color: colors.textMuted, marginLeft: 6, fontSize: 13 }}>{Math.floor(Math.random() * 20) + 1}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Activity color={colors.textMuted} size={18} style={{ transform: [{ rotate: '90deg' }] }} />
                                    <Text style={{ color: colors.textMuted, marginLeft: 6, fontSize: 13 }}>{Math.floor(Math.random() * 10)}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => handleLikeMessage(msg.id)} style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Heart color={msg.likedBy?.includes('my_user_id') ? '#F91880' : colors.textMuted} size={18} />
                                    <Text style={{ color: msg.likedBy?.includes('my_user_id') ? '#F91880' : colors.textMuted, marginLeft: 6, fontSize: 13 }}>{msg.likes}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <BarChart3 color={colors.textMuted} size={18} />
                                    <Text style={{ color: colors.textMuted, marginLeft: 6, fontSize: 13 }}>{Math.floor(Math.random() * 500) + 100}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Share color={colors.textMuted} size={18} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </TouchableOpacity>`;
    
    content = content.substring(0, startIdx) + replacement + content.substring(endIdx);
    fs.writeFileSync(file, content);
    console.log("Successfully replaced feed");
} else {
    console.log("Could not find start or end block");
}

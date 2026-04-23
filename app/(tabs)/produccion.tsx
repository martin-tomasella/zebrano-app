// app/(tabs)/produccion.tsx
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { db } from '@/lib/supabase';
import { colors, spacing, radius } from '@/lib/theme';

export default function ProduccionScreen() {
  const router = useRouter();
  const { data, refetch, isRefetching } = useQuery({
    queryKey: ['ot-activas'],
    queryFn: () => db.ot.activas().then(r => r.data ?? []),
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgDeep }}>
      <FlatList
        data={data ?? []}
        keyExtractor={i => i.numero_ot}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.gold} />}
        ListHeaderComponent={<Text style={{ fontSize: 22, fontFamily: 'Syne_600SemiBold', color: colors.text1, marginBottom: spacing.md }}>Producción</Text>}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Text style={{ fontSize: 32, marginBottom: 12 }}>⬡</Text>
            <Text style={{ color: colors.text1, fontSize: 16, fontFamily: 'Syne_600SemiBold' }}>Sin OT activas</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={{ backgroundColor: colors.bgCard, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border }}
            onPress={() => router.push(`/ot/${item.numero_ot}`)}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ fontSize: 10, color: colors.text3, fontFamily: 'DMSans_400Regular' }}>{item.numero_ot}</Text>
              <Text style={{ fontSize: 13, color: colors.green, fontFamily: 'Syne_600SemiBold' }}>{item.avance_pct}%</Text>
            </View>
            <Text style={{ fontSize: 15, fontFamily: 'Syne_600SemiBold', color: colors.text1 }}>{item.modulo_nombre}</Text>
            <Text style={{ fontSize: 12, color: colors.text3, marginTop: 2, marginBottom: 8 }}>{item.cliente_nombre}</Text>
            <View style={{ height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden' }}>
              <View style={{ height: '100%', width: `${item.avance_pct}%`, backgroundColor: colors.green, borderRadius: 2 }} />
            </View>
            <Text style={{ fontSize: 11, color: colors.text3, marginTop: 6, fontFamily: 'DMSans_400Regular' }}>
              ⏱ {item.horas_reales}/{item.horas_estimadas} hs  ·  📅 {item.fecha_entrega_estimada ?? '—'}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
